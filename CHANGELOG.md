# Changelog

ASTERIAの重要な変更を記録します。バージョン番号は
[Semantic Versioning](https://semver.org/)に準拠します。

## [4.0.0] - 2026-09-05

### Added

- 条件と処理が見えるローカル自動化と5つの収録ルール
- 自動化の実行履歴、起動時実行、手動実行、Undo
- 4つのミッションテンプレートとカスタムテンプレート作成
- プロジェクト、ミッション、時間ブロックの一括展開
- 7種類のデータを対象にしたワークスペース横断検索
- 健全性スコアと重複・参照切れ・予定重複・期限切れ状態の診断
- スコープ限定の自動修復

### Improved

- 任意色から生成するMaterial Design 3セマンティックパレット
- ライト、ダーク、Windowsシステムテーマ
- WCAG AAを保つ前景色の自動補正
- Expressive、Gentle、Reduced Motion
- Google Calendar、Outlook、Todoist、Notion、Trello、Excel向けBridge
- JSON、CSV、ICS、Markdownのインポート・エクスポート

### Security

- CSV数式インジェクション対策
- 20 MBのインポート上限
- 外部接続を拒否するContent Security Policy
- Electron sandbox、Context Isolation、外部ナビゲーション拒否

### Compatibility

- データスキーマ7
- 旧スキーマ1〜6を自動移行
- ASTERIA 2.1の実データを使った保持検証を完了

### Known limitations

- サービス連携はOAuthライブ同期ではなくローカルファイル交換です。
- Windows配布版はAuthenticode未署名です。

[4.0.0]: ../../releases/tag/v4.0.0
