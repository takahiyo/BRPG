# 開発状態

更新：2026-10-22 JST / 担当：統括エージェント。

最新状態：状態異常・バフの追加計画を文書化・整合性検証・共有済み。計画checkpointは `6ee6b37`（origin/main/dev到達確認済み）。S0の仕様確定とゲーム実装は未着手。ゲームコードの最終変更は `fbd0e12`。現在の復旧記録は末尾の状態異常追加計画を優先し、下記M/U/R/B/C節は過去の記録として参照する。

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
