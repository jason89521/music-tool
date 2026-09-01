# Music Tool

Music Tool 是一個可離線使用的個人音樂練習 PWA。第一項工具是節奏練習器，可產生正式打擊樂譜並以小鼓、預備拍與選用節拍器播放。

## 開發

```sh
npm install
npm run dev
```

## 驗證

```sh
npm test
npm run lint
npm run build
```

## 音效

目前 `public/audio/snare.wav` 是指定 Freesound 素材的公開低品質預覽處理版。取得原始 WAV 後應以相同處理流程替換，並更新 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) 的說明與 SHA-256。
