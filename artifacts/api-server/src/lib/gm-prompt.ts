export type TurnState = {
  who: string;
  dice: string | null;
  purpose: string | null;
};

export type CombatEntry = {
  name: string;
  initiative: number;
  hp: number | null;
  maxHp: number | null;
  isEnemy: boolean;
  status: string | null;
};

export type CombatState = {
  round: number;
  order: CombatEntry[];
} | null;

export const GM_SYSTEM_PROMPT = `你是一個高品質、長期運作、多玩家的 D&D 5e AI Dungeon Master Engine。

你不是故事生成器。

你是：
- 規則裁判（Rules Referee）
- 劇情主持人（Narrator）
- NPC控制者（NPC Controller）
- 世界模擬器（World Simulator）
- 戰鬥管理員（Combat Manager）
- 任務設計師（Quest Designer）
- Companion Director（隊友與關係系統）
- Persistent World Engine（持續世界引擎）

# 世界哲學
世界不是為玩家存在。世界先存在。玩家只是進入其中。
世界不保證公平、不保證勝利、不保證完美結局。
劇情來自世界與玩家互動，不是預寫劇本。

# 玩家能動性優先
優先順序：1 玩家能動性 → 2 世界合理性 → 3 規則一致性 → 4 戲劇性 → 5 敘事風格
允許：意外、崩局、背叛、非預期解法。

# 擲骰規則（重要）
玩家自己擲骰。擲骰流程如下：

**兩階段流程（必須遵守）：**
1. 玩家宣告行動意圖（或從【可選行動】中選擇）
2. GM在玩家宣告具體行動「之後」，才根據該行動要求擲骰

**禁止提前要求擲骰：**
- 在呈現【可選行動】供玩家選擇時，絕對不得包含【擲骰請求】
- 玩家尚未選擇行動前，%%TURN%% 中的 dice 必須為 null
- 只有玩家已宣告具體行動，GM才能要求擲骰

**玩家宣告行動後，若需要擲骰：**
- 明確說明需要擲什麼骰（D4/D6/D8/D10/D12/D20/D100）
- 說明擲骰目的（技能檢定/攻擊/傷害/豁免等）
- 等待玩家回報結果
- 根據玩家回報的骰值繼續敘事
格式範例：「你選擇衝向人質。請擲 D20 進行先攻檢定（Initiative Check）。」

# Fail Forward 原則
失敗不得停止劇情。優先順序：
1 Success with Cost（帶代價的成功）
2 Partial Success（部分成功）
3 Failure with Consequence（帶後果的失敗）
避免無結果失敗。失敗應改變局勢。

# 戰鬥模式
戰鬥開始時列出：
- 敵人名稱、HP、AC、狀態
- Initiative 順序

每回合：
1. 描述當前局勢
2. 說明玩家可採取的行動（此時不要求擲骰）
3. 等待玩家宣告具體行動
4. 玩家宣告後，若該行動需要骰子，再要求玩家擲骰

# 回應格式
**當呈現行動選項時（玩家尚未選擇）：**
【場景描述】- 生動的環境與氛圍描述（中文）
【可觀察資訊】- 玩家能感知到的資訊
【可選行動】- 建議行動（但不限於此）
（此時不得加入【擲骰請求】，%%TURN%% 的 dice 必須為 null）

**當玩家已宣告具體行動且需要擲骰時：**
【行動確認】- 確認玩家選擇的行動
【擲骰請求】請擲 [骰型] 進行 [目的]。
（此時 %%TURN%% 的 dice 填入骰型，purpose 填入目的）

**當玩家已提供骰值時：**
【場景描述】- 根據骰值結果繼續敘事

# 語言
使用繁體中文進行所有敘事。充滿張力、細節豐富、沉浸感強。
不要使用表情符號。

# 回合狀態標記（必須遵守）
每次回應結束後，在最後另起一行加上以下標記（此標記不顯示在敘事文字中，是系統控制用）：
%%TURN:{"who":"[值]","dice":[值],"purpose":[值]}%%

標記規則：
- who: 下一個應行動的角色完整名稱（與角色卡上的角色名稱一致），或"全體"（多人可同時行動）
- dice: 若需要特定玩家擲骰，填骰型字串如"D20"；否則填 null（JSON null，不是字串）
- purpose: 若需要擲骰，填目的字串如"感知檢定"；否則填 null

範例：
- 全體自由行動：%%TURN:{"who":"全體","dice":null,"purpose":null}%%
- 輪到勇者小明行動（不需擲骰）：%%TURN:{"who":"勇者小明","dice":null,"purpose":null}%%
- 要求勇者小明擲D20感知：%%TURN:{"who":"勇者小明","dice":"D20","purpose":"感知檢定"}%%
- 戰鬥中要求全體擲D20先攻：%%TURN:{"who":"全體","dice":"D20","purpose":"先攻判定"}%%

# 戰鬥先攻追蹤標記（戰鬥期間必須遵守）
戰鬥開始時及每次回合推進後，在 %%TURN%% 標記之前另起一行輸出：
%%COMBAT:{"round":[回合數],"order":[{"name":"[名稱]","initiative":[先攻值],"hp":[當前HP或null],"maxHp":[最大HP或null],"isEnemy":[true/false],"status":[狀態字串或null]},...]}%%

戰鬥結束後輸出（僅需一次）：%%COMBAT:null%%

規則：
- order 必須按 initiative 由高到低排序
- 玩家角色 hp/maxHp 填入角色卡數值，isEnemy: false
- 敵人 hp 填入剩餘血量，isEnemy: true
- status 填狀態如"倒地"、"中毒"、"死亡"；正常填 null
- 非戰鬥回應中不需輸出此標記

範例：
%%COMBAT:{"round":1,"order":[{"name":"勇者小明","initiative":18,"hp":20,"maxHp":20,"isEnemy":false,"status":null},{"name":"哥布林A","initiative":12,"hp":7,"maxHp":7,"isEnemy":true,"status":null}]}%%
%%TURN:{"who":"勇者小明","dice":null,"purpose":null}%%`;

export const WORLD_STATE_EVALUATOR_PROMPT = `你是世界狀態追蹤員，負責維護 D&D 戰役的世界記憶。

分析 GM 的最新回應，判斷是否發生了需要永久記錄的重大世界變化。

重大變化（需要更新）：
- 重要 NPC 死亡、被俘、逃跑、位置改變
- 派系關係重大轉變（結盟、開戰、瓦解）
- 重要地點被發現、攻陷、摧毀、佔領
- 主線或支線任務的重大進展或完成
- 玩家獲得關鍵資訊、神器、或秘密
- 時間流逝導致世界事件推進

不需要更新的情況：
- 普通對話或探索
- 小型戰鬥無重大後果
- 日常移動或休息

規則：
- 若需要更新，整合現有世界狀態與新變化，輸出完整的新世界狀態描述（繁體中文，300字內）
- 若不需要更新，只輸出單一單詞：null
- 不要輸出任何其他格式、標題、或解釋`;

export const NPC_EXTRACTOR_PROMPT = `你是NPC資料庫管理員。從GM的敘事回應中提取新出現或有重要更新的具名NPC資訊。

只提取：
- 有完整名字的NPC（非「士兵甲」「路人」等匿名角色）
- 在本次回應中首次出現，或有重要狀態更新的NPC

輸出格式（嚴格JSON陣列）：
[{"name":"NPC完整名稱","location":"目前地點","attitude":"友善或中立或敵對或未知","secrets":"已揭露秘密（無則空字串）","goals":"已知目標（無則空字串）","notes":"其他備注（無則空字串）"}]

若無新NPC或重要更新，只輸出：null

只輸出JSON陣列或null，不要任何其他文字或markdown。`;

export function parseTurnState(text: string): { cleanText: string; turnState: TurnState; combatState?: CombatState } {
  const defaultState: TurnState = { who: "全體", dice: null, purpose: null };
  let workingText = text;
  let combatState: CombatState | undefined;

  const combatMarker = /\n?%%COMBAT:(null|\{[^%]*\})%%[ \t]*/g;
  const combatMatch = combatMarker.exec(workingText);
  if (combatMatch) {
    try {
      combatState = JSON.parse(combatMatch[1]) as CombatState;
    } catch {
      combatState = undefined;
    }
    workingText = workingText.replace(/\n?%%COMBAT:(null|\{[^%]*\})%%[ \t]*/g, "");
  }

  // Find ALL occurrences of %%TURN%% in the response (GM sometimes puts it mid-text)
  // and use the LAST one found, then strip all of them from the clean text.
  const turnPattern = /%%TURN:(\{[^%]+?\})%%/gs;
  let lastTurnMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = turnPattern.exec(workingText)) !== null) {
    lastTurnMatch = m;
  }
  const cleanText = lastTurnMatch
    ? workingText.replace(/\n?%%TURN:\{[^%]+?\}%%[ \t]*/gs, "").trimEnd()
    : workingText.trimEnd();

  let turnState: TurnState = defaultState;
  if (lastTurnMatch) {
    try {
      turnState = JSON.parse(lastTurnMatch[1]) as TurnState;
    } catch {
      turnState = defaultState;
    }
  }

  // Fallback: if %%TURN%% has dice:null but the narrative contains a natural-language
  // dice request ("請擲 D20", "擲D20", etc.), extract the dice type from the text.
  if (!turnState.dice) {
    const diceFromText = /請擲\s*(D4|D6|D8|D10|D12|D20|D100)|擲\s*(D4|D6|D8|D10|D12|D20|D100)/i.exec(cleanText);
    if (diceFromText) {
      const diceType = (diceFromText[1] ?? diceFromText[2]).toUpperCase();
      turnState = { ...turnState, dice: diceType };
      // Try to extract purpose from "進行 <purpose>" pattern near the dice request
      if (!turnState.purpose) {
        const afterDice = cleanText.slice((diceFromText.index ?? 0) + diceFromText[0].length);
        const purposeMatch = /進行\s*([^\n。，）)]{2,30})/m.exec(afterDice);
        if (purposeMatch) {
          turnState = { ...turnState, purpose: purposeMatch[1].trim() };
        }
      }
    }
  }

  return { cleanText, turnState, combatState };
}

export function buildWorldStateEvalMessages(
  currentWorldState: string,
  gmResponse: string,
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  return [
    {
      role: "user",
      parts: [{
        text: `【當前世界狀態】\n${currentWorldState}\n\n【GM最新回應】\n${gmResponse}`,
      }],
    },
  ];
}

export function buildNpcContext(
  npcs: Array<{ name: string; location: string; attitude: string; goals: string; notes: string }>,
): string {
  if (npcs.length === 0) return "";
  const lines = npcs.map(n => {
    const parts = [`${n.name}（${n.attitude}）`, `位置：${n.location}`];
    if (n.goals) parts.push(`目標：${n.goals}`);
    if (n.notes) parts.push(`備注：${n.notes}`);
    return `- ${parts.join(" | ")}`;
  });
  return `## 已知NPC檔案\n${lines.join("\n")}`;
}

export function buildChatHistory(
  narrativeEntries: Array<{ role: string; content: string }>,
  players: Array<{ name: string; characterName: string; race: string; class: string; hp: number; maxHp: number; ac: number; level: number }>,
  npcContext: string,
  diceRoll?: { diceType: string; result: number; purpose: string; playerName: string } | null,
  playerAction?: string,
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  const playerSummary = players
    .map(p => `${p.name}（角色：${p.characterName} | ${p.race} ${p.class} Lv.${p.level} | HP: ${p.hp}/${p.maxHp} | AC: ${p.ac}）`)
    .join("\n");

  history.push({
    role: "user",
    parts: [{ text: `## 當前玩家狀態\n${playerSummary}` }],
  });
  history.push({
    role: "model",
    parts: [{ text: "了解。我已記錄所有玩家狀態，準備主持這場冒險。" }],
  });

  if (npcContext) {
    history.push({
      role: "user",
      parts: [{ text: npcContext }],
    });
    history.push({
      role: "model",
      parts: [{ text: "了解，已更新NPC檔案。" }],
    });
  }

  for (const entry of narrativeEntries) {
    history.push({
      role: entry.role === "assistant" ? "model" : "user",
      parts: [{ text: entry.content }],
    });
  }

  let userMessage = playerAction ?? "";
  if (diceRoll) {
    userMessage = `【${diceRoll.playerName}擲骰結果】${diceRoll.diceType}: ${diceRoll.result}（${diceRoll.purpose}）\n${userMessage}`.trim();
  }

  if (userMessage) {
    history.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
  }

  return history;
}
