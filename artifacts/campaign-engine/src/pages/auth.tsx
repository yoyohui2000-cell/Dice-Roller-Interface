import { useState } from "react";
import { ScrollText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type Mode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL || "/"}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
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
            {mode !== "forgot" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center gap-2 font-medium"
                  onClick={handleGoogle}
                  disabled={googleLoading || loading}
                >
                  <GoogleIcon />
                  {googleLoading ? "跳轉中..." : "用 Google 登入"}
                </Button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs text-muted-foreground">
                    <span className="bg-card px-2">或使用電子信箱</span>
                  </div>
                </div>
              </>
            )}
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
