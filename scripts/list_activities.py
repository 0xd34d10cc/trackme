import sys
import os
import csv
import json

def main():
    path = sys.argv[1]
    activities = set()
    for filename in os.listdir(path):
        if not filename.endswith('.csv'):
            continue
        with open(os.path.join(path, filename), 'rt', encoding='utf-8') as f:
            for entry in csv.reader(f):
                exe = entry[3]
                activities.add(exe)

    with open('activities.json', 'wt', encoding='utf-8') as f:
        json.dump(list(activities), f)

if __name__ == '__main__':
    main()