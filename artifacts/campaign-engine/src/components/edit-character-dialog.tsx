import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { useUpdatePlayer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EditablePlayer {
  id: number;
  characterName: string;
  avatarDescription?: string | null;
}

interface Props {
  player: EditablePlayer;
  invalidateKeys?: unknown[][];
  triggerClassName?: string;
  onSaved?: (characterName: string, avatarDescription: string) => void;
}

export function EditCharacterDialog({ player, invalidateKeys, triggerClassName, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [characterName, setCharacterName] = useState(player.characterName);
  const [avatarDescription, setAvatarDescription] = useState(player.avatarDescription ?? "");
  const updatePlayer = useUpdatePlayer();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setCharacterName(player.characterName);
      setAvatarDescription(player.avatarDescription ?? "");
    }
  }, [open, player.characterName, player.avatarDescription]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterName.trim()) return;
    updatePlayer.mutate(
      {
        playerId: player.id,
        data: {
          characterName: characterName.trim(),
          avatarDescription: avatarDescription.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
          onSaved?.(characterName.trim(), avatarDescription.trim());
          setOpen(false);
        },
      }
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={triggerClassName ?? "h-7 w-7 text-muted-foreground hover:text-foreground"}
        onClick={() => setOpen(true)}
        title="編輯角色"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">編輯角色</DialogTitle>
            <DialogDescription>更新角色名稱與外觀描述</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="char-name">角色名稱</Label>
              <Input
                id="char-name"
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                placeholder="輸入角色名稱"
                required
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar-desc">
                外觀與個性描述
                <span className="ml-2 text-xs text-muted-foreground font-normal">（選填）</span>
              </Label>
              <Textarea
                id="avatar-desc"
                value={avatarDescription}
                onChange={e => setAvatarDescription(e.target.value)}
                placeholder={"描述角色的外表、服裝、氣質或個性特徵...\n例如：高挑的半精靈女性，銀白長髮，眼神深邃而冷靜，總穿著一件繪有星圖的深藍色法袍。"}
                className="min-h-[130px] resize-none text-sm"
                maxLength={800}
              />
              <p className="text-xs text-muted-foreground text-right">
                {avatarDescription.length} / 800
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={updatePlayer.isPending || !characterName.trim()}>
                {updatePlayer.isPending ? "儲存中..." : "儲存"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
