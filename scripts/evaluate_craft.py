"""MDを正本とする主部材クラフトの試算。完成品BOM・在庫・戦闘は扱わない。"""
import argparse
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ROUTES = "HFMIX"


def table_rows(path):
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("|"):
            yield [cell.strip() for cell in line.strip().strip("|").split("|")]


def id_rows(path, pattern, width):
    result = {}
    for row in table_rows(path):
        if re.fullmatch(pattern, row[0]):
            if len(row) != width or row[0] in result:
                raise ValueError(f"不正な辞典行: {path.name}: {row[0]}")
            result[row[0]] = row
    if not result:
        raise ValueError(f"辞典が空です: {path}")
    return result


def tags(value):
    return set() if value == "-" else {v.strip() for v in re.split("[,・]", value) if v.strip()}


def load_data(root=ROOT):
    d = root / "docs"
    profiles, routes, classes = {}, {}, {}
    for row in table_rows(d / "crafting/加工工程プロファイル.md"):
        if len(row) == 7 and row[0] in ROUTES and len(row[0]) == 1:
            routes[row[0]] = row
        elif len(row) == 11 and row[0] != "工程型" and row[1] != "---":
            profiles[row[0]] = row
        elif len(row) == 6 and row[0] != "素材工程クラス" and row[1] != "---":
            classes[row[0]] = row
    return dict(
        materials=id_rows(d / "materials/素材LV辞典.md", r"S\d{4}", 7),
        products=id_rows(d / "items/加工品名辞典.md", r"P\d{4}", 8),
        material_work=id_rows(d / "crafting/素材加工特性.md", r"S\d{4}", 11),
        product_work=id_rows(d / "crafting/加工品クラフト方向性.md", r"P\d{4}", 6),
        tech=id_rows(d / "crafting/技術発見と進行設計.md", r"K\d{2}", 6),
        profiles=profiles, routes=routes, classes=classes,
    )


def requirements(data, material_id, product_id, route):
    if route not in data["routes"]:
        raise ValueError("未知の加工経路")
    m = data["material_work"][material_id]
    p = data["product_work"][product_id]
    profile = data["profiles"][p[3]]
    route_row = data["routes"][route]
    i = ROUTES.index(route)
    values = (m[3+i], profile[1+i])
    required = None if "-" in values else max(map(int, values)) + int(p[4])
    tech = tags(route_row[3])
    if route in "IX" and m[2] == "高融点金属":
        tech.add("K10")
    if route in "IX" and m[2] == "魔法金属":
        tech.add("K11")
    if route == "X" and m[2] == "神造固体":
        tech.add("K13")
    # 全前提を再帰的に含め、未達の上位技術だけを渡す抜け道を防ぐ。
    def expand(key, stack):
        if key in stack:
            raise ValueError("技術の前提が循環しています")
        answer = {key}
        for dep in tags(data["tech"][key][2]):
            answer |= expand(dep, stack | {key})
        return answer
    needed = set()
    for key in tech:
        needed |= expand(key, set())
    equipment = tags(route_row[4]) | tags(profile[6+i]) | tags(data["classes"][m[2]][1+i])
    return required, needed, equipment


def magic_cost_and_residue(base_residue, surplus):
    if not 0 <= base_residue <= 100 or surplus < 0:
        raise ValueError("残留基準または技能余裕が範囲外")
    # 整数式にして、端数誤差によるceilのぶれを避ける。
    remaining = max(0, 60-surplus)
    floor = math.ceil(base_residue / 3)
    residue = floor + ((base_residue-floor) * remaining + 59) // 60
    return 1 + remaining / 30, residue


def evaluate(data, material_id, product_id, route, skill, technologies=(), equipment=(),
             recipe_known=False, inherited_residue=0):
    if not 1 <= skill <= 300 or not 0 <= inherited_residue <= 100:
        raise ValueError("技能は1〜300、継承残留は0〜100")
    required, needed, machines = requirements(data, material_id, product_id, route)
    m, p = data["materials"][material_id], data["products"][product_id]
    mw, pw = data["material_work"][material_id], data["product_work"][product_id]
    problems = []
    if not (tags(m[3]) & tags(p[3])):
        problems.append("素材カテゴリ不適合")
    if mw[2] == "鉱石原料" and pw[3] not in {"装飾祭具", "計量記録"}:
        problems.append("鉱石は別レシピで精錬が必要")
    if mw[2] == "エネルギー":
        problems.append("封入部品の複合レシピ未定義")
    if required is None:
        problems.append("この経路では加工不可")
    elif required > 300:
        problems.append("必要技能が上限300を超過")
    elif skill < required:
        problems.append("技能不足")
    if not recipe_known:
        problems.append("加工品レシピ未取得")
    missing_tech = sorted(needed - set(technologies))
    missing_equipment = sorted(machines - set(equipment))
    if missing_tech:
        problems.append("未発見技術")
    if missing_equipment:
        problems.append("設備不足")
    result = dict(material=material_id, product=product_id, route=route, skill=skill,
                  required_skill=required, craftable=not problems, reasons=problems,
                  missing_technologies=missing_tech, missing_equipment=missing_equipment)
    if problems:
        return result
    surplus = skill-required
    row = data["routes"][route]
    quality = min(int(row[6]), int(row[5]) + surplus//5 + (5 if "精密測定器" in equipment else 0))
    multiplier, new_residue = magic_cost_and_residue(int(mw[8]), surplus) if route == "M" else (0, 0)
    residue = max(inherited_residue, new_residue)
    result.update(quality=quality, residual=residue, magic_mana_multiplier=multiplier,
                  enchantment_transmission=round(quality/100 * (1-residue/100), 6))
    return result


def enchantment_gate(tier, skill, quality, technologies=(), equipment=()):
    if tier not in range(1, 6) or not 1 <= skill <= 300 or not 0 <= quality <= 100:
        raise ValueError("付与段階・技能・品質が範囲外")
    min_skill = [20, 60, 120, 180, 240][tier-1]
    min_quality = [20, 40, 60, 80, 95][tier-1]
    tech = ["K06", "K06", "K09", "K09", "K12"][tier-1]
    # technologiesは習得済みの整合した集合を渡す。
    return (skill >= min_skill and quality >= min_quality and tech in technologies
            and (tier != 5 or "精密刻印機" in equipment))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--material", required=True, help="素材ID、例S0135")
    parser.add_argument("--product", required=True, help="加工品ID、例P0031")
    parser.add_argument("--route", required=True, choices=list(ROUTES))
    parser.add_argument("--skill", required=True, type=int)
    parser.add_argument("--tech", default="", help="習得済み技術IDをカンマ区切り")
    parser.add_argument("--equipment", default="", help="設備能力タグをカンマ区切り")
    parser.add_argument("--recipe-known", action="store_true")
    parser.add_argument("--inherited-residue", type=int, default=0)
    args = parser.parse_args()
    try:
        result = evaluate(load_data(), args.material, args.product, args.route, args.skill,
                          tags(args.tech), tags(args.equipment), args.recipe_known, args.inherited_residue)
    except (KeyError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
