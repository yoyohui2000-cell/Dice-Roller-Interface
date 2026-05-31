import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Plus, X, Sword, Shield, Package,
  Scroll, Star, Coins, Check, Pencil, Users, Map, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

type EquipSlot = "mainHand" | "offHand" | "head" | "chest" | "hands" | "feet" | "ring1" | "ring2" | "neck";

export type EquippedItem = {
  name: string;
  attackBonus?: string;
  damage?: string;
  damageType?: string;
};

export type CharacterStats = {
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  tempHp: number;
  speed: number;
  hitDice: string;
  proficiencyBonus: number;
  characterAlignment: string;
  saves: Partial<Record<AbilityKey, boolean>>;
  skillProfs: Partial<Record<string, boolean>>;
  conditions: string[];
  resources: Array<{ name: string; current: number; max: number }>;
  spellSlots: Array<{ level: number; current: number; max: number }>;
  currency: { pp: number; gp: number; sp: number; cp: number };
  equippedSlots: Partial<Record<EquipSlot, EquippedItem | null>>;
  inventory: Array<{ id: number; name: string; qty: number }>;
  questItems: Array<{ id: number; name: string }>;
  reputation: Array<{ faction: string; value: number }>;
  relationships: Array<{ name: string; attitude: string }>;
  storyFlags: Array<{ label: string; done: boolean }>;
  alignmentTrack: { good: number; evil: number; lawful: number; chaotic: number };
};

export const DEFAULT_STATS: CharacterStats = {
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  tempHp: 0, speed: 30, hitDice: "1d8", proficiencyBonus: 2, characterAlignment: "中立",
  saves: {}, skillProfs: {}, conditions: [], resources: [], spellSlots: [],
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  equippedSlots: {}, inventory: [], questItems: [],
  reputation: [], relationships: [], storyFlags: [],
  alignmentTrack: { good: 50, evil: 50, lawful: 50, chaotic: 50 },
};

export type PlayerCoreFields = {
  hp: number; maxHp: number; ac: number; level: number;
  characterName: string; race: string; class: string; background: string;
};

export type CharacterSheetPlayer = PlayerCoreFields & { id: number; stats: string; name: string };

export type CharacterSheetSaveData = PlayerCoreFields & { stats: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "力量", dex: "敏捷", con: "體質", int: "智力", wis: "感知", cha: "魅力",
};
const ABILITY_SHORT: Record<AbilityKey, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

const SKILLS: Array<{ ability: AbilityKey; key: string; label: string }> = [
  { ability: "str", key: "athletics", label: "運動" },
  { ability: "dex", key: "acrobatics", label: "雜技" },
  { ability: "dex", key: "sleightOfHand", label: "扒竊" },
  { ability: "dex", key: "stealth", label: "潛行" },
  { ability: "int", key: "arcana", label: "奧術" },
  { ability: "int", key: "history", label: "歷史" },
  { ability: "int", key: "investigation", label: "調查" },
  { ability: "int", key: "nature", label: "自然" },
  { ability: "int", key: "religion", label: "宗教" },
  { ability: "wis", key: "animalHandling", label: "馴獸" },
  { ability: "wis", key: "insight", label: "洞察" },
  { ability: "wis", key: "medicine", label: "醫療" },
  { ability: "wis", key: "perception", label: "察覺" },
  { ability: "wis", key: "survival", label: "求生" },
  { ability: "cha", key: "deception", label: "欺騙" },
  { ability: "cha", key: "intimidation", label: "威嚇" },
  { ability: "cha", key: "performance", label: "表演" },
  { ability: "cha", key: "persuasion", label: "說服" },
];

const CONDITIONS_PRESET = [
  "中毒", "失明", "耳聾", "魅惑", "恐懼", "擒拿",
  "無行動力", "隱形", "麻痺", "石化", "俯臥",
  "束縛", "目眩", "昏迷", "疲憊", "專注",
];

const EQUIP_SLOTS: Array<{ key: EquipSlot; label: string; isWeapon?: boolean }> = [
  { key: "mainHand", label: "主手", isWeapon: true },
  { key: "offHand", label: "副手", isWeapon: true },
  { key: "head", label: "頭部" },
  { key: "chest", label: "胸甲" },
  { key: "hands", label: "手部" },
  { key: "feet", label: "腳部" },
  { key: "ring1", label: "戒指1" },
  { key: "ring2", label: "戒指2" },
  { key: "neck", label: "護符" },
];

const RELATIONSHIP_ATTITUDES = ["友善", "信任", "中立", "敵對", "仇恨", "未知"];

const ATTITUDE_COLOR: Record<string, string> = {
  "友善": "text-green-400", "信任": "text-blue-400", "中立": "text-muted-foreground",
  "敵對": "text-orange-400", "仇恨": "text-red-400", "未知": "text-muted-foreground",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseStats(statsStr: string): CharacterStats {
  try {
    return { ...DEFAULT_STATS, ...JSON.parse(statsStr) as Partial<CharacterStats> };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function statMod(score: number) { return Math.floor((score - 10) / 2); }
function fmtMod(m: number) { return m >= 0 ? `+${m}` : `${m}`; }

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5">{children}</div>;
}

function StatBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center bg-card border border-border rounded p-1.5 text-center min-w-[44px]">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono leading-none">{label}</div>
      <div className="text-sm font-bold font-mono text-primary leading-none my-0.5">{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground font-mono leading-none">{sub}</div>}
    </div>
  );
}

function InlineNumEdit({
  value, min = 0, max = 999, className = "", onChange,
}: { value: number; min?: number; max?: number; className?: string; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  if (editing) {
    return (
      <input
        className={cn("w-10 text-center bg-background border border-primary/60 rounded text-xs font-mono focus:outline-none text-primary", className)}
        value={raw} autoFocus
        onChange={e => setRaw(e.target.value)}
        onBlur={() => { const n = parseInt(raw, 10); if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n))); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { const n = parseInt(raw, 10); if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n))); setEditing(false); } else if (e.key === "Escape") setEditing(false); }}
      />
    );
  }
  return (
    <span onClick={() => { setRaw(String(value)); setEditing(true); }} className={cn("font-mono text-xs cursor-pointer hover:text-primary transition-colors", className)}>
      {value}
    </span>
  );
}

function PipTrack({ current, max, onToggle }: { current: number; max: number; onToggle: (idx: number) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <button key={i} onClick={() => onToggle(i)} title={i < current ? "使用中" : "可用"}
          className={cn("w-3.5 h-3.5 rounded-sm border transition-colors", i < current ? "bg-primary border-primary/80" : "bg-background border-border hover:border-primary/40")} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "char" | "ability" | "spell" | "equip" | "quest";

const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: "char", label: "角色", icon: <Star className="w-3 h-3" /> },
  { key: "ability", label: "能力", icon: <Zap className="w-3 h-3" /> },
  { key: "spell", label: "法術", icon: <Scroll className="w-3 h-3" /> },
  { key: "equip", label: "裝備", icon: <Package className="w-3 h-3" /> },
  { key: "quest", label: "任務", icon: <Map className="w-3 h-3" /> },
];

interface CharacterSheetProps {
  player: CharacterSheetPlayer;
  onSave: (data: CharacterSheetSaveData) => void;
  isSaving?: boolean;
}

export default function CharacterSheet({ player, onSave, isSaving }: CharacterSheetProps) {
  const [tab, setTab] = useState<Tab>("char");
  const [stats, setStats] = useState<CharacterStats>(() => parseStats(player.stats));
  const [hp, setHp] = useState(player.hp);
  const [maxHp, setMaxHp] = useState(player.maxHp);
  const [ac, setAc] = useState(player.ac);
  const [level, setLevel] = useState(player.level);
  const [savedFlash, setSavedFlash] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestOnSave = useRef(onSave);
  useEffect(() => { latestOnSave.current = onSave; }, [onSave]);

  useEffect(() => { setStats(parseStats(player.stats)); }, [player.id, player.stats]);
  useEffect(() => { setHp(player.hp); }, [player.hp]);
  useEffect(() => { setMaxHp(player.maxHp); }, [player.maxHp]);
  useEffect(() => { setAc(player.ac); }, [player.ac]);
  useEffect(() => { setLevel(player.level); }, [player.level]);

  const scheduleSave = useCallback((coreFields: { hp: number; maxHp: number; ac: number; level: number }, s: CharacterStats) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      latestOnSave.current({
        ...coreFields,
        characterName: player.characterName,
        race: player.race,
        class: player.class,
        background: player.background,
        stats: JSON.stringify(s),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }, 800);
  }, [player.characterName, player.race, player.class, player.background]);

  const updStats = useCallback((patch: Partial<CharacterStats>) => {
    setStats(prev => {
      const next = { ...prev, ...patch };
      scheduleSave({ hp, maxHp, ac, level }, next);
      return next;
    });
  }, [scheduleSave, hp, maxHp, ac, level]);

  const updHp = (v: number) => { const clamped = Math.max(0, Math.min(v, maxHp)); setHp(clamped); scheduleSave({ hp: clamped, maxHp, ac, level }, stats); };
  const updMaxHp = (v: number) => { const n = Math.max(1, v); setMaxHp(n); scheduleSave({ hp, maxHp: n, ac, level }, stats); };
  const updAc = (v: number) => { const n = Math.max(0, v); setAc(n); scheduleSave({ hp, maxHp, ac: n, level }, stats); };
  const updLevel = (v: number) => { const n = Math.max(1, Math.min(20, v)); setLevel(n); scheduleSave({ hp, maxHp, ac, level: n }, stats); };

  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  const hpColor = hpPct > 0.5 ? "bg-green-600" : hpPct > 0.2 ? "bg-yellow-500" : "bg-destructive";
  const prof = stats.proficiencyBonus;

  // ── Character Tab ──────────────────────────────────────────────────────────
  const CharTab = () => {
    const [showCondPicker, setShowCondPicker] = useState(false);
    const [customCond, setCustomCond] = useState("");

    const removeCondition = (c: string) => {
      updStats({ conditions: stats.conditions.filter(x => x !== c) });
    };
    const addCondition = (c: string) => {
      if (!c.trim() || stats.conditions.includes(c)) return;
      updStats({ conditions: [...stats.conditions, c] });
      setShowCondPicker(false);
      setCustomCond("");
    };

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div className="col-span-2 bg-card border border-border rounded p-2">
            <div className="font-serif font-bold text-foreground text-sm">{player.characterName}</div>
            <div className="text-muted-foreground text-[11px]">Lv.{level} {player.race} {player.class}</div>
            <div className="flex items-center gap-2 mt-1">
              <InlineEditText value={stats.characterAlignment} onChange={v => updStats({ characterAlignment: v })} className="text-[10px] text-muted-foreground" placeholder="陣營" />
              <span className="text-border">·</span>
              <span className="text-[10px] text-muted-foreground truncate">{player.background || "—"}</span>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>生命值</SectionTitle>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <InlineNumEdit value={hp} max={maxHp} onChange={updHp} className={cn("text-base font-bold", hp <= maxHp * 0.2 ? "text-destructive" : "text-primary")} />
              <span className="text-muted-foreground text-xs">/</span>
              <InlineNumEdit value={maxHp} onChange={updMaxHp} className="text-xs text-muted-foreground" />
            </div>
            {stats.tempHp > 0 && (
              <span className="text-[10px] font-mono text-blue-400 bg-blue-950/40 border border-blue-700/30 rounded px-1.5 py-0.5">
                +{stats.tempHp} 臨時
              </span>
            )}
          </div>
          <div className="h-2 bg-background rounded-full border border-border overflow-hidden">
            <div className={cn("h-full transition-all duration-500 rounded-full", hpColor)} style={{ width: `${hpPct * 100}%` }} />
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] text-muted-foreground">臨時HP</span>
            <InlineNumEdit value={stats.tempHp} onChange={v => updStats({ tempHp: Math.max(0, v) })} className="text-xs text-blue-400" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="AC" value={String(ac)} />
          <StatBadge label="先攻" value={fmtMod(statMod(stats.dex))} />
          <StatBadge label="速度" value={`${stats.speed}`} sub="ft" />
          <StatBadge label="等級" value={String(level)} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="flex flex-col items-start bg-card border border-border rounded p-1.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono">AC</div>
            <InlineNumEdit value={ac} onChange={updAc} className="text-sm font-bold font-mono text-primary" />
          </div>
          <div className="flex flex-col items-start bg-card border border-border rounded p-1.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono">等級</div>
            <InlineNumEdit value={level} min={1} max={20} onChange={updLevel} className="text-sm font-bold font-mono text-primary" />
          </div>
          <div className="flex flex-col items-start bg-card border border-border rounded p-1.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono">速度(ft)</div>
            <InlineNumEdit value={stats.speed} onChange={v => updStats({ speed: Math.max(0, v) })} className="text-sm font-bold font-mono text-primary" />
          </div>
          <div className="flex flex-col items-start bg-card border border-border rounded p-1.5">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono">命中骰</div>
            <InlineEditText value={stats.hitDice} onChange={v => updStats({ hitDice: v })} className="text-sm font-bold font-mono text-primary" placeholder="1d8" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionTitle>狀態效果</SectionTitle>
            <button onClick={() => setShowCondPicker(v => !v)} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-mono">
              <Plus className="w-3 h-3" />新增
            </button>
          </div>
          <AnimatePresence>
            {showCondPicker && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-2 space-y-1.5 overflow-hidden">
                <div className="flex flex-wrap gap-1">
                  {CONDITIONS_PRESET.filter(c => !stats.conditions.includes(c)).map(c => (
                    <button key={c} onClick={() => addCondition(c)} className="text-[10px] bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors font-serif">{c}</button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input value={customCond} onChange={e => setCustomCond(e.target.value)} placeholder="自訂狀態..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addCondition(customCond)} />
                  <button onClick={() => addCondition(customCond)} className="text-[10px] text-primary px-2 py-1 bg-primary/10 border border-primary/30 rounded hover:bg-primary/20">+</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap gap-1.5">
            {stats.conditions.length === 0 ? (
              <span className="text-[10px] text-muted-foreground italic">無狀態效果</span>
            ) : stats.conditions.map(c => (
              <span key={c} className="flex items-center gap-1 text-[10px] bg-amber-950/40 border border-amber-700/40 text-amber-300 rounded px-1.5 py-0.5 font-serif">
                {c}
                <button onClick={() => removeCondition(c)} className="text-amber-500 hover:text-amber-200"><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Ability Tab ────────────────────────────────────────────────────────────
  const AbilityTab = () => {
    const [skillsOpen, setSkillsOpen] = useState(true);

    const toggleSave = (k: AbilityKey) => {
      updStats({ saves: { ...stats.saves, [k]: !stats.saves[k] } });
    };
    const toggleSkill = (key: string) => {
      updStats({ skillProfs: { ...stats.skillProfs, [key]: !stats.skillProfs[key] } });
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>熟練加值</SectionTitle>
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono font-bold text-primary">{fmtMod(prof)}</span>
            <InlineNumEdit value={prof} min={2} max={6} onChange={v => updStats({ proficiencyBonus: v })} className="text-[10px] text-muted-foreground" />
          </div>
        </div>

        <div>
          <SectionTitle>六維屬性</SectionTitle>
          <div className="grid grid-cols-3 gap-1">
            {ABILITY_KEYS.map(k => {
              const score = stats[k];
              const m = statMod(score);
              return (
                <div key={k} className="flex flex-col items-center bg-card border border-border rounded py-1.5 px-1">
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono">{ABILITY_SHORT[k]}</div>
                  <div className="text-base font-bold font-mono text-primary leading-none">{fmtMod(m)}</div>
                  <InlineNumEdit value={score} min={1} max={30} onChange={v => updStats({ [k]: v } as Partial<CharacterStats>)} className="text-[10px] text-muted-foreground mt-0.5" />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle>豁免</SectionTitle>
          <div className="space-y-0.5">
            {ABILITY_KEYS.map(k => {
              const proficient = !!stats.saves[k];
              const total = statMod(stats[k]) + (proficient ? prof : 0);
              return (
                <div key={k} className="flex items-center gap-2">
                  <button onClick={() => toggleSave(k)} className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors shrink-0", proficient ? "bg-primary border-primary/80 text-primary-foreground" : "border-border hover:border-primary/40")}>
                    {proficient && <Check className="w-2 h-2" />}
                  </button>
                  <span className="text-[11px] font-mono text-muted-foreground w-6">{fmtMod(total)}</span>
                  <span className="text-[11px] font-serif text-foreground">{ABILITY_LABELS[k]}豁免</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <button onClick={() => setSkillsOpen(v => !v)} className="flex items-center gap-1 w-full">
            {skillsOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <SectionTitle>技能</SectionTitle>
          </button>
          <AnimatePresence>
            {skillsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-0.5 mt-1">
                  {SKILLS.map(sk => {
                    const proficient = !!stats.skillProfs[sk.key];
                    const abilScore = stats[sk.ability];
                    const total = statMod(abilScore) + (proficient ? prof : 0);
                    return (
                      <div key={sk.key} className="flex items-center gap-2">
                        <button onClick={() => toggleSkill(sk.key)} className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors shrink-0", proficient ? "bg-primary border-primary/80 text-primary-foreground" : "border-border hover:border-primary/40")}>
                          {proficient && <Check className="w-2 h-2" />}
                        </button>
                        <span className="text-[11px] font-mono text-muted-foreground w-6">{fmtMod(total)}</span>
                        <span className="text-[11px] font-serif text-foreground flex-1">{sk.label}</span>
                        <span className="text-[9px] text-muted-foreground/50 font-mono uppercase shrink-0">{ABILITY_SHORT[sk.ability]}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  // ── Spell Tab ──────────────────────────────────────────────────────────────
  const SpellTab = () => {
    const [newResName, setNewResName] = useState("");
    const [newResMax, setNewResMax] = useState(1);
    const [newSlotLvl, setNewSlotLvl] = useState(1);
    const [newSlotMax, setNewSlotMax] = useState(2);

    const toggleSlotPip = (slotIdx: number, pipIdx: number) => {
      const updated = stats.spellSlots.map((s, i) => {
        if (i !== slotIdx) return s;
        const newCurrent = pipIdx < s.current ? pipIdx : pipIdx + 1;
        return { ...s, current: Math.max(0, Math.min(newCurrent, s.max)) };
      });
      updStats({ spellSlots: updated });
    };

    const removeSlot = (idx: number) => updStats({ spellSlots: stats.spellSlots.filter((_, i) => i !== idx) });
    const addSlot = () => {
      if (stats.spellSlots.some(s => s.level === newSlotLvl)) return;
      const sorted = [...stats.spellSlots, { level: newSlotLvl, current: newSlotMax, max: newSlotMax }].sort((a, b) => a.level - b.level);
      updStats({ spellSlots: sorted });
    };
    const restoreAllSlots = () => updStats({ spellSlots: stats.spellSlots.map(s => ({ ...s, current: s.max })) });

    const updateResource = (idx: number, patch: Partial<{ name: string; current: number; max: number }>) => {
      updStats({ resources: stats.resources.map((r, i) => i === idx ? { ...r, ...patch } : r) });
    };
    const removeResource = (idx: number) => updStats({ resources: stats.resources.filter((_, i) => i !== idx) });
    const addResource = () => {
      if (!newResName.trim()) return;
      updStats({ resources: [...stats.resources, { name: newResName.trim(), current: newResMax, max: newResMax }] });
      setNewResName(""); setNewResMax(1);
    };

    return (
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionTitle>職業資源</SectionTitle>
          </div>
          <div className="space-y-2">
            {stats.resources.map((r, i) => (
              <div key={i} className="bg-card border border-border rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-serif text-foreground">{r.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-primary">{r.current}/{r.max}</span>
                    <button onClick={() => removeResource(i)} className="text-muted-foreground/40 hover:text-destructive/70"><X className="w-3 h-3" /></button>
                  </div>
                </div>
                <PipTrack current={r.current} max={r.max} onToggle={pip => {
                  const newCurrent = pip < r.current ? pip : pip + 1;
                  updateResource(i, { current: Math.max(0, Math.min(newCurrent, r.max)) });
                }} />
              </div>
            ))}
            <div className="flex gap-1">
              <input value={newResName} onChange={e => setNewResName(e.target.value)} placeholder="資源名稱..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addResource()} />
              <InlineNumEdit value={newResMax} min={1} max={99} onChange={setNewResMax} className="w-8 text-center text-[10px]" />
              <button onClick={addResource} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionTitle>法術位</SectionTitle>
            {stats.spellSlots.length > 0 && (
              <button onClick={restoreAllSlots} className="text-[9px] text-primary hover:text-primary/80 font-mono">全部恢復</button>
            )}
          </div>
          <div className="space-y-1.5">
            {stats.spellSlots.map((s, i) => (
              <div key={s.level} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0">Lv{s.level}</span>
                <div className="flex gap-0.5 flex-1">
                  {Array.from({ length: s.max }).map((_, pip) => (
                    <button key={pip} onClick={() => toggleSlotPip(i, pip)}
                      className={cn("w-5 h-5 rounded border text-[9px] font-mono transition-colors", pip < s.current ? "bg-primary/80 border-primary/60 text-primary-foreground" : "bg-background border-border text-muted-foreground hover:border-primary/40")}>
                      {pip < s.current ? "◆" : "◇"}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{s.current}/{s.max}</span>
                <button onClick={() => removeSlot(i)} className="text-muted-foreground/30 hover:text-destructive/60 shrink-0"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <div className="flex gap-1 items-center mt-1">
              <span className="text-[9px] text-muted-foreground">新增 Lv</span>
              <InlineNumEdit value={newSlotLvl} min={1} max={9} onChange={setNewSlotLvl} className="w-6 text-[10px]" />
              <span className="text-[9px] text-muted-foreground">最多</span>
              <InlineNumEdit value={newSlotMax} min={1} max={9} onChange={setNewSlotMax} className="w-6 text-[10px]" />
              <button onClick={addSlot} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Equip Tab ──────────────────────────────────────────────────────────────
  const EquipTab = () => {
    const [editingSlot, setEditingSlot] = useState<EquipSlot | null>(null);
    const [editSlotData, setEditSlotData] = useState<EquippedItem>({ name: "" });
    const [newInvName, setNewInvName] = useState("");
    const [newQuestName, setNewQuestName] = useState("");

    const openSlotEdit = (k: EquipSlot) => {
      const existing = stats.equippedSlots[k];
      setEditSlotData(existing ? { ...existing } : { name: "" });
      setEditingSlot(k);
    };
    const saveSlotEdit = () => {
      if (!editingSlot) return;
      const val = editSlotData.name.trim() ? editSlotData : null;
      updStats({ equippedSlots: { ...stats.equippedSlots, [editingSlot]: val } });
      setEditingSlot(null);
    };
    const clearSlot = (k: EquipSlot) => updStats({ equippedSlots: { ...stats.equippedSlots, [k]: null } });

    const addInv = () => {
      if (!newInvName.trim()) return;
      updStats({ inventory: [...stats.inventory, { id: Date.now(), name: newInvName.trim(), qty: 1 }] });
      setNewInvName("");
    };
    const removeInv = (id: number) => updStats({ inventory: stats.inventory.filter(x => x.id !== id) });
    const updateInvQty = (id: number, qty: number) => updStats({ inventory: stats.inventory.map(x => x.id === id ? { ...x, qty: Math.max(0, qty) } : x) });

    const addQuest = () => {
      if (!newQuestName.trim()) return;
      updStats({ questItems: [...stats.questItems, { id: Date.now(), name: newQuestName.trim() }] });
      setNewQuestName("");
    };
    const removeQuest = (id: number) => updStats({ questItems: stats.questItems.filter(x => x.id !== id) });

    const cur = stats.currency;
    const updateCurrency = (k: keyof typeof cur, v: number) => updStats({ currency: { ...cur, [k]: Math.max(0, v) } });

    const SLOT_IS_WEAPON: Record<EquipSlot, boolean> = { mainHand: true, offHand: true, head: false, chest: false, hands: false, feet: false, ring1: false, ring2: false, neck: false };

    return (
      <div className="space-y-3">
        <div>
          <SectionTitle>已裝備</SectionTitle>
          <div className="grid grid-cols-2 gap-1">
            {EQUIP_SLOTS.map(({ key: k, label }) => {
              const item = stats.equippedSlots[k];
              return (
                <div key={k} className="bg-card border border-border rounded p-1.5 cursor-pointer hover:border-primary/40 transition-colors group relative" onClick={() => openSlotEdit(k)}>
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
                  {item ? (
                    <>
                      <div className="text-[11px] font-serif text-foreground truncate">{item.name}</div>
                      {SLOT_IS_WEAPON[k] && item.damage && (
                        <div className="text-[9px] font-mono text-primary/70">{item.attackBonus && `命中${item.attackBonus}`} {item.damage} {item.damageType}</div>
                      )}
                      <button onClick={e => { e.stopPropagation(); clearSlot(k); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive/70 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                    </>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/40 italic">空</div>
                  )}
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {editingSlot && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-2 bg-card border border-primary/30 rounded p-2 space-y-1.5">
                <div className="text-[10px] font-mono text-primary mb-1">{EQUIP_SLOTS.find(s => s.key === editingSlot)?.label} 裝備</div>
                <input value={editSlotData.name} onChange={e => setEditSlotData(d => ({ ...d, name: e.target.value }))} placeholder="物品名稱" className="w-full text-[11px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && saveSlotEdit()} autoFocus />
                {(editingSlot === "mainHand" || editingSlot === "offHand") && (
                  <div className="grid grid-cols-3 gap-1">
                    <input value={editSlotData.attackBonus ?? ""} onChange={e => setEditSlotData(d => ({ ...d, attackBonus: e.target.value }))} placeholder="命中 +8" className="text-[10px] bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:border-primary/50" />
                    <input value={editSlotData.damage ?? ""} onChange={e => setEditSlotData(d => ({ ...d, damage: e.target.value }))} placeholder="1d8+4" className="text-[10px] bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:border-primary/50" />
                    <input value={editSlotData.damageType ?? ""} onChange={e => setEditSlotData(d => ({ ...d, damageType: e.target.value }))} placeholder="揮砍" className="text-[10px] bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:border-primary/50" />
                  </div>
                )}
                <div className="flex gap-1">
                  <button onClick={saveSlotEdit} className="flex-1 py-1 bg-primary/20 border border-primary/40 text-primary rounded text-[10px] hover:bg-primary/30">儲存</button>
                  <button onClick={() => setEditingSlot(null)} className="px-3 py-1 bg-muted/20 text-muted-foreground rounded text-[10px] hover:bg-muted/40">取消</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <SectionTitle>金幣</SectionTitle>
          <div className="grid grid-cols-4 gap-1">
            {(["pp", "gp", "sp", "cp"] as const).map(k => (
              <div key={k} className="flex flex-col items-center bg-card border border-border rounded py-1">
                <div className="text-[8px] uppercase font-mono text-amber-400/70">{k.toUpperCase()}</div>
                <InlineNumEdit value={cur[k]} onChange={v => updateCurrency(k, v)} className="text-sm font-mono font-bold text-amber-300" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionTitle>背包</SectionTitle>
          </div>
          <div className="space-y-1 mb-1.5">
            {stats.inventory.map(item => (
              <div key={item.id} className="flex items-center gap-1.5">
                <InlineNumEdit value={item.qty} min={0} max={999} onChange={v => updateInvQty(item.id, v)} className="text-[10px] text-muted-foreground w-8 text-center" />
                <span className="text-[11px] font-serif text-foreground flex-1 truncate">{item.name}</span>
                <button onClick={() => removeInv(item.id)} className="text-muted-foreground/30 hover:text-destructive/60"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {stats.inventory.length === 0 && <div className="text-[10px] text-muted-foreground italic">背包是空的</div>}
          </div>
          <div className="flex gap-1">
            <input value={newInvName} onChange={e => setNewInvName(e.target.value)} placeholder="物品名稱..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addInv()} />
            <button onClick={addInv} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionTitle>任務物品</SectionTitle>
          </div>
          <div className="space-y-1 mb-1.5">
            {stats.questItems.map(item => (
              <div key={item.id} className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[11px] font-serif text-amber-200 flex-1 truncate">{item.name}</span>
                <button onClick={() => removeQuest(item.id)} className="text-muted-foreground/30 hover:text-destructive/60"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {stats.questItems.length === 0 && <div className="text-[10px] text-muted-foreground italic">無任務物品</div>}
          </div>
          <div className="flex gap-1">
            <input value={newQuestName} onChange={e => setNewQuestName(e.target.value)} placeholder="任務物品名稱..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addQuest()} />
            <button onClick={addQuest} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    );
  };

  // ── Quest Tab ──────────────────────────────────────────────────────────────
  const QuestTab = () => {
    const [newFlag, setNewFlag] = useState("");
    const [newFaction, setNewFaction] = useState("");
    const [newRelName, setNewRelName] = useState("");
    const [newRelAttr, setNewRelAttr] = useState("中立");

    const toggleFlag = (i: number) => updStats({ storyFlags: stats.storyFlags.map((f, j) => j === i ? { ...f, done: !f.done } : f) });
    const removeFlag = (i: number) => updStats({ storyFlags: stats.storyFlags.filter((_, j) => j !== i) });
    const addFlag = () => { if (!newFlag.trim()) return; updStats({ storyFlags: [...stats.storyFlags, { label: newFlag.trim(), done: false }] }); setNewFlag(""); };

    const updateRepValue = (i: number, v: number) => updStats({ reputation: stats.reputation.map((r, j) => j === i ? { ...r, value: Math.max(-100, Math.min(100, v)) } : r) });
    const removeRep = (i: number) => updStats({ reputation: stats.reputation.filter((_, j) => j !== i) });
    const addRep = () => { if (!newFaction.trim()) return; updStats({ reputation: [...stats.reputation, { faction: newFaction.trim(), value: 0 }] }); setNewFaction(""); };

    const removeRel = (i: number) => updStats({ relationships: stats.relationships.filter((_, j) => j !== i) });
    const addRel = () => { if (!newRelName.trim()) return; updStats({ relationships: [...stats.relationships, { name: newRelName.trim(), attitude: newRelAttr }] }); setNewRelName(""); };
    const cycleAttr = (i: number) => {
      const cur = stats.relationships[i].attitude;
      const idx = RELATIONSHIP_ATTITUDES.indexOf(cur);
      const next = RELATIONSHIP_ATTITUDES[(idx + 1) % RELATIONSHIP_ATTITUDES.length];
      updStats({ relationships: stats.relationships.map((r, j) => j === i ? { ...r, attitude: next } : r) });
    };

    const al = stats.alignmentTrack;

    return (
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionTitle>劇情旗標</SectionTitle>
          </div>
          <div className="space-y-1 mb-1.5">
            {stats.storyFlags.length === 0 && <div className="text-[10px] text-muted-foreground italic">尚無劇情記錄</div>}
            {stats.storyFlags.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <button onClick={() => toggleFlag(i)} className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors shrink-0", f.done ? "bg-green-700/80 border-green-600/60 text-white" : "border-border hover:border-primary/40")}>
                  {f.done && <Check className="w-2 h-2" />}
                </button>
                <span className={cn("text-[11px] font-serif flex-1", f.done ? "text-muted-foreground line-through" : "text-foreground")}>{f.label}</span>
                <button onClick={() => removeFlag(i)} className="text-muted-foreground/30 hover:text-destructive/60 shrink-0"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={newFlag} onChange={e => setNewFlag(e.target.value)} placeholder="劇情事件..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addFlag()} />
            <button onClick={addFlag} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        <div>
          <SectionTitle>聲望</SectionTitle>
          <div className="space-y-1.5 mb-1.5">
            {stats.reputation.length === 0 && <div className="text-[10px] text-muted-foreground italic">尚無聲望記錄</div>}
            {stats.reputation.map((r, i) => {
              const pct = Math.max(0, Math.min(100, (r.value + 100) / 2));
              const color = r.value >= 0 ? "bg-green-600" : "bg-red-700";
              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-serif text-foreground">{r.faction}</span>
                    <div className="flex items-center gap-1">
                      <InlineNumEdit value={r.value} min={-100} max={100} onChange={v => updateRepValue(i, v)} className="text-[10px] text-primary font-mono" />
                      <button onClick={() => removeRep(i)} className="text-muted-foreground/30 hover:text-destructive/60"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="h-1 bg-background rounded border border-border overflow-hidden">
                    <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            <input value={newFaction} onChange={e => setNewFaction(e.target.value)} placeholder="派系名稱..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addRep()} />
            <button onClick={addRep} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        <div>
          <SectionTitle>NPC 關係</SectionTitle>
          <div className="space-y-1 mb-1.5">
            {stats.relationships.length === 0 && <div className="text-[10px] text-muted-foreground italic">尚無NPC關係</div>}
            {stats.relationships.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-serif text-foreground flex-1 truncate">{r.name}</span>
                <button onClick={() => cycleAttr(i)} className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border border-border hover:border-primary/40 transition-colors", ATTITUDE_COLOR[r.attitude] ?? "text-muted-foreground")}>
                  {r.attitude}
                </button>
                <button onClick={() => removeRel(i)} className="text-muted-foreground/30 hover:text-destructive/60"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={newRelName} onChange={e => setNewRelName(e.target.value)} placeholder="NPC名稱..." className="flex-1 text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50" onKeyDown={e => e.key === "Enter" && addRel()} />
            <select value={newRelAttr} onChange={e => setNewRelAttr(e.target.value)} className="text-[10px] bg-background border border-border rounded px-1 text-foreground focus:outline-none">
              {RELATIONSHIP_ATTITUDES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={addRel} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] hover:bg-primary/20"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        <div>
          <SectionTitle>陣營傾向</SectionTitle>
          <div className="space-y-2">
            {([["good", "evil", "善良", "邪惡"], ["lawful", "chaotic", "守序", "混亂"]] as const).map(([a, b, la, lb]) => {
              const valA = al[a as keyof typeof al];
              return (
                <div key={a} className="space-y-0.5">
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                    <span>{la} <span className="text-primary">{valA}</span></span>
                    <span className="text-muted-foreground/60">{lb} {al[b as keyof typeof al]}</span>
                  </div>
                  <div className="relative h-1.5 bg-background border border-border rounded overflow-hidden cursor-pointer"
                    onClick={e => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      updStats({ alignmentTrack: { ...al, [a]: Math.round(pct), [b]: Math.round(100 - pct) } });
                    }}>
                    <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${valA}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex border-b border-border shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-mono tracking-wider transition-colors", tab === t.key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {(isSaving || savedFlash) && (
        <div className="shrink-0 flex justify-end px-2 py-0.5 text-[9px] font-mono text-muted-foreground/60">
          {isSaving ? "儲存中..." : "✓ 已儲存"}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
              {tab === "char" && <CharTab />}
              {tab === "ability" && <AbilityTab />}
              {tab === "spell" && <SpellTab />}
              {tab === "equip" && <EquipTab />}
              {tab === "quest" && <QuestTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Inline text edit helper ──────────────────────────────────────────────────

function InlineEditText({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value);
  if (editing) {
    return (
      <input
        value={raw} autoFocus
        className={cn("bg-background border border-primary/50 rounded px-1 focus:outline-none", className)}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => { onChange(raw); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onChange(raw); setEditing(false); } else if (e.key === "Escape") { setRaw(value); setEditing(false); } }}
      />
    );
  }
  return (
    <span onClick={() => { setRaw(value); setEditing(true); }} className={cn("cursor-pointer hover:text-primary transition-colors", className, !value && "italic text-muted-foreground/50")}>
      {value || placeholder || "—"}
    </span>
  );
}
