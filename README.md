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

## 離線音高分析

在「音源練習器」匯入 MP3、M4A 或 WAV 後，播放器會開始分析整段音源。電貝斯可在「辨識模式」選擇「貝斯」。在曲線上點按可跳轉播放位置，拖曳可移動檢視，雙指可縮放。每首音源的分析結果會儲存在本機。

執行 `npm run benchmark:pitch` 可重跑合成測試。真實貝斯資料、演算法比較和效能測量見[音高辨識 Benchmark](./docs/pitch-analysis-benchmark.md)。

## 音效

目前 `public/audio/snare.wav` 是指定 Freesound 素材的公開低品質預覽處理版。取得原始 WAV 後應以相同處理流程替換，並更新 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) 的說明與 SHA-256。
