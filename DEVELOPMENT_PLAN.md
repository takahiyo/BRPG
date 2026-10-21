# 開発計画

更新：2026-10-22 JST。作業ID：resume-equipment-release。

- GitHub共有モード：`checkpoint_auto`。ユーザーの「開発を進め、段階的にリモートへアップ」と今回の再開指示を継承。
- 対象：origin = https://github.com/takahiyo/BRPG.git、dev/main。既存の公開範囲を維持。devはPagesプレビュー、mainはPages本番の自動ビルド起点（既存公開運用）。通常pushのみ。認証・DB・公開設定は変更しない。
- 料金：このセッションの既存ツール内で実施。新しい有料APIへ切り替えない。
- 制約：静的HTMLの直接起動、旧保存キー互換を維持。Obsidian原資料は読み取りのみ。既存AGENTS.mdと共通規則原本のユーザー差分は保持し、無断stageしない。
- 既存履歴：詳細はDEVELOPMENT.md/HANDOFF.md。現在の復旧点はDEVELOPMENT_STATUS.mdを正とする。

| ID | 目的・変更対象 | 依存 | 受入条件・検証 | チェックポイント |
| --- | --- | --- | --- | --- |
| M0 | 再開状態の照合、計画/状態の新設 | なし | main/dev到達確認、実ファイルと履歴照合 | 文書をcommit/pushし先端確認 |
| M1 | 装備の保存読込境界検証 | M0 | 旧形式互換、破損装備と両手競合の拒否を再現テスト。問題があれば最小修正。関連Nodeスイート成功 | コード・テスト・状態をcommit/push |
| M2 | 配布用ファイルと統合確認 | M1 | Pagesビルド、JS/CSS参照の存在、保存UIの表示と操作、全回帰テスト。pushとCI/公開結果は区別 | 検証記録・必要な修正をcommit/push |

今回の完了条件：上記の保存・配布境界を検証し、変更をmain/devへ通常共有して復旧記録を残す。Google実ログイン・二端末同期、未作成のモンスター画像制作は別の未完了課題として維持する。
