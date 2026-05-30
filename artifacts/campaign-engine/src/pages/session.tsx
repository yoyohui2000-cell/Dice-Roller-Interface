import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
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
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Dices, UserPlus, Wifi, WifiOff, Clock, Users, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeSession, type RealtimeEvent, type TurnState } from "@/hooks/use-realtime-session";

type NpcData = {
  id: number; sessionId: number; name: string; location: string;
  attitude: string; secrets: string; goals: string; notes: string;
  createdAt: string; updatedAt: string;
};

const ATTITUDE_STYLE: Record<string, string> = {
  "友善": "bg-green-900/40 text-green-400 border-green-700/50",
  "中立": "bg-muted text-muted-foreground border-border",
  "敵對": "bg-red-900/40 text-red-400 border-red-700/50",
  "未知": "bg-card text-muted-foreground border-border",
};

export default function Session() {
  const { id } = useParams();
  const sessionId = parseInt(id || "0", 10);

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
  const [sessionNpcs, setSessionNpcs] = useState<NpcData[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"status" | "npcs">("status");
  const pendingDiceAutoSubmit = useRef(false);
  const handleSendRef = useRef<() => void>(() => {});

  const selectedPlayer = players?.find(p => p.id === selectedPlayerId);
  const isMyTurn = turnState.who === "全體" || selectedPlayer?.characterName === turnState.who;

  useEffect(() => {
    if (players && players.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId]);

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
    pendingDiceAutoSubmit.current = false;
  }, [turnState.dice, turnState.who]);

  useEffect(() => {
    if (
      turnState.dice !== null &&
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
  }, [activeRollId, rollResult, isStreaming, turnState.dice]);

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
        setNarrative(narrativeRef.current);
        setIsStreaming(true);
        break;
      }
      case "gm_chunk": {
        narrativeRef.current += event.chunk;
        setNarrative(narrativeRef.current);
        break;
      }
      case "gm_done": {
        narrativeRef.current = narrativeRef.current.replace(/\n?%%TURN:\{[^%]*\}%%\s*$/, "").trimEnd() + "\n\n";
        setNarrative(narrativeRef.current);
        setIsStreaming(false);
        refetchHistory();
        refetchPlayers();
        refetchDiceRolls();
        if (event.turnState) {
          setTurnState(event.turnState);
        }
        setTimeout(() => refetchSession(), 3500);
        setTimeout(() => fetchNpcs(), 3000);
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
  });

  useEffect(() => {
    if (!sessionId) return;
    import("@/lib/supabase").then(({ supabase }) => {
      const channel = supabase.channel(`session:${sessionId}`);
      channel.subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });
      return () => { supabase.removeChannel(channel); };
    });
  }, [sessionId]);

  const handleSend = async () => {
    const isDiceMode = turnState.dice !== null && activeRollId !== null;
    if (isStreaming || !selectedPlayerId) return;
    if (!isDiceMode && !action.trim()) return;
    if (!isMyTurn) return;

    const currentPlayer = players?.find(p => p.id === selectedPlayerId);
    const pName = currentPlayer?.characterName || "玩家";
    const currentAction = action.trim() || "(骰子結果)";

    setAction("");

    let rollText = "";
    if (rollResult !== null && rollingDice) {
      rollText = ` (擲 ${rollingDice}: ${rollResult}${rollPurpose ? ` - ${rollPurpose}` : ""})`;
    }

    const line = `[${pName}] ${currentAction}${rollText}\n\n[GM] `;
    narrativeRef.current += line;
    setNarrative(narrativeRef.current);
    setIsStreaming(true);

    broadcast({
      type: "player_action",
      playerId: selectedPlayerId,
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

    try {
      const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/campaign/sessions/${sessionId}/gm-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          action: currentAction,
          diceRollId: submittingRollId,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                narrativeRef.current += data.content;
                setNarrative(narrativeRef.current);
                broadcast({ type: "gm_chunk", chunk: data.content });
              }
              if (data.done) {
                narrativeRef.current = narrativeRef.current.replace(/\n?%%TURN:\{[^%]*\}%%\s*$/, "").trimEnd() + "\n\n";
                setNarrative(narrativeRef.current);
                setIsStreaming(false);

                const newTurnState: TurnState = data.turnState ?? { who: "全體", dice: null, purpose: null };
                setTurnState(newTurnState);

                broadcast({ type: "gm_done", turnState: newTurnState });
                broadcast({ type: "turn_change", ...newTurnState });

                refetchHistory();
                setTimeout(() => {
                  refetchSession();
                  broadcast({ type: "world_state_update" });
                }, 3500);
                setTimeout(() => fetchNpcs(), 3000);
              }
            } catch {
              // ignore partial chunk
            }
          }
        }
      }
    } catch (err) {
      setIsStreaming(false);
      setTurnState({ who: "全體", dice: null, purpose: null });
      console.error(err);
    }
  };

  handleSendRef.current = handleSend;

  const executeRoll = (diceType: string, max: number) => {
    if (!selectedPlayerId || !isMyTurn) return;
    if (turnState.dice !== null && turnState.dice !== diceType) return;

    const currentPlayer = players?.find(p => p.id === selectedPlayerId);
    const pName = currentPlayer?.characterName || "玩家";

    setRollingDice(diceType);
    setRollResult(null);
    setActiveRollId(null);

    setTimeout(() => {
      const result = Math.floor(Math.random() * max) + 1;
      setRollResult(result);

      submitRoll.mutate({
        id: sessionId,
        data: {
          playerId: selectedPlayerId,
          diceType,
          result,
          purpose: rollPurpose || "一般判定"
        }
      }, {
        onSuccess: (data) => {
          setActiveRollId(data.id);
          refetchDiceRolls();
          broadcast({
            type: "dice_roll",
            playerId: selectedPlayerId,
            characterName: pName,
            diceType,
            result,
            purpose: rollPurpose || "一般判定",
          });
        }
      });
    }, 800);
  };

  const [newPlayer, setNewPlayer] = useState({
    name: "", characterName: "", race: "", class: "", background: "", hp: 10, maxHp: 10, ac: 10, level: 1
  });
  const [playerModalOpen, setPlayerModalOpen] = useState(false);

  const handleCreatePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    addPlayer.mutate({
      id: sessionId,
      data: { ...newPlayer, stats: "{}" }
    }, {
      onSuccess: (player) => {
        setPlayerModalOpen(false);
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
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="hover:bg-primary/20"><ArrowLeft className="w-5 h-5 text-primary" /></Button>
          </Link>
          <h1 className="text-2xl font-serif text-primary drop-shadow-md">{session?.name}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isConnected
            ? <><Wifi className="w-4 h-4 text-green-500" /><span className="text-green-500">即時同步</span></>
            : <><WifiOff className="w-4 h-4 text-yellow-500" /><span className="text-yellow-500">連線中...</span></>
          }
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        <aside className="w-72 border-r border-border bg-sidebar p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
            <h2 className="font-serif text-xl text-primary">冒險者隊伍</h2>
            <Dialog open={playerModalOpen} onOpenChange={setPlayerModalOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20"><UserPlus className="w-5 h-5" /></Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl text-primary">創造新角色</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePlayer} className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>玩家暱稱</Label><Input value={newPlayer.name} onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })} required /></div>
                    <div><Label>角色名稱</Label><Input value={newPlayer.characterName} onChange={e => setNewPlayer({ ...newPlayer, characterName: e.target.value })} required /></div>
                    <div><Label>種族</Label><Input value={newPlayer.race} onChange={e => setNewPlayer({ ...newPlayer, race: e.target.value })} required /></div>
                    <div><Label>職業</Label><Input value={newPlayer.class} onChange={e => setNewPlayer({ ...newPlayer, class: e.target.value })} required /></div>
                    <div><Label>最大 HP</Label><Input type="number" value={newPlayer.maxHp} onChange={e => setNewPlayer({ ...newPlayer, maxHp: +e.target.value, hp: +e.target.value })} required /></div>
                    <div><Label>AC (護甲)</Label><Input type="number" value={newPlayer.ac} onChange={e => setNewPlayer({ ...newPlayer, ac: +e.target.value })} required /></div>
                  </div>
                  <div><Label>背景故事</Label><Input value={newPlayer.background} onChange={e => setNewPlayer({ ...newPlayer, background: e.target.value })} /></div>
                  <Button type="submit" className="w-full" disabled={addPlayer.isPending}>加入隊伍</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            {playersLoading ? <div className="text-sm text-muted-foreground text-center">載入中...</div> :
              players?.length === 0 ? <div className="text-sm text-muted-foreground text-center italic py-4">隊伍中還沒有人</div> :
                <div className="space-y-4 pr-3">
                  {players?.map(p => {
                    const isActive = turnState.who !== "全體" && p.characterName === turnState.who;
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded border transition-colors cursor-pointer ${selectedPlayerId === p.id ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/50'} ${isActive ? 'ring-1 ring-primary/60' : ''}`}
                        onClick={() => setSelectedPlayerId(p.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-serif font-bold text-lg text-foreground">{p.characterName}</div>
                          {isActive && (
                            <span className="text-[10px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded border border-primary/30 animate-pulse">行動中</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{p.race} {p.class} · Lv {p.level}</div>
                        <div>
                          <div className="flex justify-between text-xs mb-1 font-mono">
                            <span className="text-muted-foreground">HP</span>
                            <span className={p.hp <= p.maxHp * 0.2 ? 'text-destructive' : 'text-primary'}>{p.hp} / {p.maxHp}</span>
                          </div>
                          <div className="h-1.5 bg-background rounded-full overflow-hidden border border-border">
                            <div
                              className={`h-full transition-all duration-500 ${p.hp / p.maxHp > 0.5 ? 'bg-green-600' : p.hp / p.maxHp > 0.2 ? 'bg-yellow-500' : 'bg-destructive'}`}
                              style={{ width: `${(p.hp / p.maxHp) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-xs font-mono text-muted-foreground">AC: {p.ac}</div>
                      </div>
                    );
                  })}
                </div>
            }
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col relative bg-[#1c1815] shadow-inner">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/old-wall.png")' }}></div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-8 font-serif text-lg leading-relaxed whitespace-pre-wrap relative z-10"
          >
            {narrative || <span className="italic text-muted-foreground">故事尚未開始...</span>}
            {isStreaming && <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1 align-middle shadow-[0_0_8px_rgba(200,140,50,0.8)]" />}
          </div>

          <div className="border-t border-border bg-card relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">

            <AnimatePresence>
              {!isMyTurn && !isStreaming && (
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
                {isMyTurn && turnState.dice !== null && !isStreaming ? (
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
                      <span>GM 要求擲骰：請擲 <strong>{turnState.dice}</strong>{turnState.purpose ? ` — ${turnState.purpose}` : ""}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-amber-400/80 font-mono tracking-wider">① 填寫擲骰目的</div>
                      <Input
                        value={rollPurpose}
                        onChange={e => setRollPurpose(e.target.value)}
                        placeholder="例如：感知檢定、攻擊判定..."
                        className="bg-background border-amber-700/40 focus-visible:ring-amber-600 text-sm"
                        disabled={!!rollingDice}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-amber-400/80 font-mono tracking-wider">② 點擊擲骰</div>
                      <div className="flex items-center gap-3">
                        {[4, 6, 8, 10, 12, 20, 100].map(max => {
                          const diceLabel = `D${max}`;
                          if (turnState.dice !== diceLabel) return null;
                          return (
                            <Button
                              key={diceLabel}
                              onClick={() => executeRoll(diceLabel, max)}
                              disabled={!rollPurpose.trim() || !!rollingDice}
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

                        {!rollPurpose.trim() && !rollingDice && (
                          <span className="text-xs text-muted-foreground font-serif italic">請先填寫擲骰目的再擲骰</span>
                        )}
                      </div>
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
                        !selectedPlayerId ? "請先選擇左側角色..." :
                        isStreaming ? "GM 正在回應中..." :
                        !isMyTurn ? `等待 ${turnState.who} 行動中...` :
                        "描述你的行動或說話..."
                      }
                      className="flex-1 bg-background border-primary/30 focus-visible:ring-primary text-lg py-6"
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      disabled={!selectedPlayerId || isStreaming || !isMyTurn}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={isStreaming || !action.trim() || !selectedPlayerId || !isMyTurn}
                      className="h-auto px-8 text-lg font-serif"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      行動
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        <aside className="w-64 border-l border-border bg-sidebar p-4 flex flex-col gap-0">
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
        </aside>
      </div>
    </div>
  );
}
