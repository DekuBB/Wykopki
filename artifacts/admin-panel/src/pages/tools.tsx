import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Plus, Trash2, ToggleLeft, ToggleRight, Megaphone, Ticket, RefreshCw } from "lucide-react";

interface Coupon {
  id: number;
  code: string;
  valuePln: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

function CouponManager() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [adding, setAdding] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coupons");
      const data = (await res.json()) as Coupon[];
      setCoupons(data);
    } catch {
      toast({ title: "Blad ladowania kuponow", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCoupons(); }, []);

  const handleAdd = async () => {
    if (!code.trim() || !value.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), valuePln: parseFloat(value), maxUses: parseInt(maxUses) || 1 }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Blad");
      }
      setCode(""); setValue(""); setMaxUses("1");
      toast({ title: "Kupon dodany" });
      await fetchCoupons();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Blad", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await fetch(`/api/coupons/${id}/toggle`, { method: "PATCH" });
      await fetchCoupons();
    } catch {
      toast({ title: "Blad", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/coupons/${id}`, { method: "DELETE" });
      await fetchCoupons();
    } catch {
      toast({ title: "Blad", variant: "destructive" });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="w-4 h-4" /> Kupony
        </CardTitle>
        <CardDescription>Dodawaj kody promocyjne z wartoscia PLN</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Kod</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PROMO2026" className="h-8 text-xs font-mono uppercase" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Wartosc (PLN)</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="10.00" type="number" step="0.01" min="0.01" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Maks. uzyc</Label>
            <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="1" type="number" min="1" className="h-8 text-xs" />
          </div>
        </div>
        <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={handleAdd} disabled={adding || !code.trim() || !value.trim()}>
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Dodaj kupon
        </Button>

        <div className="border-t border-border pt-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : coupons.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Brak kuponow</p>
          ) : (
            <div className="space-y-2">
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-secondary/30 rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-bold">{c.code}</code>
                      <Badge variant={c.isActive ? "default" : "secondary"} className="text-xs h-4 px-1">
                        {c.isActive ? "Aktywny" : "Nieaktywny"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.valuePln.toFixed(2)} PLN · {c.usedCount}/{c.maxUses} uzyc
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggle(c.id)}>
                      {c.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-400" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BroadcastPanel() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), parseMode: "HTML" }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Blad");
      }
      const data = (await res.json()) as { sent: number; failed: number; total: number };
      setResult(data);
      toast({ title: `Wyslano do ${data.sent} z ${data.total} uzytkownikow` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Blad wysylania", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="w-4 h-4" /> Broadcast
        </CardTitle>
        <CardDescription>Wyslij wiadomosc do wszystkich uzytkownikow bota. Obsluguje HTML: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;code&gt;kod&lt;/code&gt;</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Tresc wiadomosci</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Wpisz tresc wiadomosci. Mozesz uzyc HTML: &lt;b&gt;pogrubienie&lt;/b&gt;, &lt;i&gt;kursywa&lt;/i&gt;"
            className="min-h-[120px] text-sm font-mono resize-none"
          />
          <p className="text-xs text-muted-foreground">{message.length}/4000 znakow</p>
        </div>

        {result && (
          <div className="bg-secondary/30 rounded-md p-3 text-xs space-y-1">
            <div className="text-green-400 font-medium">Broadcast zakonczony</div>
            <div className="text-muted-foreground">Wyslano: <span className="text-foreground">{result.sent}</span></div>
            <div className="text-muted-foreground">Nieudane: <span className={result.failed > 0 ? "text-destructive" : "text-foreground"}>{result.failed}</span></div>
            <div className="text-muted-foreground">Lacznie uzytkownikow: <span className="text-foreground">{result.total}</span></div>
          </div>
        )}

        <Button
          className="w-full gap-2"
          onClick={handleSend}
          disabled={sending || !message.trim()}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Wysylanie..." : "Wyslij do wszystkich"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Tools() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Narzedzia</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Broadcast, kupony promocyjne i inne narzedzia administracyjne
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <BroadcastPanel />
        <CouponManager />
      </div>
    </div>
  );
}
