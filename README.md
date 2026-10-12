# ROAD DRIVER

Three.js + TypeScript + Viteで作った、道路そのものを動かす3Dゲームです。車は自動走行します。A/D・左右キー、または画面の左右ボタンで道路を動かし、60秒間落下を避けてください。

## 開発

```sh
npm ci
npm run dev
```

## 検証と公開ビルド

```sh
npm run typecheck
npm test
npm run build
```

GitHub Pages用のビルドは `npm run build` で `base: /ROAD-DRIVER/` を設定します。`dist/` をPagesへ公開してください。

## GLBアセット

`public/assets/manifest.json` に `models` 配列を用意し、`category: "vehicle"` のモデルを `public/assets/` 以下に配置すると車種として読み込みます。各エントリーには `id`, `file`, `category`, `source`, `license`, `bytes`, `usage` を記録してください。ロード失敗・破損時は手続き生成車両にフォールバックします。NEXUS接続は開発時の取得・選定に限定し、公開版はmanifestとローカルGLBだけを使います。

現環境にはNEXUS接続手段とGLBがないため、manifestは空です。ライセンス確認済みのGLBを追加するまでは車・建物・木・未来背景を軽量な手続き生成モデルで表示します。

## 操作

- A/D または ←/→: 道路を左右にずらす
- P / Esc: 一時停止・再開
- M: 効果音のミュート切替
- iPad: 画面下の左右タッチボタン
