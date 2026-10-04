#!/usr/bin/env python3
"""One-off conversion of the old SQLite store to DuckDB.

Drives the `duckdb` binary -- no Python packages needed. DuckDB's sqlite_scanner
reads the source directly, so the copy is one vectorized statement rather than a
row-by-row trip through Python. (Doing it with duckdb's Python bindings and
executemany is dramatically slower: each statement autocommits, so a per-row
fsync turns 3M rows into 3M commits.)

Run it with trackme stopped: DuckDB takes an exclusive lock on its own file, and
reading SQLite while the tracker is writing would give a torn view.

    python scripts/migrate_to_duckdb.py %USERPROFILE%\\trackme\\data.db %USERPROFILE%\\trackme\\data.duckdb

Run it again for the debug store (\\trackme\\debug\\data.db -> data.duckdb).

The source is attached read-only and is never modified. The destination is
refused if it already exists unless --force is passed.
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# "begin" and "end" are keywords in DuckDB, so the SQLite side must be quoted.
CONVERT_SQL = """
INSTALL sqlite;
LOAD sqlite;
ATTACH '{source}' AS src (TYPE sqlite, READ_ONLY);
CREATE TABLE activities (
    begin_ms bigint,
    end_ms bigint,
    pid bigint,
    exe varchar,
    title varchar
);
INSERT INTO activities
    SELECT "begin", "end", pid, exe, title FROM src.activities ORDER BY "begin";
CHECKPOINT;
"""

# Source and destination in a single row, so the result is one CSV record.
VERIFY_SQL = """
LOAD sqlite;
ATTACH '{source}' AS src (TYPE sqlite, READ_ONLY);
SELECT
    (SELECT count(*) FROM src.activities),
    (SELECT count(*) FROM activities),
    (SELECT sum("end" - "begin") FROM src.activities),
    (SELECT sum(end_ms - begin_ms) FROM activities),
    (SELECT count(DISTINCT exe) FROM src.activities),
    (SELECT count(DISTINCT exe) FROM activities),
    (SELECT min("begin") FROM src.activities),
    (SELECT min(begin_ms) FROM activities),
    (SELECT max("begin") FROM src.activities),
    (SELECT max(begin_ms) FROM activities);
"""

NULLS_SQL = """
SELECT count(*) FROM activities
WHERE begin_ms IS NULL OR end_ms IS NULL OR pid IS NULL
   OR exe IS NULL OR title IS NULL;
"""

# Windows installs duckdb.exe under a versioned WinGet package directory.
WINGET_GLOB = "Microsoft/WinGet/Packages/DuckDB.cli_*/duckdb.exe"


def find_duckdb(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit)
    if os.environ.get("DUCKDB"):
        return Path(os.environ["DUCKDB"])
    found = shutil.which("duckdb")
    if found:
        return Path(found)
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        candidates = sorted(Path(local_app_data).glob(WINGET_GLOB))
        if candidates:
            return candidates[-1]
    raise SystemExit("error: no duckdb binary found; pass --duckdb PATH or set %DUCKDB%")


def run_sql(duckdb: Path, database: Path, sql: str, csv: bool = False) -> str:
    args = [str(duckdb)]
    if csv:
        args.append("-csv")
    args.append(str(database))
    result = subprocess.run(
        args, input=sql, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(f"error: duckdb exited with code {result.returncode}")
    return result.stdout


def query_row(duckdb: Path, database: Path, sql: str, width: int) -> list[int]:
    """Run a query and return the last CSV line that has exactly `width` fields."""
    for line in reversed(run_sql(duckdb, database, sql, csv=True).splitlines()):
        parts = line.split(",")
        if len(parts) == width and all(p.lstrip("-").isdigit() for p in parts):
            return [int(p) for p in parts]
    raise SystemExit("error: could not parse a result row out of duckdb output")


def human(size: int) -> str:
    return f"{size:,} B ({size / 1024 / 1024:.1f} MiB)"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="existing SQLite database")
    parser.add_argument("destination", type=Path, help="DuckDB database to create")
    parser.add_argument("--duckdb", help="path to the duckdb executable")
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite an existing destination and skip the app-still-running check",
    )
    args = parser.parse_args()

    source, destination = args.source, args.destination
    if not source.is_file():
        print(f"error: source does not exist: {source}", file=sys.stderr)
        return 1
    if not destination.parent.is_dir():
        print(f"error: destination directory does not exist: {destination.parent}", file=sys.stderr)
        return 1

    # A source touched seconds ago means the tracker is probably live, which
    # would give an inconsistent snapshot.
    idle_seconds = time.time() - source.stat().st_mtime
    if idle_seconds < 120 and not args.force:
        print(
            f"error: {source} was modified {idle_seconds:.0f}s ago - trackme looks like it is\n"
            "still running. Quit it (tray -> Exit) and retry, or pass --force.",
            file=sys.stderr,
        )
        return 1

    if destination.exists():
        if not args.force:
            print(f"error: {destination} already exists (pass --force to replace)", file=sys.stderr)
            return 1
        destination.unlink()
        Path(f"{destination}.wal").unlink(missing_ok=True)

    duckdb = find_duckdb(args.duckdb)
    # DuckDB string literals do not process backslashes, but forward slashes
    # keep the SQL unambiguous on Windows.
    attach = str(source).replace("\\", "/")

    print(f"duckdb:      {duckdb}")
    print(f"source:      {source} ({human(source.stat().st_size)})")
    print(f"destination: {destination}")

    started = time.perf_counter()
    run_sql(duckdb, destination, CONVERT_SQL.format(source=attach))
    print(f"converted in {time.perf_counter() - started:.1f}s")

    stats = query_row(duckdb, destination, VERIFY_SQL.format(source=attach), width=10)
    labels = ("rows", "total duration (ms)", "distinct exe", "min begin", "max begin")
    print("\nverification (source -> destination):")
    ok = True
    for label, src, dst in zip(labels, stats[0::2], stats[1::2]):
        match = src == dst
        ok &= match
        print(f"  {label:<20} {src:>16} -> {dst:>16}  {'ok' if match else 'MISMATCH'}")

    nulls = query_row(duckdb, destination, NULLS_SQL, width=1)[0]
    if nulls:
        print(f"  warning: {nulls} row(s) have NULL columns; the app cannot read those")
        ok = False

    print(f"\nsize: {human(source.stat().st_size)} -> {human(destination.stat().st_size)}")

    if not ok:
        print("\nFAILED: the two databases disagree; do not switch over.", file=sys.stderr)
        return 1

    print("\nMigration verified. Keep the original as a backup:")
    return 0


if __name__ == "__main__":
    sys.exit(main())
