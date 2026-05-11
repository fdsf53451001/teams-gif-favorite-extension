# Teams GIF 我的最愛

在 Microsoft Teams 網頁版加入類似 Discord 的 **GIF 我的最愛**功能。

## 功能

| 功能 | 說明 |
|---|---|
| ⭐ 聊天收藏 | 滑鼠移到聊天訊息中的 GIF，右上角出現星星按鈕，點一下加入最愛，再點取消 |
| 🗂 Picker 整合 | 點 GIF 按鈕開啟 Teams 內建 GIF picker，分類頁第一格即為「我的最愛」 |
| 🔄 即時同步 | 多個分頁同時開啟 Teams，收藏狀態自動同步 |

## 安裝

1. 下載或 clone 此資料夾
2. 打開 Edge：`edge://extensions/`　或 Chrome：`chrome://extensions/`
3. 開啟右上角「開發人員模式」
4. 點「載入未封裝項目」→ 選擇本資料夾（`teams-gif-favorite-extension/`）
5. 打開 [teams.microsoft.com](https://teams.microsoft.com) 或 [teams.live.com](https://teams.live.com)

## 使用方式

### 收藏 GIF
1. 在任一聊天中，滑鼠移到別人傳的 GIF 上
2. 右上角出現 ☆ 星星按鈕 → 點一下變成 ★（已收藏）
3. 再點一下取消收藏

### 使用我的最愛
1. 點訊息輸入列的 GIF 按鈕（笑臉/貼圖圖示）
2. 切到 **GIFs** 分頁
3. 分類頁第一格是 ⭐ **我的最愛**
4. 點進去 → 看到所有收藏的 GIF → 點一下即插入訊息輸入框

## 已知限制

- **Teams 桌面 App 不支援**（瀏覽器擴充功能無法注入 Teams 原生 App）
- GIF 只記網址，若來源網址失效，收藏的項目無法顯示
- 若 Teams 改版改動 DOM 結構，可能需要更新 `src/content/selectors.js` 內的 selector
- GIF 插入策略依 Teams 版本而定，若自動插入失敗，會自動複製 GIF 到剪貼簿並提示手動貼上

## 排除問題

打開 DevTools（F12）→ Console，過濾 `[GifFav]` 可看到除錯訊息。

若收藏的 GIF 未顯示 / 星星未出現，可能是 Teams 更新後 selector 失效。請在 DevTools Console 執行：

```js
// 確認 content script 有載入
window.GifFav
```

若回傳 `undefined`，代表 content script 未載入，請確認擴充功能已啟用且網域符合。

若有 `GifFav` 物件但星星不出現，表示 selector 失效，請在 Teams 聊天頁 inspect GIF `<img>` 元素，找出其 src 格式並更新 `selectors.js` 的 `isGifImg` 函式。
