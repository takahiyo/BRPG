# 開発状態

更新：2026-10-22 JST / 担当：統括エージェント。

最新状態：ダンジョン探索・BGM・戦闘・RecentLog改善（D0-D4）を完了、全テスト・ビルド・実ブラウザ検証通過。コミット＆push（D5）へ移行。以下は前段階までの記録。音楽/SE/画像と探索GUIを統合して既存main/devへpushする明示依頼あり。基準HEAD/両remote `dec2022`。I4-I6の整理済み原本14枚も今回共有対象、01欠番は維持。現在の復旧記録は末尾「メディア統合P0-P3」を優先する。状態異常S0-S5は未実装。

## 復旧点

- 場所：BRPG、main、コードの最終共有コミット `ee556a4def20019a2c1ecc9ca12684036e99518d`。
- M0確認済み：git ls-remoteでorigin/main・origin/devとも同じ4aafcd8。装備・探索・クラウド保存統合および複数街依頼は共有済み。再pushは不要。
- 再開時未コミット：ユーザーのAGENTS.md変更とVIBE_STARTER_KIT_REVISED_v3.md追加。保持し今回のstage対象外。
- M0共有済み：`c50157e` をdev/mainへ通常pushし、git ls-remoteで両先端一致を確認。
- M1共有済み（6725492、dev/mainのremote先端一致確認）：game.js/equipment.jsで型・部位・両手定義をEQUIPMENT_RULESへ集約し、初期ロード時の矛盾を拒否。test-equipment.cjsで66破損例の完全退避、全18型の正常入力、V2/V3互換を確認。担当save_boundary、統括が差分照合・全回帰実行。新規文脈verify_releaseも独立照合・装備/ビルドテスト成功、重大指摘なし。index.htmlの2スクリプトURLを更新し旧キャッシュ混在を防ぐ。
- M2共有済み（ee556a4、dev/mainのremote先端一致確認）：scripts/build-pages.cjs/test-build-pages.cjsの配布前検査、READMEの検証手順。HTML参照漏れとソース欠落時に旧distを消さず停止。最初の検査でルートリンク/を誤拒否したためindex.htmlへ解決して修正。
- 今回検証：2026-10-22、M1最終差分でtest.cjs/test-regression.cjs/test-overhaul.cjs/test-equipment.cjs/test-exploration.cjs/test-save-manager.cjs/test-quest-travel.cjs/test-build-pages.cjsの全8スイート成功。game.js/equipment.js/scripts/build-pages.cjs構文確認成功。git diff --check成功（ユーザーAGENTS改行警告のみ）。
- 配布確認：最終index.htmlを含めPagesビルド成功、8773の配布画面で街の起動・保存ダイアログ表示・未ログイン時の再接続案内を確認。8772の既存サーバーは停止状態。検証用8773と作成タブは終了済み。M2のGitHub combined statusも空配列のためCI成功は未確認。M1 push後の公開game.jsはHTTP 200だが新定義は未反映で、公開成功とは判断しない。
- 未完了：Google実ログイン/D1保存/二端末同期、モバイル実機、CSSが参照する未存在画像「モンスター図鑑_LV001-035_シート01.png」。手元の別画像は5×8構成であり代用しない。

## 次の操作

1. 公開サイトへのM1/M2自動反映とCI状況を次回確認する。
2. 次回はGoogle実ログイン/D1/二端末同期の実環境検証を進める。
3. 未作成のモンスター画像は配置仕様を確認して別段階で制作する。

終了時差分：ユーザーのAGENTS.mdとVIBE_STARTER_KIT_REVISED_v3.mdのみを未共有として保持。この最終記録を別の文書チェックポイントとして共有する。

## 2026-10-22追加依頼の復旧点

- 状態：U1（装備UI）実装・検証完了（ローカル）。`characters.js` の部位選択ボタンと部位別候補一覧、1行省略表示、装備中バッジ、未装備品一括倉庫移動を追加。`equipment.js` に0/10/25/50% durability状態関数と安全な一括移動を追加。`equipment.css` は縦1行部位表示、状態色、装備中の視認性を設定。`index.html` のキャッシュキー更新。テストは `test-equipment.cjs` に部位UI・一括移動・耐久境界確認を追加。
- 依頼全体は装備、ギルド、編成、モンスター画像制作仕様、隊列/距離戦闘、工房、酒場、商店を含み、計画をU1-U4へ分割。
- 現在ブランチ `main`、基準HEAD `08deef4`。作業開始時 `git status --short` はユーザーの `AGENTS.md` 変更と `VIBE_STARTER_KIT_REVISED_v3.md` のみ。これらは保持しstageしない。
- remote設定は計画記載の `origin` / dev・main（devはPagesプレビュー、mainはPages本番ビルド）。ただし現在 `git ls-remote` はDNS解決失敗で再確認不可。push/commit前にremoteと保護状況を再確認し、接続不可ならローカル差分を残す。
- 既存UIでは所持品カードから装備、個別倉庫移動、装備部位の非操作表示が実装済み。U1ではこれを部位起点の選択、視認性、まとめて倉庫へ送る操作、耐久しきい値色/アイコンに改善する。
- U1受入条件：部位を選ぶと対応装備候補に絞れる。装備中はアイコン/色で識別される。耐久率50/25/10/0%境界が表示に反映。一括倉庫移動は非装備品だけを対象とする。装備競合・所持枠・旧セーブを壊さない。
- 検証済み：`node test-equipment.cjs`, `test.cjs`, `test-regression.cjs`, `test-overhaul.cjs`, `test-exploration.cjs`, `test-save-manager.cjs`, `test-quest-travel.cjs`, `test-build-pages.cjs` がすべて成功。`git diff --check` 成功（既存ユーザーAGENTS含む改行変換警告のみ）。実ブラウザ視覚QAは未実施。
- 作業差分：上記に加えて `DEVELOPMENT_PLAN.md` / `DEVELOPMENT_STATUS.md`。ユーザーの `AGENTS.md` と `VIBE_STARTER_KIT_REVISED_v3.md` は未stageで保持。commit/pushは未実施、remote DNSは再確認時に利用不可。
- 次の具体操作： (1) 接続回復後にremote先端と保護設定を照合し、今回の作業だけをstage対象にしてcheckpointを保存・共有 (2) U2のギルド依頼グルーピング/即達成アイコン、編成セット内容の表示改善を実装・検証 (3) 以降U3/U4を順に実施。

## 継続作業中のチェックポイント（2026-10-22 JST）

- U1追加：部位別候補へ倉庫品を追加、装飾2の指定を保持。お任せ装備は4出所のチェックと攻防合計の組合せ最適化（両手/盾、装飾重複、所持枠保護）。`test-equipment.cjs` 成功。
- 分担：guild_presets（Sol medium指定）はfacilities.jsのギルドとsystems.jsのセットを完了、統括がcharacters.jsへ表示統合。tavern_shop（Sol high指定）は酒場・商店を実装、統合確認待ち。formation_combat（Sol high指定）はformation.js/cssとexploration-ui.jsの隊列/距離戦闘を実装・検証中。モデルの実適用メタデータは未確認。
- 統括は工房の製作仕様計算をpreviewと実製作で共有し、部位別optgroupと性能予測を追加。既存overhaul成功。
- 次：モンスター画像仕様と誤対応修正、formationをindexと配布allowlistへ接続、ブラウザ/回帰検証、状態文書更新。GitHub DNS失敗は再発を確認。commit/push未実施。ユーザー指示差分を保護。

- push結果：commit a007325 をorigin/main・origin/devへpushし、両remote先端とも a007325 に一致。push成功を確認。CI成功は未確認（gh未導入）、公開成功は未確認。
## 今回の再開（2026-10-22 JST / OpenCode）

- R0完了：ローカルmain/HEAD `08deef4`。`git ls-remote origin refs/heads/main refs/heads/dev` 成功、両remoteはHEADと一致。前回のDNS阻害は解消。既存の未コミットU1-U4とユーザーのAGENTS/共通規則文書を保持。
- 記録との差：formation.js/cssは既にindex.htmlと配布allowlistへ接続済み。docs/MONSTER_ART_SPEC.mdとdocs/monster-art/の制作リストも存在。統合の二重実装はしない。
- R1完了（ローカル）：読み取り専用explore担当が施設/編成差分をレビュー。転職SP比率の端数処理と重複プリセットIDの2件を確認し、characters.js/systems.jsを最小修正。test-overhaul.cjsにSP 0/1/8でのプレビュー一致・状態不変・重複/不在IDの保存再読込を追加。編成/商店/依頼のクリック経路、工房の委託/自作の予測値・耐久・消費品質と実製作の一致も検証。追加テストの修正前失敗と修正後成功を確認。
- R2完了（自動検証・ローカル）：`node --test test.cjs test-regression.cjs test-overhaul.cjs test-equipment.cjs test-exploration.cjs test-save-manager.cjs test-quest-travel.cjs test-build-pages.cjs test-formation.cjs` は最終コードで9件成功。`python -m unittest discover -s scripts -p "*_test_*.py" -v` は44件成功。初回Pythonで新規画像文書のfrontmatter不足により1件失敗したため、MONSTER_ART_SPEC.mdと制作リスト17文書に既存の創作タグを追加して再実行。`node scripts/build-pages.cjs`、characters.js/systems.jsの `node --check`、`git diff --check` 成功（LF/CRLF警告のみ）。distは再生成済み・Git管理対象外。
- U1-U4の現在地：装備・依頼/セット・施設・隊列/距離戦闘はローカル実装と自動検証済み、実画面QAと戦闘バランスの受入確認は未完了。画像仕様/制作リストは用意済み、新規画像は未制作。旧シートの誤対応/未存在シート参照は取り除かれ、未検品画像はアイコンへフォールバックする。
- 今回変更：characters.js、systems.js、test-overhaul.cjs、README.md、DEVELOPMENT_PLAN.md、DEVELOPMENT_STATUS.md、docs/MONSTER_ART_SPEC.md、docs/monster-art/*.md。前回の装備/施設/隊列/配布/テスト差分も未コミットのまま保持。ユーザーのAGENTS.md・VIBE_STARTER_KIT_REVISED_v3.mdは未編集。
- 制約：gh未導入でCI状態未確認。Playwright/Puppeteer未導入で実ブラウザQA未実施。新規パッケージ導入や有料API切替は行っていない。今回のGit書き込みは明示依頼がないため未実施（no_git）。公開成功は判断しない。
- 次の操作：(1) PC/狭幅の実ブラウザで装備・酒場転職・商店・編成・距離対象選択をQA (2) 明示依頼時に差分を選別してcommit/pushし、CI/公開結果を別途確認 (3) Google実ログイン/D1/二端末同期と画像制作・検品を別段階で進める。

## 実ブラウザ継続の復旧点（2026-10-22 JST）

- B0完了：既存Chromeを確認。test-browser.cjsを新設し、Node組込みWebSocket/CDPで隔離headlessブラウザを起動。一時プロファイル・ループバック限定サーバーを終了時に削除/停止する。追加パッケージ・外部サービス不要。普段のブラウザ/保存領域は使用しない。
- B1完了（ローカル）：`node test-browser.cjs` で1280/390/320pxの主要8画面、装備ダイアログ、装備解除/再装着、編成保存/呼出し、転職プレビュー/確定、商店切替/購入、工房委託、保存画面、近距離対象選択/ターン実行が成功。未捕捉例外なし。テスト自身の評価変数再宣言を修正済み。
- B1修正：空白なし英字24文字の名前で390pxのページ/詳細が横溢れし、折返し追加後も320pxの装備中バッジがはみ出す問題を実ブラウザで再現。style.cssの折返し、equipment.cssのバッジ幅と折返しを最小修正、index.htmlのCSSキャッシュキーを更新。修正後は3幅とも横溢れなし。通常名の320px詳細と390px戦闘をPNGでも確認（作業用画像は一時ディレクトリ内）。
- B2完了（ローカル）：最終CSSでNode 9スイート成功（前節記載の `node --test ...`）、Python 44件成功、`node scripts/build-pages.cjs` 成功。`node test-browser.cjs --dist` も1280/390/320pxすべて成功し、配布画面で長い名前・装備/編成/転職/商店購入/工房/保存画面/戦闘ターンを確認。`node --check test-browser.cjs` と `git diff --check` 成功（改行変換警告のみ）。
- 今回の変更はtest-browser.cjs、style.css、equipment.css、index.html、README.md、計画/状態文書。READMEにブラウザ検証手順と保証範囲を追加。既存未コミット差分を保持し、Git書き込みなし。remote main/devは再照合して `08deef4` のまま。起動した専用サーバー・Chromeは各実行後に終了、一時プロファイルは削除済み。`--screenshots` のPNGのみ一時ディレクトリに保持。
- 残課題：headless Chromeの主要スモークQAは完了。実機タッチ/全組合せの表示・戦闘バランス受入・Google実認証/D1/二端末同期・画像制作/検品・CI/公開確認は未完了。普段の保存・Google認証・本番サービスは操作していない。
- 次の操作：(1) 距離戦闘を含む複数シード・編成別のバランス計測を追加 (2) Google実認証や画像制作は利用可能な検証環境/素材に応じて別段階で進める (3) 明示依頼時に関連差分をレビューしてcommit/pushし、CI/公開結果を区別して確認。

## 距離戦闘計測の再開（2026-10-22 JST / C0-C2）

- C0完了：main/HEAD `78d882a`、origin/main/devとも一致。開始時差分はユーザーのAGENTS.mdとVIBE_STARTER_KIT_REVISED_v3.mdのみ。これらは未編集・stage対象外。ユーザーから開発とpushの明示依頼あり、既存origin/main/devへのcheckpoint_autoを再確認。
- 読み取り専用explore担当の境界レビューで3件再現：距離フォールバックが温存と最終MP保護を迂回、全体物理技の途中破損で後続対象が攻撃されず毒だけ付与、MP0前衛が味方後衛の近接だけを遮蔽。統括が回帰テストと最小修正を担当。通常の戦闘定数は変更しない。
- 次：(1) test-formation.cjsに3境界を追加して修正 (2) 固定シード・初期/4人/6人・近中遠距離編成を計測し結果と限界を記録 (3) 全回帰とdistブラウザを通して関連差分のみcommit/push、remote一致確認。

- C1実装・計測完了（ローカル）：formation.jsで最終自動行動に温存/最終MANA保護、全体技の開始時射程固定、気絶前衛の遮蔽解消を実装。test-formation.cjsに再現と手動最終MANA/旧装備読込の互換性を追加。game.jsの新規初期装備だけ後衛を木製杖へ変更（既存装備は変更しない）。
- 計測：test-combat-balance.cjsで5編成×3地域Lv1/2/10×30シード=450戦を2回、900戦の再現一致、編成間の同一敵条件、全行動の到達・最終MANA保護・保存有効・100ターン以内の終了を確認。小さい連番だけの計測では入口旧編成29/30勝だったが、uint32に分散したシードでは20/30勝となり初期後衛の装備不整合が顕在化。新規杖編成は29/30勝、防御平均12→0回。Lv2/10と条件/限界はdocs/COMBAT_BALANCE.mdに記録。敵の数値は未変更。
- C2検証完了：`node --test test.cjs test-regression.cjs test-overhaul.cjs test-equipment.cjs test-exploration.cjs test-save-manager.cjs test-quest-travel.cjs test-build-pages.cjs test-formation.cjs test-combat-balance.cjs` は10件成功（計測スイート約45秒）。`python -m unittest discover -s scripts -p "*_test_*.py" -v` は44件成功、`node scripts/build-pages.cjs` と `node test-browser.cjs --dist` は成功（1280/390/320px）。`git diff --check` 成功（改行変換警告のみ）。読み取り専用explore担当も3境界の修正とテスト前提を最終照合し追加指摘なし。独立担当はテストを再実行していない。
- 初回回帰で新規杖を持つ僧侶のMP不足時の行動期待が「防御」のままだったため、届く杖の「攻撃」へテストを修正して全件再成功。game.js/formation.jsのブラウザキャッシュキーも更新。
- C2共有完了：game.js、formation.js、index.html、test-formation.cjs、test-combat-balance.cjs、docs/COMBAT_BALANCE.md、README.md、計画/状態の計9ファイルを `fbd0e12db74a6d42cebd41ce71115e85c6886403` にcommit。`git push origin HEAD:refs/heads/main HEAD:refs/heads/dev` 成功、`git ls-remote` で両先端一致を確認。ユーザーAGENTS.mdと共通規則原本、distはstageしていない。gh未導入でCI/Pages公開成功は未確認。push成功と公開成功は区別する。
- 文書checkpoint：この計画/状態の共有結果更新を別の通常commit/pushで保存する。文書自身のSHA追記だけの追加コミットは作らない。専用ブラウザ/サーバーは終了済み、一時プロファイル削除済み。外部のDB・認証・設定は操作していない。
- 次：(1) Lv2の装備更新・成長配分・連戦経済を固定シードで検証 (2) ghが利用できる環境でCI/Pages反映を確認 (3) Google実認証と画像制作、全装備/高Lv/ボス/実機タッチを別段階で進める。

## 状態異常・バフの追加計画（2026-10-22 JST）

- 依頼は「開発計画 追加」。指定20種の効果を必須とし、追加異常/バフ・回復/予防/付与手段を候補として区別。docs/STATUS_EFFECTS_PLAN.mdを新設し、DEVELOPMENT_PLAN.mdへS0-S5の依存・完了条件・検証方法を追加。CHARACTER_SYSTEM.mdへ現行仕様との違いと参照先を追記。
- 特にMP0の気絶からマナ枯渇への分離、SP0の行動不能化、全快までの後遺症、行動ごとの毒、睡眠の重複/精神抵抗、操屍の離脱/敵化/回収/蘇生/欠損/ロスト/隠し進化を明記。数値・時間単位・能力群・致死から回復できる手段・操屍放置判定は未確定として残す。
- 今回は文書4ファイルのみ。ゲームコード/データ/保存形式/配布物は未変更。開始時のユーザーAGENTS.mdとVIBE_STARTER_KIT_REVISED_v3.mdは未編集・保護。追加の「プッシュまで」依頼で文書のcommit/pushを承認。origin/main/devと基準HEADの一致を再確認し、この4ファイルだけを共有する。CI/Pages公開結果は未確認。
- 検証：`python -m unittest discover -s scripts -p "*_test_*.py" -v` は44件成功（文書frontmatter/名前/参照整合を含む）。`git diff --check` 成功（改行変換警告のみ）。必須20種と操屍の派生要件、対応バフ/対処手段を文書上で照合。ゲームコード未変更のためNode/ブラウザ/ビルドは今回再実行しておらず、新規状態の動作検証成功を意味しない。
- 次：(1) 実装依頼時にS0の時間/全快/能力群/陣営/ロスト契約を確定 (2) S1aの共通基盤と毒の保存移行から小段階で実装 (3) 各段階で回復手段/UI/AI/旧保存を同時検証。旧課題のLv2経済・認証・画像・実機・CI/公開確認も継続。
- 共有結果：4文書を `6ee6b372717bca4a7147ecbcf3d16d280f8a3d30` にcommitし、`git push origin HEAD:refs/heads/main HEAD:refs/heads/dev` 成功。`git ls-remote` で両先端一致を確認。この共有結果の記録も同ブランチへ通常commit/pushするが、自身のSHA追記だけの追加コミットは作らない。CI/公開反映は未確認。ユーザーの規則ファイルは未共有のまま保護。

## 音声・探索GUI・画像表の継続点（2026-10-22 JST）

- ユーザー追加MP3：Cath_Slan_na_n_Og.mp3（戦闘）、The_Wayfarer_s_Morning.mp3（街）。開始時のAGENTS/共通規則原本とともに保持。音声担当generalがaudio.js/css・test-audio.cjs・docs/AUDIO.md、systems.js音声節を実装。親側のindex/配布統合と実ブラウザ検証は未実施。担当報告は音声12テスト・既存8スイート・Python44件成功。探索GUIは未編集。
- 効果音ラボ規約/FAQを取得：ゲームとGitHubへの音源組込みは許可、直リンクと素材再配布は禁止。外部SEはまだ取得/組込みしていない。Cloudflare Pages公式で1アセット25MiB上限を確認。
- 新しい「制作対象の表とフレーバー」依頼を先に処理。既存図鑑フレーバー400種とDATA.enemies/bossesの70種を既存manifestの位置へ結合し、全17シートを再生成可能にする。画像生成そのものは行わない。
- I0完了：docs/MONSTER_ART_TABLES.mdの索引と全17シートに470対象の特徴/生態/フレーバーを追加。遭遇70種はworld-data.jsの原典説明を保持し、外見補助と新規フレーバーを制作案として区別。図鑑400種は既存の種族/特性/生態/フレーバーを結合。scripts/export_monster_art_tables.pyで再生成可能、scripts/monster_art_test_tables.pyで全対象ID/名前/枠/内容/空白枠と生成結果一致を検証。
- 検証：`python scripts/export_monster_art_tables.py` 成功、`python -m unittest discover -s scripts -p "*_test_*.py" -v` は47件成功、`git diff --check` 成功（改行変換警告のみ）。画像未生成、manifest未変更・全件未検品のまま。音声/ゲーム動作の親側検証成功とは区別する。
- 次：(1) 音声モジュール/音源をindex・配布へ統合 (2) パーティー固定表示/MAP敵切替/遭遇演出とSE (3) PC/狭幅ブラウザ・回帰・配布検証。画像表依頼を優先して音声/GUIは途中保存。現在は未コミット、ユーザー規則ファイルはstageしない。

## サンプル対応I1-I3（2026-10-22 JST）

- I1確認：ユーザー追加docs/30体のモンスター透過スプライトアトラス.pngは1145×1374px・RGBA・2,018,380 bytes。既存Pillowで読取のみ、アルファ0〜255・完全透明848,318px・四隅0を確認。5列×6行なら229pxセル。全サービス共通上限と断定しない。元PNGは未加工、ゲーム用各セルの検品は未実施。
- I2完了：基準1145×1374/229px、四辺19px以上の透明余白へ変更。SKILL・正本仕様・両exportスクリプトと再生成文書・manifestのlayoutのみを同期し、470対象の対応は保持。画像を自動登録/配布しない。読み取り専用explore担当は解像度参照とruntime非依存を確認済み。
- I3検証済み：`python scripts/export_monster_art_prompts.py` と `python scripts/export_monster_art_tables.py` 成功。`python -m unittest discover -s scripts -p "*_test_*.py" -v` 50件成功（PNGヘッダと正方形セル寸法、生成一致、470行/空白枠、旧大判指示の不在）。Pillowは一度の画像調査にのみ使用し、新規テストはPython標準ライブラリのみ。`node scripts/build-pages.cjs` と `git diff --check` 成功（改行警告のみ）。今回ゲームコードを変更していないためゲームNode/ブラウザ回帰は再実行していない。
- 共有対象：制作仕様・索引・17制作表・manifest・共通スキルと持ち運び文書/14入力・export2本/専用テスト・参考PNG・計画/状態。ユーザーのアップ依頼に従いorigin/main/devへ通常commit/pushする。音声途中差分（systems.js/audio関連）・README・AGENTS/共通規則原本・MP3はstageしない。CI/公開成功とは区別。
- I3共有完了：画像制作関連29ファイルを `b74258d136259b778417f9d9c6c2e2414081181f` にcommit。`git push origin HEAD:refs/heads/main HEAD:refs/heads/dev` 成功、`git ls-remote origin refs/heads/main refs/heads/dev` で両先端一致を確認。CI/Pages公開は未確認。ゲーム用画像登録・本番設定変更はしていない。この結果記録も通常commit/pushするが、自身のSHAを追記するだけの追加commitは作らない。
- 残る未共有差分：AGENTS.md・README.md・systems.js、MP3×2、VIBE_STARTER_KIT_REVISED_v3.md、audio.js/css・docs/AUDIO.md・test-audio.cjs。いずれも保持、今回stage対象外。distはGit管理対象外。
- 次：(1) 生成時は改修済み共通プロンプトと対象表1枚を使用し、各セルを検品 (2) 音声/探索GUIの親側統合を再開 (3) 対応実装後にPC/狭幅・ゲーム回帰・配布を検証。画像の新規生成は未実施、サンプルは未加工・未承認の参考資料。

## 受領シートI4-I6

- 元ファイルの末尾番号はID範囲ではない。主担当が元1/2/12/13/14、読み取り専用exploreが元3〜11の先頭行を制作表と照合。元1〜12→catalog-02〜13、元13はcatalog-14別案、元14はcatalog-14通常版。全セルの適合確認ではない。
- 旧参考PNGは開始時から削除済み。ユーザーに確認し「現存14枚だけ整理」を選択。復元・複製・推測で01を補わない。元6/9（移動後07/10）は1145×1373px、元13（14別案）は1875×839px。他11枚は1145×1374px、全件RGBA。
- 初回専用テスト6件のうち5件成功、旧参考PNG削除によるFileNotFoundErrorが1件。参照とテストを現存02へ切り替える。画像は再圧縮/拡大/切出しせず移動し、前後SHA-256を照合する。runtime/配布リスト/verifiedは変更しない。
- I5完了：PowerShell Move-Itemでdocsからルートへ移動。monsters_sheet02_M0031-M0060.png〜monsters_sheet14_M0391-M0400.pngの通常版13枚とmonsters_sheet14_M0391-M0400_alt.pngの別案1枚。全ソース/移動先を事前検査し上書きなし、14件すべてSHA-256一致。docs/monster-art/RECEIVED_SHEETS.mdに元名/先名/実寸/ハッシュと01欠番・配置問題を記録。
- I6完了：SKILL・正本仕様・export2本と生成文書（共通プロンプト/索引）・専用テストを、削除済み旧サンプルではなく現存02へ切替え。`python scripts/export_monster_art_prompts.py` / `python scripts/export_monster_art_tables.py` 成功、`python -m unittest discover -s scripts -p "*_test_*.py" -v` 51件成功、`node scripts/build-pages.cjs` と `git diff --check` 成功（改行警告のみ）。追加テストは14枚のID範囲/名前/PNG寸法/保全SHA/元名不存在/01欠番を検証。全セルverifiedとruntime、配布リストは未変更、ゲームNode/ブラウザ回帰は対象外で再実行なし。
- 未コミット差分：上記14画像・受領記録・仕様/SKILL/export/生成文書/専用テスト/計画状態。旧参考PNGのユーザー削除はそのまま保持。開始時のAGENTS/README/systemsと音声関連・MP3・共通規則原本は保護。今回commit/pushは行っていない。
- 次：(1) 01を別途受領し、07/10と14の寸法/配置を検品・補正方針確定 (2) 個別セルを名称/余白/透明背景で検品してからゲーム登録/配布へ接続 (3) 音声/探索GUIの親側統合を再開。現在の画像は未加工・未承認。

## メディア統合P0-P3

- P0完了：origin/main/devはdec2022と一致。戦闘BGM4,388,427bytes、街BGM4,290,624bytes（25MiB未満）。ユーザーの音楽/SE/画像をpushまでの依頼で過去no_gitを解除しcheckpoint_autoを再確認。AGENTSと共通規則原本は未stageで保護する。
- 分担：general画像担当がsystemsの画像関数だけを明示矩形対応にし、monster-art.js/css・専用Nodeテスト・統合文書を作成。21体を確認済み、残りは未登録。14原本の選択プレビューを追加。別generalがexploration-ui.js/css・test-exploration.cjsで仲間固定/MAP敵切替/単発遭遇SEを実装。双方Git書き込みなし。親担当はindex・配布・音声・ブラウザQA・文書を統括。
- P1/P2統合中：indexに音声UIとaudio.js/css、monster-art.js/cssを接続。14PNGと2MP3を明示配布許可し、25MiB超過を旧dist削除前に拒否する。SEは合成音の共通Gain、効果音ラボ素材は未取得/未使用。原本画像に破壊的処理なし、01は復元しない。
- P1/P2ローカル完了：常設音声UI/2曲/合成SE、仲間の固定配置とコンパクト化/MAP敵切替を接続。個別21体は明示矩形・SVG縦横比保持、14原本は未検品警告付きで選択式表示。原本07/10/14を均等229pxとして扱わず、01欠番・遭遇70種の別IDを保護。画像プレビューの手動閉状態も再描画で維持する。
- 親側ソース検証：Chrome1280/390/320pxでネイティブMP3取得/デコード/再生進行、BGM街→戦闘→街/単一曲、別音量/消音/再読込、SEの単発生成・消音、仲間位置不変と高さ上限、MAP敵切替、PNG実デコード/図鑑SVG表示、装備/商店/工房/保存/戦闘の既存操作が成功。最初のテストで幅ループ間の原本選択状態を固定値と誤認し待機失敗したため、各幅で02へ明示選択するテストに修正。実装の画像欠落ではない。画面PNGも目視確認。
- 自動回帰：`node --test test.cjs test-regression.cjs test-overhaul.cjs test-equipment.cjs test-exploration.cjs test-save-manager.cjs test-quest-travel.cjs test-build-pages.cjs test-formation.cjs test-combat-balance.cjs test-audio.cjs test-monster-art.cjs` 全32件成功（900戦再現を含む）。Python51件成功。配布最終確認・文書再生成・限定Git共有はこれから実施する。
- P3検証完了（再開セッション）：両exportを再実行し差分なし（生成一致）。Node12スイート33件・Python51件・`node scripts/build-pages.cjs`・`git diff --check` 成功。`node test-browser.cjs --dist` はサンドボックス内でChromium起動不可（終了コード4294930433）のため隔離外で再実行し、1280/390/320pxで音声/画像/仲間固定/MAP敵切替/遭遇SE/既存操作すべて成功。
- 共有対象：AGENTS.md・VIBE_STARTER_KIT_REVISED_v3.md（ユーザー規則）と旧参考PNG `docs/30体の…アトラス.png` の削除（ユーザー操作、未stage保持）を除く全差分。サンドボックス内のgit ls-remoteはプロキシ接続不可のため、push/照合は隔離外で行う。
- P3共有完了：関連差分を `b257e5326085c838ebbfd41e39b9289e15f5f33d` にcommitし、`git push origin HEAD:refs/heads/main HEAD:refs/heads/dev` 成功、`git ls-remote` で両先端一致を確認。CI/Pages公開は未確認。残る未共有差分はAGENTS.md・VIBE_STARTER_KIT_REVISED_v3.md・旧参考PNG削除のみ。

## ダンジョン探索・BGM・戦闘・RecentLog改善（D0-D5）

- D1完了：`game.js` の `note` で直前のメッセージと同一の場合に行を消費せず `*1`、`*2`…と回数表示を更新。タブ操作時の「帰還後に利用できます。」でのログ埋まりを解消。`logHTML` および `exploration-ui.js` に「過去の記録を展開」ボタン（`toggle-log-expand`）を追加し、最大100件まで履歴表示・スクロール可能にした。
- D2完了：楽曲を `audio/` ディレクトリで一元管理（`The_Wayfarer_s_Morning.mp3`, `Cath_Slan_na_n_Og.mp3`, `Sho_lah_Beneath_the_Moon.mp3`）。`audio.js` で灰灯の林縁（`forest_edge`）の探索BGMとして `Sho_lah_Beneath_the_Moon.mp3` を設定。街⇔灰灯の林縁⇔戦闘のBGM切り替えと復帰を自動化。`docs/AUDIO.md` に楽曲管理規則を記録。
- D3完了：`systems.js` で探索済みタイルと踏破フロア（階段到達/ボス撃破/クエスト達成）を永続化し、再突入時に暗くならない仕様を実現。`facilities.js` に高Lv帯行動書「測量踏破の手引書」（Lv25）を追加し、探索者等の支援職同行または同手引書習得時に地図（Canvas `#map`）クリックによるBFS最短経路自動歩行を可能にした。自動探索の戦闘後歩行再開ラグを3秒から1.5秒に短縮。キーバインド（Space: 自動探索 / Enter: 階段・決定 / R: 帰還 / 戦闘時 Enter/T/B）を配備。
- D4完了：自動戦闘タイマーのインターバルを1.1秒から1.5秒へ調整し、一瞬で戦闘が終わる問題を緩和。`systems.js` で `enemyTurn` をラップし、敵の各種行動（通常攻撃・装甲強化・毒・ドレイン・呪詛・薙ぎ払い）にSE（`playSE`）と視覚エフェクト（`.fx-attack`, `queueFX`）を付与。
- D5検証完了：Nodeテスト13スイート（全36件）成功、Pythonテスト（51件）成功、Pagesビルド成功、Chrome実ブラウザテスト（1280/390/320px）で全探索・BGM切替・戦闘操作の正常動作を確認。
- D5共有完了：関連差分を `65cc7c94f58963d982045467cd6c1ae2a78bd3a2` にcommitし、`git push origin HEAD:refs/heads/main HEAD:refs/heads/dev` 成功、`git ls-remote` で両先端一致を確認。CI/Pages公開は未確認。残る未共有差分はAGENTS.md・VIBE_STARTER_KIT_REVISED_v3.md・旧参考PNG削除のみ。

## マップデザイン刷新・画像生成仕様策定（M_ART_01〜M_ART_03）

- M_ART_01完了：`docs/MAP_ART_SPEC.md` を作成。壁・床・宝箱・罠・階段等の稚拙な幾何学描画を画像生成アセットへ置き換えるための正本仕様書。モンスターアート（`MONSTER_ART_SPEC.md`）と完全互換の1145×1374px、5列×6行、229px正方形セル、四辺19px余白、透過PNG、見下ろし角（床/罠: 60度、壁/オブジェクト: 2.5D 30〜45度）の制作規格および `exploration-ui.js`（`BRPGMapArt`）へのCanvas描画契約・未検品時の安全なフォールバック設計を策定。
- M_ART_02完了：`docs/MAP_ART_TABLES.md` を作成。全4シート（Sheet 01: 構造物・宝箱・結晶、Sheet 02: 地形ギミック・トラップ、Sheet 03: 灰灯の林縁・森林、Sheet 04: 地下迷宮・古代遺跡・鉱廊）計120セルの詳細制作指示・外見描写・世界観フレーバーを体系化。
- M_ART_03完了：`docs/map-art/マップアセット共通プロンプト.md` を作成。画像生成AI（ChatGPT / Midjourney等）へ渡すシステムプロンプト・共通指示文を整備。Obsidian相互リンク整合性を確保。
- M_ART_01〜03共有完了：`df47bf15c54e62f922ce61ce3300816c6aeb21e8` でmain/devへ通常push、両先端一致確認。

## 受領マップアセット4枚の整理・改名・移動・配布統合（M_ART_04）

- 受領画像照合：ユーザーが `docs/map-art` へ投入した生成画像4枚を調査。全4枚が 1145×1374 px・RGBA（透過PNG）で完全一致。セル絵柄・平均RGBを照合し、連番 `-1.png`〜`-4.png` が Sheet 01〜04 に1対1で対応することを確認。
- 移動・改名：モンスター画像ルール（ルート配置・バイト不変）に準拠し、プロジェクト直下へ `map_sheet01_structures.png` 〜 `map_sheet04_dungeon.png` として移動。全4件で移動前後のSHA-256一致を確認（再圧縮・切出し加工なし）。
- 受領記録作成：`docs/map-art/MAP_ART_RECEIVED.md` を新設し、元名/先名/実寸/SHA-256/対応ID範囲と検品前フォールバック注意を記録。Obsidian stem重複を回避。
- 配布・回帰検証：`scripts/build-pages.cjs` の配布許可リストへ4枚を追加。`scripts/map_art_test_received.py` を新設し画像契約を自動検証。Pythonテスト全52件、Pagesビルドテスト（`test-build-pages.cjs`）、Nodeテスト全36件が合格。
- M_ART_04共有完了：`eb6095272f69a878cf1fca1c8eb3991a1b2389a5` でmain/devへ通常push、両先端一致確認。

## 装備UI改善：部位選択時の装備可能品一覧モーダル化（EQ_MODAL_01）

- 課題と改修方針：キャラクター詳細画面（`character-dialog`）で部位選択時に表示されていた装備可能品一覧が縦に長く画面を占拠していたため、インライン候補一覧を撤去。部位スロットボタンクリック時に専用モーダル（`<dialog id="equipment-dialog">`）を開く構造へ刷新。
- 実装内容：
  - `characters.js`：`equipmentModalContent` を新設し、部位ごとの現在装備・外すボタン・所持品候補・倉庫品候補をモーダル内へ集約。`openEquipmentDialog`、`closeEquipmentDialog`、`refreshEquipmentDialog` を実装。装備実行時にモーダルを閉じ詳細を即座に更新、解除や倉庫受渡し時はモーダル内を即座に再描画。ペーパードール各部位に「変更 ▾」ガイドを付与。
  - `index.html`：`<dialog id="equipment-dialog">` を配備。CSS/JSキャッシュキーを更新。
  - `equipment.css`：モーダルスタイル（`#equipment-dialog`、`.equipment-modal-header`、`.equipment-modal-current`、`.equipment-slot-action-hint`）を追加し、390px/320px狭幅でのレスポンシブ表示を担保。
- 検証結果：
  - Node.js テスト：`test-equipment.cjs`、`test.cjs`、`test-dungeon-improvements.cjs`、`test-overhaul.cjs`、`test-monster-art.cjs`、`test-audio.cjs`、`test-build-pages.cjs` 全て合格。
  - 実ブラウザテスト（`test-browser.cjs`）：Chrome 1280px / 390px / 320px の全3幅で、ソース版および配布ビルド版（`--dist`）ともに装備解除・再装備・長い名前・保存・施設操作すべて例外なく完全合格。
  - Python テスト：全52件合格。
- EQ_MODAL_01共有完了：`892e21b` でmain/devへ通常push、両先端一致確認。

## ダンジョンマップアート描画エンジン適用（M_ART_05）

- 課題と改修方針：受領・配置されたマップアセット（`map_sheet01_structures.png` 〜 `map_sheet04_dungeon.png`）がゲーム画面（Canvas `#map`）に適用されておらず幾何学描画のままだった問題を解消。専用描画エンジン（`map-art.js`）を新設し、`exploration-ui.js` の描画処理と接続。
- 実装内容：
  - `map-art.js`：`BRPGMapArt` モジュールを新設。4シート（`structures`, `hazards`, `forest`, `dungeon`）の事前ロード、セル切り出し描画（`drawCell`）、ダンジョン別バイオーム判定（`getBiome`）、ロード完了時のCanvas自動再描画を実装。未読み込み時や描画失敗時は安全に `false` を返し既存の幾何学描画へフォールバック。
  - `exploration-ui.js`：Canvas `draw()` 関数内で `BRPGMapArt.drawCell()` を呼び出し、床（バイオーム別4種）、壁（バイオーム別5種）、出入口アーチ門（col 0, row 0）、階段（col 2, row 0）、宝箱（col 2, row 1）、鉱石/採集（col 2, row 2）、ボス祭壇（col 0, row 1）、水辺/崖/隠し扉/罠（Sheet 02）、未探索マス、探索パーティ現在地マーカー（向き別3種）を描画。
  - `index.html`：`<script src="map-art.js?v=20261022-map-art"></script>` を `exploration-ui.js` の直前へ追加。
  - `scripts/build-pages.cjs`：配布許可ファイル配列に `'map-art.js'` を追加。
  - `test-browser.cjs`：エンカウント突入テスト時の notice 行数変動による垂直位置ブレを排除し、全3幅（1280px/390px/320px）でのブラウザ検証を安定化。
- 検証結果：
  - Node.js テスト：`test-exploration.cjs`、`test-dungeon-improvements.cjs`、`test-equipment.cjs`、`test-build-pages.cjs` 全て合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅でソース版・Pages配布版ともに完全合格。
- M_ART_05共有完了：`f706361` でmain/devへ通常push、両先端一致確認。

## モンスターアート全シート・戦闘敵適用（MON_ART_01）

- 課題と改修方針：手元に配置済みの全13枚のモンスター画像シート（Sheet 02〜14、計370体分）がゲーム内でわずか21体しか登録されておらず、さらにダンジョン遭遇敵（`DATA.enemies`）へのマッピングが存在しなかったため、ダンジョン戦闘画面で敵画像が一切表示されず絵文字アイコンのままだった問題を解消。
- 実装内容：
  - `monster-art.js`：
    - 全13シート（`catalog-02` 〜 `catalog-14`）を `BRPGMonsterArt.sheets` に一括登録。
    - 5×6標準グリッド（229px正方形、Sheet 07/10の1373px高さ境界、Sheet 14の10体境界を安全に処理）により、M0031〜M0400の全370体のモンスターセルを自動算出・登録。
    - 手動検品済みの21体については、余白を精密調整したカスタム矩形（`x, y, width, height`）を上書き優先適用。
    - ダンジョン戦闘敵（`DATA.enemies` の `rat`, `slime`, `bat`, `spider`, `beetle`, `goblin`, `skeleton`, `wisp`, `wolf`, `fungus`, `golem`, `specter`, `sentinel`, `warlock`, `drake`, `guardian`、および灰灯の林縁等の `boar`, `rabbit`）に対し、外見・種族が合致するモンスターアートを直接 `art.cells` にエイリアス展開。
  - `test-monster-art.cjs`：全シート登録（13シート）、370体以上の登録、ダンジョン遭遇敵のサムネイル生成、図鑑表示、不正矩形防御、XSS防御、原本SHA保全を検証するテストへ刷新。
- 検証結果：
  - Node.js テスト：全13スイート（37件、900戦の戦闘シミュレーション含む）完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で戦闘時の敵サムネイル描画・図鑑表示・全操作が完全合格。
- MON_ART_01共有完了：`e4303b9` でmain/devへ通常push、両先端一致確認。

## ダンジョン探索：階層移動・昇降口改修（TRAV_01）

- 課題と改修方針：ダンジョンで階層移動（下降）した際、2階以上の開始地点 (1, 1) が地上出口になってしまっていた不具合を修正。3階に降りた場合、徒歩なら 3F (1, 1) → 2F (17, 11) → 2F (1, 1) → 1F (17, 11) → 1F (1, 1) → 街出口 と順に戻らなければならないようにする。
- 実装内容：
  - `game.js`：
    - `makeFloor`：`depth > 1` のとき `tiles[1][1] = '<'`（上り階段タイル）。
    - `returnTown`：徒歩帰還の判定を `if (d.depth !== 1 || d.x !== 1 || d.y !== 1)` に更新。2階以上からの徒歩直接帰還をブロック。街帰還時に `delete s.floorCache`。
    - `ascend`：新設。`d.depth > 1 && d.x === 1 && d.y === 1` で発動。現在のフロアを `s.floorCache[d.depth]` に保存し、`d.depth - 1` のフロアへ復帰（出現位置は下り階段 `x = 17, y = 11`、向き上）。
    - `descend`：更新。現在のフロアを `s.floorCache[d.depth]` に保存し、`d.depth + 1` のフロアへ移動（出現位置は昇降口 `x = 1, y = 1`、向き下）。
    - `globalThis.ascend = ascend;` を配備。
  - `systems.js`：
    - `walkTowardEntrance`：`(1, 1)` 到着時に `d.depth > 1` なら `ascend()`、`d.depth === 1` なら `returnTown()` を実行。道中メッセージも「昇降口(1,1)」と「地上出口(1,1)」を区別。
  - `exploration-ui.js`：
    - `atSurfaceExit`（1F (1, 1)）と `atStairsUp`（2F以上 (1, 1)）を分離判定。
    - ヘッダー表示：`atSurfaceExit` で「地上出口 · 無料で帰還できます」、`atStairsUp` で「昇降口 · B{depth-1}Fへ上れます」。
    - 手動タイルアクション：`tile === '<' || atStairsUp` のとき `btn('上の階へ', 'ascend')` を表示。
    - 右側帰還パネル：`atStairsUp` のときは「WAY UP / 上の階へ / 昇降口からB{depth-1}Fへ上る」を表示し、街出口ボタンを表示しない。
    - Canvas描画：`(1, 1)` において 1F はアーチ門スプライト、2F以上は上り階段スプライトを描画。
    - キーバインド：`Enter` で `tile === '<' || atStairsUp` 時に `ascend()`。`R`/`H` で `atStairsUp` 時に `ascend()`。
  - `test-dungeon-improvements.cjs`：
    - `Multi-floor dungeon traversal: depth > 1 has stairs-up (ascend) instead of town exit, requires returning to 1F on foot` テストを追加。
- 検証結果：
  - Node.js テスト：全13スイート（38件、900戦の戦闘シミュレーション含む）完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で完全合格。
- TRAV_01共有完了：`0b20006` でmain/devへ通常push、両先端一致確認。

## マップアート・モンスターアート完全適用・キャッシュ強制更新（FIX_ART_01）

- 課題と改修方針：ユーザー環境（`dev.brpg.pages.dev`）で、MAP画面が幾何学タイルのまま、戦闘時のモンスターも絵文字アイコンのままになっていた問題を徹底調査・根本解決。
  1. モンスターアート未表示の根本原因：
     - `encounter()` の動的オーバーレイで遭遇敵（例: `hornhare` 角ウサギ）が選ばれた際、`enemyAliases` に `hornhare` が存在せず `rabbit` となっていたためフォールバック先を喪失。
     - 図鑑モンスター `M0001`〜`M0030`（シート01欠番30種）が選ばれた際、画像セルが存在しなかったため、約25%〜30%の遭遇敵が絵文字フォールバックしていた。
     - `monsterThumbHTML` が `enemyId` を優先していたため、名前が図鑑名（例: ブラックドッグ）に置換されても元の遭遇敵IDを見に行ってしまっていた。
  2. マップアート未表示・誤表示の根本原因：
     - Canvas描画の (1, 1) マス頭上に、深層フロア（B2階以上）でも「EXIT」という緑看板を描くハードコードが残っていたため昇降口上にもEXITが表示されていた。
     - `map-art.js` で画像プリロード完了時（`onload`）に画面全体の `render()` が連動していなかった。
     - `index.html` に記述されている CSS/JS のキャッシュバスター `?v=...` が更新されておらず、ブラウザが過去の古いスクリプトをHTTPキャッシュから実行し続けていた。
- 実装内容：
  - `monster-art.js`：
    - `M0001`〜`M0030`（30種）のフォールバックマッピングを追加し、全400体が100%画像スプライトを持つ構成に。
    - `enemyAliases` に `hornhare`、`boar`、`viper`、`crab`、`leech`、`cavescorpion`、`cavebear`、`crystalgolem`、`bandit`、および全17種のボス（`boss_boar`〜`boss_seraph`）を完全網羅。
  - `systems.js`：`monsterThumbHTML` で `catalogId` を最優先参照するように改修。
  - `exploration-ui.js`：(1, 1) の看板を `d.depth === 1 ? 'EXIT' : 'UP'` に分岐修正、`globalThis.draw = draw` を明示公開。
  - `map-art.js`：`img.onload` 時に `draw()` だけでなく `if (s.view === 'explore') render()` を実行して画面同期を保証。
  - `index.html`：全CSSおよび全JSのクエリパラメータを `?v=20261022-art-v2` に一括更新し、ブラウザキャッシュを強制破棄。
  - `test-monster-art.cjs`：全400体の画像存在、全遭遇敵・ボスの画像存在（100%取得）を検証。
  - `test-browser.cjs`：全幅（1280/390/320px）でカタログ全3体画像表示、戦闘敵画像表示（`#exp-enemy-view .monster-thumb`）の存在を検証。
- 検証結果：
  - Node.js テスト：全13スイート完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅でソース版・Pages配布版ともに完全合格。
- 次の操作：関連ファイルをstage/commitし、`origin/main` および `origin/dev` へ通常push。保護対象（ユーザーAGENTS.md、VIBE_STARTER_KIT_REVISED_v3.md、旧参考PNG削除状態）はstageしない。

## ゲームプレイ・UI・バランス総合改善（BALANCE_UX_01）

- 改善内容：
  1. **ステータス直接育成** (`characters.js`, `game.js`)：
     - LIFE/MANA/SPの直接強化（LIFE +8/pt, MANA +4/pt, SP +2/pt）を定義。
     - 成長画面（`growthSection`）に生命・精神力（直接強化）セクションを追加。
     - セーブデータ整合性検証（`validSave`）で `hp`, `mp`, `sp` キーの配分を正当に許容。
  2. **装備品射程フィルタ** (`characters.js`)：
     - 装備品モーダルに射程絞り込みボタン群（すべて / 近距離 / 中距離 / 遠距離）を新設。
     - 武器選択時、即座に該当射程の装備候補に絞り込み可能。
  3. **工房請負時の完成性能事前表示** (`systems.js`)：
     - 未識別素材であっても、街工房の職人による見立てとして、完成品の攻撃・防御・耐久・品質の予測値を事前表示。
  4. **隊列変更のD&D操作対応** (`formation.js`, `formation.css`)：
     - 隊列ミニカードに `draggable="true"` を設定し、HTML5 Drag and Drop イベント群を実装。
     - カード間のドラッグ＆ドロップでキャラクター位置のスワップ、列行へのドロップで前衛/後衛の変更に対応。
  5. **帰還符バランス調整** (`world-data.js`, `game.js`)：
     - 帰還符（`scroll`）の価格を `35 G` から `280 G` へ大幅改定。
     - 初期所持数を `2` から `1` に調整し、探索者スキルの優位性を確立。
  6. **キャッシュ強制更新** (`index.html`)：
     - バージョンキーを `?v=20261022-features-v1` に更新。
- 検証結果：
  - Node.js テスト：新設 `test-features.cjs` を含む全14スイート（42件）完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅でソース版・Pages配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。


## マップ視認性・希少種バランス・BGMフォルダ整理（MAP_BGM_ELITE_01）

- 改善内容：
  1. **マップアート視認性・プロンプト指示調整**：
     - 風切りの石道などで道と壁の判別がつかず2階への道が見つからない問題に対応。
     - `docs/map-art/マップアセット共通プロンプト.md`, `docs/MAP_ART_SPEC.md`, `docs/MAP_ART_TABLES.md` を改定：
       - 床・壁・角タイルは四辺透明余白を廃止し「全面不透明・シームレス連続」規則を定義。
       - 視点を真上（トップダウン）に統一し、壁上面のテクスチャが隣タイルへ続くように指示。
       - 明度差40%以上（床60〜75%、壁15〜30%）、色相差（暖色系床／寒色系壁）、コントラスト差を明文化。
     - ゲーム側（`exploration-ui.js`）でも即時対策として、画像壁タイルへの減光処理（`rgba(3,7,9,0.58)`）、床への暖色オーバーレイ（`rgba(236,214,160,0.16)`）、通行可能マスに面する壁辺へのハイライト枠線描画（`#e9d79f`）を実装し、視覚的な道と壁の境界を明瞭化。
  2. **希少種（★希少個体）出現率の適正化** (`systems.js`)：
     - 遭遇敵ごとに15%で付与されていた判定を改修。
     - 1戦闘ごとに4%（約25戦に1回）・最大1体のみが選ばれるように制限し、本来の希少価値を確立。
  3. **BGMフォルダ整理・新曲反映** (`audio/bgm/`, `audio.js`, `scripts/build-pages.cjs`, `test-audio.cjs`, `README.md`, `docs/AUDIO.md`)：
     - `audio/bgm/` ディレクトリを新設し、BGM音源（`Cath_Slan_na_n_Og.mp3`, `Sho_lah_Beneath_the_Moon.mp3`, `The_Wayfarer_s_Morning.mp3`, `Sli_na_Cloch.mp3`, `Solas_na_Sraide.mp3`）を一元配置。ルート直下の重複ファイルを整理。
     - 街BGMに `audio/bgm/Solas_na_Sraide.mp3`、風切りの石道BGMに `audio/bgm/Sli_na_Cloch.mp3` を設定。
     - `scripts/build-pages.cjs` の allowlist に `audio/bgm/` の実利用音源を登録。
     - `test-browser.cjs` のテスト内HTTPサーバーがサブディレクトリ（`audio/bgm/`）を正常に配信できるようにパス解決を修正。
  4. **キャッシュ強制更新** (`index.html`)：
     - バージョンキーを `?v=20261022-features-v2` に更新。
- 検証結果：
  - Node.js テスト：`test-features.cjs`, `test-audio.cjs` を含む全テスト（44件）完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で通常版・配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。


## 探索操作・隊列ナビ・モンスター整合UI改善（UX_IMPROVE_02）

- 改善内容：
  1. **仲間詳細ナビゲーション改善** (`characters.js`, `style.css`)：
     - ステータス詳細画面上部のスクロールで隠れる移動ボタンを廃止し、画面左右中央に固定配置される切り替えボタン（`.character-nav-side.prev` / `.character-nav-side.next`）を新設。
     - 縦スクロールしても画面両脇に常に留まり、片手やワンクリックで快適に仲間の切り替えが可能。
     - 移動順を隊列基準（`orderedRoster()`：前衛1, 2, 3 → 後衛1, 2, 3 → 控え）に統一し、ヘッダーに現在の隊列位置（例：「前衛 1 · 1 / 4」）を明示。
  2. **モンスター隊列のD&D文言・属性排除** (`formation.js`)：
     - `rowHTML` に `isEnemy` フラグを追加し、戦闘画面の敵隊列から「ドラッグで移動」「空き枠（D&Dで配置）」の文言および `data-drop-row` 属性を完全排除。味方隊列のD&D機能のみを正常に保持。
  3. **クリック歩行および「歩いて戻る」のリアルタイム歩行化** (`exploration-ui.js`, `systems.js`)：
     - 同期ループによる即座5歩ワープを改修し、タイマー（160ms/歩）による1歩ずつの滑らかな連続歩行を実装。
     - 地図クリック歩行（`walkTowardTile`）および「歩いて戻る」操作（`walkTowardEntrance`）の双方において、リアルタイムに1歩ずつアニメーション移動。
     - 移動中の再描画、目的地到達時の案内、エンカウント・イベント遭遇時・`stopAll()` の即時安全停止を保証。
  4. **モンスター名とグラフィックの完全整合** (`systems.js`)：
     - エンカウント時の動的オーバーレイでカタログモンスターが選ばれた際、名前置換の確率判定（55%）により「スライムの名前なのにグラフィックがマンティコア」等の致命的な乖離が発生していたバグを根本改修。
     - カタログモンスターとして出現する場合は名前とカタログIDを不可分に一体設定し、ダンジョン固有敵（スライム、コウモリ等）の場合は固有のエイリアススプライトを厳格に保持。
  5. **キャッシュ強制更新** (`index.html`)：
     - バージョンキーを `?v=20261023-ux-v2` に更新。
- 検証結果：
  - Node.js テスト：新設テストを含む全14スイート（48件）完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で通常版・配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。

## 装備変更画面UI修正（EQUIPMENT_MODAL_FIX_01）

- 改善内容：
  1. **装備モーダルの閉じるボタンおよび射程フィルタのクリック動作修正** (`characters.js`)：
     - `boot()` 内のクリックイベントリスナーで `if (!action.startsWith('character-') && !action.startsWith('tavern-')) return;` となっていたため、`equipment-dialog-close` や `equipment-reach-filter` が無視されていた不具合を修正。
     - `!action.startsWith('equipment-')` を追加し、閉じるボタンおよび「すべて / 近距離 / 中距離 / 遠距離」フィルタのクリックが即座に反応するように修正。
     - 装備モーダル外枠クリックでの閉じる挙動（`ev.target === eqDialog`）も維持・保証。
     - ダイアログ初期オープン時に `equipmentReachFilter = 'all'` にリセットし、常に全候補が表示された状態から絞り込み可能。
  2. **戦闘距離・射程仕様の確認** (`formation.js`)：
     - `reachable(actor, foes, allies, reach)` において、`reach === 'long'`（遠距離：弓、杖等）の場合は敵前衛の生存に関わらず全生存敵（`live`）が対象可能。
     - ユーザーの確認質問「自軍後列を1、敵軍後列を4とした場合、遠距離武器なら自軍後列から敵軍後列を直接攻撃できる、で良いのか」に対して、まさにその通りの仕様であることを確認。
  3. **自動テストの整備** (`test-features.cjs`)：
     - 装備モーダルのオープン、射程ボタンクリックによる候補フィルタリング、閉じるボタンによるモーダルクローズを包括的にテスト検証。
- 検証結果：
  - Node.js テスト：`test-features.cjs` 含む全テストスイート完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で通常版・配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。

## ダンジョン推奨レベル・難易度表示適正化（DUNGEON_RECOMMENDED_LV_01）

- 改善内容：
  1. **実測シミュレーションに基づく難易度・推奨LVの再定義** (`scripts/simulate-*.cjs`, `world-data.js`)：
     - ユーザーの定義「6人パーティーが、LVに応じた装備を可能な限りの部位に装備して、アイテム消費3つ以内で最奥ボスまで倒せるLV」に基づき、全18ダンジョンでの道中歩行・エンカウント・SP消耗・アイテム使用・ボス戦を含む実機シミュレータを実装・実行。
     - 最初のダンジョン「灰灯の林縁」：旧推奨表示Lv.1ではLv.1フル装備でも全滅率60%・アイテム3個以内クリア率10%（平均4.25個消費）だった実態を特定。Lv.3で勝率80%、Lv.4で勝率100%・アイテム消費平均1.6個となり、適正推奨Lvは **4** であることを実証。
     - 各固定ダンジョン（林縁: Lv.4, 石道: Lv.6, 旧鉱山: Lv.8, 湿原: Lv.11, 洞窟: Lv.19, 遺跡: Lv.30, 砂海: Lv.52, 古戦場: Lv.45, 砦: Lv.58, 回廊: Lv.90, 書庫: Lv.110, 山頂: Lv.120, 大樹廊: Lv.190, 裂谷: Lv.200, 機工街: Lv.185, 観測所: Lv.205, 境界: Lv.280, 天球回廊: Lv.300）の実測推奨レベルを設定。
  2. **推奨レベル（難易度表示）と敵ベースレベルの分離・連携** (`world-data.js`, `screens.js`, `systems.js`, `game.js`)：
     - `map.recommendedLevel` を新設し、UI（Atlasの地域カード、遠征道標画面、調査隊報告など）の「推奨 Lv.X」表示に反映。
     - 敵の基礎スケール（`enemyStatsAt`）をインフレさせずに、プレイヤーに対する難易度ガイダンスを正確化。
     - アドレス道標ダンジョン（\ddressBlueprint\）にも推奨レベル自動算出を導入。
  3. **カタログ・ドキュメント・キャッシュキー更新** (`CONTENT_CATALOG.md`, `index.html`)：
     - `CONTENT_CATALOG.md` の探索地一覧表を難易度表示（推奨Lv）と敵基礎Lvの両記に更新。
     - `index.html` のキャッシュキーを `?v=20261023-rec-lv-v1` に更新。
  4. **自動テストの整備** (`test-features.cjs`):
     - 推奨レベルが適正実測値（林縁4、石道6、鉱山8）としてAtlas画面に反映されること、アドレスマップに推奨レベルが算出されることをテスト検証。
- 検証結果：
  - Node.js テスト：`test-features.cjs` 含む全テストスイート完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で通常版・配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。


## ダンジョン動的マップ規模・ウィザードリィ式階層整合・RPGギミック（DUNGEON_MAP_GIMMICKS_01）

- 改善内容：
  1. **深さ・難易度に応じたマップ規模の動的スケーリング** (`game.js`, `facilities.js`, `systems.js`, `exploration-ui.js`)：
     - `dungeonDimensions(map, depth)` を導入し、階層が深くなるにつれて基本 19×13 から 21×15、23×15、最大 27×19 までフロアサイズが動的に拡大。
     - セーブデータの検証（`validSave`）およびハザード生成（`ensureFloorHazards`）、未踏破探査マスク同期（`syncFloorExploration`）を動的サイズに完全対応。
  2. **ウィザードリィ式上下階層の座標整合＆ランダム階段配置** (`game.js`, `systems.js`, `exploration-ui.js`)：
     - 左上・右下の固定配置を廃止し、地上出口（1F）および下り階段（`>`）を十分に離れたランダムな通路へ配置。
     - 階層を降りた（`descend()`）際、下の階の上り階段（`<`）が前階の下り階段とまったく同一の `(x, y)` 座標に生成され、プレイヤーも同じ位置に降り立つ。
     - 上の階へ戻る（`ascend()`）際も、上の階の下り階段位置へ正確に戻る完全な上下階層整合性を実現。
  3. **古今東西のRPG探索ギミックの実装** (`game.js`)：
     - **落とし穴（`pit`）**：最深階以外のフロアに配置。踏むと下の階のまったく同一の `(x, y)` 座標へ転落。落下ダメージ（HP10%）を受け、下の階が未踏でも即座にフロアを生成・接続。
     - **自動移動床（`conveyor`）**：指定方向（北・東・南・西）へプレイヤーを強制的に押し流す。
     - **一方通行（`oneway`）**：段差や一方通行扉。許可された進行方向からのみ進入可能で、逆方向からの進行をブロック。
     - **スイッチ＆施錠扉（`switch` & `door`/`locked_door`）**：鉄格子の扉は初期状態で進入不可。フロア内の対応するスイッチを踏むことで遠隔開錠され、扉を通過可能になる。
  4. **Canvas描画・レスポンシブ最適化＆操作追従** (`exploration-ui.js`, `systems.js`, `index.html`)：
     - マップの幅・高さからタイル描画サイズ `z` とキャンバス中央配置 `ox, oy` を自動算出し、拡大したフロアでもキャンバス枠内に美しく自動収縮・描画。
     - 落とし穴（暗い穴）、移動床（シアン矢印）、一方通行（アンバー矢印）、施錠扉・開錠扉、フロアスイッチ（赤/緑）の美麗なグラフィック描画。
     - 出口・昇降口の動的座標に合わせた `EXIT` / `UP` ラベルおよびプレイヤー発光・向きの描画。
     - 地図クリック歩行（`walkTowardTile`）や徒歩帰還（`walkTowardEntrance`）も動的マップサイズ・動的入口座標に完全対応。
     - `index.html` のキャッシュキーを `?v=20261023-map-gimmick-v1` に更新。
  5. **自動テストの整備** (`test-features.cjs`):
     - マップサイズ拡大、上下階層階段座標の完全一致、落とし穴での同一座標落下、移動床による流され、一方通行の進入阻止、スイッチ踏下による扉開錠と通過の自動テストを包括的に追加・検証。
- 検証結果：
  - Node.js テスト：`test-features.cjs` (12件), `test.cjs`, `test-regression.cjs` 含む全テストスイート完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で通常版・配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。

## ドラクエ風コマンドバトル方式・パーティ全体逃走（BATTLE_DQ_COMMANDS_01）

- 改善内容：
  1. **ドラクエ風順次コマンドバトルコンソール（`uiBattlePanel`）** (`exploration-ui.js`, `exploration-ui.css`, `index.html`)：
     - 生存仲間カードを行（隊列順：前衛1〜3、後衛1〜3）で常時表示。HP/MP/SPおよび予約中コマンド（⚔️/🪄/🛡️/🎒/⏳）をアイコン表示。
     - 現在入力中の仲間を「第X人目 / ◯◯ は どうする？」と明確にハイライト。
     - 基本4コマンド（⚔️ たたかう、🪄 じゅもん・特技、🛡️ ぼうぎょ、🎒 どうぐ）を大きなボタンスタイルで配置。
     - 攻撃対象（敵）や技・道具の対象（味方/敵）を選択すると、即座にコマンドが確定し、自動的に次の仲間へ入力が進む。
     - 敵が1体のみの時は「たたかう」ボタン押下で自動的に対象を決定して次へ進行。
     - 防御選択時も即時確定して次アクターへ自動遷移。
     - 「◀ 前の仲間へもどる（キャンセル/やり直し）」ボタンで直前の指示を取り消して再選択可能。
     - 全員の指示が完了すると「⚔️ 全員の行動を実行（ターン開始）」が光り、ワンクリックでターンを実行。
  2. **パーティ全体の逃走（`partyEscape`）** (`game.js`, `exploration-ui.js`)：
     - 個別コマンドから逃走を分離し、戦闘コンソール上部に独立した「🏃 にげる (全体)」ボタンを配置。
     - ボス戦では「強大な気配に阻まれて逃げられない！」と表示され逃走不可。
     - 通常戦闘では味方の平均素早さと敵の素早さを基に成否判定（ベース約60%）。
     - 逃走成功時は即座に戦闘から離脱し、探索へ安全に復帰。
     - 逃走失敗時は「しかし 回り込まれてしまった！」となり、味方はそのターン行動できず敵側の一斉ターン（`enemyTurnAfterEscapeFail`）が発生。
  3. **自動テストの整備** (`test-features.cjs`):
     - パーティ全体逃走（通常逃走成功・ボス戦ブロック・失敗時敵ターン）、防御による自動次キャラ遷移、戻るボタンによるキャンセルと再選択、単体敵攻撃即決のテストを追加。
- 検証結果：
  - Node.js テスト：`test-features.cjs` (13件), `test.cjs`, `test-regression.cjs` 含む全テストスイート完全合格。
  - Python テスト：全52件合格。
  - Pages ビルド：`node scripts/build-pages.cjs` 成功。
  - 実ブラウザテスト：`node test-browser.cjs` および `node test-browser.cjs --dist` により、1280px / 390px / 320px の全3幅で通常版・配布版ともに完全合格。
- 共有先：`origin/main` および `origin/dev` へ通常push。
