"""主部材のクラフト試算例を現行MDデータから再生成する。"""
from evaluate_craft import ROOT, load_data, requirements, evaluate


def main():
    data = load_data()
    cases = [
        ("初期の松明", "S0001", "P0331", "H", 1, {}),
        ("手工を極めた松明", "S0001", "P0331", "H", 300, {}),
        ("鍛冶の鋼短剣", "S0037", "P0001", "F", 60, {}),
        ("技能だけ高い鍛冶", "S0060", "P0001", "F", 300, {}),
        ("タングステンの魔法試作", "S0060", "P0001", "M", 112, {}),
        ("同じ品・熟練途中", "S0060", "P0001", "M", 142, {}),
        ("同じ品・低残留製作", "S0060", "P0001", "M", 172, {}),
        ("同じ品・工業化", "S0060", "P0001", "I", 182, {}),
        ("技能は十分だが設備なし", "S0060", "P0001", "I", 300, {"equipment": set()}),
        ("技能と設備はあるが技術未発見", "S0060", "P0001", "I", 300, {"technologies": set()}),
        ("アダマンタイト槍・まだ未達", "S0135", "P0031", "M", 150, {}),
        ("アダマンタイト槍・魔法の閾値", "S0135", "P0031", "M", 151, {}),
        ("同じ槍・魔法技能余裕30", "S0135", "P0031", "M", 181, {}),
        ("同じ槍・魔法技能余裕60", "S0135", "P0031", "M", 211, {}),
        ("同じ槍・鍛冶では不可", "S0135", "P0031", "F", 300, {}),
        ("同じ槍・機械加工", "S0135", "P0031", "I", 231, {}),
        ("同じ槍・精密加工の閾値", "S0135", "P0031", "X", 271, {}),
        ("同じ槍・完全な付与伝達", "S0135", "P0031", "X", 296, {}),
        ("魔法製部材を再加工", "S0135", "P0031", "X", 296, {"inherited_residue": 66}),
        ("神造素材を精密加工", "S0199", "P0001", "X", 300, {}),
        ("不壊素材を鍛冶で加工", "S0200", "P0001", "F", 300, {}),
        ("布で鎖帷子の鎖は作れない", "S0259", "P0195", "H", 300, {}),
        ("鉱石を地金と取り違える", "S0028", "P0001", "M", 300, {}),
        ("未取得の短剣レシピ", "S0037", "P0001", "F", 300, {"recipe_known": False}),
        ("旋盤だけでは不足", "S0037", "P0031", "I", 151, {"equipment": {"旋盤"}}),
        ("旋盤と必要な周辺設備を揃える", "S0037", "P0031", "I", 151, {}),
        ("エネルギーを単独主材にする", "S0190", "P0001", "M", 300, {}),
        ("精密技術だけを未検証で持つ", "S0135", "P0031", "X", 300, {"technologies": {"K12"}}),
    ]
    lines = ["---", "タグ: [創作]", "---", "", "# クラフト検証例", "",
             "[[クラフトシステム設計]]の式を、現行の素材・加工品・工程表から計算した28例。再生成は `python scripts/export_craft_examples.py`。戦闘性能の比較ではなく、表示上の主部材の製作可否と付与の器を比較する。", "",
             "特記のない例は必要な技術とその前提・全設備・加工品レシピを取得済みと仮定する。通常の試算では精密測定器を任意追加していないため、必須となるX経路だけ測定加点5が付く。魔力倍率はMのみで、物理経路の『—』は直接魔法成形の消費がない意味。", "",
             "| 例 | 素材＋加工品 | 経路 | 技能LV | 必要LV | 結果 | Q | R | 魔力倍率 | 付与伝達率 |",
             "|---|---|---|---:|---:|---|---:|---:|---:|---:|"]
    missing = []
    for n, (label, mat, prod, route, skill, overrides) in enumerate(cases, 1):
        _, tech, equipment = requirements(data, mat, prod, route)
        params = dict(technologies=tech, equipment=equipment, recipe_known=True)
        params.update(overrides)
        r = evaluate(data, mat, prod, route, skill, **params)
        name = data["materials"][mat][2] + "の" + data["products"][prod][1]
        required = r["required_skill"] if r["required_skill"] is not None else "経路なし"
        result = "可能" if r["craftable"] else "／".join(r["reasons"])
        q, residue = r.get("quality", "—"), r.get("residual", "—")
        mana = f'{r["magic_mana_multiplier"]:.2f}' if r["craftable"] and route == "M" else "—"
        eta = f'{r["enchantment_transmission"]*100:.2f}%' if r["craftable"] else "—"
        lines.append(f"| {n}. {label} | {name} | {route} | {skill} | {required} | {result} | {q} | {residue} | {mana} | {eta} |")
        if r["missing_technologies"] or r["missing_equipment"]:
            missing.append(f'- 例{n}：不足技術 `{",".join(r["missing_technologies"]) or "なし"}`、不足設備 `{",".join(r["missing_equipment"]) or "なし"}`。')
    lines += ["", "## 条件不足の内訳", "", *missing, "", "## 読み取り", "",
              "魔法加工は素材の実用化を先行させ、技能余裕が増えると消費と残留が改善する。機械加工へ追いつくと残留ゼロの新造品が得られ、精密加工でQ100に達すると同じ付与術式の基礎効果が100%伝わる。", "",
              "残留66の魔法製部材を精密加工しても、その履歴を引き継ぐため伝達率は34%に留まる。過去の魔法製装備を無条件で最終装備へ変換することはできない。素材を新規に調達し直す、熟練時に作り直す、別の低残留装備を選ぶ、という判断を残す。", "",
              "E5には伝達率だけでなくエンチャントLV240・Q95・K12・精密刻印機が必要。表の製作可能はE5の即時付与や、副部材を含む完成品の完成を意味しない。", ""]
    path = ROOT / "docs/crafting/クラフト検証例.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(cases)} cases -> {path}")


if __name__ == "__main__":
    main()
