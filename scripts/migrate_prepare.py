import sys
import os
import csv
import datetime
import json

SAMPLE = '2022-10-31 09:34:16.7454559'
MAX_DATE_LEN = len(SAMPLE) - 1

def parse_time(time):
    time = time[:MAX_DATE_LEN].strip()
    dt = datetime.datetime.strptime(time, '%Y-%m-%d %H:%M:%S.%f')
    return int(dt.timestamp() * 1000)

def main():
    path = sys.argv[1]
    entries = []
    for filename in os.listdir(path):
        if not filename.endswith('.csv'):
            continue

        with open(os.path.join(path, filename), 'rt', encoding='utf-8') as f:
            for entry in csv.reader(f):
                start = parse_time(entry[0][:])
                end = parse_time(entry[1])
                pid = entry[2].strip()
                exe = entry[3].strip()
                title = ','.join(e for e in entry[4:]).strip()
                entries.append([start, end, pid, exe, title])

    with open('entries.json', 'wt', encoding='utf-8') as f:
        json.dump(entries, f, indent=4)


if __name__ == '__main__':
    main()
