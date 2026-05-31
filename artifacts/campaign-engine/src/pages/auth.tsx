import { useState } from "react";
import { ScrollText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Mode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
        } else {
          setMessage("確認信已發送！請查看您的信箱，點擊連結後即可登入。");
        }
      } else {
        const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL || "/"}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          setError(error.message);
        } else {
          setMessage("重設密碼連結已發送！請查看您的信箱。");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, string> = {
    login: "踏入大廳",
    signup: "創建冒險者帳號",
    forgot: "重設密碼",
  };

  const descriptions: Record<Mode, string> = {
    login: "使用您的帳號繼續冒險旅程",
    signup: "建立帳號，開始您的 D&D 冒險",
    forgot: "輸入您的信箱，我們將發送重設連結",
  };

  const btnLabels: Record<Mode, string> = {
    login: "登入",
    signup: "註冊",
    forgot: "發送重設連結",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif text-primary flex items-center justify-center gap-3">
            <ScrollText className="w-10 h-10" />
            冒險大廳
          </h1>
          <p className="text-muted-foreground font-serif text-lg">古老的羊皮紙上，記載著未完的故事...</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="font-serif text-2xl text-primary">{titles[mode]}</CardTitle>
            <CardDescription>{descriptions[mode]}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">電子信箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="adventurer@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">密碼</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="至少 6 個字元"
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-sm text-green-400 bg-green-400/10 border border-green-400/30 rounded-md px-3 py-2">
                  {message}
                </div>
              )}

              <Button type="submit" className="w-full font-serif text-base" disabled={loading}>
                {loading ? "處理中..." : btnLabels[mode]}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground space-y-2">
              {mode === "login" && (
                <>
                  <div>
                    還沒有帳號？{" "}
                    <button type="button" onClick={() => reset("signup")} className="text-primary hover:underline font-medium">
                      立即註冊
                    </button>
                  </div>
                  <div>
                    <button type="button" onClick={() => reset("forgot")} className="text-primary/70 hover:underline text-xs">
                      忘記密碼？
                    </button>
                  </div>
                </>
              )}
              {mode === "signup" && (
                <div>
                  已有帳號？{" "}
                  <button type="button" onClick={() => reset("login")} className="text-primary hover:underline font-medium">
                    直接登入
                  </button>
                </div>
              )}
              {mode === "forgot" && (
                <div>
                  <button type="button" onClick={() => reset("login")} className="text-primary hover:underline font-medium">
                    ← 返回登入
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
