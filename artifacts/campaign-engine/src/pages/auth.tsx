import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AuthPage() {
  const handleLogin = () => {
    window.location.href = "/api/replauth/login?redirect_url=" + encodeURIComponent(window.location.href);
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
            <CardTitle className="font-serif text-2xl text-primary">踏入大廳</CardTitle>
            <CardDescription>登入後開始您的 D&D 冒險旅程</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              className="w-full font-serif text-base"
              onClick={handleLogin}
            >
              登入
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
