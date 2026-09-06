# Privacy

ASTERIAは**ローカルファースト**のデスクトップアプリです。

## 保存するデータ

ミッション、プロジェクト、予定、習慣、ログ、集中セッション、設定、NEXUSルール、
テンプレートをWindowsのアプリデータ領域に保存します。正常な直前データを回復コピー
としてローカルに保持します。

## 外部送信

ASTERIA 4.5はアプリ画面から外部ネットワークへ接続しません。Content Security Policyの
`connect-src`は`none`です。テレメトリ、広告SDK、クラウド分析、アカウント登録は
ありません。

## サービス連携

Google Calendar、Outlook、Todoist、Notion、Trello、Excelとの連携は、ユーザーが明示的に
保存または読込するローカルファイルを介して行います。パスワード、OAuthトークン、
サービス認証情報は保存しません。

## エクスポートと削除

設定またはBridgeからJSON、CSV、ICS、Markdownをエクスポートできます。ポータブルEXEを
削除してもユーザーデータは自動削除されません。削除する場合は、先に必要なバックアップを
作成したうえでASTERIAのユーザーデータ領域を削除してください。

## Third-party code

デスクトップ実行基盤としてElectronを利用します。依存関係は`package-lock.json`で固定し、
リリース前にテストと依存監査を行います。
