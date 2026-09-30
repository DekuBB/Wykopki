import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCities, useCreateCity, useUpdateCity, useDeleteCity, getListCitiesQueryKey,
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey,
  useListDistricts, useCreateDistrict, useUpdateDistrict, useDeleteDistrict, getListDistrictsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Loader2, Upload, Image, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";

type City = { id: number; name: string; emoji: string | null; isActive: boolean };
type Product = { id: number; cityId: number; name: string; emoji: string | null; pricePln: number; weightGrams: number | null; isActive: boolean };
type District = { id: number; cityId: number; name: string; isActive: boolean };
type ProductPhoto = { id: number; productId: number; objectPath: string; caption: string | null; servingUrl: string; createdAt: string };

// ─── Photo Manager (inside product dialog) ──────────────────────────────────
function PhotoManager({ productId }: { productId: number }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ProductPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadPhotos = async () => {
    if (loaded) return;
    setLoadingPhotos(true);
    try {
      const res = await fetch(`/api/product-photos/${productId}`);
      const data = await res.json() as ProductPhoto[];
      setPhotos(data);
      setLoaded(true);
    } catch {
      toast({ title: "Blad ladowania zdjec", variant: "destructive" });
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Auto-load when mounted
  useState(() => { void loadPhotos(); });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      // Step 1: get presigned URL
      const urlRes = await fetch("/api/product-photos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

      // Step 2: upload directly to GCS
      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // Step 3: register in DB
      const photoRes = await fetch("/api/product-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, objectPath, caption: caption || undefined }),
      });
      const newPhoto = await photoRes.json() as ProductPhoto;
      setPhotos(prev => [...prev, newPhoto]);
      setCaption("");
      toast({ title: "Zdjecie dodane" });
    } catch {
      toast({ title: "Blad przesylania zdjecia", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (photoId: number) => {
    try {
      await fetch(`/api/product-photos/${photoId}`, { method: "DELETE" });
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast({ title: "Zdjecie usuniete" });
    } catch {
      toast({ title: "Blad usuwania", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium">Zdjecia produktu</p>
      <p className="text-xs text-muted-foreground">
        Po zakupie klient automatycznie otrzymuje wszystkie zdjecia przypisane do tego produktu.
      </p>

      {loadingPhotos && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ladowanie...
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-md overflow-hidden border border-border bg-background">
              <img
                src={photo.servingUrl}
                alt={photo.caption ?? "Zdjecie produktu"}
                className="w-full h-24 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-size='12'%3EBlad%3C/text%3E%3C/svg%3E"; }}
              />
              {photo.caption && (
                <p className="text-xs text-muted-foreground truncate px-1.5 py-0.5 bg-black/60 absolute bottom-0 w-full">{photo.caption}</p>
              )}
              <button
                onClick={() => void handleDelete(photo.id)}
                className="absolute top-1 right-1 h-5 w-5 rounded-sm bg-destructive/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !loadingPhotos && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Image className="h-3.5 w-3.5" /> Brak zdjec — dodaj pierwsze
        </div>
      )}

      <div className="space-y-2">
        <Input
          placeholder="Podpis zdjecia (opcjonalnie)"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          className="h-8 text-xs bg-background border-border"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2 border-dashed border-border"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Przesylanie..." : "Dodaj zdjecie"}
        </Button>
      </div>
    </div>
  );
}

// ─── City Dialog ────────────────────────────────────────────────────────────
function CityDialog({ open, onClose, city }: { open: boolean; onClose: () => void; city?: City }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateCity();
  const update = useUpdateCity();
  const [name, setName] = useState(city?.name ?? "");
  const [emoji, setEmoji] = useState(city?.emoji ?? "");
  const [isActive, setIsActive] = useState(city?.isActive ?? true);

  const isEditing = !!city;
  const pending = create.isPending || update.isPending;

  const reset = () => { setName(""); setEmoji(""); setIsActive(true); };

  const handleSave = async () => {
    if (!name.trim()) return toast({ title: "Nazwa jest wymagana", variant: "destructive" });
    try {
      if (isEditing) {
        await update.mutateAsync({ id: city.id, data: { name: name.trim(), emoji: emoji || undefined, isActive } });
      } else {
        await create.mutateAsync({ data: { name: name.trim(), emoji: emoji || undefined, isActive } });
      }
      qc.invalidateQueries({ queryKey: getListCitiesQueryKey() });
      toast({ title: isEditing ? "Miasto zaktualizowane" : "Miasto dodane" });
      reset();
      onClose();
    } catch {
      toast({ title: "Blad zapisu", variant: "destructive" });
    }
    return;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj miasto" : "Dodaj miasto"}</DialogTitle>
          <DialogDescription>Wypelnij dane miasta dostepnego w bocie.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1.5">
              <Label>Nazwa</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. WARSZAWA" />
            </div>
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🏙️" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="city-active" />
            <Label htmlFor="city-active">Aktywne</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Anuluj</Button>
          <Button onClick={handleSave} disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Dialog ──────────────────────────────────────────────────────────
function ProductDialog({ open, onClose, product, cities }: { open: boolean; onClose: () => void; product?: Product; cities: City[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [name, setName] = useState(product?.name ?? "");
  const [emoji, setEmoji] = useState(product?.emoji ?? "");
  const [cityId, setCityId] = useState<string>(product?.cityId ? String(product.cityId) : "");
  const [price, setPrice] = useState(product?.pricePln ? String(product.pricePln) : "");
  const [weight, setWeight] = useState(product?.weightGrams ? String(product.weightGrams) : "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const isEditing = !!product;
  const pending = create.isPending || update.isPending;

  const reset = () => { setName(""); setEmoji(""); setCityId(""); setPrice(""); setWeight(""); setIsActive(true); };

  const handleSave = async () => {
    if (!name.trim()) return toast({ title: "Nazwa jest wymagana", variant: "destructive" });
    if (!cityId) return toast({ title: "Wybierz miasto", variant: "destructive" });
    if (!price || isNaN(Number(price))) return toast({ title: "Podaj poprawna cene", variant: "destructive" });
    try {
      const payload = {
        name: name.trim(),
        emoji: emoji || undefined,
        cityId: Number(cityId),
        pricePln: Number(price),
        weightGrams: weight ? Number(weight) : undefined,
        isActive,
      };
      if (isEditing) {
        await update.mutateAsync({ id: product.id, data: payload });
      } else {
        await create.mutateAsync({ data: payload });
      }
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: isEditing ? "Produkt zaktualizowany" : "Produkt dodany" });
      reset();
      onClose();
    } catch {
      toast({ title: "Blad zapisu", variant: "destructive" });
    }
    return;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj produkt" : "Dodaj produkt"}</DialogTitle>
          <DialogDescription>Uzupelnij dane produktu i przypisz do miasta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1.5">
              <Label>Nazwa</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Kamien" />
            </div>
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="💎" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Miasto</Label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Wybierz miasto..." />
              </SelectTrigger>
              <SelectContent>
                {cities.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.emoji} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cena (PLN)</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="np. 70" />
            </div>
            <div className="space-y-1.5">
              <Label>Waga (g)</Label>
              <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="np. 1" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="product-active" />
            <Label htmlFor="product-active">Aktywny</Label>
          </div>

          {isEditing && <PhotoManager productId={product.id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Anuluj</Button>
          <Button onClick={handleSave} disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── District Dialog ─────────────────────────────────────────────────────────
function DistrictDialog({ open, onClose, district, cities }: { open: boolean; onClose: () => void; district?: District; cities: City[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateDistrict();
  const update = useUpdateDistrict();
  const [name, setName] = useState(district?.name ?? "");
  const [cityId, setCityId] = useState<string>(district?.cityId ? String(district.cityId) : "");
  const [isActive, setIsActive] = useState(district?.isActive ?? true);

  const isEditing = !!district;
  const pending = create.isPending || update.isPending;

  const reset = () => { setName(""); setCityId(""); setIsActive(true); };

  const handleSave = async () => {
    if (!name.trim()) return toast({ title: "Nazwa jest wymagana", variant: "destructive" });
    if (!cityId) return toast({ title: "Wybierz miasto", variant: "destructive" });
    try {
      const payload = { name: name.trim(), cityId: Number(cityId), isActive };
      if (isEditing) {
        await update.mutateAsync({ id: district.id, data: payload });
      } else {
        await create.mutateAsync({ data: payload });
      }
      qc.invalidateQueries({ queryKey: getListDistrictsQueryKey() });
      toast({ title: isEditing ? "Dzielnica zaktualizowana" : "Dzielnica dodana" });
      reset();
      onClose();
    } catch {
      toast({ title: "Blad zapisu", variant: "destructive" });
    }
    return;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj dzielnice" : "Dodaj dzielnice"}</DialogTitle>
          <DialogDescription>Przypisz dzielnice do wybranego miasta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nazwa dzielnicy</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Srodmiescie" />
          </div>
          <div className="space-y-1.5">
            <Label>Miasto</Label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Wybierz miasto..." />
              </SelectTrigger>
              <SelectContent>
                {cities.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.emoji} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="district-active" />
            <Label htmlFor="district-active">Aktywna</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Anuluj</Button>
          <Button onClick={handleSave} disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ open, onClose, onConfirm, label, pending }: {
  open: boolean; onClose: () => void; onConfirm: () => void; label: string; pending: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunac "{label}"?</AlertDialogTitle>
          <AlertDialogDescription>Tej operacji nie mozna cofnac.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Usun
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Assortment() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: cities = [], isLoading: lCities } = useListCities({ query: { queryKey: getListCitiesQueryKey() } });
  const { data: products = [], isLoading: lProducts } = useListProducts({ query: { queryKey: getListProductsQueryKey() } });
  const { data: districts = [], isLoading: lDistricts } = useListDistricts({ query: { queryKey: getListDistrictsQueryKey() } });

  const deleteCity = useDeleteCity();
  const deleteProduct = useDeleteProduct();
  const deleteDistrict = useDeleteDistrict();

  const [cityDialog, setCityDialog] = useState<{ open: boolean; city?: City }>({ open: false });
  const [productDialog, setProductDialog] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [districtDialog, setDistrictDialog] = useState<{ open: boolean; district?: District }>({ open: false });
  const [deleteState, setDeleteState] = useState<{ type: "city" | "product" | "district"; id: number; label: string } | null>(null);

  const handleDelete = async () => {
    if (!deleteState) return;
    try {
      if (deleteState.type === "city") {
        await deleteCity.mutateAsync({ id: deleteState.id });
        qc.invalidateQueries({ queryKey: getListCitiesQueryKey() });
      } else if (deleteState.type === "product") {
        await deleteProduct.mutateAsync({ id: deleteState.id });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      } else {
        await deleteDistrict.mutateAsync({ id: deleteState.id });
        qc.invalidateQueries({ queryKey: getListDistrictsQueryKey() });
      }
      toast({ title: "Usunieto" });
      setDeleteState(null);
    } catch {
      toast({ title: "Blad usuwania", variant: "destructive" });
    }
  };

  const deletePending = deleteCity.isPending || deleteProduct.isPending || deleteDistrict.isPending;

  if (lCities || lProducts || lDistricts) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Asortyment</h1>
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Asortyment</h1>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="bg-background border border-border">
          <TabsTrigger value="products">Produkty ({products.length})</TabsTrigger>
          <TabsTrigger value="districts">Dzielnice ({districts.length})</TabsTrigger>
          <TabsTrigger value="cities">Miasta ({cities.length})</TabsTrigger>
        </TabsList>

        {/* PRODUCTS */}
        <TabsContent value="products">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Produkty</CardTitle>
                <CardDescription>Kliknij edytuj aby zarzadzac zdjeciami produktu</CardDescription>
              </div>
              <Button className="gap-2" size="sm" onClick={() => setProductDialog({ open: true })}>
                <Plus className="h-4 w-4" />
                Dodaj produkt
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Miasto</TableHead>
                    <TableHead>Cena</TableHead>
                    <TableHead>Waga</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const city = cities.find(c => c.id === p.cityId);
                    return (
                      <TableRow key={p.id} className="border-border">
                        <TableCell className="font-mono text-muted-foreground text-xs">{p.id}</TableCell>
                        <TableCell className="font-medium">
                          <span className="mr-1">{p.emoji}</span>{p.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{city?.name ?? "?"}</TableCell>
                        <TableCell className="font-medium tabular-nums">{formatCurrency(p.pricePln)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.weightGrams != null ? `${p.weightGrams}g` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.isActive ? "default" : "secondary"} className={p.isActive ? "bg-primary/10 text-primary border-primary/20" : ""}>
                            {p.isActive ? "Aktywny" : "Nieaktywny"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => setProductDialog({ open: true, product: p as Product })}>
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteState({ type: "product", id: p.id, label: `${p.emoji} ${p.name} ${p.weightGrams}g` })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!products.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Brak produktow</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISTRICTS */}
        <TabsContent value="districts">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dzielnice</CardTitle>
                <CardDescription>Zarzadzaj obszarami dostawy w miastach</CardDescription>
              </div>
              <Button className="gap-2" size="sm" onClick={() => setDistrictDialog({ open: true })}>
                <Plus className="h-4 w-4" />
                Dodaj dzielnice
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Dzielnica</TableHead>
                    <TableHead>Miasto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districts.map((d) => {
                    const city = cities.find(c => c.id === d.cityId);
                    return (
                      <TableRow key={d.id} className="border-border">
                        <TableCell className="font-mono text-muted-foreground text-xs">{d.id}</TableCell>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{city?.name ?? "?"}</TableCell>
                        <TableCell>
                          <Badge variant={d.isActive ? "default" : "secondary"} className={d.isActive ? "bg-primary/10 text-primary border-primary/20" : ""}>
                            {d.isActive ? "Aktywna" : "Nieaktywna"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => setDistrictDialog({ open: true, district: d as District })}>
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteState({ type: "district", id: d.id, label: d.name })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!districts.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Brak dzielnic</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CITIES */}
        <TabsContent value="cities">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Miasta</CardTitle>
                <CardDescription>Zarzadzaj miastami dostepnymi w bocie</CardDescription>
              </div>
              <Button className="gap-2" size="sm" onClick={() => setCityDialog({ open: true })}>
                <Plus className="h-4 w-4" />
                Dodaj miasto
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Produkty</TableHead>
                    <TableHead>Dzielnice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cities.map((c) => {
                    const cityProducts = products.filter(p => p.cityId === c.id);
                    const cityDistricts = districts.filter(d => d.cityId === c.id);
                    return (
                      <TableRow key={c.id} className="border-border">
                        <TableCell className="font-mono text-muted-foreground text-xs">{c.id}</TableCell>
                        <TableCell className="font-medium"><span className="mr-1">{c.emoji}</span>{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cityProducts.length}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cityDistricts.length}</TableCell>
                        <TableCell>
                          <Badge variant={c.isActive ? "default" : "secondary"} className={c.isActive ? "bg-primary/10 text-primary border-primary/20" : ""}>
                            {c.isActive ? "Aktywne" : "Nieaktywne"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => setCityDialog({ open: true, city: c as City })}>
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteState({ type: "city", id: c.id, label: c.name })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!cities.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Brak miast</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CityDialog open={cityDialog.open} city={cityDialog.city} onClose={() => setCityDialog({ open: false })} />
      <ProductDialog open={productDialog.open} product={productDialog.product} cities={cities as City[]} onClose={() => setProductDialog({ open: false })} />
      <DistrictDialog open={districtDialog.open} district={districtDialog.district} cities={cities as City[]} onClose={() => setDistrictDialog({ open: false })} />
      <DeleteConfirm open={!!deleteState} label={deleteState?.label ?? ""} onClose={() => setDeleteState(null)} onConfirm={handleDelete} pending={deletePending} />
    </div>
  );
}
