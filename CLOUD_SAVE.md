# Googleアカウント連携とクラウド保存

ローカル保存は従来の `ashen-atlas-v3` を使用する。`index.html` の直接起動と静的HTTP配信は、Google設定やD1なしで利用できる。クラウド保存はGoogle Identity Servicesによるサインインと、同じオリジンで動くCloudflare Worker/D1を必要とする。Google Driveへの保存ではない。

## 用意する設定

1. Google CloudでOAuth同意画面とウェブアプリケーションのOAuthクライアントを作成する。公開範囲とテストユーザーを設定し、JavaScript生成元へ実際のHTTPS配信オリジンを登録する（開発時はlocalhostのオリジンも登録）。クライアントシークレットはこの構成では使用しない。
2. Workersに `worker.js` をエントリーポイントとして設定する。既存のassetsへ `binding = "ASSETS"` を追加し、APIリクエストがWorkerへ届くよう `run_worker_first = ["/api/*"]` を指定する。
3. 環境変数 `GOOGLE_CLIENT_ID` にGoogleのクライアントIDを設定する。これは公開識別子で、`GET /api/config` からブラウザへ返す。
4. D1データベースを用意して `DB` へバインドし、`migrations/0001_saves.sql` を適用する。1アカウントにつき1件の保存スロットを保持する。

設定例（実際のIDに置換する。D1未用意の間はこの節を設定しない）：

```toml
main = "worker.js"

[vars]
GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com"

[[d1_databases]]
binding = "DB"
database_name = "brpg-saves"
database_id = "YOUR_D1_DATABASE_ID"
migrations_dir = "migrations"
```

Wranglerが利用できる環境で、作業フォルダーを `C:\TEMP\GitHub\BRPG` にして `wrangler d1 create brpg-saves`、設定後 `wrangler d1 migrations apply brpg-saves --local` でローカルDBを準備できる。本番の作成・`--remote` 適用・公開は外部変更となるため別途実施する。この実装作業では実サービスの作成・公開を行っていない。

assetsにリポジトリ直下を指定する場合は、配信対象にバックエンドソース、SQL、ローカル設定、Git情報等が含まれないよう `.assetsignore` を管理する。フロントエンドの公開対象とサーバー専用ファイルを混在させない。

## APIと保存境界

- `GET /api/config` は `{googleClientId, cloudEnabled}`。D1またはクライアントIDが未設定ならクラウド利用不可。
- `GET /api/save` はGoogle ID tokenを `Authorization: Bearer ...` で受け取り、`{save, revision, updatedAt}` を返す。未保存は `save:null, revision:0, updatedAt:null`。
- `PUT /api/save` は `{save, revision}` を送る。同一オリジンのOriginとJSONを必須とし、リクエスト全体を2MiBに制限する。初回はrevision 0、以後は直近に読み取ったrevisionを指定する。成功時は新しい `{revision, updatedAt}`。別端末の更新が先行した場合は409で拒否する。自動的に競合を上書きしない。
- クラウドへの通信失敗、401、409を保存成功として表示しない。読み込む際はゲーム本体の `validSave` で完全検証する。サーバー側の検証はv3の外形・主要配列・数値のみで、ゲームルールの正当性や不正プレイ防止を保証しない。

ID tokenはWeb CryptoのRS256で署名を検証し、Googleの公開JWKSはCache-Controlに従ってキャッシュする。aud/iss/exp/iat/subおよび存在する場合のazpを検証し、検証済みsubだけを保存の所有者キーに使う。メールアドレス・Googleプロフィール・トークンはDBへ保存しない。Cookieセッションは作らず、クロスオリジンCORSも提供しない。Google ID tokenを含むリクエストヘッダーの収集を監視設定で有効にしない。

クラウドが設定済みでもローカル保存からの無断移行をしない。ログイン・アカウント切替後は読み込み／アップロードを確認し、競合時はどちらを採用するかユーザーが選ぶ。クラウド使用中も既存の端末保存キーへ控えを残す。端末の控えはアカウント共通なので、共有端末ではゲーム進行が見える。クラウド読み込み前の冒険は `ashen-atlas-v3-before-cloud` に1世代退避し、退避に失敗した場合は読み込まない。接続中のアカウント／保存先変更では古い応答を破棄する。

クラウド自動保存は変更後およそ5秒で送信する。閉じる直前の変更は未送信になる場合があるため、「クラウド保存済み」を確認する。失敗・競合・認証期限切れでは自動送信を停止し、「再接続・保存」で明示的に選び直す。再読み込み後の保存先はローカルで、Googleへ再ログインして接続する。初期化もローカルへ戻し、明示的な再接続まではクラウドを上書きしない。

## 現時点の確認範囲

`node --check worker.js` 成功。生成したRSA鍵と模擬JWKS/D1を使い、署名付きJWTの認証、aud不一致・期限切れ拒否、所有者分離、Origin拒否、外形検証、初回保存・revision競合・更新を確認した。またPython標準SQLiteで実際のUPSERT文を実行し、保存未存在・初回作成・古いrevision拒否・更新を確認した。模擬環境とSQLiteの結果であり、実Google OAuth設定・本番D1接続・公開環境での端末間同期は未確認。料金・容量・公開審査要件は実際のアカウントと設定で確認する。

参照：[GoogleのID token検証](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)、[Google Identity Servicesの設定](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)、[D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)、[Workers assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)。Googleのtokeninfoは開発・デバッグ向けのため、本APIの認証処理では使用しない。
