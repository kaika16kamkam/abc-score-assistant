# abc-score-assistant

### github pages link

https://kaika16kamkam.github.io/abc-score-assistant/

## ローカルでの起動方法

### 前提

- Node.js / npm が使えること
- `python3` が使えること

### 1. 依存パッケージをインストール

```bash
npm ci
```

### 2. TypeScript をビルド

```bash
npm run build
```

ビルド結果は `js/` に出力されます。

### 3. ローカルサーバーを起動

```bash
python3 -m http.server 8000
```

ブラウザで以下を開いてください。

```text
http://localhost:8000
```

## 開発時

TypeScript を監視しながら開発する場合は、別ターミナルで以下を実行してください。

```bash
npm run build:watch
```

このプロジェクトには `npm start` はなく、`index.html` を静的配信して動かす構成です。

## GitHub Pages への配信

`js/` はビルド生成物なので Git 管理していません。
GitHub Pages では `.github/workflows/deploy-pages.yml` で `npm run build` を実行し、生成した `js/` を含む成果物を配信します。

リポジトリ設定の Pages は `Deploy from a branch` ではなく `GitHub Actions` を選んでください。
