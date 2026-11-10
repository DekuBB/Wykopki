import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
export type Category = { id: number; name: string; emoji: string | null; isActive: boolean };
export function Categories() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data = [], isError } = useQuery<Category[]>({ queryKey: ["/api/categories"], queryFn: async () => { const res = await fetch("/api/categories"); if (!res.ok) throw new Error(); return res.json(); } });
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/categories${editing ? `/${editing}` : ""}`, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), emoji, isActive: active }) });
      if (!res.ok) throw new Error();
      await qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditing(null); setName(""); setEmoji(""); setActive(true);
      toast({ title: "Kategoria zapisana" });
    } catch { toast({ title: "Nie udało się zapisać kategorii. Sprawdź, czy nazwa już istnieje.", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/categories/${editing}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await qc.invalidateQueries({ queryKey: ["/api/categories"] });
      await qc.invalidateQueries({ queryKey: ["/api/products"] });
      setEditing(null); setName(""); setEmoji(""); setActive(true);
      toast({ title: "Kategoria usunięta. Produkty pozostały w asortymencie." });
    } catch { toast({ title: "Nie udało się usunąć kategorii", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>Kategorie produktów</CardTitle></CardHeader><CardContent className="space-y-4">
    {isError && <p role="alert">Nie udało się pobrać kategorii.</p>}
    <div className="flex flex-wrap gap-2">{data.map(c => <Button key={c.id} variant="outline" className="min-h-11" onClick={() => { setEditing(c.id); setName(c.name); setEmoji(c.emoji ?? ""); setActive(c.isActive); }}>{c.emoji} {c.name}{!c.isActive ? " · nieaktywna" : ""} · Edytuj</Button>)}</div>
    {!data.length && !isError && <p className="text-sm text-muted-foreground">Dodaj pierwszą kategorię, a następnie przypisz ją w edycji produktu.</p>}
    <form onSubmit={e => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-[1fr_100px_auto]">
      <div className="space-y-1"><Label htmlFor="category-name">Nazwa kategorii</Label><Input id="category-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="category-emoji">Emoji</Label><Input id="category-emoji" value={emoji} maxLength={16} onChange={e => setEmoji(e.target.value)} /></div>
      <div className="flex items-center gap-3 self-end min-h-11"><Switch id="category-active" checked={active} onCheckedChange={setActive} /><Label htmlFor="category-active">Aktywna</Label></div>
      <div className="flex flex-wrap gap-2 sm:col-span-3"><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Zapisywanie…" : editing ? "Zapisz zmiany" : "Dodaj kategorię"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setName(""); setEmoji(""); setActive(true); }}>Anuluj edycję</Button>}{editing && <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>Usuń kategorię</Button>}</div>
    </form>
  </CardContent></Card>;
}
