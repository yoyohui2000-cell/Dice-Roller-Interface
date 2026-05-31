import React, { useState } from "react";
import { Link } from "wouter";
import { useListCampaignSessions, useCreateCampaignSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Hub() {
  const { data: sessions, isLoading, refetch } = useListCampaignSessions();
  const createSession = useCreateCampaignSession();
  
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [worldDescription, setWorldDescription] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    createSession.mutate(
      { data: { name, worldDescription } },
      {
        onSuccess: () => {
          setIsOpen(false);
          setName("");
          setWorldDescription("");
          refetch();
        }
      }
    );
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-8 sm:mb-12 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-serif text-primary flex items-center gap-3">
            <ScrollText className="w-7 h-7 sm:w-10 sm:h-10" />
            冒險大廳
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 font-serif text-base sm:text-lg">古老的羊皮紙上，記載著未完的故事...</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="font-serif text-base sm:text-lg px-4 sm:px-6 h-10 sm:h-12 self-start sm:self-auto">
              <Plus className="w-5 h-5 mr-2" />
              開啟新局
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">創造新冒險</DialogTitle>
              <DialogDescription>
                設定你的新戰役。準備好進入未知的世界了嗎？
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">戰役名稱</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="例如：龍與地下城：失落的礦坑"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="world">世界觀描述 (選填)</Label>
                <Textarea 
                  id="world" 
                  value={worldDescription} 
                  onChange={e => setWorldDescription(e.target.value)} 
                  placeholder="描述這個世界的背景、當前的情勢..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createSession.isPending}>
                  {createSession.isPending ? "創造中..." : "確認創造"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full rounded-md bg-card/50" />
            <Skeleton className="h-48 w-full rounded-md bg-card/50" />
            <Skeleton className="h-48 w-full rounded-md bg-card/50" />
          </>
        ) : sessions?.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground border border-dashed border-border rounded-lg bg-card/20 font-serif text-xl">
            目前沒有進行中的冒險，點擊右上角開啟新局。
          </div>
        ) : (
          sessions?.map(session => (
            <Link key={session.id} href={`/session/${session.id}`} className="block transition-transform hover:scale-[1.02]">
              <Card className="h-full hover:border-primary/50 transition-colors bg-card cursor-pointer border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-serif text-primary">{session.name}</CardTitle>
                  <CardDescription className="text-secondary-foreground font-serif mt-1">階段: {session.phase}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {session.worldState || "迷霧籠罩的世界..."}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
