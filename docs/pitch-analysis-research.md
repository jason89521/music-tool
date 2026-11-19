# 離線音高辨識技術調研

## 演算法與套件

- **YIN** 對不同週期計算訊號差，再用累積平均正規化差值（CMND）找第一個低於門檻的谷底，最後用拋物線內插估計週期。`@audio/pitch-yin@1.1.0` 的預設 ESM 匯出回傳 `{ freq, clarity }` 或 `null`。`yinInto` 支援呼叫端重用工作陣列，可避免逐 frame 配置記憶體。原始碼以巢狀迴圈計算差值，成本隨比較窗長與可搜尋的週期數增加。此版本於 2026-11-18 發布，npm 標示 MIT，核心無執行期依賴。比較窗加上最大延遲才是實際讀取範圍，整個輸入 buffer 的幾何中央與比較窗中央可能不同。 [YIN 論文](https://doi.org/10.1121/1.1458024) · [1.1.0 原始碼](https://github.com/audiojs/pitch/blob/95b8d061491352a8565db133f082e919a3fe6c89/packages/pitch-yin/yin.js) · [npm 發布資訊](https://registry.npmjs.org/@audio%2fpitch-yin/1.1.0) · [上游授權](https://github.com/audiojs/pitch/blob/95b8d061491352a8565db133f082e919a3fe6c89/LICENSE)
- **McLeod Pitch Method（MPM）** 用正規化平方差函數（NSDF）的峰值估計週期與週期性。`pitchy@4.1.0` 的 `PitchDetector.forFloat32Array(frameSize)` 建立可重用的估測器，`findPitch(frame, sampleRate)` 回傳 `[Hz, clarity]`。實作使用零填補、`fft.js` 頻域自相關、NSDF 峰值及插值，FFT 成本為 O(N log N)。`minVolumeAbsolute` 可做振幅下限，音高範圍由使用端判斷。發布版為純 JS ESM，含型別宣告，2024-01-04 發布的 4.1.0 附 MIT 授權。上游 `main` 於 2026-10-13 仍有提交，該分支的 `package.json` 已改標 0BSD。`@audio/pitch-mcleod` 也提供 MPM，其原始碼以巢狀迴圈直接計算自相關。 [MPM 論文](https://www.cs.otago.ac.nz/graphics/Geoff/tartini/papers.html) · [Pitchy 4.1.0 原始碼](https://github.com/ianprime0509/pitchy/blob/d830636bdcd82b4a0648f65a5ebc182e231f8458/index.js) · [npm 發布資訊](https://registry.npmjs.org/pitchy/4.1.0) · [目前分支的授權資訊](https://github.com/ianprime0509/pitchy/blob/d41851e038d05be4352245a4de414997b507cc53/package.json) · [audiojs MPM 原始碼](https://github.com/audiojs/pitch/blob/95b8d061491352a8565db133f082e919a3fe6c89/packages/pitch-mcleod/mcleod.js)
- **pYIN** 先以多個 YIN 門檻建立候選週期的分布，再以隱馬可夫模型解碼跨 frame 的音高與有聲狀態。已查核 `@audio/pitch-pyin@2.1.0` 的 npm 發布檔案。預設匯出 `pyin(frame)` 只產生單一 frame 的候選結果。具名匯出 `track` 實際呼叫 FFT 候選估計並執行跨 frame 的 Viterbi 解碼。隱藏狀態用 0.1 半音的音高格和有聲／無聲狀態，回溯記憶體受 `lag` 限制。`track` 支援以區塊餵入 PCM，回傳 `times`、`f0`、`voiced`、`prob`；有聲時通常輸出候選的插值頻率，模型在缺候選的情形可回退到音高格中央。`prob` 來自候選的總有聲機率。頻率範圍越大，模型狀態越多，須實測其成本與快速跳音表現。此 ESM 版本於 2026-10-12 發布，npm 標示 MIT，執行期依賴為 `fourier-transform`。較舊的 1.0.1 原始碼只包含單 frame 輸出，版本會改變可用的 API。 [pYIN 論文](https://www.eecs.qmul.ac.uk/~simond/pub/2014/MauchDixon-PYIN-ICASSP2014.pdf) · [2.1.0 發布資訊](https://registry.npmjs.org/@audio%2fpitch-pyin/2.1.0) · [跨 frame 實作](https://github.com/audiojs/pitch/blob/814a4b6cefe781cec305191110fe6fd19fcdd2ec/packages/pitch-pyin/track.js) · [Viterbi 原始碼](https://github.com/audiojs/pitch/blob/814a4b6cefe781cec305191110fe6fd19fcdd2ec/packages/pitch-pyin/viterbi.js)
- **Pitchfinder** 的 `YIN(options)` 建立接受 Float32Array 的函式，回傳 Hz 或 `null`，無對外信心值。`pitchfinder@2.3.4` 可透過打包工具在瀏覽器使用，發布日期為 2025-12-16。逐 frame 配置陣列且直接計算差值。若輸入長度是 2 的冪次，程式碼會取其一半再折半作最大 lag，例如 2048 點輸入與 22.05 kHz 的有效 lag 小於 512，涵蓋不到 Low B 約 714 點的週期。YIN 檔頭明列 GPL-3.0-or-later。前述替代實作有可重用的工作緩衝或 FFT，這個版本未納入比較。 [2.3.4 YIN 原始碼](https://github.com/peterkhayes/pitchfinder/blob/13b06365f8c7264f737b7d02d264e3589338c1a1/src/detectors/yin.ts) · [npm 發布資訊](https://registry.npmjs.org/pitchfinder/2.3.4)
- **SWIPE′** 對照鋸齒波頻譜，使用基頻與質數次泛音來減少候選的次諧波干擾。audiojs 的 JS 版本使用單一 Hann 窗與一次 FFT，再逐一評估對數頻率候選。原論文使用多解析度視窗；單窗版本的低頻效能會受到 FFT 頻率解析度限制。若 YIN／MPM／pYIN 在真實殘留伴奏上仍常出現八度錯誤，可比較原論文的多解析度版本。 [SWIPE 論文](https://doi.org/10.1121/1.2951592) · [audiojs SWIPE 原始碼](https://github.com/audiojs/pitch/blob/95b8d061491352a8565db133f082e919a3fe6c89/packages/pitch-swipe/swipe.js)

低 B 的週期約 32.4 ms。縮短視窗可以減少起音、休止與快速換音落進同一 frame 的情況，代價是用來估測低頻的週期數變少。當基頻很弱或消失時，只要足夠的泛音仍組成原始週期，時間域演算法仍可能找到週期。若訊號只剩偶數次泛音，觀測到的波形週期本身就可能小一個八度。應用合成訊號與真實錄音評估不同條件下的取捨。 [YIN 論文](https://doi.org/10.1121/1.1458024) · [MPM 論文](https://www.cs.otago.ac.nz/graphics/Geoff/tartini/papers.html)

## 真實貝斯資料

- **IDMT-SMT-Bass** 為四弦電貝斯單音，發行頁說明涵蓋 E1 至 G3，有指彈、撥片、悶音、Slap-Thumb、Slap-Pluck，也有顫音、滑音等奏法。ZIP 內 `IDMT-SMT-Bass-Description.pdf` 說明 `PS` 目錄的檔名含樂器、拾音器、撥弦方式、弦號與格數。弦號 1 至 4 對應低到高 E/A/D/G，開放弦 MIDI 為 28、33、38、43。可用 `PS` 中一般表現的錄音衡量穩定區間與標稱音符的差距。也可用奏法分類分組；單音檔名的音符標記無法反映音高隨時間的變化。 [Fraunhofer 資料說明](https://www.idmt.fraunhofer.de/en/publications/datasets/bass.html) · [Zenodo 發行檔](https://zenodo.org/records/7188892)
- **IDMT-SMT-Bass-Single-Track** 有 17 段貝斯樂句。已下載並核對 ZIP 的 MD5 為 `c85540c664e8b13badd86880bacf11fa`。`audio/NNN.wav` 對應 `annotation/NNN.xml`。XML 的 `<transcription><event>` 記錄 `onsetSec`、`offsetSec`、整數 MIDI `pitch`、`excitationStyle`（撥弦）與 `expressionStyle`（表現），部分事件另有音高調變範圍（cents）與調變頻率（Hz）。實際 948 筆事件的標稱音高為 MIDI 28 至 67。17 軌均為 E/A/D/G 四弦調弦。`NO` 表現的事件有 829 筆，可分奏法看穩定音高，並把顫音、滑音和打擊性死音當作獨立案例。 [Fraunhofer 資料說明](https://www.idmt.fraunhofer.de/en/publications/datasets/bass_lines.html) · [Zenodo 發行檔](https://zenodo.org/records/7544099) · [錄音與標註論文](https://dafx.de/paper-archive/2013/papers/24.dafx2013_submission_9.pdf)

兩份 Fraunhofer 網頁標明 CC BY-NC-ND 4.0。壓縮檔內隨附的兩份資料描述 PDF 則列 CC BY-SA 4.0。兩種授權說明不一致，本次使用限於本機評估，專案不附錄音或資料集檔案。兩份資料都是四弦標準調弦，五弦 Low B 與微分音輪廓需要另外使用具參考頻率的測試訊號或錄音驗證。 [Fraunhofer 單音資料](https://www.idmt.fraunhofer.de/en/publications/datasets/bass.html) · [Fraunhofer 樂句資料](https://www.idmt.fraunhofer.de/en/publications/datasets/bass_lines.html)

單音抽樣使用同一把貝斯與拾音器設定下的 40 個檔案。每個撥弦方式選四條弦各兩個音，分別為開放弦與第 5 格。樣本按 ZIP 索引的位置下載，並逐一核對 CRC32。用弦的開放弦 MIDI 加上格數取得標稱音高，可評估起音後的非靜音區間。從原始 ZIP 解出相同樣本的指令如下。 [單音 ZIP](https://zenodo.org/records/7188892)

```sh
unzip IDMT-SMT-BASS.zip 'PS/*/BS_1_EQ_1_??_NO_[1-4]_[05].wav' -d idmt-isolated
```

## 介面參考

《歌唱音調儀》的 App Store 說明展示連續音高曲線、錄音播放、拖曳平移和兩指縮放。Music Tool 的音高繪圖以同類互動為參考，並沿用既有播放器的播放時間與循環段落。 [App Store](https://apps.apple.com/tw/app/%E6%AD%8C%E5%94%B1%E9%9F%B3%E8%AA%BF%E5%84%80/id944309175?platform=ipad)
