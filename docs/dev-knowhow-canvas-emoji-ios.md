# Canvas Emoji 在 iOS 顯示異常：色彩繼承問題

**發現時機**：cat_volley / cat_volley_app 在 iPhone Chrome 測試時，貓、球、網、按鈕全部呈現綠色或暗色剪影。

---

## 問題根本原因

iOS（WebKit）的 canvas `fillText()` 在渲染 emoji 時，**會繼承當前的 `ctx.fillStyle`**。

桌面版 Chrome / Firefox 把 emoji 當作彩色圖像（bitmap）直接貼上，與 fillStyle 無關。但 iOS 上 emoji 走的是字型渲染路徑，相當於「有顏色的文字」，結果就是把 fillStyle 的顏色套上去。

### 具體觸發場景

```
drawSky()   → fillStyle = 藍色漸層
drawClouds() → fillText('☁️')   ← 雲被染藍
drawGround() → fillStyle = 綠色漸層
drawNet()    → fillText('🟥')   ← 網被染綠
drawCatEmoji() → fillText('🐈') ← 貓被染綠
drawBallEmoji() → fillText('🔵') ← 球被染綠
drawButtons() → fillText('◀️')  ← 按鈕被染綠
```

每次只要前面有 fill 操作沒清掉，後面的 emoji 就全被污染。

---

## 解決方案

### 核心規則
> **每次 `fillText(emoji)` 之前，明確設定 `ctx.fillStyle = '#000'`**

iOS 在 fillStyle 為 `#000`（黑色）時，emoji 觸發彩色渲染路徑，顯示正確的全彩外觀。

```javascript
// ❌ 錯誤：沒有重設 fillStyle，emoji 會繼承前一個顏色
ctx.fillText('🐈', x, y);

// ✅ 正確：明確設為黑色，iOS 才顯示彩色 emoji
ctx.fillStyle = '#000';
ctx.fillText('🐈', x, y);
```

如果函式內有用 `ctx.save()` / `ctx.restore()`，在 save 區塊內設定即可，不會污染外部狀態：

```javascript
function drawCatEmoji(x, y, emoji) {
  ctx.save();
  ctx.translate(x, y);
  ctx.font = '52px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';          // ← 必加
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}
```

### 同場加映：字型順序

iOS 需要 `Apple Color Emoji` 排在最前面，否則找不到字型時可能走備援路徑：

```javascript
// ❌ Windows 優先，iOS 找不到 Segoe UI Emoji 才 fallback
ctx.font = '52px Segoe UI Emoji, Apple Color Emoji';

// ✅ 各平台都放，iOS 先找到自己的字型
ctx.font = '52px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji';
```

---

## 開發新遊戲時的 Checklist

1. **凡用 `fillText()` 畫 emoji，前一行一定加 `ctx.fillStyle = '#000'`**
2. **字型字串永遠寫** `'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji'`
3. 如果函式有 `ctx.save()` / `ctx.restore()`，在 save 區塊內設定 fillStyle 即可
4. 畫完 emoji 若後面馬上要畫文字（非 emoji），記得重設 fillStyle 為你要的顏色

---

## 為什麼桌面正常、手機才出事

| 平台 | Emoji 渲染方式 | 受 fillStyle 影響 |
|------|--------------|-----------------|
| Windows Chrome / Firefox | 系統 emoji 字型作為 bitmap overlay | 否 |
| macOS Safari / Chrome | Apple Color Emoji（向量，色彩獨立） | 否（通常） |
| **iOS Safari / Chrome** | WebKit 字型渲染，走文字路徑 | **是** |
| Android Chrome | Noto Color Emoji（bitmap） | 否（通常） |

iOS Chrome 底層仍是 WebKit（Apple 規定所有 iOS 瀏覽器都得用 WebKit），行為與 iOS Safari 一致。

---

## 相關檔案

- `games/cat_volley.html`：主版本，2026-03-28 修正
- `games/cat_volley_app.html`：手機分支，2026-03-28 修正
