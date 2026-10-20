# 灰灯の迷宮 / ASHEN ATLAS

依存ライブラリなしのブラウザRPG試作 v3。Obsidian原案をもとに、6人パーティー・ランダム遭遇・コマンド戦闘・素材加工・段階的な自動化を実装。

## 起動

`index.html` をブラウザで開くか、PowerShellで次を実行する。

```powershell
Set-Location -LiteralPath 'C:\TEMP\GitHub\BRPG'
python -m http.server 8765 --bind 127.0.0.1
```

[プレイ画面](http://127.0.0.1:8765/)。既に起動している場合、サーバーの再起動は不要。ブラウザの再読み込みで変更を反映する。

## 基本操作

- 街の「地図と依頼」で18地域から目的地を選択。最初はLv1の林縁。依頼・素材・敵・品質を確認して出発。
- 矢印/WASDまたは地図の矢印で歩行。ランダムで遭遇し、地図横で全行動を選び「ターン実行」。名前を押すと詳細ステータス。
- 「連続自動探索」は歩行→戦闘→歩行を継続。初期は右手法・通常攻撃のみ。階段、封印、詳細画面、全滅などでは停止。
- 無料の宿・無料の戦後回復はない。入口以外の帰還は帰還符を消費。LIFE/MANA/SPの残量を見て引き返す。
- 基本5職から条件を満たして派生職へ転職。最大6人参加・16人登録。36職・133技。編成セットを3枠保存可能。
- 採集と戦利品は別。素材64種、付呪18種。工房で加工・品質・装備先を選ぶ。高品質ほど費用と必要素材品質が上がる。
- 敵手帳は遭遇・討伐で数値や弱点が判明。アドレスからLv80〜300の街と探索地を発見し、高級工房や拠点購入を目指せる。

## 保存と検証

`ashen-atlas-v3` に自動保存。`ashen-atlas-v2` がある場合は初回に変換し、元キーは残す。v1も上書きしないが、v1からの直接変換は行わない。破損した保存は別キーへ退避し新規開始。再読み込み時に自動探索は停止状態になる。保存はブラウザ・オリジンごとに別で、localhostと127.0.0.1は異なる。

```powershell
Set-Location -LiteralPath 'C:\TEMP\GitHub\BRPG'
node test.cjs
```

自動検証の保証範囲と残課題は [DEVELOPMENT.md](DEVELOPMENT.md)。引き継ぎは [AGENTS.md](AGENTS.md) から開始。原案整理は [WORLD_AND_DESIGN.md](WORLD_AND_DESIGN.md)、追加職業・ステータス案は [CHARACTER_SYSTEM.md](CHARACTER_SYSTEM.md)、データ一覧は [CONTENT_CATALOG.md](CONTENT_CATALOG.md)。
