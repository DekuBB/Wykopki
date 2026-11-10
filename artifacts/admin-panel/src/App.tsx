import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Assortment from "@/pages/assortment";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import Orders from "@/pages/orders";
import Tools from "@/pages/tools";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "unauth" | "denied">("loading");
  const [, navigate] = useLocation();

  const checkAuth = async () => {
    try {
      const app = (window as typeof window & { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } }).Telegram?.WebApp;
      const telegramMode = new URLSearchParams(window.location.search).has("telegram-admin") || !!app?.initData;
      if (telegramMode) {
        if (!app?.initData) { setStatus("denied"); return; }
        app.ready(); app.expand();
        const login = await fetch("/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: app.initData }), signal: AbortSignal.timeout(15000) });
        setStatus(login.ok ? "ok" : "denied"); return;
      }
      const res = await fetch("/api/auth/me", { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        setStatus("ok");
      } else {
        setStatus("unauth");
      }
    } catch {
      setStatus("unauth");
    }
  };

  useEffect(() => {
    void checkAuth();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "denied") return <div className="min-h-screen flex items-center justify-center p-6 bg-background text-center"><p role="alert">To konto Telegram nie ma dostępu do panelu administratora. Otwórz panel z konta administratora w prywatnej rozmowie z botem.</p></div>;
  if (status === "unauth") {
    return <Login onLogin={() => setStatus("ok")} />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/assortment" component={Assortment} />
        <Route path="/orders" component={Orders} />
        <Route path="/tools" component={Tools} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
