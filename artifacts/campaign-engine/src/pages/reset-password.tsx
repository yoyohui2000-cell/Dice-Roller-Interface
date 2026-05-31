import { useState } from "react";
import { ScrollText, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const { clearRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    if (password.length < 6) {
      setError("密碼至少需要 6 個字元");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setDone(true);
        setTimeout(() => clearRecovery(), 2000);
      }
    } finally {
      setLoading(false);
    }
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
            <CardTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <KeyRound className="w-6 h-6" />
              設定新密碼
            </CardTitle>
            <CardDescription>請輸入您的新密碼</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-green-400 text-lg font-serif">✓ 密碼已成功更新！</div>
                <div className="text-sm text-muted-foreground">正在返回冒險大廳...</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">新密碼</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="至少 6 個字元"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">確認新密碼</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="再次輸入新密碼"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full font-serif text-base" disabled={loading}>
                  {loading ? "更新中..." : "確認更新密碼"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
