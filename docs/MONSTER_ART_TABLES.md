---
タグ: [創作]
---

# モンスター画像制作表・フレーバー索引

現行ゲームへの画像追加は遭遇敵の encounter-01〜03 を先に制作。図鑑400種は catalog-01〜14。両者は別IDであり、似た名前でも画像を流用しない。

各リンク先の表を1シートずつ画像生成へ渡す。5列×6行、基準1145×1374px、1セル229px、左上から右へ配置。番号・文字・枠・背景・接地影は描かず、実アルファ透明PNGで出力する。未使用枠は透明。

画風の参考：[受領シート02](../monsters_sheet02_M0031-M0060.png)。出力実績を基準にした寸法で、サービス全体の固定上限ではない。参照シートの個体を複製せず、今回の対象表を優先。

受領状況：[改名・移動の対応表](monster-art/RECEIVED_SHEETS.md)。通常版02〜14と14別案の計14枚、01は欠番。原本はゲーム内の制作シートプレビューで確認可能。個別スプライトは [検品記録](MONSTER_ART_INTEGRATION.md) の21体のみ登録し、寸法/配置が異なる残りを一括承認しない。

フレーバー中の建物・景色・小物は生態を理解する参考で、背景を描く指示ではない。外見補助は制作用の案であり、対象名・既存特性を優先する。未確定の色・首の本数・装備は生成前に決める。

制作規約は [MONSTER_ART_SPEC.md](MONSTER_ART_SPEC.md)。対応表 manifest.json のID・名前・シート・枠は変更していない。参考サンプルは受領済みだが、各セルのゲーム用照合・承認は未実施。

| 優先 | シート | 対象数 | 先頭 | 末尾 |
| --- | --- | --- | --- | --- |
| 先行（ゲーム実装用） | [encounter-01](monster-art/encounter-01.md) | 30 | 洞穴ネズミ | 霜牙オオカミ |
| 先行（ゲーム実装用） | [encounter-02](monster-art/encounter-02.md) | 30 | 氷灯 | 霜紋の主・白銀の機甲将 |
| 先行（ゲーム実装用） | [encounter-03](monster-art/encounter-03.md) | 10 | 熔火の主・紅蓮古竜 | 天球の主・星辰の審判機構 |
| 図鑑用 | [catalog-01](monster-art/catalog-01.md) | 30 | スライム | リザードマン |
| 図鑑用 | [catalog-02](monster-art/catalog-02.md) | 30 | ホブゴブリン | ウェアベア |
| 図鑑用 | [catalog-03](monster-art/catalog-03.md) | 30 | ヘルハウンド | レイス |
| 図鑑用 | [catalog-04](monster-art/catalog-04.md) | 30 | ワイト | ワイバーン |
| 図鑑用 | [catalog-05](monster-art/catalog-05.md) | 30 | サイクロプス | 山脈渡りの大鷲 |
| 図鑑用 | [catalog-06](monster-art/catalog-06.md) | 30 | デーモン | 蛇尾の城塞亀 |
| 図鑑用 | [catalog-07](monster-art/catalog-07.md) | 30 | 麒麟 | 紅蓮角の獅子蟻 |
| 図鑑用 | [catalog-08](monster-art/catalog-08.md) | 30 | 火山灰を撒く鸞 | リッチ |
| 図鑑用 | [catalog-09](monster-art/catalog-09.md) | 30 | ベヒモス | ゲーリュオーン |
| 図鑑用 | [catalog-10](monster-art/catalog-10.md) | 30 | アルゴス | ミシペシュ |
| 図鑑用 | [catalog-11](monster-art/catalog-11.md) | 30 | アフイソトル | ウートガルザ・ロキ |
| 図鑑用 | [catalog-12](monster-art/catalog-12.md) | 30 | ベルゲルミル | 古竜王 |
| 図鑑用 | [catalog-13](monster-art/catalog-13.md) | 30 | アナンタ | 零点の粘海 |
| 図鑑用 | [catalog-14](monster-art/catalog-14.md) | 10 | 因果を食む蠍 | 終焉竜 |

## 再生成

`python scripts/export_monster_art_tables.py`（Python 3・Node.js、追加パッケージ不要）。既存manifestを読み取り、17シートとこの索引を再出力する。
