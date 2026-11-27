#!/usr/bin/env python3
"""Builds a 28x16 Robo Runner level map from a compact JSON spec and prints a LevelDef entry.

Usage:
  python3 gen_level.py spec.json                       # print the TypeScript entry
  python3 gen_level.py spec.json --insert src/levels/levels.ts   # append it to LEVEL_DEFS

Spec (all columns/rows are 0-based; the grid is 28 columns x 16 rows):
{
  "name": "Glass Gardens",
  "theme": "glass",
  "floors": {                      # optional per-floor tweaks; floors are rows 3, 6, 9, 12
    "9":  {"stone": [[0, 7]], "hole": [[12, 20]]}      # inclusive column ranges
  },
  "ladders": [[6, 12], [22, 9]],   # [column, floorRow]: fills floorRow..floorRow+2 with 'H'
  "spans":   [[8, 12, 20, "-"]],   # [row, fromCol, toCol, char] for ropes '-' and zip-lines '>' '<'
  "ents": [                        # [column, row, char]
    [2, 14, "P"], [9, 14, "$"], [18, 14, "G"], [13, 8, "*"],
    [6, 11, "S"], [3, 2, "E"], [27, 2, "V"]
  ]
}

Floors default to solid ground ('#') on rows 3, 6, 9, 12 and the bottom row 15. The script refuses to
place an entity on a non-empty cell (except '*', gold on a rope, which replaces a '-').
"""
import json
import sys

COLS, ROWS = 28, 16
FLOORS = (3, 6, 9, 12)


def build(spec):
    g = [['.'] * COLS for _ in range(ROWS)]
    g[ROWS - 1] = ['#'] * COLS
    floor_spec = spec.get('floors', {})
    for r in FLOORS:
        row = ['#'] * COLS
        opts = floor_spec.get(str(r), {})
        for a, b in opts.get('stone', []):
            for x in range(a, b + 1):
                row[x] = '@'
        for a, b in opts.get('hole', []):
            for x in range(a, b + 1):
                row[x] = '.'
        g[r] = row
    for col, floor_row in spec.get('ladders', []):
        for r in (floor_row, floor_row + 1, floor_row + 2):
            g[r][col] = 'H'
    for r, a, b, ch in spec.get('spans', []):
        for x in range(a, b + 1):
            g[r][x] = ch
    for col, r, ch in spec.get('ents', []):
        cell = g[r][col]
        if not (cell == '.' or (ch == '*' and cell == '-')):
            raise SystemExit(f"cannot place '{ch}' at col {col}, row {r}: cell already holds '{cell}'")
        g[r][col] = ch
    rows = [''.join(r) for r in g]
    chars = ''.join(rows)
    for needed, label in (('P', 'hero start P'), ('E', 'exit E')):
        if chars.count(needed) != 1:
            raise SystemExit(f'level needs exactly one {label}')
    if '$' not in chars and '*' not in chars:
        raise SystemExit('level needs at least one gold coin ($ or *)')
    if 'G' not in chars:
        raise SystemExit('level needs at least one guard G')
    return rows


def render(spec, rows):
    out = ['  {', f"    name: '{spec['name']}',", f"    theme: '{spec['theme']}',", '    map: [']
    out += [f"      '{r}'," for r in rows]
    out += ['    ],', '  },']
    return '\n'.join(out)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    with open(sys.argv[1]) as f:
        spec = json.load(f)
    entry = render(spec, build(spec))
    if '--insert' in sys.argv:
        path = sys.argv[sys.argv.index('--insert') + 1]
        with open(path) as f:
            src = f.read().rstrip()
        if not src.endswith('];'):
            raise SystemExit(f'{path} does not end with "];"')
        with open(path, 'w') as f:
            f.write(src[:-2].rstrip('\n') + '\n' + entry + '\n];\n')
        print(f"appended '{spec['name']}' to {path}")
    else:
        print(entry)


if __name__ == '__main__':
    main()
