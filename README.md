# abc-score-assistant

### github pages link

https://kaika16kamkam.github.io/abc-score-assistant/

## ローカルでの起動方法

### 前提

- Node.js / npm が使えること

### 1. 依存パッケージをインストール

```bash
npm ci
```

### 2. 開発サーバーを起動

```bash
npm run dev
```

`npm run dev` は起動前に `npm run build` を実行し、その後 `Vite` の開発サーバーを立ち上げます。

### 3. ブラウザで開く

Vite が表示するローカル URL を開いてください。
通常は `http://localhost:5173` です。

## 開発時

TypeScript の変更を自動で `js/` に反映しながら開発する場合は、別ターミナルで以下を実行してください。

```bash
npm run build:watch
```

このプロジェクトでは `index.html` が `js/main.js` を参照するため、ソース変更を即時反映したい場合は `build:watch` も必要です。

## 本番用ビルド

GitHub Pages 向けのビルド成果物を生成する場合は以下を実行してください。

```bash
npm run build
```

ビルド結果は `js/` に出力されます。

## GitHub Pages への配信

`js/` はビルド生成物なので Git 管理していません。
GitHub Pages では `.github/workflows/deploy-pages.yml` で `npm run build` を実行し、生成した `js/` を含む成果物を配信します。

リポジトリ設定の Pages は `Deploy from a branch` ではなく `GitHub Actions` を選んでください。
