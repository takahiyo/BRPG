"""Markdown辞典のカテゴリ条件を満たすアイテム名を重複なしで抽選する。"""

import argparse
from dataclasses import dataclass
from pathlib import Path
import random
import re
import sys


MATERIAL_CATEGORIES = frozenset("金属 鉄系 木 石 骨角 布 革 糸 草 ガラス 陶磁 蝋 紙 液体 魔力".split())
PRODUCT_CATEGORIES = frozenset("武器 防具 照明 野営 容器 工具 生活 商具 装身具".split())
FEATURES = frozenset("刃物 接合 柄 錠 連環 折畳 金具".split())
DEFAULT_DIR = Path(__file__).resolve().parents[1] / "docs" / "items"


def split_tags(value):
    return frozenset(part.strip() for part in re.split("[,・]", value) if part.strip())


def checked_tags(value, allowed, label, universal=False, empty=False):
    tags = split_tags(value)
    if universal and tags == {"*"}:
        return tags
    if empty and tags == {"-"}:
        return frozenset()
    if not tags or tags - allowed:
        raise ValueError(f"{label}のカテゴリが不正です: {value}")
    return tags


@dataclass(frozen=True)
class Entry:
    id: str
    name: str
    section: str
    materials: frozenset
    categories: frozenset
    features: frozenset
    min_level: int
    max_level: int


@dataclass(frozen=True)
class Material:
    tags: frozenset
    min_level: int
    max_level: int


def level_range(low, high):
    low, high = int(low), int(high)
    if not 1 <= low <= high <= 300:
        raise ValueError(f"適正LVは1〜300で下限≦上限が必要です: {low}:{high}")
    return low, high


def read_dictionary(path, prefix):
    rows = []
    section = ""
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not re.fullmatch(prefix + r"\d{4}", cells[0]):
            continue
        expected = 9 if prefix == "T" else 8
        if len(cells) != expected:
            raise ValueError(f"{cells[0]}: 列数は{expected}列が必要です")
        materials = checked_tags(cells[4] if prefix == "T" else cells[3],
                                 MATERIAL_CATEGORIES, cells[0], universal=prefix == "T")
        categories = checked_tags(cells[5] if prefix == "T" else cells[4],
                                  PRODUCT_CATEGORIES, cells[0], universal=prefix == "T")
        features = checked_tags(cells[6] if prefix == "T" else cells[5], FEATURES,
                                cells[0], empty=True)
        if prefix == "P" and len(categories) != 1:
            raise ValueError(f"{cells[0]}: 加工品カテゴリは1つ指定してください")
        low, high = level_range(cells[-2], cells[-1])
        rows.append(Entry(cells[0], cells[1], section, materials, categories, features, low, high))
    if not rows:
        raise ValueError(f"辞典に項目がありません: {path}")
    for key, label in [(lambda row: row.id, "ID"), (lambda row: row.name, "名")]:
        if len({key(row) for row in rows}) != len(rows):
            raise ValueError(f"辞典に重複{label}があります: {path}")
    return rows


def read_material_aliases(path):
    aliases = {}
    short_names = {}
    ids = set()
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not re.fullmatch(r"S\d{4}", cells[0]):
            continue
        if len(cells) != 7:
            raise ValueError(f"{cells[0]}: 素材辞典は7列が必要です")
        if cells[0] in ids:
            raise ValueError(f"素材IDが重複しています: {cells[0]}")
        ids.add(cells[0])
        tags = checked_tags(cells[3], MATERIAL_CATEGORIES, cells[0])
        low, high = level_range(cells[4], cells[5])
        material = Material(expand_material_tags(tags), low, high)
        # 元見出し・明示表示名・括弧を除いた元名だけを別名にする。
        # 名前の字面からカテゴリやLVを推測しない。
        names = {cells[1], cells[2]}
        for name in names:
            if not name or (name in aliases and aliases[name] != material):
                raise ValueError(f"素材別名が空または別分類と重複しています: {name}")
            aliases[name] = material
        short = re.split(r"[（(]", cells[1])[0].strip()
        short_names.setdefault(short, set()).add(material)
    if not aliases:
        raise ValueError(f"素材別名表がありません: {path}")
    # 作品別の同名素材は、明示表示名を優先する。曖昧な省略名は登録しない。
    for name, choices in short_names.items():
        if name not in aliases and len(choices) == 1:
            aliases[name] = next(iter(choices))
    return aliases


def expand_material_tags(tags):
    # 鉄系は金属の下位カテゴリ。それ以外の推測・文字列判定はしない。
    return tags | {"金属"} if "鉄系" in tags else tags


def accepts(condition, actual):
    return "*" in condition or bool(condition & actual)


def compatible(title, material, product, level=None):
    low, high = tuple_level_range(title, material, product)
    return (bool(material.tags & product.materials)
            and accepts(title.materials, material.tags)
            and accepts(title.categories, product.categories)
            and title.features <= product.features
            and low <= high
            and (level is None or low <= level <= high))


def tuple_level_range(title, material, product):
    return (max(title.min_level, material.min_level, product.min_level),
            min(title.max_level, material.max_level, product.max_level))


def select_entries(rows, names, category, label):
    if names:
        unknown = set(names) - {row.name for row in rows}
        if unknown:
            raise ValueError(f"未知の{label}名: {', '.join(sorted(unknown))}")
        rows = [row for row in rows if row.name in names]
    if category:
        rows = [row for row in rows if category in row.section or category in row.categories]
    if not rows:
        raise ValueError(f"{label}の候補がありません")
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--material", action="append", required=True,
                        help="素材名。末尾の『の』は付けない。複数指定可")
    parser.add_argument("--material-tag", action="append", default=[], metavar="素材名=カテゴリ,カテゴリ",
                        help="未知素材の明示分類。鉄系は金属も持つ。複数指定可")
    parser.add_argument("--material-level", action="append", default=[], metavar="素材名=下限:上限",
                        help="未知素材の適正LV範囲。material-tagと対で指定する")
    parser.add_argument("--title", action="append", help="称号名の完全一致。複数指定可")
    parser.add_argument("--product", action="append", help="加工品名の完全一致。複数指定可")
    parser.add_argument("--title-category", help="称号の章見出しを部分一致で絞る")
    parser.add_argument("--product-category", help="加工品カテゴリの完全一致または章見出しの部分一致")
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--level", type=int, help="抽選LV（1〜300）。称号・素材・加工品すべての範囲内から抽選")
    parser.add_argument("--dictionary-dir", type=Path, default=DEFAULT_DIR)
    parser.add_argument("--material-dictionary", type=Path, help="素材LV辞典。既定はdictionary-dirの隣のmaterials/素材LV辞典.md")
    args = parser.parse_args(argv)
    try:
        titles = select_entries(read_dictionary(args.dictionary_dir / "称号辞典.md", "T"),
                                args.title, args.title_category, "称号")
        products = select_entries(read_dictionary(args.dictionary_dir / "加工品名辞典.md", "P"),
                                  args.product, args.product_category, "加工品")
        aliases = read_material_aliases(args.material_dictionary or args.dictionary_dir.parent / "materials" / "素材LV辞典.md")
        if args.level is not None and not 1 <= args.level <= 300:
            raise ValueError("levelは1〜300で指定してください")
        materials = list(dict.fromkeys(name.strip() for name in args.material))
        if any(not name for name in materials):
            raise ValueError("空の素材名は使えません")
        mapped = set()
        explicit_levels = {}
        for mapping in args.material_level:
            name, separator, value = mapping.partition("=")
            name = name.strip()
            bounds = value.split(":")
            if not separator or len(bounds) != 2 or name not in materials or name in aliases or name in explicit_levels:
                raise ValueError("material-levelは未登録の指定済み素材名=下限:上限で1度だけ指定してください")
            explicit_levels[name] = level_range(*bounds)
        for mapping in args.material_tag:
            name, separator, value = mapping.partition("=")
            name = name.strip()
            if not separator or name not in materials:
                raise ValueError("material-tagは指定済みの素材名=カテゴリで指定してください")
            if name in aliases or name in mapped:
                raise ValueError(f"既知または指定済み素材の分類は上書きできません: {name}")
            if name not in explicit_levels:
                raise ValueError(f"未登録素材には--material-level {name}=下限:上限 も必要です")
            aliases[name] = Material(expand_material_tags(checked_tags(value, MATERIAL_CATEGORIES, name)),
                                     *explicit_levels[name])
            mapped.add(name)
        if explicit_levels.keys() != mapped:
            raise ValueError("未登録素材にはmaterial-tagとmaterial-levelを対で指定してください")
        unknown = [name for name in materials if name not in aliases]
        if unknown:
            raise ValueError(f"未登録の素材: {', '.join(unknown)}。--material-tag 素材名=カテゴリ と--material-level 素材名=下限:上限 を指定してください")
        # 通過した素材・加工品ごとに称号候補を持つ。全直積の文字列は作らない。
        groups = []
        total = 0
        for material in materials:
            for product in products:
                valid = [title for title in titles if compatible(title, aliases[material], product, args.level)]
                if valid:
                    groups.append((total, material, product, valid))
                    total += len(valid)
        if not total:
            raise ValueError("適合する組合せがありません。素材×加工品、称号の素材条件×加工品条件×必須特徴、適正LVの重なりを確認してください")
        if not 1 <= args.count <= total:
            raise ValueError(f"countは適合候補数の1〜{total}で指定してください")
    except (ValueError, OSError) as error:
        parser.error(str(error))
    indexes = random.Random(args.seed).sample(range(total), args.count)
    print("# アイテム名候補\n")
    print("カテゴリ・適正LV条件に適合。LV範囲は仮案。素材は指定部位の主部材。語感・世界観は要確認。性能・価格は未設定。\n")
    print("| 名称 | 称号ID | 素材 | 加工品ID | 適正LV |")
    print("| --- | --- | --- | --- | --- |")
    for index in indexes:
        # groupsは生成順を固定してあり、同じ辞典・引数・seedなら再現する。
        start, material, product, valid = next(group for group in reversed(groups) if group[0] <= index)
        title = valid[index - start]
        name = f"{title.name}{material}の{product.name}"
        low, high = tuple_level_range(title, aliases[material], product)
        cells = [name, title.id, material, product.id, f"{low}〜{high}"]
        print("| " + " | ".join(cell.replace("|", "&#124;") for cell in cells) + " |")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
