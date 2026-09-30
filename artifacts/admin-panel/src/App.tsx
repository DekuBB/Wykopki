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

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "unauth">("loading");
  const [, navigate] = useLocation();

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
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
