import requests
from pathlib import Path


def main():
    executables = set()
    data = requests.get('https://discord.com/api/v8/applications/detectable').json()
    for entry in data:
        if 'executables' not in entry:
            continue

        for exe in entry['executables']:
            if exe['os'] == 'win32':
                executables.add(Path(exe['name']).name)

    executables = list(executables)
    with open('src/games.cpp', 'wt', encoding='utf8') as out:
        out.write('#include "games.hpp"\n')
        out.write('using namespace std::literals::string_view_literals;\n')
        out.write('const std::unordered_set<std::string_view> GAMES = {\n')
        for i in range(len(executables) - 1):
            out.write(f'  "{executables[i]}"sv,\n')
        out.write(f'  "{executables[-1]}"sv\n')
        out.write('};\n')


if __name__ == '__main__':
    main()