# ASTERIA 4.0 検証記録

検証日: 2026-09-05

総合判定: **RELEASE READY（未署名ポータブル版）**

## 配布物

| 項目 | 値 |
|---|---|
| ファイル | `ASTERIA-4.0.0-portable.exe` |
| 対象 | Windows x64 |
| 形式 | インストール不要ポータブルEXE |
| サイズ | 85,516,339 bytes（81.55 MiB） |
| ProductVersion | 4.0.0 |
| Electron | 38.8.6 |
| electron-builder | 26.15.3 |
| データスキーマ | 7 |
| Authenticode | NotSigned |

SHA-256:

```text
E819C37BA8D40965B5CD13611896D8ED124620867E778B23098EDBAB18A74BB6
```

## 自動テスト

- Node単体・統合テスト: **44 / 44 PASS**
- Electron実機UIテスト（通常サイズ）: **88 / 88 PASS**
- Electron実機UIテスト（最小1040×680）: **88 / 88 PASS**
- npm依存監査: **0 vulnerabilities**（検証時点）

テスト対象には、旧スキーマ1〜6からの移行、2.1実データ保持、自動化の冪等性、
予定衝突、テンプレート展開、横断検索、診断修復、CSV安全化、各交換形式、破損ストア
回復、CSP、Electron分離設定、ARIAモーダル情報を含みます。

## 配布版の実機確認

- `app.asar`にNEXUS、Bridge、Material Design 3の実装を確認
- `win-unpacked`版と最終ポータブルEXEを起動し、NEXUS診断画面を描画
- スクリーンショット保存後にプロセスが正常終了
- Microsoft DefenderのEXE個別CustomScanで検出増加なし

## セキュリティ設計

- `sandbox = true`
- `contextIsolation = true`
- `nodeIntegration = false`
- CSP: `connect-src 'none'`, `object-src 'none'`
- 外部ウィンドウとRendererの任意ナビゲーションを拒否
- インポート上限20 MB
- CSV数式プレフィックスを無害化
- 自動化で任意スクリプトを実行しない
- 外部サービスの認証情報を保存しない

## 既知の配布上の制約

配布EXEは商用コード署名証明書がないため未署名です。Windows SmartScreenの初回警告を
完全には防げません。一般公開ではRelease記載のSHA-256照合を推奨します。
