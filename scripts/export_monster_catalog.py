"""全基礎種を含め、30LV帯ごとの固定サンプルをMarkdownへ出力する。"""

import argparse
from pathlib import Path
import random
import sys

from generate_monster_names import candidates, load_dictionaries


def build_catalog(directory, per_band=120, seed=19):
    monsters, titles = load_dictionaries(directory)
    pool = candidates(monsters, titles)
    preferred = {"ありふれたコボルト", "屈強なコボルト", "ジェネラルコボルト", "濃縮されたスライム"}
    selected = []
    rng = random.Random(seed)
    for lower in range(1, 301, 30):
        band = [row for row in pool if lower <= row[1] <= lower + 29]
        fixed = [row for row in band if row[3] == "-" or row[0] in preferred]
        optional = [row for row in band if row not in fixed]
        if not len(fixed) <= per_band <= len(band):
            raise ValueError(f"LV{lower}〜{lower+29}の出力数は{len(fixed)}〜{len(band)}で指定してください")
        rows = fixed + rng.sample(optional, per_band - len(fixed))
        selected.append((lower, sorted(rows, key=lambda row: (row[1], row[0]))))
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dictionary-dir", type=Path, default=Path(__file__).resolve().parents[1] / "docs/monsters")
    parser.add_argument("--per-band", type=int, default=120)
    parser.add_argument("--seed", type=int, default=19)
    args = parser.parse_args()
    try:
        bands = build_catalog(args.dictionary_dir, args.per_band, args.seed)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    total = args.per_band * 10
    print(f"---\nタグ:\n  - 創作\n作成日: 2026-10-19\n---\n\n# モンスター生成例{total}\n")
    print(f"[[モンスター設計ルール]]と[[モンスター称号辞典]]から、各30LV帯に{args.per_band}件ずつ、合計{total}件を出力した。基礎種400件をすべて含み、残りはカテゴリ・特性・適正LVが一致する称号付き個体。完成名の重複なし。\n")
    print(f"再生成：BRPGで `python scripts/export_monster_catalog.py --per-band {args.per_band} --seed {args.seed}`。辞典を変更すると結果も変わる。脅威度LVは[[LV設計ルール]]に基づく仮配置。\n")
    for lower, rows in bands:
        print(f"## LV{lower:03}〜{lower+29:03}\n\n| モンスター名 | 脅威度LV |\n| --- | --- |")
        for name, level, *_ in rows:
            print(f"| {name} | {level} |")
        print()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
