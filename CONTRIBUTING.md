# Contributing to ASTERIA

ASTERIAへの提案や改善を歓迎します。小さな修正でも、先にIssueで目的と利用場面を
共有するとレビューがスムーズです。

## Development setup

```powershell
npm ci
npm test
npm start
```

## Pull request checklist

- 変更の目的とユーザーへの影響を説明した
- 既存のオフラインファースト設計を維持した
- `npm test` がすべて成功した
- UI変更はライト・ダーク・最小1040×680で確認した
- キーボード操作とReduced Motionを確認した
- データ形式を変えた場合は移行処理とテストを追加した
- 新しい外部通信、権限、依存関係がある場合は理由とリスクを明記した

## Design principles

1. **Local by default** — 個人データを無断で外部へ送らない。
2. **Visible automation** — 条件と処理を人が読める形にする。
3. **Recoverable actions** — 可能な操作にはUndoまたはバックアップを用意する。
4. **Quiet clarity** — 情報量が多くても、主役となる次の行動を明確にする。
5. **Accessible motion and color** — コントラストと動きの軽減設定を守る。

詳細は[行動規範](CODE_OF_CONDUCT.md)も確認してください。
