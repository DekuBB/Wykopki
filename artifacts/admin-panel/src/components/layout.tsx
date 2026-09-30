import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Users, Package, Settings as SettingsIcon, CheckCircle2, AlertCircle, LogOut, ShoppingBag, Wrench } from "lucide-react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: health, isError } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 } });
  const { toast } = useToast();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/users", label: "Users", icon: Users },
    { href: "/assortment", label: "Assortment", icon: Package },
    { href: "/orders", label: "Zamowienia", icon: ShoppingBag },
    { href: "/tools", label: "Narzedzia", icon: Wrench },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } catch {
      toast({ title: "Blad wylogowania", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-background dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold tracking-wider uppercase text-sm">
            <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
            Control Panel
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                  ${isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"}
                `}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            {isError ? (
               <AlertCircle className="w-4 h-4 text-destructive" />
            ) : health?.status === "ok" ? (
               <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
               <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
            )}
            {isError ? "System Offline" : health?.status === "ok" ? "System Normal" : "Connecting..."}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5" />
            Wyloguj
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Nav Header */}
        <header className="h-14 md:hidden border-b border-border flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-2 text-primary font-bold tracking-wider uppercase text-sm">
            <div className="w-3 h-3 rounded-full bg-primary" />
            Control
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              {isError ? (
                 <AlertCircle className="w-4 h-4 text-destructive" />
              ) : health?.status === "ok" ? (
                 <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : null}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
