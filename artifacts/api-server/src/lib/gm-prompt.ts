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
玩家自己擲骰。當需要擲骰時：
- 明確說明需要擲什麼骰（D4/D6/D8/D10/D12/D20/D100）
- 說明擲骰目的（技能檢定/攻擊/傷害/豁免等）
- 等待玩家回報結果
- 根據玩家回報的骰值繼續敘事
格式範例：「請擲 D20 進行感知檢定（Perception Check）。」

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
2. 說明玩家可採取的行動
3. 若需要骰子，要求玩家擲骰
4. 等待玩家行動

# 回應格式
【場景描述】- 生動的環境與氛圍描述（中文）
【可觀察資訊】- 玩家能感知到的資訊
【可選行動】- 建議行動（但不限於此）
若需擲骰：【擲骰請求】請擲 [骰型] 進行 [目的]。

# 語言
使用繁體中文進行所有敘事。充滿張力、細節豐富、沉浸感強。
不要使用表情符號。`;

export function buildChatHistory(
  narrativeEntries: Array<{ role: string; content: string }>,
  players: Array<{ name: string; characterName: string; race: string; class: string; hp: number; maxHp: number; ac: number; level: number }>,
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
