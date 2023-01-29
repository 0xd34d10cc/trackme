import sys
import json
import sqlite3

def main():
    db = sys.argv[1]
    data = sys.argv[2]
    start = 0 if len(sys.argv) <= 3 else int(sys.argv[3])

    with open(data, 'rt', encoding='utf-8') as f:
        entries = json.load(f)

    connection = sqlite3.connect(db)
    for i, entry in enumerate(entries):
        if i < start:
            continue

        print(i)
        try:
            connection.execute(
                'insert into activities values (?, ?, ?, ?, ?)',
                entry
            )
            connection.commit()
        except Exception as e:
            print(f'Failed at {i}: {e}')
            return

if __name__ == '__main__':
    main()