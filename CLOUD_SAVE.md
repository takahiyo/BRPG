# Googleアカウント連携とクラウド保存

ローカル保存は従来の `ashen-atlas-v3` を使用する。`index.html` の直接起動と静的HTTP配信は、Google設定やD1なしで利用できる。クラウド保存はGoogle Identity Servicesによるサインインと、同じオリジンで動くCloudflare Worker/D1を必要とする。Google Driveへの保存ではない。

## 用意する設定

Firebaseアカウントで管理している既存プロジェクトを利用する場合、そのFirebaseプロジェクトはGoogle Cloudプロジェクトでもある。Google Cloud Consoleで**同じプロジェクト**を選び、Google Auth Platformの「クライアント」からウェブアプリ用OAuthクライアントを確認・作成する。このゲームはGoogle Identity Servicesが発行するGoogle ID tokenをWorkerで検証する方式で、Firebase AuthenticationのSDKやFirebase ID tokenは使わない。Firebase側でGoogleログインを有効化するだけでは、`GOOGLE_CLIENT_ID` と許可オリジンの設定は完了しない。

先に実際の公開URLのオリジン（例：`https://example.com`）を決める。Googleの「承認済みのJavaScript生成元」へスキームとホストだけを登録し、パスは付けない。開発用には使用する `http://localhost` とポート付きのオリジンを別に登録する。既存のOAuthクライアントを流用する場合も、用途・許可オリジンがこのゲームと一致するか確認する。現在の画面内コールバック方式ではリダイレクトURIを使わない。

今回指定された公開オリジンは `https://brpg.pages.dev` と `https://brpg.flateight.jp`。Firebaseプロジェクト「BRPG」（ID `brpg-a0775`）を作成済みで、Gemini in Firebase と Google アナリティクスは無効にした。同じGoogle CloudプロジェクトのGoogle Auth Platformにアプリ名「灰灯の迷宮」と開発者の連絡先 `brpg@flateight.jp` を設定。ウェブ用OAuthクライアント「BRPG Web」を作成し、クライアントIDは `465038567538-09uo2623nhcdeukrpe5cvfbhraotiog7.apps.googleusercontent.com`、許可JavaScript生成元は上記2つ。クライアントシークレットはこの実装では使わず、ファイルやログへ記載しない。

Googleの「ユーザー サポートメール」は当面、ユーザー承認済みの個人Gmailを使用する。ユーザー指定の `brpg@flateight.jp` は選択肢に現れず、開発者の連絡先への登録だけでは同意画面の公開サポート先は変わらない。ユーザーによると `brpg@flateight.jp` でGoogleログインしても右上には個人Gmailが表示される。IAMへ同アドレスを追加しようとすると「有効な Google アカウントに関連付けられている必要があります」と表示される。OAuthアプリの公開ステータスは「本番環境」。クライアント作成時に登録された不要なリダイレクトURI 2件は削除し、再表示して空欄を確認した。

両URLはCloudflare Pagesの `brpg` プロジェクトを指している。GitHubの `takahiyo/BRPG` と接続し、`main` を本番、`dev` をプレビューとして自動デプロイしている。Pagesのビルドコマンドを `node scripts/build-pages.cjs`、出力ディレクトリを `dist` に設定済み。コミット `8fffb5b` のプレビュー・本番デプロイで適用を確認した。`wrangler.toml` は別の `brpg` Worker向けであり、Pagesの設定には自動適用されない。Pages用の `/functions/api/[[path]].js` は既存の `worker.js` にAPI処理を委譲する。

Cloudflareアカウント内に専用D1 `brpg-saves` を作成し、`migrations/0001_saves.sql` と同じ `player_saves` テーブル定義をD1コンソールから適用した。データベースIDは `022fadb8-fcac-46f1-935e-b1728b1de951`。Pagesの本番・プレビュー両環境に `GOOGLE_CLIENT_ID` と `DB` → `brpg-saves` を登録済み。本番の `GET /api/config` は `cloudEnabled: true` を返した。実ログインとD1保存は未確認。

Google Auth Platformのテストユーザーには、現行のプロジェクト所有者アカウントを1件登録した。その後ブランディング設定を完了して一般公開し、公開ステータス「本番環境」を確認した。

ユーザーの選択により、当面は個人Gmailを公開サポートメールとして使用する。OAuthブランディングのホームページは `https://brpg.flateight.jp/` に設定済み。`privacy.html` と `terms.html` を公開して表示を確認し、ゲームのフッターからリンクした。Google Auth Platformの対応URL欄にも両URLを保存済み。ユーザーの直前確認を経てアプリを一般公開し、公開ステータス「本番環境」を確認した。

1. Google CloudでOAuth同意画面とウェブアプリケーションのOAuthクライアントを設定する。公開範囲とテストユーザーを設定し、JavaScript生成元へ実際のHTTPS配信オリジンを登録する（開発時はlocalhostのオリジンも登録）。クライアントシークレットはこの構成では使用しない。
2. Pagesでは `functions/api/[[path]].js` を配信し、Pages設定に `GOOGLE_CLIENT_ID` とD1の `DB` を登録する。`GOOGLE_CLIENT_ID` は公開識別子で、`GET /api/config` からブラウザへ返す。
3. D1に `migrations/0001_saves.sql` のテーブルを用意する。1アカウントにつき1件の保存スロットを保持する。
4. 別のWorkers配信経路を使う場合は `wrangler.toml` の `worker.js`、`ASSETS`、`/api/*` ルーティング、同じ環境変数とD1バインドを設定する。

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

Wranglerが利用できる環境で、作業フォルダーを `C:\TEMP\GitHub\BRPG` にして `wrangler d1 migrations apply brpg-saves --local` でローカルDBを準備できる。本番D1は上記の通りCloudflareダッシュボードで作成済み。ゲーム本体とPages Functionsの公開は完了した。

Pagesではスクリプトがブラウザで必要なHTML・CSS・JavaScript・画像のみを `dist` へコピーし、バックエンドソース、SQL、開発文書やローカル設定を静的公開しない。Workersのassets設定は `.assetsignore` で別途配信対象を制限する。両方の経路を混同しない。

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
