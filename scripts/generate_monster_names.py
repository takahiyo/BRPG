"""カテゴリ・特性・適正LVを照合してモンスター名と脅威度LVを抽選する。"""

import argparse
from dataclasses import dataclass
from pathlib import Path
import random
import re
import sys


CATEGORIES = frozenset("亜人 獣 鳥 爬虫 水棲 虫 植物 粘体 不死 精霊 妖精 竜 巨人 魔族 天族 造物 異形 神霊".split())
TRAITS = frozenset("肉体 筋骨 甲殻 鱗 毛皮 翼 蛇体 無形 霊体 知性 軍制 術者 幼体 成体 古代 炎 氷 雷 水 風 土 毒 闇 光".split())


@dataclass(frozen=True)
class Monster:
    id: str
    name: str
    level: int
    category: str
    traits: frozenset[str]


@dataclass(frozen=True)
class Title:
    id: str
    name: str
    delta: int
    categories: frozenset[str]
    required: frozenset[str]
    excluded: frozenset[str]
    minimum: int
    maximum: int


def tokens(value):
    return frozenset() if value == "-" else frozenset(value.split(","))


def table_rows(path, prefix, columns):
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if re.fullmatch(prefix + r"\d{4}", cells[0]):
            if len(cells) != columns:
                raise ValueError(f"列数が不正です: {path.name}:{number}")
            yield cells


def validate_unique(rows, label):
    if not rows:
        raise ValueError(f"{label}辞典が空です")
    for attr in ("id", "name"):
        values = [getattr(row, attr) for row in rows]
        if len(values) != len(set(values)):
            raise ValueError(f"{label}の{attr}が重複しています")


def load_dictionaries(directory):
    monsters = []
    for path in sorted(directory.glob("モンスター辞典_LV*.md")):
        for c in table_rows(path, "M", 5):
            monster = Monster(c[0], c[1], int(c[2]), c[3], tokens(c[4]))
            if not 1 <= monster.level <= 300 or monster.category not in CATEGORIES or monster.traits - TRAITS:
                raise ValueError(f"LV・分類・特性が不正です: {monster.id}")
            if monster.category == "粘体" and monster.traits & {"筋骨", "軍制"}:
                raise ValueError(f"粘体の特性が矛盾しています: {monster.id}")
            if monster.category == "竜" and "軍制" in monster.traits:
                raise ValueError(f"竜には軍階を付けない設計です: {monster.id}")
            if {"幼体", "成体"} <= monster.traits or "筋骨" in monster.traits and monster.traits & {"霊体", "無形"}:
                raise ValueError(f"身体特性が矛盾しています: {monster.id}")
            monsters.append(monster)
    titles = []
    for c in table_rows(directory / "モンスター称号辞典.md", "MT", 8):
        title = Title(c[0], c[1], int(c[2]), tokens(c[3]), tokens(c[4]), tokens(c[5]), int(c[6]), int(c[7]))
        if not 1 <= title.minimum <= title.maximum <= 300:
            raise ValueError(f"称号LV範囲が不正です: {title.id}")
        if title.categories - CATEGORIES - {"*"} or (title.required | title.excluded) - TRAITS:
            raise ValueError(f"称号の分類・特性が不正です: {title.id}")
        if title.required & title.excluded:
            raise ValueError(f"称号の必須・除外特性が矛盾しています: {title.id}")
        titles.append(title)
    validate_unique(monsters, "モンスター")
    validate_unique(titles, "称号")
    return monsters, titles


def compatible(monster, title):
    level = monster.level + title.delta
    return ("*" in title.categories or monster.category in title.categories) and title.required <= monster.traits and not title.excluded & monster.traits and 1 <= level <= 300 and title.minimum <= level <= title.maximum


def candidates(monsters, titles, minimum=1, maximum=300, include_base=True):
    result = []
    seen = set()
    for monster in monsters:
        choices = [(monster.name, monster.level, monster.id, "-")] if include_base else []
        choices.extend((title.name + monster.name, monster.level + title.delta, monster.id, title.id)
                       for title in titles if compatible(monster, title))
        for row in choices:
            if minimum <= row[1] <= maximum and row[0] not in seen:
                result.append(row)
                seen.add(row[0])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dictionary-dir", type=Path, default=Path(__file__).resolve().parents[1] / "docs" / "monsters")
    parser.add_argument("--monster", action="append", help="種族名の完全一致。複数指定可")
    parser.add_argument("--title", action="append", help="称号の完全一致。指定時は称号付きだけを抽選")
    parser.add_argument("--category", action="append", choices=sorted(CATEGORIES))
    parser.add_argument("--level", type=int, help="完成した脅威度LVの完全一致")
    parser.add_argument("--min-level", type=int, default=1)
    parser.add_argument("--max-level", type=int, default=300)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--base-only", action="store_true", help="称号を付けない基礎種だけ")
    modes.add_argument("--no-base", action="store_true", help="称号付きだけ")
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--with-ids", action="store_true", help="出典ID列も表示")
    args = parser.parse_args()
    minimum, maximum = args.min_level, args.max_level
    if args.level is not None:
        if (minimum, maximum) != (1, 300):
            parser.error("--levelと--min-level/--max-levelは同時指定できません")
        minimum = maximum = args.level
    if not 1 <= minimum <= maximum <= 300:
        parser.error("LVは1〜300の有効な範囲で指定してください")
    if args.base_only and args.title:
        parser.error("--base-onlyと--titleは同時指定できません")
    try:
        monsters, titles = load_dictionaries(args.dictionary_dir)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    for rows, names, label in [(monsters, args.monster, "モンスター"), (titles, args.title, "称号")]:
        if names:
            unknown = set(names) - {row.name for row in rows}
            if unknown:
                parser.error(f"未知の{label}: {', '.join(sorted(unknown))}")
            rows[:] = [row for row in rows if row.name in names]
    if args.category:
        monsters = [row for row in monsters if row.category in args.category]
    if args.base_only:
        titles = []
    pool = candidates(monsters, titles, minimum, maximum,
                      include_base=not (args.no_base or args.title))
    if not pool:
        parser.error("カテゴリ・特性・適正LVを満たす組合せがありません")
    if not 1 <= args.count <= len(pool):
        parser.error(f"countは1〜{len(pool)}で指定してください")
    selected = random.Random(args.seed).sample(pool, args.count)
    print("| モンスター名 | 脅威度LV |" + (" 基礎種ID | 称号ID |" if args.with_ids else ""))
    print("| --- | --- |" + (" --- | --- |" if args.with_ids else ""))
    for row in selected:
        cells = row if args.with_ids else row[:2]
        print("| " + " | ".join(str(cell).replace("|", "&#124;") for cell in cells) + " |")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
