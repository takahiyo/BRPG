"""docs/ 内のMarkdown辞典（全1,765項目＋職業300＋スキル180＋探索40＋クラフト）を
ブラウザが直接読み込める catalog-data.js (window.CATALOG / DATA.catalog) に変換するスクリプト。
"""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "docs"


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
    return result


def split_tags(val):
    if val in ("-", ""):
        return []
    return [v.strip() for v in re.split("[,・]", val) if v.strip()]


def build_catalog():
    # 1. 素材 (265) + 加工特性 + フレーバー
    mat_lv = id_rows(D / "materials/素材LV辞典.md", r"S\d{4}", 7)
    mat_work = id_rows(D / "crafting/素材加工特性.md", r"S\d{4}", 11)
    materials = {}
    for sid, r in mat_lv.items():
        w = mat_work[sid]
        routes = {}
        for idx, k in enumerate("HFMIX"):
            v = w[3 + idx]
            routes[k] = None if v == "-" else int(v)
        materials[sid] = {
            "id": sid,
            "rawName": r[1],
            "name": r[2],
            "tags": split_tags(r[3]),
            "minLv": int(r[4]),
            "maxLv": int(r[5]),
            "tierGroup": r[6],
            "workClass": w[2],
            "routes": routes,
            "baseResidue": int(w[8]),
            "direction": w[9],
            "flavor": w[10],
        }

    # 2. 加工品 (540) + クラフト方向性
    prod_base = {}
    section = ""
    for line in (D / "items/加工品名辞典.md").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if re.fullmatch(r"P\d{4}", cells[0]):
                prod_base[cells[0]] = (section, cells)
    prod_work = id_rows(D / "crafting/加工品クラフト方向性.md", r"P\d{4}", 6)
    products = {}
    for pid, (sec, r) in prod_base.items():
        w = prod_work[pid]
        products[pid] = {
            "id": pid,
            "name": r[1],
            "section": sec,
            "part": r[2],
            "materialTags": split_tags(r[3]),
            "category": r[4],
            "features": split_tags(r[5]),
            "minLv": int(r[6]),
            "maxLv": int(r[7]),
            "design": w[2],
            "profile": w[3],
            "shapeLv": int(w[4]),
            "flavor": w[5],
        }

    # 3. アイテム称号 (400) + フレーバー
    title_base = id_rows(D / "items/称号辞典.md", r"T\d{4}", 9)
    title_flavor = id_rows(D / "flavor/アイテム称号フレーバー.md", r"T\d{4}", 5)
    item_titles = {}
    for tid, r in title_base.items():
        fl = title_flavor[tid]
        item_titles[tid] = {
            "id": tid,
            "name": r[1],
            "meaning": r[2],
            "matCond": split_tags(r[4]),
            "catCond": split_tags(r[5]),
            "featCond": split_tags(r[6]),
            "minLv": int(r[7]),
            "maxLv": int(r[8]),
            "direction": fl[2],
            "flavor": fl[3],
        }

    # 4. 基礎モンスター (400) + フレーバー
    mon_base = {}
    mon_flavor = {}
    for suffix in ["LV001-150", "LV151-300"]:
        mon_base.update(id_rows(D / f"monsters/モンスター辞典_{suffix}.md", r"M\d{4}", 5))
        mon_flavor.update(id_rows(D / f"flavor/モンスターフレーバー_{suffix}.md", r"M\d{4}", 5))
    monsters = {}
    for mid, r in mon_base.items():
        fl = mon_flavor[mid]
        monsters[mid] = {
            "id": mid,
            "name": r[1],
            "level": int(r[2]),
            "category": r[3],
            "traits": split_tags(r[4]),
            "ecology": fl[2],
            "craftHint": fl[3],
            "flavor": fl[4],
        }

    # 5. モンスター称号 (160) + フレーバー
    mt_base = id_rows(D / "monsters/モンスター称号辞典.md", r"MT\d{4}", 8)
    mt_flavor = id_rows(D / "flavor/モンスター称号フレーバー.md", r"MT\d{4}", 4)
    monster_titles = {}
    for mtid, r in mt_base.items():
        fl = mt_flavor[mtid]
        monster_titles[mtid] = {
            "id": mtid,
            "name": r[1],
            "delta": int(r[2]),
            "categories": split_tags(r[3]),
            "required": split_tags(r[4]),
            "excluded": split_tags(r[5]),
            "minLv": int(r[6]),
            "maxLv": int(r[7]),
            "direction": fl[2],
            "flavor": fl[3],
        }

    # 6. 職業 (300) & スキル (180)
    jobs = {}
    skills = {}
    for suffix in ["冒険と戦闘", "生活と奇想"]:
        for jid, r in id_rows(D / f"jobs/職業辞典_{suffix}.md", r"J\d{4}", 10).items():
            jobs[jid] = {
                "id": jid,
                "name": r[1],
                "family": r[2],
                "branch": suffix,
                "minLv": int(r[3]),
                "maxLv": int(r[4]),
                "skills": [r[5], r[6], r[7]],
                "role": r[8],
                "flavor": r[9],
            }
        for skid, r in id_rows(D / f"jobs/スキル辞典_{suffix}.md", r"SK\d{4}", 8).items():
            skills[skid] = {
                "id": skid,
                "name": r[1],
                "branch": suffix,
                "minLv": int(r[2]),
                "maxLv": int(r[3]),
                "kind": r[4],
                "effect": r[5],
                "limit": r[6],
                "behaviors": split_tags(r[7]),
            }

    # 7. 自動探索行動 (40) & 手引書 (39)
    behaviors = {}
    for bid, r in id_rows(D / "exploration/探索行動と手引書辞典.md", r"B\d{2}", 10).items():
        behaviors[bid] = {
            "id": bid,
            "name": r[1],
            "bookId": None if r[2] == "-" else r[2],
            "bookName": r[3],
            "reqPartyLv": int(r[4]),
            "minDropLv": int(r[5]),
            "maxDropLv": int(r[6]),
            "action": r[7],
            "limit": r[8],
            "flavor": r[9],
        }

    # 8. 加工工程プロファイル・技術ノード (13)
    routes, profiles, classes = {}, {}, {}
    for row in table_rows(D / "crafting/加工工程プロファイル.md"):
        if len(row) == 7 and row[0] in "HFMIX" and len(row[0]) == 1:
            routes[row[0]] = {
                "id": row[0],
                "meaning": row[1],
                "skillType": row[2],
                "tech": split_tags(row[3]),
                "equipment": split_tags(row[4]),
                "baseQ": int(row[5]),
                "maxQ": int(row[6]),
            }
        elif len(row) == 11 and row[0] != "工程型" and row[1] != "---":
            profiles[row[0]] = {
                "id": row[0],
                "routes": {k: (None if row[1 + i] == "-" else int(row[1 + i])) for i, k in enumerate("HFMIX")},
                "equipment": {k: split_tags(row[6 + i]) for i, k in enumerate("HFMIX")},
            }
        elif len(row) == 6 and row[0] != "素材工程クラス" and row[1] != "---":
            classes[row[0]] = {
                "id": row[0],
                "equipment": {k: split_tags(row[1 + i]) for i, k in enumerate("HFMIX")},
            }

    techs = {}
    for kid, r in id_rows(D / "crafting/技術発見と進行設計.md", r"K\d{2}", 6).items():
        lv_parts = [int(x) for x in r[3].split("〜")]
        techs[kid] = {
            "id": kid,
            "name": r[1],
            "prereq": split_tags(r[2]),
            "minLv": lv_parts[0],
            "maxLv": lv_parts[-1],
            "discovery": r[4],
            "unlocks": r[5],
        }

    return {
        "materials": materials,
        "products": products,
        "itemTitles": item_titles,
        "monsters": monsters,
        "monsterTitles": monster_titles,
        "jobs": jobs,
        "skills": skills,
        "behaviors": behaviors,
        "crafting": {
            "routes": routes,
            "profiles": profiles,
            "classes": classes,
            "techs": techs,
        },
    }


def main():
    catalog = build_catalog()
    out_path = ROOT / "catalog-data.js"
    js_content = (
        "/* Auto-generated from docs/ by scripts/export_game_catalog.py. Do not edit manually. */\n"
        "const CATALOG = "
        + json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        "if (typeof DATA !== 'undefined') DATA.catalog = CATALOG;\n"
    )
    out_path.write_text(js_content, encoding="utf-8")
    print(
        f"Generated {out_path.name} ({out_path.stat().st_size:,} bytes): "
        f"materials={len(catalog['materials'])}, products={len(catalog['products'])}, "
        f"itemTitles={len(catalog['itemTitles'])}, monsters={len(catalog['monsters'])}, "
        f"monsterTitles={len(catalog['monsterTitles'])}, jobs={len(catalog['jobs'])}, "
        f"skills={len(catalog['skills'])}, behaviors={len(catalog['behaviors'])}, "
        f"techs={len(catalog['crafting']['techs'])}"
    )


if __name__ == "__main__":
    main()
