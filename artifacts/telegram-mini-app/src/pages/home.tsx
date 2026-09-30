import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LockKeyhole,
  MapPin,
  PackageOpen,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  getGetTelegramMiniAppAccountQueryKey,
  getGetTelegramMiniAppCatalogQueryKey,
  useCreateTelegramMiniAppOrder,
  useGetTelegramMiniAppCatalog,
} from '@workspace/api-client-react';
import type { BotUser, City, District, Order, Product } from '@workspace/api-client-react';

type SessionState = 'checking' | 'outside' | 'authenticated' | 'error';

function money(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
}

function initials(user?: BotUser | null) {
  return (user?.firstName?.slice(0, 1) || user?.username?.slice(0, 1) || 'T').toUpperCase();
}

export default function Home({
  sessionState,
  user,
  sessionError,
}: {
  sessionState: SessionState;
  user: BotUser | null;
  sessionError: string;
}) {
  const queryClient = useQueryClient();
  const catalog = useGetTelegramMiniAppCatalog({
    query: { queryKey: getGetTelegramMiniAppCatalogQueryKey() },
  });
  const orderMutation = useCreateTelegramMiniAppOrder();
  const [cityId, setCityId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const cities = useMemo(() => (catalog.data?.cities ?? []).filter((city) => city.isActive), [catalog.data]);
  const products = useMemo(() => (catalog.data?.products ?? []).filter((product) => product.isActive), [catalog.data]);
  const districts = useMemo(() => (catalog.data?.districts ?? []).filter((district) => district.isActive), [catalog.data]);
  const selectedCity = cities.find((city) => city.id === cityId) ?? null;
  const cityProducts = products.filter((product) => product.cityId === cityId);
  const cityDistricts = districts.filter((district) => district.cityId === cityId);
  const selectedProduct = cityProducts.find((product) => product.id === productId) ?? null;
  const selectedDistrict = cityDistricts.find((district) => district.id === districtId) ?? null;
  const canOrder = sessionState === 'authenticated' && Boolean(selectedProduct && selectedDistrict && user);
  const hasBalance = Boolean(user && selectedProduct && user.balance >= selectedProduct.pricePln);

  useEffect(() => {
    if (!cityId && cities[0]) setCityId(cities[0].id);
  }, [cityId, cities]);

  useEffect(() => {
    if (productId && !cityProducts.some((product) => product.id === productId)) setProductId(null);
    if (districtId && !cityDistricts.some((district) => district.id === districtId)) setDistrictId(null);
  }, [cityProducts, cityDistricts, districtId, productId]);

  const chooseCity = (city: City) => {
    setCityId(city.id);
    setProductId(null);
    setDistrictId(null);
    setCompletedOrder(null);
  };

  const chooseProduct = (product: Product) => {
    setProductId(product.id);
    setCompletedOrder(null);
  };

  const placeOrder = () => {
    if (!selectedProduct || !selectedDistrict || !canOrder || !hasBalance) return;
    orderMutation.mutate(
      { data: { productId: selectedProduct.id, districtId: selectedDistrict.id } },
      {
        onSuccess: (order) => {
          setCompletedOrder(order);
          queryClient.invalidateQueries({ queryKey: getGetTelegramMiniAppAccountQueryKey() });
        },
      },
    );
  };

  return (
    <div className="page-enter space-y-8 pt-5 sm:space-y-10 sm:pt-9">
      <section className="relative overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-7 shadow-[var(--shadow-soft)] sm:px-10 sm:py-10">
        <div className="absolute -right-16 -top-20 size-56 rounded-full border-[22px] border-[hsl(var(--accent)/.13)]" aria-hidden="true" />
        <div className="absolute -bottom-28 right-16 size-64 rounded-full border-[1px] border-[hsl(var(--primary)/.13)]" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
            <span className="size-2 rounded-full bg-[hsl(var(--accent))]" aria-hidden="true" />
            Dostęp lokalny
          </div>
          <h1 className="font-display max-w-xl text-4xl font-bold leading-[.98] tracking-[-.06em] text-[hsl(var(--foreground))] sm:text-6xl">
            Twój sklep.<br /><span className="text-[hsl(var(--primary))]">Twoje tempo.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))] sm:text-base">
            Aktualny katalog odbioru w Twoim mieście. Bez zbędnych kroków, z płatnością z bezpiecznego salda konta.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary)/.1)] px-3.5 py-2 text-xs font-bold text-[hsl(var(--primary))]"><LockKeyhole className="size-3.5" /> Sesja prywatna</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3.5 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))]"><Check className="size-3.5" /> Tylko aktywne pozycje</span>
          </div>
        </div>
      </section>

      {sessionState === 'checking' && (
        <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]" data-testid="status-session-checking">
          <span className="size-2 animate-pulse rounded-full bg-[hsl(var(--accent))]" /> Sprawdzamy bezpieczne połączenie z Telegramem…
        </div>
      )}
      {sessionState === 'outside' && (
        <div className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.12)] px-4 py-4 text-sm" data-testid="status-unauthenticated">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent-foreground))]" />
          <div><p className="font-bold">Otwórz ten sklep w Telegramie</p><p className="mt-1 leading-5 text-[hsl(var(--muted-foreground))]">Sesja klienta jest tworzona wyłącznie z oficjalnych danych Telegram WebApp. Katalog możesz obejrzeć, ale zamówienie wymaga wejścia z Telegrama.</p></div>
        </div>
      )}
      {sessionState === 'error' && (
        <div className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.08)] px-4 py-4 text-sm" data-testid="status-session-error">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-[hsl(var(--destructive))]" />
          <div><p className="font-bold">Nie udało się potwierdzić sesji</p><p className="mt-1 leading-5 text-[hsl(var(--muted-foreground))]">{sessionError || 'Wróć do Telegrama i spróbuj ponownie.'}</p></div>
        </div>
      )}

      <section className="space-y-5" data-testid="section-catalog">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">01 / katalog</p><h2 className="font-display mt-2 text-2xl font-bold tracking-[-.05em] sm:text-3xl">Wybierz miasto</h2></div>
          {catalog.data && <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="text-city-count">{cities.length} aktywne</span>}
        </div>
        {catalog.isLoading && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div className="skeleton h-28 rounded-2xl" key={item} />)}</div>}
        {catalog.isError && (
          <div className="rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--card))] p-5" data-testid="status-catalog-error">
            <p className="font-bold">Katalog jest chwilowo niedostępny.</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Odśwież połączenie, aby zobaczyć aktywne pozycje.</p>
            <button type="button" onClick={() => catalog.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-retry-catalog"><RefreshCw className="size-3.5" /> Spróbuj ponownie</button>
          </div>
        )}
        {!catalog.isLoading && !catalog.isError && cities.length === 0 && <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] p-10 text-center" data-testid="status-catalog-empty"><MapPin className="mx-auto size-7 text-[hsl(var(--muted-foreground))]" /><p className="mt-3 font-bold">Brak aktywnych miast</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Wróć później — katalog jest aktualizowany lokalnie.</p></div>}
        {cities.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cities.map((city) => (
              <button type="button" key={city.id} onClick={() => chooseCity(city)} className={`group relative min-h-28 overflow-hidden rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${city.id === cityId ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_10px_28px_rgba(18,119,133,.2)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'}`} data-testid={`button-city-${city.id}`}>
                {city.imageUrl && <img src={city.imageUrl} alt="" className={`absolute inset-0 size-full object-cover transition duration-300 ${city.id === cityId ? 'opacity-20 mix-blend-screen' : 'opacity-10 mix-blend-multiply'}`} />}
                <span className="relative flex h-full flex-col justify-between"><MapPin className="size-5" /><span><span className="block font-display text-lg font-bold">{city.name}</span><span className={`text-xs ${city.id === cityId ? 'text-[hsl(var(--primary-foreground)/.72)]' : 'text-[hsl(var(--muted-foreground))]'}`}>{products.filter((product) => product.cityId === city.id).length} pozycji</span></span></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedCity && (
        <section className="space-y-5" data-testid="section-products">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">02 / oferta</p><h2 className="font-display mt-2 text-2xl font-bold tracking-[-.05em]">Dostępne w {selectedCity.name}</h2></div><Sparkles className="size-5 text-[hsl(var(--accent))]" /></div>
          {cityProducts.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center" data-testid="status-products-empty"><PackageOpen className="mx-auto size-7 text-[hsl(var(--muted-foreground))]" /><p className="mt-3 font-bold">Brak dostępnych pozycji</p></div> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cityProducts.map((product, index) => (
                <button type="button" key={product.id} onClick={() => chooseProduct(product)} className={`rise-in group flex items-center gap-4 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${product.id === productId ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.12)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`} style={{ animationDelay: `${index * 60}ms` }} data-testid={`card-product-${product.id}`}>
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><PackageOpen className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-display text-base font-bold">{product.name}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{product.weightGrams ? `${product.weightGrams} g` : 'Gotowe do odbioru'}</span></span>
                  <span className="text-right"><span className="block font-display text-lg font-bold">{money(product.pricePln)}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">wybierz</span></span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedProduct && (
        <section className="grid gap-5 lg:grid-cols-[1fr_360px]" data-testid="section-checkout">
          <div className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)] sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">03 / odbiór</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-[-.05em]">Gdzie odbierzesz?</h2>
            <p className="mt-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]">Wybierz dzielnicę dla {selectedProduct.name}. Dokładne informacje otrzymasz po potwierdzeniu.</p>
            <label className="mt-7 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Dzielnica</span><span className="relative block"><select value={districtId ?? ''} onChange={(event) => setDistrictId(event.target.value ? Number(event.target.value) : null)} className="w-full appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3.5 pr-10 text-sm font-semibold outline-none transition focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" data-testid="select-district"><option value="">Wybierz dzielnicę</option>{cityDistricts.map((district) => <option value={district.id} key={district.id}>{district.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /></span></label>
            {cityDistricts.length === 0 && <p className="mt-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-districts-empty">Brak aktywnych dzielnic dla tego miasta.</p>}
            <div className="mt-7 flex items-start gap-3 rounded-xl bg-[hsl(var(--secondary)/.7)] p-4"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-[hsl(var(--primary))]" /><p className="text-xs leading-5 text-[hsl(var(--secondary-foreground))]">Odbiór pozostaje dyskretny. Szczegóły lokalizacji są dostępne wyłącznie po złożeniu zamówienia.</p></div>
          </div>
          <aside className="rounded-[24px] border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] shadow-[0_18px_40px_rgba(18,119,133,.2)] sm:p-7">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--primary-foreground)/.65)]">Podsumowanie</span><ShoppingBag className="size-5" /></div>
            <div className="mt-7 border-b border-[hsl(var(--primary-foreground)/.18)] pb-5"><p className="font-display text-xl font-bold">{selectedProduct.name}</p><p className="mt-1 text-sm text-[hsl(var(--primary-foreground)/.7)]">{selectedCity?.name} {selectedDistrict ? `· ${selectedDistrict.name}` : ''}</p></div>
            <div className="flex items-end justify-between py-5"><span className="text-sm text-[hsl(var(--primary-foreground)/.7)]">Do zapłaty</span><span className="font-display text-3xl font-bold" data-testid="text-checkout-total">{money(selectedProduct.pricePln)}</span></div>
            <div className="mb-5 flex items-center justify-between rounded-xl bg-[hsl(var(--primary-foreground)/.1)] px-3.5 py-3 text-xs"><span className="flex items-center gap-2"><CreditCard className="size-4" /> Saldo konta</span><span className="font-bold" data-testid="text-balance-checkout">{user ? money(user.balance) : 'Niedostępne'}</span></div>
            {sessionState !== 'authenticated' && <p className="mb-4 text-xs leading-5 text-[hsl(var(--primary-foreground)/.75)]" data-testid="status-checkout-auth">Zaloguj się przez Telegram, aby zapłacić z salda.</p>}
            {sessionState === 'authenticated' && !hasBalance && <p className="mb-4 text-xs font-semibold leading-5 text-[hsl(var(--primary-foreground)/.85)]" data-testid="status-insufficient-balance">Saldo jest niewystarczające dla tej pozycji.</p>}
            <button type="button" onClick={placeOrder} disabled={!canOrder || !hasBalance || orderMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--accent))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--accent-foreground))] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-place-order">{orderMutation.isPending ? 'Potwierdzamy…' : <>Potwierdź z salda <ArrowRight className="size-4" /></>}</button>
            <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--primary-foreground)/.52)]" data-testid="status-payment-unavailable">BLIK i crypto są obecnie niedostępne</p>
          </aside>
        </section>
      )}

      {orderMutation.isError && <div className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.08)] p-4 text-sm" data-testid="status-order-error"><AlertCircle className="mt-0.5 size-5 shrink-0 text-[hsl(var(--destructive))]" /><div><p className="font-bold">Nie udało się utworzyć zamówienia</p><p className="mt-1 text-[hsl(var(--muted-foreground))]">Sprawdź saldo i wybór dzielnicy, a następnie spróbuj ponownie.</p></div></div>}
      {completedOrder && <div className="page-enter rounded-[24px] border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.08)] p-6" data-testid="status-order-success"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check className="size-5" /></span><div><p className="font-display text-xl font-bold">Zamówienie przyjęte</p><p className="mt-1 text-sm leading-5 text-[hsl(var(--muted-foreground))]">Numer <span className="font-bold text-[hsl(var(--foreground))]">#{completedOrder.id}</span> został zapisany. Status płatności: <span className="font-bold">{completedOrder.paymentStatus}</span>.</p><p className="mt-3 text-xs font-semibold text-[hsl(var(--primary))]">Szczegóły odbioru pojawią się w Telegramie.</p></div></div></div>}
    </div>
  );
}