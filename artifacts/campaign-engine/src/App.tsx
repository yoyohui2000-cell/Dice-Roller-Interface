import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import { AuthContext, useAuthProvider } from "@/hooks/use-auth";

const Hub = lazy(() => import("@/pages/hub"));
const Session = lazy(() => import("@/pages/session"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="font-serif text-primary text-xl animate-pulse">讀取中...</div>
    </div>
  );
}

function Router() {
  return (
    <div className="dark min-h-screen bg-background text-foreground font-sans">
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Hub} />
            <Route path="/session/:id" component={Session} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider();

  if (auth.loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <div className="font-serif text-primary text-xl animate-pulse">召喚冒險者...</div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="dark min-h-screen bg-background text-foreground font-sans">
        <AuthContext.Provider value={auth}>
          <AuthPage />
        </AuthContext.Provider>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
