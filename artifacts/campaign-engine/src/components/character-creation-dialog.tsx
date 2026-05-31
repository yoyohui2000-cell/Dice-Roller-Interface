import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronLeft, Check, Sword, Wand2, Zap, Shield, Leaf, Music, Flame, Skull, Star, BookOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_STATS } from "@/components/character-sheet";

// ─── D&D 5e Data ──────────────────────────────────────────────────────────────

type StatKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

type Race = {
  value: string;
  label: string;
  subtitle: string;
  bonuses: Partial<Record<StatKey, number>>;
  traits: string[];
  speed: number;
  color: string;
};

type ClassDef = {
  value: string;
  label: string;
  subtitle: string;
  hitDie: number;
  defaultAc: number;
  primaryStats: StatKey[];
  savingThrows: StatKey[];
  description: string;
  icon: React.ReactNode;
  color: string;
};

type Background = {
  value: string;
  label: string;
  description: string;
  skillProfs: string[];
};

export const RACES: Race[] = [
  {
    value: "人類", label: "人類", subtitle: "Human",
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    traits: ["所有能力值 +1", "額外語言 ×1", "全能適應性"],
    speed: 30, color: "border-amber-600/50 bg-amber-950/20 hover:border-amber-500",
  },
  {
    value: "高等精靈", label: "高等精靈", subtitle: "High Elf",
    bonuses: { dex: 2, int: 1 },
    traits: ["敏捷 +2", "智力 +1", "黑暗視覺 60尺", "奧術知識", "長弓/短劍擅長"],
    speed: 30, color: "border-cyan-600/50 bg-cyan-950/20 hover:border-cyan-500",
  },
  {
    value: "山丘矮人", label: "山丘矮人", subtitle: "Hill Dwarf",
    bonuses: { con: 2, wis: 1 },
    traits: ["體質 +2", "感知 +1", "矮人韌性（HP+1/級）", "黑暗視覺 60尺", "毒素抗性"],
    speed: 25, color: "border-stone-500/50 bg-stone-950/20 hover:border-stone-400",
  },
  {
    value: "輕足半身人", label: "輕足半身人", subtitle: "Lightfoot Halfling",
    bonuses: { dex: 2, cha: 1 },
    traits: ["敏捷 +2", "魅力 +1", "幸運（重擲1的骰）", "勇敢（恐懼優勢）", "天生隱匿"],
    speed: 25, color: "border-green-600/50 bg-green-950/20 hover:border-green-500",
  },
  {
    value: "半精靈", label: "半精靈", subtitle: "Half-Elf",
    bonuses: { cha: 2, dex: 1, wis: 1 },
    traits: ["魅力 +2", "其他兩項 +1", "黑暗視覺 60尺", "技能多才多藝 ×2", "精靈血統抵抗"],
    speed: 30, color: "border-violet-600/50 bg-violet-950/20 hover:border-violet-500",
  },
  {
    value: "半獸人", label: "半獸人", subtitle: "Half-Orc",
    bonuses: { str: 2, con: 1 },
    traits: ["力量 +2", "體質 +1", "黑暗視覺 60尺", "堅韌忍耐（1HP復甦）", "殘暴攻擊（傷害骰重擲）"],
    speed: 30, color: "border-red-700/50 bg-red-950/20 hover:border-red-600",
  },
  {
    value: "龍裔", label: "龍裔", subtitle: "Dragonborn",
    bonuses: { str: 2, cha: 1 },
    traits: ["力量 +2", "魅力 +1", "龍息武器（錐形/線形）", "傷害類型抗性", "龍祖傳承"],
    speed: 30, color: "border-orange-600/50 bg-orange-950/20 hover:border-orange-500",
  },
  {
    value: "提夫林", label: "提夫林", subtitle: "Tiefling",
    bonuses: { int: 1, cha: 2 },
    traits: ["魅力 +2", "智力 +1", "黑暗視覺 60尺", "冥界傳承（施法）", "火焰抗性"],
    speed: 30, color: "border-rose-700/50 bg-rose-950/20 hover:border-rose-600",
  },
  {
    value: "岩石侏儒", label: "岩石侏儒", subtitle: "Rock Gnome",
    bonuses: { int: 2, con: 1 },
    traits: ["智力 +2", "體質 +1", "黑暗視覺 60尺", "侏儒詭計（施法）", "工匠知識"],
    speed: 25, color: "border-yellow-600/50 bg-yellow-950/20 hover:border-yellow-500",
  },
];

export const CLASSES: ClassDef[] = [
  {
    value: "戰士", label: "戰士", subtitle: "Fighter",
    hitDie: 10, defaultAc: 16,
    primaryStats: ["str", "con"], savingThrows: ["str", "con"],
    description: "精通武器與護甲的全能戰鬥專家",
    icon: <Sword className="w-5 h-5" />, color: "border-red-700/50 bg-red-950/20 hover:border-red-600",
  },
  {
    value: "法師", label: "法師", subtitle: "Wizard",
    hitDie: 6, defaultAc: 11,
    primaryStats: ["int"], savingThrows: ["int", "wis"],
    description: "透過學習掌握強大奧術的施法者",
    icon: <Wand2 className="w-5 h-5" />, color: "border-blue-600/50 bg-blue-950/20 hover:border-blue-500",
  },
  {
    value: "流氓", label: "流氓", subtitle: "Rogue",
    hitDie: 8, defaultAc: 13,
    primaryStats: ["dex"], savingThrows: ["dex", "int"],
    description: "靈巧潛行、技能精通的陰影行者",
    icon: <Skull className="w-5 h-5" />, color: "border-gray-500/50 bg-gray-950/20 hover:border-gray-400",
  },
  {
    value: "聖騎士", label: "聖騎士", subtitle: "Paladin",
    hitDie: 10, defaultAc: 18,
    primaryStats: ["str", "cha"], savingThrows: ["wis", "cha"],
    description: "神聖誓言束縛的聖戰勇士與治療者",
    icon: <Shield className="w-5 h-5" />, color: "border-yellow-500/50 bg-yellow-950/20 hover:border-yellow-400",
  },
  {
    value: "遊俠", label: "遊俠", subtitle: "Ranger",
    hitDie: 10, defaultAc: 14,
    primaryStats: ["dex", "wis"], savingThrows: ["str", "dex"],
    description: "荒野追蹤、弓術精通的自然戰士",
    icon: <Leaf className="w-5 h-5" />, color: "border-green-600/50 bg-green-950/20 hover:border-green-500",
  },
  {
    value: "牧師", label: "牧師", subtitle: "Cleric",
    hitDie: 8, defaultAc: 15,
    primaryStats: ["wis"], savingThrows: ["wis", "cha"],
    description: "神明力量的化身，施放神術與治療",
    icon: <Star className="w-5 h-5" />, color: "border-amber-500/50 bg-amber-950/20 hover:border-amber-400",
  },
  {
    value: "野蠻人", label: "野蠻人", subtitle: "Barbarian",
    hitDie: 12, defaultAc: 13,
    primaryStats: ["str", "con"], savingThrows: ["str", "con"],
    description: "原始狂暴爆發出超凡戰鬥力的蠻族",
    icon: <Flame className="w-5 h-5" />, color: "border-orange-700/50 bg-orange-950/20 hover:border-orange-600",
  },
  {
    value: "吟遊詩人", label: "吟遊詩人", subtitle: "Bard",
    hitDie: 8, defaultAc: 13,
    primaryStats: ["cha"], savingThrows: ["dex", "cha"],
    description: "以音樂魔法支援同伴、操控情勢",
    icon: <Music className="w-5 h-5" />, color: "border-pink-600/50 bg-pink-950/20 hover:border-pink-500",
  },
  {
    value: "德魯伊", label: "德魯伊", subtitle: "Druid",
    hitDie: 8, defaultAc: 13,
    primaryStats: ["wis"], savingThrows: ["int", "wis"],
    description: "自然守護者，掌握變形與大地魔法",
    icon: <Leaf className="w-5 h-5" />, color: "border-emerald-600/50 bg-emerald-950/20 hover:border-emerald-500",
  },
  {
    value: "武僧", label: "武僧", subtitle: "Monk",
    hitDie: 8, defaultAc: 10,
    primaryStats: ["dex", "wis"], savingThrows: ["str", "dex"],
    description: "空手格鬥與氣功的禪定武藝大師",
    icon: <Zap className="w-5 h-5" />, color: "border-cyan-600/50 bg-cyan-950/20 hover:border-cyan-500",
  },
  {
    value: "術士", label: "術士", subtitle: "Sorcerer",
    hitDie: 6, defaultAc: 11,
    primaryStats: ["cha"], savingThrows: ["con", "cha"],
    description: "血脈中流淌著天生魔力的施法者",
    icon: <Flame className="w-5 h-5" />, color: "border-purple-600/50 bg-purple-950/20 hover:border-purple-500",
  },
  {
    value: "魔契者", label: "魔契者", subtitle: "Warlock",
    hitDie: 8, defaultAc: 13,
    primaryStats: ["cha"], savingThrows: ["wis", "cha"],
    description: "與神秘強大存在訂立契約的黑暗術者",
    icon: <BookOpen className="w-5 h-5" />, color: "border-violet-700/50 bg-violet-950/20 hover:border-violet-600",
  },
];

export const BACKGROUNDS: Background[] = [
  { value: "士兵", label: "士兵 (Soldier)", description: "曾服役於正規軍隊，熟悉紀律與戰陣", skillProfs: ["運動", "威嚇"] },
  { value: "罪犯", label: "罪犯 (Criminal)", description: "有黑暗的非法過去，擅長潛入與謊言", skillProfs: ["欺騙", "潛行"] },
  { value: "貴族", label: "貴族 (Noble)", description: "出身名門望族，精通政治與社交禮儀", skillProfs: ["歷史", "勸說"] },
  { value: "民間英雄", label: "民間英雄 (Folk Hero)", description: "從平民百姓中崛起的草根英雄", skillProfs: ["馴獸", "求生"] },
  { value: "學者", label: "學者 (Sage)", description: "畢生鑽研知識，博覽萬卷典籍", skillProfs: ["奧術", "歷史"] },
  { value: "侍僧", label: "侍僧 (Acolyte)", description: "在神廟侍奉神靈，虔誠的信仰追隨者", skillProfs: ["洞察", "宗教"] },
  { value: "藝人", label: "藝人 (Entertainer)", description: "巡迴演出的表演藝術家，善於取悅人心", skillProfs: ["雜技", "表演"] },
  { value: "行會工匠", label: "行會工匠 (Guild Artisan)", description: "屬於工匠行會的熟練手藝人", skillProfs: ["洞察", "勸說"] },
  { value: "流浪兒", label: "流浪兒 (Urchin)", description: "在城市街道長大的生存老手", skillProfs: ["扒竊", "潛行"] },
  { value: "荒野遊蕩者", label: "荒野遊蕩者 (Outlander)", description: "在荒野邊疆獨自生存的流浪者", skillProfs: ["運動", "求生"] },
];

const STAT_LABELS: Record<StatKey, string> = { str: "力量", dex: "敏捷", con: "體質", int: "智力", wis: "感知", cha: "魅力" };
const STAT_KEYS: StatKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2);
}

function modStr(val: number) {
  return val >= 0 ? `+${val}` : `${val}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export type CharacterCreationData = {
  name: string;
  characterName: string;
  race: string;
  class: string;
  background: string;
  hp: number;
  maxHp: number;
  ac: number;
  level: number;
  stats: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CharacterCreationData) => void;
  isPending?: boolean;
  isJoinLink?: boolean;
  sessionName?: string;
};

type Step = "names" | "race" | "class" | "stats" | "review";
const STEPS: Step[] = ["names", "race", "class", "stats", "review"];

export default function CharacterCreationDialog({ open, onOpenChange, onSubmit, isPending, isJoinLink, sessionName }: Props) {
  const [step, setStep] = useState<Step>("names");
  const [playerName, setPlayerName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Partial<Record<StatKey, number>>>({});
  const [draggingValue, setDraggingValue] = useState<number | null>(null);

  const race = RACES.find(r => r.value === selectedRace) ?? null;
  const cls = CLASSES.find(c => c.value === selectedClass) ?? null;

  const finalStats = useMemo((): Record<StatKey, number> => {
    const base: Record<StatKey, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    for (const key of STAT_KEYS) {
      const assigned = assignments[key];
      if (assigned !== undefined) base[key] = assigned;
      if (race?.bonuses[key]) base[key] = (base[key] ?? 10) + (race.bonuses[key] ?? 0);
    }
    return base;
  }, [assignments, race]);

  const conMod = abilityMod(finalStats.con);
  const wisMod = abilityMod(finalStats.wis);
  const dexMod = abilityMod(finalStats.dex);

  const calcHp = useMemo(() => {
    if (!cls) return 10;
    return Math.max(1, cls.hitDie + conMod);
  }, [cls, conMod]);

  const calcAc = useMemo(() => {
    if (!cls) return 10;
    if (cls.value === "野蠻人") return 10 + dexMod + conMod;
    if (cls.value === "武僧") return 10 + dexMod + wisMod;
    return cls.defaultAc;
  }, [cls, dexMod, conMod, wisMod]);

  const assignedValues = new Set(Object.values(assignments));
  const unassignedPool = STANDARD_ARRAY.filter(v => !assignedValues.has(v));
  const allAssigned = assignedValues.size === 6 && STANDARD_ARRAY.every(v => assignedValues.has(v));

  const reset = () => {
    setStep("names");
    setPlayerName("");
    setCharacterName("");
    setSelectedRace(null);
    setSelectedClass(null);
    setSelectedBackground(null);
    setAssignments({});
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const canNext = () => {
    if (step === "names") return playerName.trim() !== "" && characterName.trim() !== "";
    if (step === "race") return selectedRace !== null;
    if (step === "class") return selectedClass !== null;
    if (step === "stats") return allAssigned && selectedBackground !== null;
    return true;
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const back = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const handleSubmit = () => {
    if (!race || !cls || !selectedBackground) return;
    const statsObj = {
      ...DEFAULT_STATS,
      ...finalStats,
      hitDice: `1d${cls.hitDie}`,
      speed: race.speed,
    };
    onSubmit({
      name: playerName.trim(),
      characterName: characterName.trim(),
      race: selectedRace!,
      class: selectedClass!,
      background: selectedBackground,
      hp: calcHp,
      maxHp: calcHp,
      ac: calcAc,
      level: 1,
      stats: JSON.stringify(statsObj),
    });
    reset();
  };

  const stepIdx = STEPS.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-serif text-2xl text-primary">
            {isJoinLink ? "加入冒險！" : "創造新角色"}
          </DialogTitle>
          {isJoinLink && sessionName && (
            <DialogDescription className="font-serif text-muted-foreground">
              你的朋友邀請你加入《{sessionName}》。
            </DialogDescription>
          )}

          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn("flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border transition-colors",
                  i < stepIdx ? "bg-primary border-primary text-primary-foreground" :
                  i === stepIdx ? "border-primary text-primary bg-primary/10" :
                  "border-border text-muted-foreground"
                )}>
                  {i < stepIdx ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px transition-colors", i < stepIdx ? "bg-primary" : "bg-border")} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-0.5">
            <span>名字</span><span>種族</span><span>職業</span><span>能力值</span><span>確認</span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6 pb-2">
          <div className="py-4">

            {/* Step 1: Names */}
            {step === "names" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">為你的玩家與角色命名，這將出現在冒險記錄中。</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">玩家暱稱</Label>
                    <Input
                      placeholder="你在現實中的名字"
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      className="bg-background"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">角色名稱</Label>
                    <Input
                      placeholder="你的冒險者名稱"
                      value={characterName}
                      onChange={e => setCharacterName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Race */}
            {step === "race" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">選擇你的種族，每個種族賦予不同的天賦與加成。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RACES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setSelectedRace(r.value)}
                      className={cn(
                        "text-left rounded-lg border-2 p-3 transition-all",
                        r.color,
                        selectedRace === r.value ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="font-serif text-base text-foreground">{r.label}</span>
                          <span className="text-muted-foreground text-xs ml-2">{r.subtitle}</span>
                        </div>
                        {selectedRace === r.value && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.traits.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 text-muted-foreground border border-border/50">{t}</span>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">速度 {r.speed}尺</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Class */}
            {step === "class" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">選擇你的職業，決定你的戰鬥風格與特殊能力。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CLASSES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setSelectedClass(c.value)}
                      className={cn(
                        "text-left rounded-lg border-2 p-3 transition-all",
                        c.color,
                        selectedClass === c.value ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-primary/80">{c.icon}</span>
                          <div>
                            <span className="font-serif text-base text-foreground">{c.label}</span>
                            <span className="text-muted-foreground text-xs ml-2">{c.subtitle}</span>
                          </div>
                        </div>
                        {selectedClass === c.value && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">{c.description}</p>
                      <div className="flex gap-2 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50 text-muted-foreground">骰 d{c.hitDie}</span>
                        <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/50 text-muted-foreground">預設AC {c.defaultAc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Stats & Background */}
            {step === "stats" && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    使用標準陣列 <span className="text-foreground font-mono">[15, 14, 13, 12, 10, 8]</span> 分配六項能力值。
                    {race && <span className="text-primary"> 種族加成已包含在最終值中。</span>}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-background border border-border">
                    <span className="text-xs text-muted-foreground self-center">未分配：</span>
                    {STANDARD_ARRAY.map(v => {
                      const alreadyAssigned = assignedValues.has(v);
                      const isThisUsed = alreadyAssigned;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={isThisUsed}
                          onClick={() => setDraggingValue(draggingValue === v ? null : v)}
                          className={cn(
                            "w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all",
                            isThisUsed ? "opacity-30 cursor-not-allowed border-border text-muted-foreground" :
                            draggingValue === v ? "border-primary bg-primary/20 text-primary ring-2 ring-primary" :
                            "border-border bg-card text-foreground hover:border-primary/60"
                          )}
                        >
                          {v}
                        </button>
                      );
                    })}
                    {draggingValue !== null && (
                      <span className="text-xs text-primary self-center ml-1">← 點擊能力值欄位來分配 {draggingValue}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {STAT_KEYS.map(key => {
                      const assigned = assignments[key];
                      const bonus = race?.bonuses[key] ?? 0;
                      const total = (assigned ?? 10) + bonus;
                      const mod = abilityMod(total);
                      const isPrimary = cls?.primaryStats.includes(key) ?? false;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (draggingValue !== null) {
                              setAssignments(prev => {
                                const next = { ...prev };
                                const oldValue = prev[key];
                                if (oldValue !== undefined) {
                                  // Swap: don't remove old, let it go back to pool
                                }
                                next[key] = draggingValue;
                                return next;
                              });
                              setDraggingValue(null);
                            } else if (assigned !== undefined) {
                              setAssignments(prev => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                            }
                          }}
                          className={cn(
                            "rounded-lg border-2 p-2.5 text-center transition-all",
                            isPrimary ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                            draggingValue !== null ? "hover:border-primary hover:bg-primary/10 cursor-pointer" : "",
                            assigned !== undefined ? "cursor-pointer" : draggingValue !== null ? "cursor-pointer" : "cursor-default"
                          )}
                        >
                          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{STAT_LABELS[key]}</div>
                          <div className={cn("text-2xl font-bold tabular-nums mt-0.5", assigned !== undefined ? "text-foreground" : "text-muted-foreground/40")}>
                            {assigned !== undefined ? total : "—"}
                          </div>
                          {assigned !== undefined ? (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{modStr(mod)}</span>
                              {bonus !== 0 && <span className="text-primary ml-1 text-[9px]">(+{bonus}種)</span>}
                            </div>
                          ) : (
                            <div className="text-[9px] text-muted-foreground/40">點擊分配</div>
                          )}
                          {isPrimary && <div className="text-[9px] text-primary mt-0.5">主要屬性</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">背景</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BACKGROUNDS.map(bg => (
                      <button
                        key={bg.value}
                        type="button"
                        onClick={() => setSelectedBackground(bg.value)}
                        className={cn(
                          "text-left rounded-lg border-2 p-2.5 transition-all border-border bg-card hover:border-primary/50",
                          selectedBackground === bg.value ? "border-primary bg-primary/5 ring-1 ring-primary ring-offset-0" : ""
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-serif text-foreground">{bg.label}</span>
                          {selectedBackground === bg.value && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{bg.description}</p>
                        <div className="flex gap-1 mt-1">
                          {bg.skillProfs.map(s => (
                            <span key={s} className="text-[9px] px-1 py-0.5 rounded bg-background border border-border text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {step === "review" && race && cls && selectedBackground && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">確認你的角色資訊，創建後將儲存至資料庫。</p>

                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-2xl font-serif text-primary">{characterName}</div>
                      <div className="text-sm text-muted-foreground">玩家：{playerName}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-primary border-primary/50 text-xs">{race.label} {cls.label}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">1級 ／ {BACKGROUNDS.find(b => b.value === selectedBackground)?.label}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-red-950/40 border border-red-800/40 p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">HP</div>
                      <div className="text-xl font-bold text-red-400">{calcHp}</div>
                    </div>
                    <div className="rounded-lg bg-blue-950/40 border border-blue-800/40 p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">AC</div>
                      <div className="text-xl font-bold text-blue-400">{calcAc}</div>
                    </div>
                    <div className="rounded-lg bg-amber-950/40 border border-amber-800/40 p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">速度</div>
                      <div className="text-xl font-bold text-amber-400">{race.speed}尺</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5">
                    {STAT_KEYS.map(key => (
                      <div key={key} className="rounded bg-background border border-border p-1.5 text-center">
                        <div className="text-[9px] font-mono text-muted-foreground uppercase">{STAT_LABELS[key].slice(0, 2)}</div>
                        <div className="text-base font-bold text-foreground">{finalStats[key]}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">{modStr(abilityMod(finalStats[key]))}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">種族特性</div>
                    <div className="flex flex-wrap gap-1">
                      {race.traits.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/50 text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="text-[10px]">骰型 d{cls.hitDie}</span>
                    <span className="text-border">·</span>
                    <span className="text-[10px]">熟練加值 +2</span>
                    <span className="text-border">·</span>
                    <span className="text-[10px]">豁免：{cls.savingThrows.map(k => STAT_LABELS[k]).join("、")}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={step === "names"}
            className="text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />返回
          </Button>

          {step !== "review" ? (
            <Button
              type="button"
              onClick={next}
              disabled={!canNext()}
              className="min-w-[100px]"
            >
              下一步<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="min-w-[120px] bg-primary text-primary-foreground"
            >
              {isPending ? "建立中..." : "✦ 踏上冒險"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
