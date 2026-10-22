"""400種の辞典から、5列6行の画像生成用入力スニペットを再出力する。"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def build_prompts():
    layout = json.loads((ROOT / "docs/monster-art/manifest.json").read_text(encoding="utf-8"))["layout"]
    size = f"{layout['width']}×{layout['height']}px、1枠{layout['cell']}×{layout['cell']}px"
    monsters = []
    for suffix in ["LV001-150", "LV151-300"]:
        path = ROOT / f"docs/monsters/モンスター辞典_{suffix}.md"
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if re.fullmatch(r"M\d{4}", cells[0]):
                monsters.append((cells[0], cells[1]))
    assert [m[0] for m in monsters] == [f"M{i:04}" for i in range(1, 401)]
    lines = ["---", "タグ: [創作]", "---", "", "# モンスター画像生成リスト_30枠", "",
             "先に[[アセットシート共通プロンプト]]をスキル・固定指示として設定し、以下のコードブロックをシート番号順に一つずつ渡す。ID・枠番号・行番号は画像へ描かない。対象は既存辞典400種で、30体×13枚＋10体×1枚の計14枚。最後の20枠は透明のまま残す。", "",
             "行は上から、各行の項目は左から右へ並べる。各シートで枠1〜30へ戻るが、MのIDは通し番号。入力順は既存辞典と一致し、30LV刻みの区分とは別の、画像配置用の30体区切りである。", ""]
    for start in range(0, len(monsters), 30):
        batch = monsters[start:start+30]
        number = start//30+1
        lines += [f"## シート{number:02}：{batch[0][0]}〜{batch[-1][0]}", "", "```text",
                  "BRPGアセットシート共通スキルに従って、次の1枚を描いてください。",
                  "対象種別：モンスター。名前・番号・文字なし。5列×6行。透明背景。",
                  f"基準サイズ：{size}。サンプルの実寸を基準にし、拡大出力は要求しない。",
                  "添付サンプルは画風と配置の参考のみ。対象種と順序は以下のリストを厳守。各枠の四辺8%以上を透明にし、角・翼・武器も切らない。",
                  f"シート番号：{number:02}",
                  f"保存名案：monsters_sheet{number:02}_{batch[0][0]}-{batch[-1][0]}.png"]
        for row in range(6):
            entries = []
            for col in range(5):
                slot = row*5+col
                value = " ".join(batch[slot]) if slot < len(batch) else "空白（何も描かない・透明）"
                entries.append(f"枠{slot+1:02}={value}")
            lines.append(f"{row+1}行目・左から："+" / ".join(entries))
        lines += ["```", ""]
    output = ROOT / "docs/monsters/モンスター画像生成リスト_30枠.md"
    skill = (ROOT / "skills/brpg-asset-sheet/SKILL.md").read_text(encoding="utf-8")
    body = skill.split("---", 2)[2].strip()
    portable = ["---", "タグ: [創作]", "---", "", "# アセットシート共通プロンプト", "",
                "下のコードブロックを画像生成側のスキル・固定指示として設定し、その後に[[モンスター画像生成リスト_30枠]]の各ブロックを一つずつ渡す。モンスター名を固定指示へ埋め込まないため、将来はアイテムのリストにも使える。", "",
                "これは持ち運び用のスキル本文。BRPGリポジトリにも `skills/brpg-asset-sheet/SKILL.md` として保存している。Codexのグローバルスキル領域へのインストールは行っていない。", "",
                f"今回のサンプル「30体のモンスター透過スプライトアトラス.png」の実寸は{size}。この出力実績に合わせ、解像度の引き上げではなく限られた画素数での識別性と透明余白を優先する。ChatGPT全体の固定上限を断定するものではない。", "", "```text", body, "```", ""]
    return {output: "\n".join(lines), ROOT / "docs/monsters/アセットシート共通プロンプト.md": "\n".join(portable)}


def main():
    for file, content in build_prompts().items():
        file.write_text(content, encoding="utf-8")
    print("400 IDs verified; 14 sheets; 20 empty final slots; common prompt exported")


if __name__ == "__main__":
    main()
