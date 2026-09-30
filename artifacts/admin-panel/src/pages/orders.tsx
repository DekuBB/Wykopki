import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, ImagePlus, Send, RefreshCw, Clock } from "lucide-react";

interface Order {
  id: number;
  telegramId: string;
  productName: string;
  cityName: string;
  districtName: string;
  amountPln: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  fulfillmentGps: string | null;
  fulfillmentNote: string | null;
  fulfillmentPhotoPath: string | null;
  fulfilledAt: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "fulfilled") {
    return <Badge className="bg-green-600 text-white text-xs">Zrealizowane</Badge>;
  }
  return <Badge variant="secondary" className="text-xs bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Oczekuje</Badge>;
}

function FulfillDialog({
  order,
  onClose,
  onFulfilled,
}: {
  order: Order;
  onClose: () => void;
  onFulfilled: () => void;
}) {
  const { toast } = useToast();
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [note, setNote] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/fulfill-upload-url`);
      if (!res.ok) throw new Error("Upload URL error");
      const { uploadUrl, objectPath } = (await res.json()) as { uploadUrl: string; objectPath: string };

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");

      setPhotoPath(objectPath);
      toast({ title: "Zdjecie przesłane" });
    } catch {
      toast({ title: "Blad przesylania zdjecia", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const gps =
        lat.trim() && lng.trim()
          ? JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng) })
          : undefined;

      const res = await fetch(`/api/orders/${order.id}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentGps: gps,
          fulfillmentNote: note.trim() || undefined,
          fulfillmentPhotoPath: photoPath || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Blad");
      }
      toast({ title: `Zamowienie #${order.id} zrealizowane! Klient zostal powiadomiony.` });
      onFulfilled();
      onClose();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Blad realizacji", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md dark bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Realizuj zamowienie #{order.id}
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 rounded-md p-3">
          <div><span className="text-foreground font-medium">Produkt:</span> {order.productName}</div>
          <div><span className="text-foreground font-medium">Miasto / Dzielnica:</span> {order.cityName} / {order.districtName}</div>
          <div><span className="text-foreground font-medium">Telegram ID:</span> {order.telegramId}</div>
          <div><span className="text-foreground font-medium">Kwota:</span> {order.amountPln.toFixed(2)} PLN</div>
          <div><span className="text-foreground font-medium">Platnosc:</span> {order.paymentStatus === "paid" ? "Oplacona" : "Nieoplacona"} ({order.paymentMethod})</div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Wspolrzedne GPS skrytki
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Szerokosc (lat)"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                placeholder="Dlugosc (lng)"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <ImagePlus className="w-3 h-3" /> Zdjecie skrytki
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <ImagePlus className="w-3 h-3 mr-1" />
                )}
                {uploading ? "Wysylanie..." : "Wybierz zdjecie"}
              </Button>
              {photoPath && (
                <span className="text-xs text-green-400">Przeslane</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Wiadomosc dla klienta (opcjonalnie)</Label>
            <Textarea
              placeholder="Np. skrytka pod trzecia lawka od wejscia..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Anuluj
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || (!lat.trim() && !photoPath && !note.trim())}
            className="text-xs gap-1"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {sending ? "Wysylanie..." : "Wyslij do klienta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Orders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fulfillOrder, setFulfillOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "fulfilled">("pending");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Blad pobierania zamowien");
      const data = (await res.json()) as Order[];
      setOrders(data);
    } catch {
      toast({ title: "Blad ladowania zamowien", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  const filtered = orders.filter((o) =>
    filter === "all" ? true : o.status === filter
  );

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Zamowienia</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realizuj zamowienia — wyslij lokalizacje i zdjecie skrytki do klienta
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 text-xs">
              {pendingCount} oczekuje
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading} className="h-8 text-xs gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Odswiez
          </Button>
        </div>
      </div>

      <div className="flex gap-1">
        {(["pending", "all", "fulfilled"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setFilter(f)}
          >
            {f === "pending" ? "Oczekujace" : f === "fulfilled" ? "Zrealizowane" : "Wszystkie"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {filter === "pending" ? "Brak oczekujacych zamowien" : "Brak zamowien"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <Card key={order.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">#{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="font-medium text-foreground">{order.productName}</div>
                      <div>{order.cityName} / {order.districtName}</div>
                      <div>ID klienta: {order.telegramId}</div>
                      <div>{order.amountPln.toFixed(2)} PLN · {order.paymentMethod}</div>
                      <div className="flex items-center gap-1 text-muted-foreground/70">
                        <Clock className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleString("pl-PL")}
                      </div>
                    </div>
                  </div>
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      className="text-xs shrink-0 gap-1 bg-primary"
                      onClick={() => setFulfillOrder(order)}
                    >
                      <Send className="w-3 h-3" />
                      Realizuj
                    </Button>
                  )}
                  {order.status === "fulfilled" && order.fulfilledAt && (
                    <div className="text-xs text-muted-foreground/70 shrink-0 text-right">
                      <div className="text-green-400">Wyslano</div>
                      <div>{new Date(order.fulfilledAt).toLocaleString("pl-PL")}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {fulfillOrder && (
        <FulfillDialog
          order={fulfillOrder}
          onClose={() => setFulfillOrder(null)}
          onFulfilled={fetchOrders}
        />
      )}
    </div>
  );
}
