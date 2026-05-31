import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { parseStats } from "@/components/character-sheet";
import { Shield, Zap, Package, Heart } from "lucide-react";

type PlayerRow = {
  id: number;
  characterName: string;
  race: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  stats: string;
};

interface PartyStatsPanelProps {
  players: PlayerRow[];
}

const CONDITION_COLOR: Record<string, string> = {
  "中毒":   "bg-green-950/70 text-green-300 border-green-700/50",
  "失明":   "bg-gray-950/70 text-gray-300 border-gray-600/50",
  "耳聾":   "bg-gray-950/70 text-gray-300 border-gray-600/50",
  "魅惑":   "bg-pink-950/70 text-pink-300 border-pink-700/50",
  "恐懼":   "bg-purple-950/70 text-purple-300 border-purple-700/50",
  "擒拿":   "bg-orange-950/70 text-orange-300 border-orange-700/50",
  "無行動力": "bg-slate-950/70 text-slate-400 border-slate-600/50",
  "隱形":   "bg-sky-950/70 text-sky-300 border-sky-700/50",
  "麻痺":   "bg-yellow-950/70 text-yellow-300 border-yellow-700/50",
  "石化":   "bg-stone-950/70 text-stone-300 border-stone-600/50",
  "俯臥":   "bg-amber-950/70 text-amber-300 border-amber-700/50",
  "束縛":   "bg-red-950/70 text-red-300 border-red-700/50",
  "目眩":   "bg-indigo-950/70 text-indigo-300 border-indigo-700/50",
  "昏迷":   "bg-red-950/70 text-red-400 border-red-700/50",
  "疲憊":   "bg-zinc-950/70 text-zinc-400 border-zinc-600/50",
  "專注":   "bg-blue-950/70 text-blue-300 border-blue-700/50",
};

const DEFAULT_COND_COLOR = "bg-muted/50 text-muted-foreground border-border";

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const color = pct > 0.5 ? "bg-green-500" : pct > 0.2 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground flex items-center gap-1">
          <Heart className="w-2.5 h-2.5" /> HP
        </span>
        <span className={cn("font-mono font-bold", pct <= 0.2 ? "text-red-400" : pct <= 0.5 ? "text-yellow-400" : "text-green-400")}>
          {hp} / {maxHp}
        </span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden border border-border/50">
        <motion.div
          className={cn("h-full rounded-full", color)}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function PipRow({ current, max, label }: { current: number; max: number; label: string }) {
  if (max === 0) return null;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[9px] font-mono text-muted-foreground/70 w-3 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-sm border",
              i < current
                ? "bg-blue-400/80 border-blue-500/80"
                : "bg-background border-border/50",
            )}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">{current}/{max}</span>
    </div>
  );
}

function PlayerCard({ player }: { player: PlayerRow }) {
  const stats = parseStats(player.stats ?? "{}");
  const prevConditionsRef = useRef<string[]>([]);
  const [newConditions, setNewConditions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prev = new Set(prevConditionsRef.current);
    const added = stats.conditions.filter(c => !prev.has(c));
    if (added.length > 0) {
      setNewConditions(new Set(added));
      const t = setTimeout(() => setNewConditions(new Set()), 3000);
      prevConditionsRef.current = stats.conditions;
      return () => clearTimeout(t);
    }
    prevConditionsRef.current = stats.conditions;
    return undefined;
  }, [stats.conditions.join(",")]);

  const activeSlots = stats.spellSlots.filter(s => s.max > 0);
  const topItems = stats.inventory.slice(0, 6);

  const hpPct = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  const isDowned = player.hp === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDowned ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-lg border bg-card/60 p-2.5 space-y-2 transition-colors duration-500",
        isDowned ? "border-red-800/60" : hpPct <= 0.2 ? "border-red-700/40" : "border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-serif shrink-0",
          isDowned ? "bg-red-900/60 text-red-300" : "bg-primary/20 text-primary",
        )}>
          {player.characterName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-serif font-bold text-foreground truncate leading-none">
            {player.characterName}
          </div>
          <div className="text-[9px] text-muted-foreground font-mono truncate leading-none mt-0.5">
            {player.race} {player.class} Lv.{player.level}
          </div>
        </div>
        {isDowned && (
          <span className="text-[9px] text-red-400 font-mono shrink-0 animate-pulse">瀕死</span>
        )}
      </div>

      {/* HP bar */}
      <HpBar hp={player.hp} maxHp={player.maxHp} />

      {/* Conditions */}
      {stats.conditions.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1 flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> 狀態異常
          </div>
          <div className="flex flex-wrap gap-1">
            <AnimatePresence>
              {stats.conditions.map(c => (
                <motion.span
                  key={c}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded border font-mono",
                    newConditions.has(c)
                      ? "ring-1 ring-offset-0 ring-amber-400/60"
                      : "",
                    CONDITION_COLOR[c] ?? DEFAULT_COND_COLOR,
                  )}
                >
                  {c}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Spell Slots */}
      {activeSlots.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" /> 法術位
          </div>
          <div className="space-y-0.5">
            {activeSlots.map(slot => (
              <PipRow
                key={slot.level}
                current={slot.current}
                max={slot.max}
                label={`L${slot.level}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inventory */}
      {topItems.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1 flex items-center gap-1">
            <Package className="w-2.5 h-2.5" /> 物品
          </div>
          <div className="flex flex-wrap gap-1">
            {topItems.map(item => (
              <span
                key={item.id}
                className="text-[9px] px-1.5 py-0.5 rounded border bg-background border-border text-foreground/80 font-mono"
              >
                {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}
              </span>
            ))}
            {stats.inventory.length > 6 && (
              <span className="text-[9px] text-muted-foreground/50 font-mono self-center">
                +{stats.inventory.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.conditions.length === 0 && activeSlots.length === 0 && topItems.length === 0 && (
        <p className="text-[9px] text-muted-foreground/50 italic font-mono">尚無狀態、法術或物品資料</p>
      )}
    </motion.div>
  );
}

export default function PartyStatsPanel({ players }: PartyStatsPanelProps) {
  if (players.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm italic text-muted-foreground text-center px-2">
          隊伍中還沒有人。
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2.5 pr-1 pb-2">
        {players.map(p => (
          <PlayerCard key={p.id} player={p} />
        ))}
      </div>
    </ScrollArea>
  );
}
