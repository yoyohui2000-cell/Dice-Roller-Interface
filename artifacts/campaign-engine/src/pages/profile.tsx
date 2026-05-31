import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, ArrowLeft, Shield, Heart, Swords, User, BookOpen } from "lucide-react";
import { EditCharacterDialog } from "@/components/edit-character-dialog";

interface CharacterEntry {
  id: number;
  characterName: string;
  name: string;
  race: string;
  class: string;
  background: string;
  hp: number;
  maxHp: number;
  ac: number;
  level: number;
  stats: string;
  avatarDescription?: string | null;
  createdAt: string;
  sessionId: number;
  sessionName: string;
  sessionPhase: string;
}

const CLASS_COLORS: Record<string, string> = {
  "戰士": "bg-red-900/40 border-red-700/50 text-red-300",
  "法師": "bg-blue-900/40 border-blue-700/50 text-blue-300",
  "牧師": "bg-yellow-900/40 border-yellow-700/50 text-yellow-300",
  "盜賊": "bg-purple-900/40 border-purple-700/50 text-purple-300",
  "遊俠": "bg-green-900/40 border-green-700/50 text-green-300",
  "聖武士": "bg-orange-900/40 border-orange-700/50 text-orange-300",
  "德魯伊": "bg-lime-900/40 border-lime-700/50 text-lime-300",
  "吟遊詩人": "bg-pink-900/40 border-pink-700/50 text-pink-300",
  "野蠻人": "bg-rose-900/40 border-rose-700/50 text-rose-300",
  "術士": "bg-violet-900/40 border-violet-700/50 text-violet-300",
  "魔法使": "bg-cyan-900/40 border-cyan-700/50 text-cyan-300",
  "武僧": "bg-amber-900/40 border-amber-700/50 text-amber-300",
};

const PHASE_LABELS: Record<string, string> = {
  exploration: "探索中",
  combat: "戰鬥中",
  rest: "休息中",
};

function statMod(v: number) {
  const m = Math.floor((v - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function CharacterCard({ char, queryKey }: { char: CharacterEntry; queryKey: unknown[] }) {
  let parsedStats: Record<string, number> = {};
  try { parsedStats = JSON.parse(char.stats); } catch {}

  const statKeys = [
    { key: "str", label: "力量" },
    { key: "dex", label: "敏捷" },
    { key: "con", label: "體質" },
    { key: "int", label: "智力" },
    { key: "wis", label: "感知" },
    { key: "cha", label: "魅力" },
  ];
  const hasStats = statKeys.some(s => parsedStats[s.key] !== undefined);

  const classStyle = Object.entries(CLASS_COLORS).find(([k]) =>
    char.class.includes(k)
  )?.[1] ?? "bg-card border-border text-muted-foreground";

  const hpPct = Math.max(0, Math.min(100, (char.hp / char.maxHp) * 100));
  const hpColor = hpPct > 60 ? "bg-green-500" : hpPct > 30 ? "bg-yellow-500" : "bg-red-500";

  const initials = char.characterName.slice(0, 2);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors flex flex-col">
      <div className="p-5 flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-serif text-lg font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h3 className="font-serif text-xl text-primary truncate">{char.characterName}</h3>
              <EditCharacterDialog
                player={{ id: char.id, characterName: char.characterName, avatarDescription: char.avatarDescription }}
                invalidateKeys={[queryKey]}
                triggerClassName="h-6 w-6 text-muted-foreground/50 hover:text-primary flex-shrink-0"
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">玩家：{char.name}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-muted-foreground">等級</div>
            <div className="text-2xl font-serif text-primary font-bold">{char.level}</div>
          </div>
        </div>

        {/* Avatar description */}
        {char.avatarDescription && (
          <div className="bg-muted/20 rounded-lg px-3 py-2.5 border border-border/50 flex gap-2">
            <BookOpen className="w-3.5 h-3.5 text-primary/50 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {char.avatarDescription}
            </p>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${classStyle}`}>{char.class}</span>
          <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">{char.race}</span>
          <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">{char.background}</span>
        </div>

        {/* HP bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />生命值</span>
            <span className="text-foreground font-mono">{char.hp} / {char.maxHp}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${hpColor} rounded-full transition-all`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        {/* AC */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>護甲值</span>
            <span className="text-foreground font-mono ml-1">{char.ac}</span>
          </div>
        </div>

        {/* Stats */}
        {hasStats && (
          <div className="grid grid-cols-6 gap-1">
            {statKeys.map(({ key, label }) => (
              <div key={key} className="text-center bg-muted/30 rounded p-1.5">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="text-xs font-mono text-foreground font-semibold">
                  {parsedStats[key] !== undefined ? statMod(parsedStats[key]) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign footer */}
      <Link href={`/session/${char.sessionId}`}>
        <div className="border-t border-border px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Swords className="w-3 h-3" />
              <span>戰役</span>
            </div>
            <div className="text-sm text-foreground font-serif truncate">{char.sessionName}</div>
          </div>
          <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
            {PHASE_LABELS[char.sessionPhase] ?? char.sessionPhase}
          </Badge>
        </div>
      </Link>
    </div>
  );
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();

  const queryKey = ["my-characters", user?.id];
  const { data: characters, isLoading } = useQuery<CharacterEntry[]>({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch(`/api/campaign/my-characters?userId=${encodeURIComponent(user!.id)}`);
      if (!res.ok) throw new Error("Failed to load characters");
      return res.json();
    },
  });

  const initials = (user?.name ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              大廳
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-serif text-lg text-primary font-bold">
              {initials}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif text-primary flex items-center gap-2">
                <User className="w-5 h-5" />
                我的角色
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[220px]">{user?.name}</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={signOut} className="text-muted-foreground">
          登出
        </Button>
      </div>

      {/* Stats summary */}
      {!isLoading && characters && (
        <div className="flex items-center gap-6 mb-8">
          <div className="text-center">
            <div className="text-3xl font-serif text-primary font-bold">{characters.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">角色總數</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-serif text-primary font-bold">
              {new Set(characters.map(c => c.sessionId)).size}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">參與戰役</div>
          </div>
          {characters.length > 0 && (
            <div className="text-center">
              <div className="text-3xl font-serif text-primary font-bold">
                {Math.max(...characters.map(c => c.level))}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">最高等級</div>
            </div>
          )}
        </div>
      )}

      {/* Character grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-80 rounded-xl bg-card/50" />)}
        </div>
      ) : !characters || characters.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border rounded-xl bg-card/20">
          <ScrollText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="font-serif text-xl text-muted-foreground">你還沒有任何角色</p>
          <p className="text-sm text-muted-foreground/60 mt-2 mb-6">進入一場戰役並創建你的第一個角色吧！</p>
          <Link href="/">
            <Button variant="outline" className="font-serif">前往冒險大廳</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map(char => (
            <CharacterCard key={char.id} char={char} queryKey={queryKey} />
          ))}
        </div>
      )}
    </div>
  );
}
