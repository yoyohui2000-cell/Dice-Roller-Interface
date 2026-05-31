import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCampaignSession,
  getGetCampaignSessionQueryKey,
  useListSessionPlayers,
  getListSessionPlayersQueryKey,
  useAddSessionPlayer,
  useSubmitDiceRoll,
  useGetSessionHistory,
  getGetSessionHistoryQueryKey,
  useGetSessionDiceRolls,
  getGetSessionDiceRollsQueryKey,
  useUpdatePlayer,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Dices, UserPlus, Wifi, WifiOff, Clock, Users, BookOpen, Swords, Shield, Skull, X, Link2, Check, Pencil, Plus, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeSession, type RealtimeEvent, type TurnState, type CombatState } from "@/hooks/use-realtime-session";
import { usePresence } from "@/hooks/use-presence";
import CharacterSheet, { type CharacterSheetSaveData, type GmChange } from "@/components/character-sheet";
import CharacterCreationDialog, { type CharacterCreationData } from "@/components/character-creation-dialog";

type NpcData = {
  id: number; sessionId: number; name: string; location: string;
  attitude: string; secrets: string; goals: string; notes: string;
  createdAt: string; updatedAt: string;
};

type HpProposal = {
  id: string;
  playerId: number;
  characterName: string;
  delta: number;
  label: string;
};

type GmStatNotification = {
  id: string;
  characterName: string;
  lines: Array<{ text: string; color: "red" | "green" | "amber" | "blue" | "purple" }>;
  ts: number;
};

type RawPlayerUpdate = {
  name: string;
  hpChange: number;
  conditionsAdd: string[];
  conditionsRemove: string[];
  inventoryAdd: Array<{ name: string; qty: number }>;
  inventoryRemove: string[];
  spellSlotsUse: Array<{ level: number; count: number }>;
};

type PlayerLike = { id: number; characterName: string; hp: number; maxHp: number };
type EnemyDraft = { id: string; name: string; initiative: number };

function parseHpChanges(text: string, players: PlayerLike[], turnWho: string): HpProposal[] {
  const proposals: HpProposal[] = [];
  const seen = new Set<string>();

  const addProposal = (amount: number, isDamage: boolean, idx: number) => {
    if (amount <= 0 || amount > 999) return;
    const delta = isDamage ? -amount : amount;
    const ctx = text.substring(Math.max(0, idx - 100), idx + 100);

    let target: PlayerLike | undefined;
    for (const p of players) {
      if (ctx.includes(p.characterName)) { target = p; break; }
    }
    if (!target && (ctx.includes("你") || ctx.includes("your") || ctx.includes("you "))) {
      target = players.find(p => p.characterName === turnWho) ?? (players.length === 1 ? players[0] : undefined);
    }
    if (!target && players.length === 1) target = players[0];
    if (!target) return;

    const key = `${target.id}:${delta}`;
    if (seen.has(key)) return;
    seen.add(key);

    proposals.push({
      id: `${Date.now()}-${idx}`,
      playerId: target.id,
      characterName: target.characterName,
      delta,
      label: isDamage ? `受到 ${amount} 點傷害` : `恢復 ${amount} 點生命`,
    });
  };

  const runAll = (patterns: RegExp[], isDamage: boolean) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const amount = parseInt(m[1] ?? m[2] ?? "0");
        addProposal(amount, isDamage, m.index);
      }
    }
  };

  runAll([
    /受到\s*(\d+)\s*點?[^，。\n]{0,12}傷害/g,
    /造成[了]?\s*(\d+)\s*點?[^，。\n]{0,12}傷害/g,
    /takes?\s+(\d+)\s+(?:\w+\s+)?damage/gi,
    /suffers?\s+(\d+)\s+(?:\w+\s+)?damage/gi,
    /deals?\s+(\d+)\s+(?:\w+\s+)?damage/gi,
  ], true);

  runAll([
    /恢復[了]?\s*(\d+)\s*點?(?:生命值?|HP|hp)/g,
    /回復\s*(\d+)\s*點?(?:生命值?|HP|hp)/g,
    /治癒[了]?\s*(\d+)\s*點?(?:生命值?|HP|hp)/g,
    /heals?\s+(?:for\s+)?(\d+)\s+(?:hit\s+points?|hp)/gi,
    /regains?\s+(\d+)\s+(?:hit\s+points?|hp)/gi,
    /restores?\s+(\d+)\s+(?:hit\s+points?|hp)/gi,
  ], false);

  return proposals;
}

const ATTITUDE_STYLE: Record<string, string> = {
  "友善": "bg-green-900/40 text-green-400 border-green-700/50",
  "中立": "bg-muted text-muted-foreground border-border",
  "敵對": "bg-red-900/40 text-red-400 border-red-700/50",
  "未知": "bg-card text-muted-foreground border-border",
};

export default function Session() {
  const { id } = useParams();
  const sessionId = parseInt(id || "0", 10);
  const { user } = useAuth();

  const { data: session, isLoading: sessionLoading, refetch: refetchSession } = useGetCampaignSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetCampaignSessionQueryKey(sessionId) }
  });

  const { data: players, isLoading: playersLoading, refetch: refetchPlayers } = useListSessionPlayers(sessionId, {
    query: { enabled: !!sessionId, queryKey: getListSessionPlayersQueryKey(sessionId) }
  });

  const { data: history, refetch: refetchHistory } = useGetSessionHistory(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionHistoryQueryKey(sessionId) }
  });

  const { data: diceRollHistory, refetch: refetchDiceRolls } = useGetSessionDiceRolls(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionDiceRollsQueryKey(sessionId) }
  });

  const submitRoll = useSubmitDiceRoll();
  const addPlayer = useAddSessionPlayer();

  const [narrative, setNarrative] = useState("");
  const [action, setAction] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const narrativeRef = useRef<string>("");
  const [isConnected, setIsConnected] = useState(false);

  const [rollingDice, setRollingDice] = useState<string | null>(null);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [rollPurpose, setRollPurpose] = useState("");
  const [activeRollId, setActiveRollId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [worldStateUpdated, setWorldStateUpdated] = useState(false);
  const prevWorldStateRef = useRef<string | undefined>(undefined);

  const [turnState, setTurnState] = useState<TurnState>({ who: "全體", dice: null, purpose: null });
  const [combatState, setCombatState] = useState<CombatState>(null);
  const [sessionNpcs, setSessionNpcs] = useState<NpcData[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"status" | "npcs" | "combat">("status");
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hpProposals, setHpProposals] = useState<HpProposal[]>([]);
  const [gmStatNotifications, setGmStatNotifications] = useState<GmStatNotification[]>([]);
  const [gmChangesByPlayer, setGmChangesByPlayer] = useState<Record<number, GmChange>>({});
  const streamStartPosRef = useRef<number>(0);
  const isLocalStreamingRef = useRef(false);
  const playersRef = useRef(players);
  const turnStateRef = useRef(turnState);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { turnStateRef.current = turnState; }, [turnState]);
  const updatePlayer = useUpdatePlayer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [initiativeOpen, setInitiativeOpen] = useState(false);
  const [playerInits, setPlayerInits] = useState<Record<number, number>>({});
  const [enemyDrafts, setEnemyDrafts] = useState<EnemyDraft[]>([]);
  const [isSubmittingInit, setIsSubmittingInit] = useState(false);
  const [newEnemyName, setNewEnemyName] = useState("");
  const [newEnemyInit, setNewEnemyInit] = useState(10);

  const isJoinLink = new URLSearchParams(window.location.search).has("join");

  const rollD20 = () => Math.floor(Math.random() * 20) + 1;

  const parseDexMod = (statsJson: string): number => {
    try {
      const s = JSON.parse(statsJson) as Record<string, unknown>;
      const dex = typeof s.dex === "number" ? s.dex : typeof s.DEX === "number" ? s.DEX as number : 10;
      return Math.floor((dex - 10) / 2);
    } catch { return 0; }
  };

  const openInitiativeDialog = () => {
    const inits: Record<number, number> = {};
    for (const p of players ?? []) {
      const mod = parseDexMod(p.stats ?? "{}");
      inits[p.id] = Math.max(1, rollD20() + mod);
    }
    setPlayerInits(inits);
    setEnemyDrafts([]);
    setNewEnemyName("");
    setNewEnemyInit(10);
    setInitiativeOpen(true);
  };

  const rerollAllInitiatives = () => {
    const inits: Record<number, number> = {};
    for (const p of players ?? []) {
      const mod = parseDexMod(p.stats ?? "{}");
      inits[p.id] = Math.max(1, rollD20() + mod);
    }
    setPlayerInits(inits);
  };

  const addEnemyDraft = () => {
    if (!newEnemyName.trim()) return;
    setEnemyDrafts(prev => [...prev, { id: Date.now().toString(), name: newEnemyName.trim(), initiative: newEnemyInit }]);
    setNewEnemyName("");
    setNewEnemyInit(10);
  };

  const handleStartCombat = async () => {
    if (isSubmittingInit) return;
    setIsSubmittingInit(true);
    try {
      const entries = [
        ...(players ?? []).map(p => ({
          name: p.characterName,
          initiative: playerInits[p.id] ?? 10,
          hp: p.hp,
          maxHp: p.maxHp,
          isEnemy: false,
          status: null,
        })),
        ...enemyDrafts.map(e => ({
          name: e.name,
          initiative: e.initiative,
          hp: null,
          maxHp: null,
          isEnemy: true,
          status: null,
        })),
      ];
      const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const resp = await fetch(`${BASE}/api/campaign/sessions/${sessionId}/initiative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!resp.ok) throw new Error("Failed to set initiative");
      const data = await resp.json() as { combatState: CombatState };
      setCombatState(data.combatState);
      setSidebarTab("combat");
      broadcast({ type: "combat_update", combatState: data.combatState });
      setInitiativeOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingInit(false);
    }
  };

  const handleNextTurn = async () => {
    const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const resp = await fetch(`${BASE}/api/campaign/sessions/${sessionId}/initiative/next`, { method: "POST" });
    if (!resp.ok) return;
    const data = await resp.json() as { combatState: CombatState };
    setCombatState(data.combatState);
    broadcast({ type: "combat_update", combatState: data.combatState });
  };

  const handleEndCombat = async () => {
    const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    await fetch(`${BASE}/api/campaign/sessions/${sessionId}/initiative`, { method: "DELETE" });
    setCombatState(null);
    setSidebarTab("status");
    broadcast({ type: "combat_update", combatState: null });
  };

  const handleSaveCharacter = useCallback((data: CharacterSheetSaveData) => {
    if (!selectedPlayerId) return;
    const playersKey = getListSessionPlayersQueryKey(sessionId);
    queryClient.setQueryData(playersKey, (old: typeof players) =>
      old?.map(p => p.id === selectedPlayerId ? { ...p, ...data } : p) ?? []
    );
    updatePlayer.mutate({
      playerId: selectedPlayerId,
      data: { hp: data.hp, maxHp: data.maxHp, ac: data.ac, level: data.level, stats: data.stats }
    }, {
      onSuccess: () => refetchPlayers(),
      onError: () => {
        refetchPlayers();
        toast({ title: "儲存失敗", description: "角色資料儲存失敗，請重試。", variant: "destructive" });
      }
    });
  }, [selectedPlayerId, sessionId, queryClient, players, updatePlayer, refetchPlayers, toast]);

  const handleShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?join=1`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };
  const pendingDiceAutoSubmit = useRef(false);
  const handleSendRef = useRef<() => void>(() => {});

  const selectedPlayer = players?.find(p => p.id === selectedPlayerId);
  const isMyTurn = turnState.who === "全體" || selectedPlayer?.characterName === turnState.who;
  // NPC turn = turnState.who is not "全體" and not any player's character name
  const playerCharNames = new Set((players ?? []).map(p => p.characterName));
  const isNpcTurn = !isMyTurn && turnState.who !== "全體" && !playerCharNames.has(turnState.who);

  const { onlineUsers } = usePresence({
    sessionId,
    characterName: selectedPlayer?.characterName,
    playerId: selectedPlayer?.id,
  });

  useEffect(() => {
    if (!players || players.length === 0) return;
    if (selectedPlayerId) return;
    if (!user) return;
    const myPlayer = players.find(p => p.userId === user.id);
    if (myPlayer) setSelectedPlayerId(myPlayer.id);
  }, [players, selectedPlayerId, user]);

  useEffect(() => {
    if (isJoinLink && !sessionLoading) {
      setPlayerModalOpen(true);
    }
  }, [isJoinLink, sessionLoading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [narrative, isStreaming]);

  useEffect(() => {
    if (session?.worldState && prevWorldStateRef.current !== undefined && prevWorldStateRef.current !== session.worldState) {
      setWorldStateUpdated(true);
      const t = setTimeout(() => setWorldStateUpdated(false), 4000);
      return () => clearTimeout(t);
    }
    if (session?.worldState) {
      prevWorldStateRef.current = session.worldState;
    }
    return undefined;
  }, [session?.worldState]);

  useEffect(() => {
    if (!isStreaming) return;
    const watchdog = setTimeout(() => {
      const notice = "\n\n⚠️ *GM 回應逾時，連線已重置。請重新輸入你的行動。*\n\n";
      narrativeRef.current += notice;
      setNarrative(narrativeRef.current);
      setIsStreaming(false);
      setTurnState({ who: "全體", dice: null, purpose: null });
    }, 30_000);
    return () => clearTimeout(watchdog);
  }, [isStreaming]);

  useEffect(() => {
    if (history && !narrativeRef.current && !isStreaming) {
      const formatted = history.map(entry => {
        if (entry.role === "assistant") return `[GM] ${entry.content}`;
        const pName = players?.find(p => p.id === entry.playerId)?.characterName || "玩家";
        return `[${pName}] ${entry.content}`;
      }).join("\n\n");
      if (formatted) {
        const initial = formatted + "\n\n";
        narrativeRef.current = initial;
        setNarrative(initial);
      }
    }
  }, [history, players]);

  useEffect(() => {
    if (turnState.dice !== null && turnState.purpose) {
      setRollPurpose(turnState.purpose);
    }
    // A new dice request arrived (or was cleared) — reset all roll state so
    // stale results from the previous roll can never trigger an accidental
    // auto-submit for the new request.
    setRollingDice(null);
    setRollResult(null);
    setActiveRollId(null);
    pendingDiceAutoSubmit.current = false;
  }, [turnState.dice, turnState.who]);

  useEffect(() => {
    if (
      turnState.dice !== null &&
      rollingDice !== null &&          // player has actually rolled for THIS request
      activeRollId !== null &&
      rollResult !== null &&
      !isStreaming &&
      !pendingDiceAutoSubmit.current
    ) {
      pendingDiceAutoSubmit.current = true;
      const t = setTimeout(() => handleSendRef.current(), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activeRollId, rollResult, isStreaming, turnState.dice, rollingDice]);

  const fetchNpcs = useCallback(async () => {
    if (!sessionId) return;
    try {
      const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/campaign/sessions/${sessionId}/npcs`);
      if (res.ok) {
        const data = await res.json() as NpcData[];
        setSessionNpcs(data);
      }
    } catch {
      // silent
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) fetchNpcs();
  }, [sessionId, fetchNpcs]);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case "player_action": {
        const rollText = event.rollInfo ? ` ${event.rollInfo}` : "";
        const line = `[${event.characterName}] ${event.action}${rollText}\n\n[GM] `;
        narrativeRef.current += line;
        streamStartPosRef.current = narrativeRef.current.length;
        setNarrative(narrativeRef.current);
        setIsStreaming(true);
        break;
      }
      case "gm_chunk": {
        if (isLocalStreamingRef.current) break;
        narrativeRef.current += event.chunk;
        setNarrative(narrativeRef.current);
        break;
      }
      case "gm_done": {
        if (isLocalStreamingRef.current) break;
        const rawGmText = narrativeRef.current.slice(streamStartPosRef.current);
        narrativeRef.current = narrativeRef.current
          .replace(/\n?%%COMBAT:(null|\{[^%]*\})%%[ \t]*/g, "")
          .replace(/\n?%%TURN:\{[^%]*\}%%\s*$/, "")
          .replace(/\n?%%PLAYER_UPDATE:\{[^%]*\}%%[ \t]*/g, "")
          .trimEnd() + "\n\n";
        setNarrative(narrativeRef.current);
        setIsStreaming(false);
        refetchHistory();
        refetchPlayers();
        refetchDiceRolls();
        if (event.turnState) {
          setTurnState(event.turnState);
        }
        if (event.combatState !== undefined) {
          setCombatState(event.combatState);
          if (event.combatState !== null) {
            setSidebarTab("combat");
          }
        }
        setTimeout(() => refetchSession(), 3500);
        setTimeout(() => fetchNpcs(), 3000);
        if (rawGmText.trim()) {
          const currentPlayers = (playersRef.current ?? []) as PlayerLike[];
          const freshProposals = parseHpChanges(rawGmText, currentPlayers, turnStateRef.current.who);
          if (freshProposals.length > 0) {
            setHpProposals(prev => [
              ...freshProposals,
              ...prev.filter(p => !freshProposals.some(f => f.playerId === p.playerId)),
            ]);
          }
        }
        break;
      }
      case "combat_update": {
        setCombatState(event.combatState);
        if (event.combatState !== null) {
          setSidebarTab("combat");
        }
        break;
      }
      case "turn_change": {
        setTurnState({ who: event.who, dice: event.dice, purpose: event.purpose });
        break;
      }
      case "world_state_update": {
        setTimeout(() => refetchSession(), 500);
        break;
      }
      case "dice_roll": {
        const line = `\n💠 ${event.characterName} 擲 ${event.diceType}: **${event.result}**${event.purpose ? ` (${event.purpose})` : ""}\n`;
        narrativeRef.current += line;
        setNarrative(narrativeRef.current);
        break;
      }
      case "player_joined": {
        const line = `\n⚔️ ${event.characterName}（${event.race} ${event.class}）加入了冒險隊伍！\n`;
        narrativeRef.current += line;
        setNarrative(narrativeRef.current);
        refetchPlayers();
        break;
      }
      case "player_hp_update": {
        refetchPlayers();
        break;
      }
    }
  }, [refetchHistory, refetchPlayers, refetchDiceRolls, refetchSession, fetchNpcs]);

  const { broadcast } = useRealtimeSession({
    sessionId,
    onEvent: handleRealtimeEvent,
    onStatusChange: setIsConnected,
  });

  const handleSend = async () => {
    const isDiceMode = turnState.dice !== null && activeRollId !== null;
    // Auto-use first player if none selected yet (handles dice auto-submit race)
    const effectivePlayerId = selectedPlayerId ?? players?.[0]?.id ?? null;
    if (isStreaming || !effectivePlayerId) return;
    // During NPC turns, allow sending even with no action (blank = "continue" signal)
    if (!isDiceMode && !action.trim() && !isNpcTurn) return;
    // Block player action only when it's another PLAYER's turn (not NPC)
    if (!isDiceMode && !isMyTurn && !isNpcTurn) return;

    // Reset the auto-submit guard immediately so it can never double-fire
    pendingDiceAutoSubmit.current = false;

    const currentPlayer = players?.find(p => p.id === effectivePlayerId);
    const pName = currentPlayer?.characterName || "玩家";
    // NPC turn with no typed action → send a "continue" signal to the GM
    const currentAction = action.trim() || (isNpcTurn ? `(GM請繼續，輪到${turnState.who}行動)` : "(骰子結果)");

    setAction("");

    let rollText = "";
    if (rollResult !== null && rollingDice) {
      rollText = ` (擲 ${rollingDice}: ${rollResult}${rollPurpose ? ` - ${rollPurpose}` : ""})`;
    }

    // NPC-turn "continue" signal is an invisible system prompt — don't add it to the visible narrative
    const isNpcContinue = isNpcTurn && !action.trim() && !rollText;
    const line = isNpcContinue ? `\n[GM] ` : `[${pName}] ${currentAction}${rollText}\n\n[GM] `;
    narrativeRef.current += line;
    setNarrative(narrativeRef.current);
    setIsStreaming(true);

    broadcast({
      type: "player_action",
      playerId: effectivePlayerId,
      characterName: pName,
      action: currentAction,
      rollInfo: rollText || undefined,
    });

    const submittingRollId = activeRollId;

    setRollingDice(null);
    setRollResult(null);
    setRollPurpose("");
    setActiveRollId(null);
    setTurnState({ who: "全體", dice: null, purpose: null });

    isLocalStreamingRef.current = true;
    try {
      const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/campaign/sessions/${sessionId}/gm-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: effectivePlayerId,
          action: currentAction,
          diceRollId: submittingRollId,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      // Use {stream: true} so multi-byte UTF-8 chars across chunk boundaries decode correctly
      const decoder = new TextDecoder("utf-8", { fatal: false });
      // Buffer accumulates raw bytes across chunks; SSE events are delimited by "\n\n"
      let sseBuffer = "";

      const processEvent = (eventText: string) => {
        for (const line of eventText.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              narrativeRef.current += data.content;
              setNarrative(narrativeRef.current);
            }
            if (data.done) {
              narrativeRef.current = narrativeRef.current
                .replace(/\n?%%COMBAT:(null|\{[^%]*\})%%[ \t]*/g, "")
                .replace(/\n?%%TURN:\{[^%]+?\}%%[ \t]*/gs, "")
                .replace(/\n?%%PLAYER_UPDATE:\{[^%]*\}%%[ \t]*/g, "")
                .trimEnd() + "\n\n";
              setNarrative(narrativeRef.current);
              setIsStreaming(false);

              const newTurnState: TurnState = data.turnState ?? { who: "全體", dice: null, purpose: null };
              setTurnState(newTurnState);

              if (data.combatState !== undefined) {
                const newCombatState: CombatState = data.combatState as CombatState;
                setCombatState(newCombatState);
                if (newCombatState !== null) setSidebarTab("combat");
                broadcast({ type: "combat_update", combatState: newCombatState });
              }

              // Apply GM-driven player stat updates immediately to the cache
              if (Array.isArray(data.playerUpdates) && data.playerUpdates.length > 0) {
                const updates = data.playerUpdates as Array<{ id: number; characterName: string; hp: number; maxHp: number; ac: number; level: number; stats: string }>;
                const rawChanges = (data.gmPlayerChanges ?? []) as RawPlayerUpdate[];
                const playersKey = getListSessionPlayersQueryKey(sessionId);

                // Snapshot current HP values for delta computation
                const currentPlayers = playersRef.current ?? [];

                queryClient.setQueryData(playersKey, (old: typeof players) =>
                  old?.map(p => {
                    const upd = updates.find(u => u.id === p.id);
                    return upd ? { ...p, hp: upd.hp, maxHp: upd.maxHp, ac: upd.ac, level: upd.level, stats: upd.stats } : p;
                  }) ?? []
                );

                // Build visual change feedback
                const ts = Date.now();
                const newChanges: Record<number, GmChange> = {};
                const notifications: GmStatNotification[] = [];

                for (const upd of updates) {
                  const prev = currentPlayers.find(p => p.id === upd.id);
                  const hpDelta = prev ? upd.hp - prev.hp : null;
                  const raw = rawChanges.find(r => r.name === upd.characterName);

                  const conditionsAdded = raw?.conditionsAdd ?? [];
                  const conditionsRemoved = raw?.conditionsRemove ?? [];
                  const itemsGained = (raw?.inventoryAdd ?? []).map(i => i.name);
                  const itemsLost = raw?.inventoryRemove ?? [];
                  const slotsUsed = raw?.spellSlotsUse ?? [];

                  newChanges[upd.id] = { hpDelta: hpDelta !== 0 ? hpDelta : null, conditionsAdded, conditionsRemoved, itemsGained, itemsLost, slotsUsed, ts };

                  // Build notification lines
                  const lines: GmStatNotification["lines"] = [];
                  if (hpDelta !== null && hpDelta !== 0) {
                    lines.push({ text: `${hpDelta > 0 ? "+" : ""}${hpDelta} HP (${prev?.hp ?? "?"} → ${upd.hp})`, color: hpDelta < 0 ? "red" : "green" });
                  }
                  for (const c of conditionsAdded) lines.push({ text: `＋${c}`, color: "amber" });
                  for (const c of conditionsRemoved) lines.push({ text: `${c} 解除`, color: "green" });
                  for (const i of itemsGained) lines.push({ text: `＋${i}`, color: "blue" });
                  for (const i of itemsLost) lines.push({ text: `－${i}`, color: "red" });
                  for (const s of slotsUsed) lines.push({ text: `法術位 Lv${s.level} ×${s.count}`, color: "purple" });

                  if (lines.length > 0) {
                    notifications.push({ id: `${upd.id}-${ts}`, characterName: upd.characterName, lines, ts });
                  }
                }

                setGmChangesByPlayer(newChanges);
                if (notifications.length > 0) {
                  setGmStatNotifications(prev => [...prev, ...notifications]);
                  setTimeout(() => setGmStatNotifications(prev => prev.filter(n => n.ts !== ts)), 6000);
                }

              }

              isLocalStreamingRef.current = false;
              refetchHistory();
              refetchPlayers();
              refetchDiceRolls();
              setTimeout(() => {
                refetchSession();
                broadcast({ type: "world_state_update" });
              }, 3500);
              setTimeout(() => fetchNpcs(), 3000);
            }
          } catch {
            // malformed JSON in this line — skip
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        // Split on the SSE event delimiter "\n\n" — each complete event is processed,
        // the trailing partial event (if any) stays in the buffer for the next chunk.
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() ?? "";
        for (const event of events) {
          if (event.trim()) processEvent(event);
        }
      }
      // Flush any remaining complete event in the buffer
      if (sseBuffer.trim()) processEvent(sseBuffer);
    } catch (err) {
      isLocalStreamingRef.current = false;
      setIsStreaming(false);
      setTurnState({ who: "全體", dice: null, purpose: null });
      console.error(err);
    }
  };

  handleSendRef.current = handleSend;

  const executeRoll = (diceType: string, max: number) => {
    if (turnState.dice !== null && turnState.dice !== diceType) return;

    // Auto-use first player if none is selected yet
    const effectivePlayerId = selectedPlayerId ?? players?.[0]?.id ?? null;
    if (!effectivePlayerId) return;
    if (!selectedPlayerId) setSelectedPlayerId(effectivePlayerId);

    const currentPlayer = players?.find(p => p.id === effectivePlayerId);
    const pName = currentPlayer?.characterName || "玩家";
    const effectivePurpose = rollPurpose.trim() || turnState.purpose || "一般判定";

    setRollingDice(diceType);
    setRollResult(null);
    setActiveRollId(null);

    setTimeout(() => {
      const result = Math.floor(Math.random() * max) + 1;
      setRollResult(result);

      submitRoll.mutate({
        id: sessionId,
        data: {
          playerId: effectivePlayerId,
          diceType,
          result,
          purpose: effectivePurpose,
        }
      }, {
        onSuccess: (data) => {
          setActiveRollId(data.id);
          refetchDiceRolls();
          broadcast({
            type: "dice_roll",
            playerId: effectivePlayerId,
            characterName: pName,
            diceType,
            result,
            purpose: effectivePurpose,
          });
        }
      });
    }, 800);
  };

  const [playerModalOpen, setPlayerModalOpen] = useState(false);

  const handleCreatePlayer = (data: CharacterCreationData) => {
    addPlayer.mutate({
      id: sessionId,
      data: {
        userId: user?.id,
        name: data.name, characterName: data.characterName,
        race: data.race, class: data.class, background: data.background,
        hp: data.hp, maxHp: data.maxHp, ac: data.ac, level: data.level,
        stats: data.stats,
      }
    }, {
      onSuccess: (player) => {
        setPlayerModalOpen(false);
        setSelectedPlayerId(player.id);
        refetchPlayers();
        broadcast({
          type: "player_joined",
          characterName: player.characterName,
          race: player.race,
          class: player.class,
        });
      }
    });
  };

  if (sessionLoading) return <div className="p-8 text-center text-primary font-serif">讀取古老卷軸中...</div>;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0 hover:bg-primary/20"><ArrowLeft className="w-5 h-5 text-primary" /></Button>
          </Link>
          <h1 className="text-base sm:text-2xl font-serif text-primary drop-shadow-md truncate">{session?.name}</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="md:hidden text-primary hover:bg-primary/20" onClick={() => { setMobileLeftOpen(v => !v); setMobileRightOpen(false); }}>
            <Users className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden text-primary hover:bg-primary/20" onClick={() => { setMobileRightOpen(v => !v); setMobileLeftOpen(false); }}>
            <BookOpen className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary hover:bg-primary/20 relative"
            onClick={handleShareLink}
            title="分享此戰役連結"
          >
            <AnimatePresence mode="wait">
              {linkCopied ? (
                <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check className="w-4 h-4 text-green-400" />
                </motion.span>
              ) : (
                <motion.span key="link" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Link2 className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
          <AnimatePresence>
            {linkCopied && (
              <motion.span
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="text-xs text-green-400 font-serif hidden sm:inline whitespace-nowrap"
              >
                連結已複製！
              </motion.span>
            )}
          </AnimatePresence>
          {onlineUsers.length > 0 && (
            <div
              className="hidden sm:flex items-center gap-1.5"
              title={onlineUsers.map(u => u.characterName).join("、") + " 在線中"}
            >
              <div className="flex -space-x-1.5">
                {onlineUsers.slice(0, 3).map((u) => (
                  <div
                    key={u.playerId}
                    title={u.characterName}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold font-mono uppercase select-none ${
                      u.playerId === selectedPlayer?.id
                        ? "border-green-500 bg-green-900/60 text-green-300"
                        : "border-primary/40 bg-primary/20 text-primary"
                    }`}
                  >
                    {u.characterName.charAt(0)}
                  </div>
                ))}
                {onlineUsers.length > 3 && (
                  <div className="w-6 h-6 rounded-full border-2 border-border bg-muted flex items-center justify-center text-[9px] font-mono text-muted-foreground select-none">
                    +{onlineUsers.length - 3}
                  </div>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                {onlineUsers.length} 在線
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
            {isConnected
              ? <><Wifi className="w-4 h-4 text-green-500" /><span className="hidden sm:inline text-green-500">即時同步</span></>
              : <><WifiOff className="w-4 h-4 text-yellow-500" /><span className="hidden sm:inline text-yellow-500">連線中...</span></>
            }
          </div>
        </div>
      </header>

      {(mobileLeftOpen || mobileRightOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => { setMobileLeftOpen(false); setMobileRightOpen(false); }}
        />
      )}

      <div className="flex flex-1 overflow-hidden">

        <aside className={`fixed inset-y-0 left-0 z-50 md:relative md:inset-auto md:z-auto w-[85vw] max-w-xs md:w-72 border-r border-border bg-sidebar p-4 flex flex-col overflow-y-auto md:overflow-hidden transition-transform duration-300 ease-in-out ${mobileLeftOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="flex md:hidden justify-end mb-1">
            <button onClick={() => setMobileLeftOpen(false)} className="p-1 rounded hover:bg-primary/20 text-muted-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
            <h2 className="font-serif text-xl text-primary">冒險者隊伍</h2>
            <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20" onClick={() => setPlayerModalOpen(true)}>
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>
          <CharacterCreationDialog
            open={playerModalOpen}
            onOpenChange={setPlayerModalOpen}
            onSubmit={handleCreatePlayer}
            isPending={addPlayer.isPending}
            isJoinLink={isJoinLink}
            sessionName={session?.name}
          />

          <AnimatePresence>
            {gmStatNotifications.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 space-y-1.5 overflow-hidden"
              >
                {gmStatNotifications.map(notif => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10, height: 0 }}
                    className="rounded border border-primary/30 bg-primary/5 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-primary/80 tracking-wider uppercase">⚙ GM 更新了 {notif.characterName}</span>
                      <button
                        onClick={() => setGmStatNotifications(prev => prev.filter(n => n.id !== notif.id))}
                        className="text-muted-foreground/40 hover:text-muted-foreground/80"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {notif.lines.map((line, i) => (
                        <span
                          key={i}
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            line.color === "red" ? "bg-red-950/60 text-red-300 border border-red-700/40" :
                            line.color === "green" ? "bg-green-950/60 text-green-300 border border-green-700/40" :
                            line.color === "amber" ? "bg-amber-950/60 text-amber-300 border border-amber-700/40" :
                            line.color === "blue" ? "bg-blue-950/60 text-blue-300 border border-blue-700/40" :
                            "bg-purple-950/60 text-purple-300 border border-purple-700/40"
                          }`}
                        >
                          {line.text}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hpProposals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 space-y-2 overflow-hidden"
              >
                {hpProposals.map(proposal => {
                  const target = players?.find(p => p.id === proposal.playerId);
                  const curHp = target?.hp ?? 0;
                  const maxHp = target?.maxHp ?? 100;
                  const newHp = Math.max(0, Math.min(curHp + proposal.delta, maxHp));
                  const isDmg = proposal.delta < 0;
                  return (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className={`rounded border p-2 text-xs ${isDmg ? "border-red-700/50 bg-red-950/30" : "border-green-700/50 bg-green-950/30"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-serif font-bold ${isDmg ? "text-red-300" : "text-green-300"}`}>
                          {isDmg ? "⚔️" : "✨"} {proposal.characterName}
                        </span>
                        <span className="font-mono text-muted-foreground text-[10px]">
                          {curHp} → <span className={isDmg ? "text-red-300" : "text-green-300"}>{newHp}</span>
                        </span>
                      </div>
                      <div className="text-muted-foreground mb-2">{proposal.label}</div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            const playersKey = getListSessionPlayersQueryKey(sessionId);
                            const snapshot = queryClient.getQueryData(playersKey);
                            queryClient.setQueryData(playersKey, (old: typeof players) =>
                              old?.map(p => p.id === proposal.playerId ? { ...p, hp: newHp } : p) ?? []
                            );
                            updatePlayer.mutate({ playerId: proposal.playerId, data: { hp: newHp } }, {
                              onSuccess: () => {
                                refetchPlayers();
                                setHpProposals(prev => prev.filter(p => p.id !== proposal.id));
                                broadcast({ type: "player_hp_update", playerId: proposal.playerId, characterName: proposal.characterName, hp: newHp, maxHp: target?.maxHp ?? 0 });
                              },
                              onError: () => {
                                queryClient.setQueryData(playersKey, snapshot);
                                toast({ title: "HP 更新失敗", description: "無法套用傷害/治療，請重試。", variant: "destructive" });
                              }
                            });
                          }}
                          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded font-mono text-[10px] transition-colors ${isDmg ? "bg-red-900/40 text-red-300 hover:bg-red-900/70" : "bg-green-900/40 text-green-300 hover:bg-green-900/70"}`}
                        >
                          <Check className="w-3 h-3" /> 確認
                        </button>
                        <button
                          onClick={() => setHpProposals(prev => prev.filter(p => p.id !== proposal.id))}
                          className="px-2 py-1 rounded bg-muted/20 text-muted-foreground hover:bg-muted/40 font-mono text-[10px] transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {(players?.length ?? 0) > 1 && (
            <div className="flex flex-wrap gap-1 mb-2 shrink-0">
              {players?.map(p => {
                const isActive = turnState.who !== "全體" && p.characterName === turnState.who;
                return (
                  <button key={p.id} onClick={() => setSelectedPlayerId(p.id)}
                    className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${selectedPlayerId === p.id ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"}${isActive ? " ring-1 ring-primary/50" : ""}`}>
                    {p.characterName}{isActive ? " ▶" : ""}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden -mx-4 -mb-4">
            {playersLoading ? (
              <div className="text-sm text-muted-foreground text-center py-8">載入中...</div>
            ) : players?.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center italic py-8">隊伍中還沒有人</div>
            ) : selectedPlayer ? (
              <CharacterSheet
                player={selectedPlayer}
                onSave={handleSaveCharacter}
                isSaving={updatePlayer.isPending}
                gmChange={gmChangesByPlayer[selectedPlayer.id]}
              />
            ) : null}
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-[#1c1815] shadow-inner">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/old-wall.png")' }}></div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-8 font-serif text-base sm:text-lg leading-relaxed whitespace-pre-wrap relative z-10"
          >
            {narrative || <span className="italic text-muted-foreground">故事尚未開始...</span>}
            {isStreaming && <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1 align-middle shadow-[0_0_8px_rgba(200,140,50,0.8)]" />}
          </div>

          <div className="border-t border-border bg-card relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">

            <AnimatePresence>
              {!isMyTurn && !isNpcTurn && !isStreaming && turnState.dice === null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border text-muted-foreground text-sm font-serif overflow-hidden"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>等待 <strong className="text-foreground">{turnState.who}</strong> 行動中...</span>
                </motion.div>
              )}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border text-muted-foreground text-sm font-serif overflow-hidden"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-3.5 h-3.5 border-2 border-primary/60 border-t-transparent rounded-full shrink-0"
                  />
                  <span>GM 正在回應中...</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-4">
              <AnimatePresence mode="wait">
                {turnState.dice !== null && !isStreaming ? (
                  /* ── DICE MODE ── */
                  <motion.div
                    key="dice-mode"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-serif text-amber-300 bg-amber-950/50 rounded px-3 py-2 border border-amber-700/40">
                      <Dices className="w-4 h-4 animate-pulse shrink-0" />
                      <span>GM 要求擲骰：<strong>{turnState.dice}</strong>{turnState.purpose ? ` — ${turnState.purpose}` : ""}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {[4, 6, 8, 10, 12, 20, 100].map(max => {
                        const diceLabel = `D${max}`;
                        if (turnState.dice !== diceLabel) return null;
                        return (
                          <Button
                            key={diceLabel}
                            onClick={() => executeRoll(diceLabel, max)}
                            disabled={!!rollingDice}
                            className="font-mono font-bold text-base px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/80 shadow-[0_0_20px_rgba(200,140,50,0.4)] disabled:opacity-40 disabled:shadow-none transition-all"
                          >
                            <Dices className="w-4 h-4 mr-2" />
                            擲 {diceLabel}
                          </Button>
                        );
                      })}

                      <AnimatePresence>
                        {rollingDice && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3 bg-card px-4 py-2 rounded border border-primary/50 shadow-[0_0_15px_rgba(200,140,50,0.2)]"
                          >
                            <span className="font-serif text-muted-foreground">{rollingDice}</span>
                            {rollResult === null ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
                                className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
                              />
                            ) : (
                              <motion.div className="flex flex-col items-center">
                                <motion.span
                                  initial={{ scale: 2, color: '#fff' }}
                                  animate={{ scale: 1, color: 'hsl(var(--primary))' }}
                                  className="font-bold text-2xl font-mono leading-none"
                                >
                                  {rollResult}
                                </motion.span>
                                <span className="text-[10px] text-amber-400/70 font-mono animate-pulse">提交中...</span>
                              </motion.div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : isNpcTurn && !isStreaming ? (
                  /* ── NPC TURN — "continue" button so game never gets stuck ── */
                  <motion.div
                    key="npc-turn"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2 text-sm font-serif text-muted-foreground bg-muted/30 rounded px-3 py-2 border border-border">
                      <Swords className="w-4 h-4 shrink-0 text-red-400" />
                      <span><strong className="text-foreground">{turnState.who}</strong> 正在行動...</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={action}
                        onChange={e => setAction(e.target.value)}
                        placeholder="（可選）輸入玩家反應，或直接點擊讓 GM 繼續"
                        className="flex-1 bg-background border-border focus-visible:ring-primary text-sm sm:text-base py-4 sm:py-5"
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        disabled={isStreaming}
                      />
                      <Button
                        onClick={handleSend}
                        disabled={isStreaming}
                        className="h-auto px-4 sm:px-6 text-base font-serif bg-red-900/60 hover:bg-red-800/80 border border-red-700/40 text-red-200"
                      >
                        <ChevronRight className="w-5 h-5 sm:mr-1" />
                        <span className="hidden sm:inline">繼續</span>
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  /* ── ACTION MODE ── */
                  <motion.div
                    key="action-mode"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex gap-2"
                  >
                    <Input
                      value={action}
                      onChange={e => setAction(e.target.value)}
                      placeholder={
                        !selectedPlayerId ? "請先選擇角色 (點擊左上角👥)..." :
                        isStreaming ? "GM 正在回應中..." :
                        !isMyTurn ? `等待 ${turnState.who} 行動中...` :
                        "描述你的行動或說話..."
                      }
                      className="flex-1 bg-background border-primary/30 focus-visible:ring-primary text-base sm:text-lg py-4 sm:py-6"
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      disabled={!selectedPlayerId || isStreaming || !isMyTurn}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={isStreaming || !action.trim() || !selectedPlayerId || !isMyTurn}
                      className="h-auto px-4 sm:px-8 text-base sm:text-lg font-serif"
                    >
                      <Send className="w-5 h-5 sm:mr-2" />
                      <span className="hidden sm:inline">行動</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        <aside className={`fixed inset-y-0 right-0 z-50 md:relative md:inset-auto md:z-auto w-[85vw] max-w-xs md:w-64 border-l border-border bg-sidebar p-4 flex flex-col gap-0 overflow-y-auto md:overflow-hidden transition-transform duration-300 ease-in-out ${mobileRightOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}`}>
          <div className="flex md:hidden justify-end mb-1">
            <button onClick={() => setMobileRightOpen(false)} className="p-1 rounded hover:bg-primary/20 text-muted-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-1 mb-4 border-b border-border pb-2">
            <button
              onClick={() => setSidebarTab("status")}
              className={`flex items-center gap-1 flex-1 justify-center py-1 rounded text-sm font-serif transition-colors ${sidebarTab === "status" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              狀態
            </button>
            <button
              onClick={() => { setSidebarTab("npcs"); fetchNpcs(); }}
              className={`flex items-center gap-1 flex-1 justify-center py-1 rounded text-sm font-serif transition-colors relative ${sidebarTab === "npcs" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Users className="w-3.5 h-3.5" />
              NPC
              {sessionNpcs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center font-mono">
                  {sessionNpcs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab("combat")}
              className={`flex items-center gap-1 flex-1 justify-center py-1 rounded text-sm font-serif transition-colors relative ${sidebarTab === "combat" ? "bg-red-900/20 text-red-400" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Swords className="w-3.5 h-3.5" />
              戰鬥
              {combatState && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] flex items-center justify-center font-mono animate-pulse">
                  {combatState.round}
                </span>
              )}
            </button>
          </div>

          {sidebarTab === "status" && (
            <>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">階段</div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-sm px-3 py-1 font-serif">
                  {session?.phase || "探索"}
                </Badge>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">世界狀態</div>
                  <AnimatePresence>
                    {worldStateUpdated && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1 text-[10px] text-primary font-mono"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                        已更新
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <motion.div
                  key={session?.worldState}
                  initial={worldStateUpdated ? { opacity: 0, y: -4 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`text-sm italic leading-relaxed text-foreground/80 p-2 bg-background rounded border transition-colors duration-700 ${worldStateUpdated ? "border-primary/50 shadow-[0_0_8px_rgba(200,140,50,0.15)]" : "border-border"}`}
                >
                  {session?.worldState || "未知的領域..."}
                </motion.div>
              </div>

              <div className="border-t border-border pt-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-serif text-base text-primary">擲骰紀錄</h2>
                  <span className="text-xs text-muted-foreground font-mono">{diceRollHistory?.length ?? 0} 次</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1.5 pr-2">
                    {diceRollHistory?.slice().reverse().map(roll => (
                      <div key={roll.id} className="text-xs bg-background p-2 rounded border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-primary font-bold">{roll.diceType}: {roll.result}</span>
                          <span className="text-muted-foreground">{roll.characterName}</span>
                        </div>
                        {roll.purpose && <div className="text-muted-foreground/70 mt-0.5 truncate">{roll.purpose}</div>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {sidebarTab === "npcs" && (
            <div className="flex-1 flex flex-col min-h-0">
              {sessionNpcs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm italic text-muted-foreground text-center px-2">尚未記錄任何NPC。<br />與GM互動後NPC將自動被記錄。</p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-2">
                    {sessionNpcs.map(npc => (
                      <div key={npc.id} className="bg-background p-3 rounded border border-border text-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-serif font-bold text-foreground">{npc.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${ATTITUDE_STYLE[npc.attitude] ?? ATTITUDE_STYLE["未知"]}`}>
                            {npc.attitude}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div className="flex gap-1"><span className="text-muted-foreground/50">位置</span><span>{npc.location}</span></div>
                          {npc.goals && <div className="flex gap-1"><span className="text-muted-foreground/50">目標</span><span className="line-clamp-2">{npc.goals}</span></div>}
                          {npc.notes && <div className="flex gap-1"><span className="text-muted-foreground/50">備注</span><span className="line-clamp-2">{npc.notes}</span></div>}
                          {npc.secrets && <div className="flex gap-1 text-amber-700/70"><span>🔒</span><span className="line-clamp-1 italic">{npc.secrets}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {sidebarTab === "combat" && (
            <div className="flex-1 flex flex-col min-h-0">
              {!combatState ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
                  <Swords className="w-10 h-10 text-red-900/50" />
                  <p className="text-sm text-muted-foreground text-center italic px-2">
                    尚未開始戰鬥。<br />點擊下方按鈕設定先攻順序。
                  </p>
                  <button
                    onClick={openInitiativeDialog}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-red-800/50 bg-red-950/20 text-red-300 text-sm font-serif hover:bg-red-950/40 transition-colors"
                  >
                    <Swords className="w-4 h-4" /> 開始戰鬥
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Swords className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="font-serif text-base text-red-400 truncate">先攻順序</span>
                      <Badge variant="outline" className="border-red-800/50 text-red-400 bg-red-950/30 font-mono text-[10px] px-1.5 shrink-0">
                        第 {combatState.round} 回合
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={handleNextTurn}
                        title="下一位"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-red-900/30 text-red-300 hover:bg-red-900/60 text-[10px] font-mono transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" /> 下一位
                      </button>
                      <button
                        onClick={handleEndCombat}
                        title="結束戰鬥"
                        className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-1.5 pr-1">
                      {combatState.order.map((entry, idx) => {
                        const activeIdx = (combatState as unknown as { activeIndex?: number }).activeIndex ?? combatState.order.findIndex(e => e.name === turnState.who);
                        const isActive = idx === activeIdx;
                        const isDead = entry.status === "死亡";
                        return (
                          <motion.div
                            key={`${entry.name}-${idx}`}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: isDead ? 0.4 : 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`relative p-2 rounded border text-xs transition-all duration-300 ${
                              isActive
                                ? "border-red-500/60 bg-red-950/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                                : entry.isEnemy
                                  ? "border-red-900/40 bg-red-950/10"
                                  : "border-primary/20 bg-background"
                            }`}
                          >
                            {isActive && (
                              <motion.span
                                className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 rounded-l"
                                layoutId="initiative-active-bar"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              />
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {entry.isEnemy ? (
                                  <Skull className="w-3 h-3 text-red-400 shrink-0" />
                                ) : (
                                  <Shield className="w-3 h-3 text-primary shrink-0" />
                                )}
                                <span className={`font-serif font-bold truncate ${isActive ? "text-red-300" : entry.isEnemy ? "text-red-200/80" : "text-foreground"}`}>
                                  {entry.name}
                                </span>
                              </div>
                              <span className="font-mono text-muted-foreground/70 text-[10px] shrink-0 ml-1">
                                先攻 {entry.initiative}
                              </span>
                            </div>
                            {entry.hp !== null && entry.maxHp !== null && (
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                                  <span>HP</span>
                                  <span className="font-mono">{entry.hp}/{entry.maxHp}</span>
                                </div>
                                <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full ${
                                      entry.hp / entry.maxHp! > 0.5 ? "bg-green-500" :
                                      entry.hp / entry.maxHp! > 0.25 ? "bg-yellow-500" : "bg-red-500"
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(0, (entry.hp / entry.maxHp!) * 100)}%` }}
                                    transition={{ duration: 0.5 }}
                                  />
                                </div>
                              </div>
                            )}
                            {entry.status && (
                              <div className="mt-1">
                                <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-900/40 border border-yellow-700/40 text-yellow-400 font-mono">
                                  {entry.status}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}

          {/* Initiative setup dialog */}
          <Dialog open={initiativeOpen} onOpenChange={setInitiativeOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif flex items-center gap-2">
                  <Swords className="w-5 h-5 text-red-400" /> 設定先攻順序
                </DialogTitle>
                <DialogDescription>已為所有玩家自動擲骰，可手動調整。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {(players ?? []).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">玩家</span>
                      <button
                        onClick={rerollAllInitiatives}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> 全部重擲
                      </button>
                    </div>
                    {(players ?? []).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded border border-border bg-background">
                        <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-serif text-sm flex-1 truncate">{p.characterName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setPlayerInits(prev => ({ ...prev, [p.id]: Math.max(1, (prev[p.id] ?? 10) - 1) }))}
                            className="w-5 h-5 flex items-center justify-center rounded bg-muted/30 hover:bg-muted/60 text-xs transition-colors"
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={playerInits[p.id] ?? 10}
                            onChange={e => setPlayerInits(prev => ({ ...prev, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-10 text-center bg-muted/20 border border-border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary py-0.5"
                          />
                          <button
                            onClick={() => setPlayerInits(prev => ({ ...prev, [p.id]: Math.min(30, (prev[p.id] ?? 10) + 1) }))}
                            className="w-5 h-5 flex items-center justify-center rounded bg-muted/30 hover:bg-muted/60 text-xs transition-colors"
                          >+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">敵人</span>
                  {enemyDrafts.map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-2 rounded border border-red-900/40 bg-red-950/10">
                      <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="font-serif text-sm flex-1 truncate text-red-200/80">{e.name}</span>
                      <span className="font-mono text-xs text-muted-foreground shrink-0">先攻 {e.initiative}</span>
                      <button
                        onClick={() => setEnemyDrafts(prev => prev.filter(x => x.id !== e.id))}
                        className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                      ><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="敵人名稱"
                      value={newEnemyName}
                      onChange={e => setNewEnemyName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addEnemyDraft(); }}
                      className="flex-1 bg-muted/20 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={newEnemyInit}
                      onChange={e => setNewEnemyInit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center bg-muted/20 border border-border rounded px-1 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={addEnemyDraft}
                      disabled={!newEnemyName.trim()}
                      className="p-1.5 rounded bg-red-900/30 text-red-300 hover:bg-red-900/60 disabled:opacity-40 transition-colors"
                    ><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setInitiativeOpen(false)}>取消</Button>
                  <Button
                    size="sm"
                    disabled={isSubmittingInit || ((players ?? []).length === 0 && enemyDrafts.length === 0)}
                    onClick={handleStartCombat}
                    className="bg-red-900/60 text-red-100 hover:bg-red-900/80 border border-red-700/50"
                  >
                    {isSubmittingInit ? "設定中..." : "開始戰鬥"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </aside>
      </div>
    </div>
  );
}
