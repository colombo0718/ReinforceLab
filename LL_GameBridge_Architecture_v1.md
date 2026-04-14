# LL GameBridge 架構規劃 v1
> LeafLune 宇宙的遊戲 × AI 通訊總架構

---

## 一、核心洞察：兩種 AI 介面，兩種遊戲類型

遊戲與 AI 的接合，從根本上分成兩種類型：

| | RR 平台（現有）| MCP Bridge（新） |
|--|--|--|
| **控制頻率** | 高頻（每 tick / 每幀）| 低頻（每回合）|
| **State 維度** | 低（數值向量）| 高（文字、結構化資料）|
| **資訊範圍** | State + Reward | State + 規則 + 歷史 + 對話 + … |
| **適合 AI** | RL Agent | LLM |
| **適合遊戲** | 即時制、連續控制 | 回合制、策略型 |
| **通訊方式** | postMessage（iframe）| MCP + Playwright |
| **代表遊戲** | CartPole、直升機、迷宮 | Shadow Protocol、法師鬥惡龍 |

兩軌不衝突，互補。

---

## 二、LL GameBridge 協定（LLGB）

### 設計目標

任何符合 LLGB 協定的網頁遊戲，都能自動接上：
- MCP Bridge → 任何 LLM 控制
- RR 平台 → RL Agent 訓練
- Blockly 腳本執行器
- 未來的其他 AI 介面

### 介面定義

遊戲在 `window` 上掛載以下物件：

```javascript
window.LLGB = {
  // 取得當前可觀測狀態（依可見性規則過濾）
  getState() → Object,

  // 執行一個動作，回傳結果
  doAction(action: string) → { result: string, reward: number, done: boolean },

  // 列出當前合法的動作清單
  getActions() → string[],

  // 重置遊戲到初始狀態
  reset() → void,

  // 遊戲的靜態 metadata（載入時讀一次即可）
  getMeta() → {
    name: string,          // 遊戲名稱
    version: string,       // 版本號
    description: string,   // 規則說明（自然語言，供 LLM 理解）
    actionSpace: string[], // 所有可能的動作
    stateSchema: Object    // state 結構說明
  }
}
```

### 為什麼 `description` 很重要

這是 LLGB 跟 RR 協定最大的差異——LLM 需要**語意理解**，不只是數值。

```javascript
getMeta() {
  return {
    name: "Shadow Protocol",
    description: `
      回合制潛行策略遊戲。忍者在 10x10 網格移動，
      陰影格可隱身，蠟燭照亮周圍格，
      目標是取得卷軸後抵達出口。
      每回合玩家與守衛同時行動。
    `,
    actionSpace: ["move_up","move_down","move_left","move_right","extinguish","pick","wait"]
  }
}
```

---

## 三、MCP Bridge 架構

```
LLM（任意：Claude / GPT / Gemini…）
  ↓ MCP tool call
Python MCP Server
  ↓ page.evaluate("window.LLGB.doAction(...)")
Playwright（瀏覽器橋梁）
  ↓
網頁遊戲（HTML/JS）
  ↓ 回傳結果
Python MCP Server
  ↓ 回傳 observation
LLM
```

### MCP Tools（LLM 可呼叫）

```python
@mcp.tool()
def get_state() -> dict:
    """取得當前遊戲狀態"""

@mcp.tool()
def do_action(action: str) -> dict:
    """執行動作，回傳結果與獎勵"""

@mcp.tool()
def get_actions() -> list:
    """列出當前合法動作"""

@mcp.tool()
def get_rules() -> str:
    """取得遊戲規則說明（自然語言）"""

@mcp.tool()
def get_history() -> list:
    """取得本局完整事件歷史"""

@mcp.tool()
def reset() -> None:
    """重置遊戲"""
```

### 可選的豐富資訊來源

LLM 玩家可以自行選擇帶入哪些資訊：

| 資訊 | 用途 |
|------|------|
| 遊戲規則說明 | 讓 LLM 理解遊戲機制 |
| 當前局面 state | 基本決策依據 |
| 本局完整歷史 | 分析對方行為模式 |
| 玩家間對話紀錄 | 判斷心理戰、偵測欺騙 |
| 歷史對局統計 | 長期策略演化 |

這讓不同層級的玩家有不同的使用方式：
- **新手**：全部餵給 LLM 當顧問，跟著建議走
- **中階**：選擇性帶入，人機協作決策
- **高手**：完全自己下，LLM 只做事後分析

---

## 四、三層架構：LLM × RL × 遊戲

```
┌─────────────────────────────────┐
│  LLM 層（策略）                  │
│  理解規則、推理局面、長期規劃      │
│  工具：MCP Bridge / 自然語言介面  │
└──────────────┬──────────────────┘
               │ 高層指令 / 策略方向
┌──────────────▼──────────────────┐
│  RL Agent 層（戰術）             │
│  快速反應、模式執行、即時決策      │
│  工具：RR 平台 / postMessage 協定 │
└──────────────┬──────────────────┘
               │ 低層動作執行
┌──────────────▼──────────────────┐
│  遊戲層（執行）                  │
│  物理規則、渲染、事件結算          │
│  介面：window.LLGB              │
└─────────────────────────────────┘
```

Shadow Protocol 的應用範例：
- **LLM**：分析戰場全局，決定「這回合主帥往左翼突破」
- **RL Agent**：執行具體移動序列，處理即時碰撞判斷
- **遊戲**：結算光影、聲音、FOV，回傳事件

---

## 五、遞迴層：LLM 控制 RR 平台訓練 RL

這是整個架構最關鍵的延伸——

**把「訓練 RL Agent」這件事本身看成一個回合制任務：**

```
LLM 觀察：當前訓練曲線、reward 走勢、agent 行為分析
LLM 決策：調整 reward shaping、修改 Blockly 腳本、更換訓練環境
LLM 執行：透過 MCP Bridge 操作 RR 平台介面
等待結果：RR 跑 N 個 episode
LLM 再次觀察：新的訓練曲線…（循環）
```

RR 平台本身就是一個「網頁遊戲」，只要掛上 `window.LLGB`，就能被 MCP Bridge 控制。

這對應學術上的 **AutoML / LLM-as-Optimizer** 概念——用 LLM 的語意推理能力搜尋最優的 RL 訓練策略，而不是手動調參。

---

## 六、LeafLune 生態的兩軌協定對照

| 面向 | RR 協定（postMessage）| LLGB 協定（window + MCP）|
|------|----------------------|--------------------------|
| **設計文件** | `RR平台可控遊戲環境宣告與通訊協定.md` | 本文件 |
| **通訊機制** | iframe postMessage | window.LLGB + Playwright |
| **State 格式** | 數值陣列 | 結構化 Object / 自然語言 |
| **動作格式** | 整數索引 | 字串名稱 |
| **額外資訊** | 無 | 規則、歷史、對話… |
| **適用 AI** | Q-Learning、DQN | 任意 LLM |
| **現有實作** | CartPole、迷宮、直升機… | Shadow Protocol（進行中）|

---

## 七、待辦

- [ ] 完成 Shadow Protocol MVP，掛上 `window.LLGB`
- [ ] 實作 Python MCP Server 最小版本（單遊戲、單 LLM）
- [ ] 驗證 Playwright 橋接可行性（`autoWeb_playwright.py` 已有基礎）
- [ ] 定義 `getHistory()` 的資料格式
- [ ] 考慮 RR 平台加入 `window.LLGB` 作為副介面（讓 LLM 可控制訓練流程）
- [ ] 多 LLM 對戰：Shadow Protocol 滲透方 vs 防守方
