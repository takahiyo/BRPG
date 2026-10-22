---
タグ: [創作]
---

# 音声の組み込み

## 統合契約

- `audio.css` を読み込み、classic script の `audio.js` を `formation.js` の後、`save-manager.js` の前に読み込む。ES modules は使わない。
- 下記マークアップを常設ヘッダー内など、画面描画で置換されない場所に1回配置する。`createElement` による自動注入はしない。設定への入口は街・探索・戦闘で常時利用可能にする。ネイティブの details はキーボードでも開閉できる。
- 配布対象に `audio.js`、`audio.css` とルートのMP3 2曲を追加する。静的相対URLで読み込み、外部APIは使わない。
- `render` ラッパーは `s.battle` の有無だけでBGMを選ぶ。戦闘以外（街・探索・施設・図鑑など）は街BGM。ロード済み戦闘の初期化にも対応する。
- 遭遇音は親側が戦闘開始時に `globalThis.playSE('encounter')` を1回呼ぶ。音声モジュールの描画ラッパーはSEを発火しない。再描画・ロード復元で遭遇音を二重発火させないこと。
- 既存 `toggle-se` は新しいSEミュートへ委譲する。既存ボタンは残してもよく、描画後に新設定へ表示を同期する。`ext.soundOn` は音声モジュールがない場合のみ旧動作として使う。

```html
<details class="audio-controls" id="audio-controls">
  <summary>音声設定</summary>
  <div class="audio-controls__rows">
    <div class="audio-controls__row">
      <label for="audio-bgm-volume">BGM</label>
      <input id="audio-bgm-volume" data-audio-volume="bgm" type="range" min="0" max="100" step="1" value="50" aria-label="BGM音量">
      <button type="button" data-audio-mute="bgm" aria-pressed="false">BGM消音</button>
    </div>
    <div class="audio-controls__row">
      <label for="audio-se-volume">SE</label>
      <input id="audio-se-volume" data-audio-volume="se" type="range" min="0" max="100" step="1" value="70" aria-label="SE音量">
      <button type="button" data-audio-mute="se" aria-pressed="false">SE消音</button>
    </div>
  </div>
  <p class="audio-controls__status" id="audio-status" role="status" aria-live="polite"></p>
</details>
```

## 設定と再生

- `globalThis.BRPGAudio.settings`: 読み取り専用スナップショット。`bgmVolume` / `seVolume` は0〜1、`bgmMuted` / `seMuted` はboolean。
- `BRPGAudio.set(key, value)`: 型・範囲を検証して即反映・保存。不正入力はfalse、成功はtrue。既定値はBGM 50%、SE 70%、両方ミュートなし。実音量の聴感を保証する値ではない。
- 設定キーはゲームセーブとは別の `brpg-audio-v1`。新規開始・ゲームロード・リセットで設定を変更しない。localStorage拒否・破損時もゲームを停止しない。端末／オリジン単位で、クラウドセーブには同期しない。
- 新しい設定キーが未作成で、起動時の既存セーブがSE OFFの場合だけSE消音を一度引き継ぐ。独立設定が既にあれば旧セーブの値では上書きしない。
- 最初の実ユーザーのpointerdown／keydownまでBGMを再生しない。拒否・読み込み失敗はcatchし、同一画面のrenderで再試行しない。次のユーザー操作・音声設定操作・表示復帰で再試行できる。
- BGMは1曲のみ、loop=true / preload=metadata。非表示タブは一時停止し、復帰時は現在の意図する曲のみを再開。再生待ち中の切替／消音／非表示は古い要素を退役させ、遅いPromise完了で新しい曲を止めない。
- SEは既存Web Audio合成を共通Gainへ接続し、再生中のSEにも音量／ミュートを即時反映。遭遇音も合成で、BGMと独立。Audio / AudioContext未対応環境や簡易DOMテストでは無音で継続する。

## 素材と楽曲の保存場所

BGMの正本保存場所は `audio/bgm/` のみ（2026-10-22 整理）。旧来のルート直下・`audio/` 直下の重複コピーは削除した。ファイル名はURL・配布ビルドで安全なASCII英数字とアンダースコアのみとする（受領時の `Solas_na_Sráide.mp3` は `Solas_na_Sraide.mp3` へ改名）。配布ビルド（Pages）は `audio.js` が参照する曲だけを allowlist で配布する。

| 用途 | `audio.js` キー | ファイル | 制作元 | 容量 |
| --- | --- | --- | --- | --- |
| 街／拠点BGM | `town` | `audio/bgm/Solas_na_Sraide.mp3` | ユーザー追加音源 | 4,347,678 bytes |
| 戦闘BGM | `battle` | `audio/bgm/Cath_Slan_na_n_Og.mp3` | Gemini（ユーザー申告） | 4,388,427 bytes |
| 灰灯の林縁 探索BGM | `forest_edge` | `audio/bgm/Sho_lah_Beneath_the_Moon.mp3` | ユーザー追加音源 | 4,265,549 bytes |
| 風切りの石道 探索BGM | `rocky_path` | `audio/bgm/Sli_na_Cloch.mp3` | ユーザー追加音源 | 4,322,600 bytes |
| その他ダンジョン探索BGM | `dungeon_default` | `audio/bgm/Sho_lah_Beneath_the_Moon.mp3` | （林縁と共用） | — |
| 予備（旧街BGM・未使用・非配布） | — | `audio/bgm/The_Wayfarer_s_Morning.mp3` | Gemini（ユーザー申告） | 4,290,624 bytes |

### 楽曲の追加手順
1. 新規MP3ファイル（推奨：44.1kHz/48kHz、ステレオ、128〜192kbps、1曲2〜5MB以内・単一25MiB制限厳守）をASCII名で `audio/bgm/` へ配置する。ルート直下には置かない。
2. `audio.js` の `tracks` オブジェクトに対象マップIDまたは用途キー（例: `rocky_path: 'audio/bgm/Sli_na_Cloch.mp3'`）を追加。
3. `scripts/build-pages.cjs` の allowlist に `audio/bgm/ファイル名` を追加。
4. `test-audio.cjs` および `docs/AUDIO.md` に登録内容を記録（`test-audio.cjs` は全曲が `audio/bgm/` に実在することを検査する）。

## 検証と引き継ぎ

担当範囲は新規 `audio.js` / `audio.css` / `test-audio.cjs` / 本書と、`systems.js` の合成音・旧SEトグルのみ。HTML・探索UI・配布スクリプト・計画／状態文書・Gitへの書き込みは親担当に任せる。

M0: ルール／計画／状態／既存音声確認。M1（M0依存）: 独立設定・BGM制御・共通SE Gain実装。M2（M1依存）: `node test-audio.cjs` のモック検証と既存ハーネス互換確認。親担当は上記マークアップ・配布対象を統合後、ブラウザで常設UI、初回操作、タブ復帰、音量、遭遇SE1回を確認する。実ブラウザでの音声出力・聴感検査はモックテストでは保証しない。

2026-10-22 ローカル結果: M0〜M2完了。`node test-audio.cjs` は12件成功。`node --test test.cjs test-regression.cjs test-overhaul.cjs test-equipment.cjs test-exploration.cjs test-save-manager.cjs test-quest-travel.cjs test-formation.cjs` は8スイート成功。`python -m unittest discover -s scripts -p "*_test_*.py" -v` は44件成功。`node --check audio.js` と担当差分の `git diff --check` も成功（systems.jsに既存のLF/CRLF変換警告あり）。初回モックで見つかった「media error後の遅いplay完了」を修正して再成功。配布ビルドと実ブラウザ音声QAは統合前のため未実施。commit/pushなし。

## 親側の統合結果

indexの常設ヘッダーへ上記操作を配置し、audio.js/css・2MP3を配布へ接続済み。探索GUIは仲間欄を戦闘前後で固定し、MAP/敵を同じ領域で切替、新規遭遇でだけ合成SEと短い演出を実行する。動き軽減指定では演出を抑制する。SElab素材は使わない。

親側 `node test-browser.cjs --screenshots` はChrome1280/390/320pxで成功。ネイティブAudioのMP3取得/デコード/再生進行、街→戦闘→街、同時再生1曲、BGM/SE別操作、再読込後の音量、遭遇SEのOscillator2個/消音時0個を実ブラウザで検証。ネイティブ音声要素を観測しておりモック置換はしない。物理スピーカーからの聴感・実機再生は未検証。配布版の最終結果と共有状況はDEVELOPMENT_STATUS.mdを参照する。
