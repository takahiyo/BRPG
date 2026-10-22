---
タグ: [創作]
---

# モンスター画像の実装・検品記録

2026-10-22 JST。画像担当のローカル実装。Git書き込みなし。計画・状態文書、index/build、ブラウザテストは親担当が統合するため変更しない。

## 段階と受入条件

| 段階 | 対象・依存 | 完了条件・検証 | 状態 |
| --- | --- | --- | --- |
| M0 | 規則・計画・状態・受領表・制作表と02/03画像の照合 | 01欠番、14枚の原本保全、名称差異を把握 | 完了 |
| M1 | M0に依存。monster-art.js、systems.js画像関数のみ | 名称と外見を目視照合した矩形だけ登録。派生プレビューで隣接混入・欠けを確認 | 完了 |
| M2 | M1に依存。test-monster-art.cjs | 図鑑HTML、承認・範囲・エスケープ・フォールバック・素材存在とハッシュをNode VMで検証 | 完了（ローカル） |
| M3 | M2に依存。monster-art.js/css・テスト・本書のみ | journalScreenの原本14枚選択、単一画像、未検品警告・実寸・01欠番、承認ガード保全を検証 | 完了（ローカル） |

## 公開インターフェース

- `monster-art.js` は追加依存のないclassic script。`systems.js` の直後、最初の `boot()` より前に読み込む。ES moduleにしない。
- systems内の既存 `globalThis.BRPGMonsterArt = { sheets: {}, cells: {} }` を置き換えず、その中を登録する。順序違いでは明確なエラーを出す。
- `BRPGMonsterArt.sheets[sheetId] = { src, width, height }`。`src` はルートの英数字・ハイフン・アンダースコアからなるPNG名だけを許可する。
- `BRPGMonsterArt.cells[catalogId] = { name, sheet, rect: { x, y, width, height }, verified: true }`。矩形は左上原点の実ピクセル、右端・下端は含まない。
- 既存 `globalThis.monsterThumbHTML(enemyId, catalogId)` と図鑑内のlexical呼出しは同一の登録を参照する。承認は厳密な `true` のみ、矩形は整数・正の寸法・画像内でなければ空文字を返す。
- 外側SVGの `xMidYMid meet` で縦横比を保持し、内側SVGで矩形外の隣の絵をクリップする。既存 `.monster-thumb` の64px等の可変枠を使い、CSS追加は不要。
- 名前は既存 `esc` を通し、画像名は許可形式を検証後にエスケープする。URLをCSS文字列へ挿入しない。
- 遭遇敵IDへの推測エイリアスは登録せず、DATA/セーブ/発見条件も変更しない。未承認セルは空文字となり、戦闘側は既存アイコン、図鑑側は従来の名称・説明表示のまま。
- `BRPGMonsterArt.sourceSheets` は14原本の読取専用配列。各要素もfreezeし、`id, label, src, firstId, lastId, width, height, warning` を持つ。個別スプライト用の `sheets/cells` とは分離し、`verified` を付けない。
- `journalScreen` をラップして末尾に `details#monster-sheet-details.monster-sheet-browser`（見出し「制作シートを確認」）を追加する。通常の調査記録と `catalogScreen` の `field_mon` タブから利用できる。
- 選択UIは `select#monster-sheet-select[data-monster-sheet="select"]`。値は `catalog-02`〜`catalog-14` と `catalog-14-alt`。ラベル・説明関連付け・原本のaltを付ける。
- documentの `change` でID・data属性・値のホワイトリストを確認し、ローカルの選択状態を更新して `render()`。選択後はdetailsを開いたままにし、selectへフォーカスを戻す。不正値は無視し、保存データには書き込まない。
- プレビュー画像は `img#monster-sheet-preview` の1枚のみ。`#monster-sheet-metadata` は対応候補ID範囲と原寸、`#monster-sheet-warning` は07/10/14/14alt等の注意を表示。原本リンクも選択中の1枚だけ。初期値は02、detailsは初期状態で閉じる。

## 配信対象

親担当は次の16ファイルを配布allowlistへ追加する。indexにはmonster-art.jsとmonster-art.cssを読み込む。CSSは既存スタイルの後、JSはsystems.js直後。原本画像は全14枚を配信するが、DOMには選択中の原本1枚のみを出力し、先行読込みしない。

```text
monster-art.js
monster-art.css
monsters_sheet02_M0031-M0060.png
monsters_sheet03_M0061-M0090.png
monsters_sheet04_M0091-M0120.png
monsters_sheet05_M0121-M0150.png
monsters_sheet06_M0151-M0180.png
monsters_sheet07_M0181-M0210.png
monsters_sheet08_M0211-M0240.png
monsters_sheet09_M0241-M0270.png
monsters_sheet10_M0271-M0300.png
monsters_sheet11_M0301-M0330.png
monsters_sheet12_M0331-M0360.png
monsters_sheet13_M0361-M0390.png
monsters_sheet14_M0391-M0400.png
monsters_sheet14_M0391-M0400_alt.png
```

systems.jsの前段実装に対応するキャッシュキーも親担当が更新する。今回の原本プレビュー追加ではsystems.jsを変更しない。画像自体は全て無加工。01は存在せず復元しない。monster-art.cssは原本の全幅・縦横比保持・長いファイル名の折返しを担当する。

## 目視承認した21体

02/03原画像をReadで確認し、対応する制作表の名称・種族と照合した。Pillowは調査時だけ使用し、アルファ連結領域の実寸を調べて個別矩形を設定。21体の派生切出しプレビューを灰色背景で再確認した。プレビューは作業用一時領域のみ、製品依存や配布物にしない。全セルの19px透明余白など制作規格への完全適合を認定するものではなく、現UIでの名称・外形・切れ・隣接混入を確認した承認である。

| シート | ID | 名称 | 目視照合の根拠 |
| --- | --- | --- | --- |
| 02 | M0031 | ホブゴブリン | 赤褐色の武装したゴブリン |
| 02 | M0032 | 河童 | 頭の皿・甲羅・水棲の亜人 |
| 02 | M0033 | インプ | 小型の赤い有翼悪魔 |
| 02 | M0034 | ケルピー | 水で形作られた馬 |
| 02 | M0035 | ハーピー | 女性上半身・翼・鳥脚 |
| 02 | M0036 | ダイアウルフ | 大型の白い狼 |
| 02 | M0037 | ガーゴイル | 石の有翼獣 |
| 02 | M0038 | グール | 痩せた爪のある屍食鬼 |
| 02 | M0040 | オーガ | 棍棒を持つ太った巨鬼 |
| 02 | M0041 | オーク | 緑色の武装した牙の亜人 |
| 02 | M0044 | トログロダイト | 槍を持つ地色の爬虫亜人 |
| 02 | M0045 | サハギン | 魚の鰭・三叉槍・水棲亜人 |
| 03 | M0061 | ヘルハウンド | 炎と溶岩を纏う犬 |
| 03 | M0062 | ディープオクトパス | 暗色の八腕の蛸 |
| 03 | M0063 | シェイド | 暗い影状の霊体 |
| 03 | M0064 | ポルターガイスト | 霊体と浮遊する椅子・食器 |
| 03 | M0065 | デュラハン | 首なしの騎乗した鎧騎士 |
| 03 | M0067 | ボーンソルジャー | 槍・盾・兜の骸骨兵 |
| 03 | M0068 | クレイゴーレム | 土塊でできた人型造物 |
| 03 | M0069 | ウッドゴーレム | 木の幹と枝の人型造物 |
| 03 | M0070 | アニメイテッドアーマー | 首の中が空洞の歩く鎧 |

矩形の正本はmonster-art.js。均等229pxグリッドからは計算しない。

## 未承認の範囲

- 図鑑400種のうち21種をruntimeで登録、残る379種は未登録。遭遇専用70種も未登録。manifestの470行と制作段階の `verified: false` は変更せず、runtimeの21件の個別承認と区別する。
- 02の鵺は鳥頭、ノールは人型に見え、確実な名称対応としない。バグベア等の曖昧なものも採用しない。03のガストは霊体風で、肉体型という指定と違うため採用しない。
- 02/03の他のセルと04〜14/14altは一括承認しない。追加依頼により未検品を明記した原本プレビューだけを用意する。原本には未発見の制作候補も含まれることをdetails内に明示し、発見済み図鑑の個別表示条件は変更しない。
- 07/10は1145×1373、14通常版は上部の大きな5×2、14altは1875×839の横長5×2。将来登録する場合も個別矩形と再検品が必要。01は欠番のまま。
- 受領表の14枚すべてをSHA-256回帰で保全する。原本PNGは切出し・再圧縮・透過修正をしていない。元画像にある微細な色縁の修正は本実装の対象外。

## 検証・引継ぎ

2026-10-22 JSTのローカル差分で実行済み。

- `node --test test-monster-art.cjs`：7/7成功。全21件のID/名前/矩形/実PNG、図鑑HTML、未発見非表示、01欠番、不正入力、エイリアス非生成、全14原本のSHA-256一致を確認。
- `node --test test-overhaul.cjs test-regression.cjs`：2/2スイート成功。
- M3追加後の `node --test test-monster-art.cjs test-overhaul.cjs test-regression.cjs`：12/12成功（画像10テスト＋既存2スイート）。原本メタデータ14件の実PNG寸法/受領表一致、全選択で単一画像、注意文、details開状態/フォーカス、不正入力無視、承認ガード非迂回、全14枚ハッシュ一致を確認。
- `node --check monster-art.js`、M3対象4ファイルの `git diff --check`：成功。
- 対象ファイルの `git diff --check`：成功。systems.jsの既存LF/CRLF変換警告のみ。
- ブラウザ・配布ビルドは担当範囲外で未実施。派生プレビューの目視とNode VM検証は、実ブラウザでのSVG表示確認の代替ではない。

前段の変更ファイルは `monster-art.js`、`test-monster-art.cjs`、本書、`systems.js` の画像関数（旧80〜92行の範囲）のみ。原本プレビュー追加では `monster-art.js`、新規 `monster-art.css`、`test-monster-art.cjs`、本書の4ファイルのみを変更し、systems.jsは再編集しない。systems.js内の既存音声差分等は画像担当の変更ではない。計画・状態・README・index/build・browser testは未編集。

親側統合：indexと配布allowlistへ上記16ファイルを接続済み。detailsの手動開閉状態も現在のDOMから同期し、閉じた後の再描画で勝手に再度開かないようにした。ソースChrome1280/390/320pxで原本02/14別案の実PNGデコード・プレビュー切替/開閉・長い名前の横溢れなし、発見済みホブゴブリン/ヘルハウンドのSVG表示を確認。全原本SHAの回帰も成功。配布版の最終結果と共有状況はDEVELOPMENT_STATUS.mdに記録する。

次の操作は親担当が行う。

1. indexへclassic scriptとCSSを追加し、配布allowlistへ上記16ファイルを追加する。
2. PC/狭幅の実ブラウザで発見済み図鑑の21体・SVGの切出しと、journalのdetails・14択・選択後の開閉/フォーカス・単一画像・原寸/警告を確認する。図鑑の未発見個別情報は非表示のまま、原本には制作候補が含まれる。
3. 全回帰・配布ビルド・ブラウザ検証の結果をplan/statusへ記録し、承認された範囲で共有する。画像担当はGit書き込みを行わない。
