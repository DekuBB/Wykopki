import { Link } from 'wouter';
import { AlertCircle, ArrowLeft, BadgeCheck, CircleDollarSign, Clock3, PackageCheck, RefreshCw } from 'lucide-react';
import { getGetTelegramMiniAppAccountQueryKey, useGetTelegramMiniAppAccount } from '@workspace/api-client-react';
import type { BotUser, Order } from '@workspace/api-client-react';

type SessionState = 'checking' | 'outside' | 'authenticated' | 'error';

function money(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
}

function orderLabel(status: string) {
  const labels: Record<string, string> = { pending: 'Oczekuje', confirmed: 'Potwierdzone', ready: 'Gotowe', completed: 'Zrealizowane', cancelled: 'Anulowane' };
  return labels[status.toLowerCase()] ?? status;
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = { paid: 'Opłacone z salda', pending: 'Oczekuje', failed: 'Nieudane' };
  return labels[status.toLowerCase()] ?? status;
}

function date(value: string) {
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function Account({ sessionState }: { sessionState: SessionState }) {
  const account = useGetTelegramMiniAppAccount({
    query: { enabled: sessionState === 'authenticated', queryKey: getGetTelegramMiniAppAccountQueryKey() },
  });
  const data = account.data;
  const user: BotUser | undefined = data?.user;
  const orders: Order[] = data?.orders ?? [];

  if (sessionState !== 'authenticated') {
    return <div className="page-enter mx-auto max-w-xl py-12 sm:py-20"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-back-shop"><ArrowLeft className="size-4" /> Wróć do sklepu</Link><div className="mt-8 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[var(--shadow-soft)] sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><CircleDollarSign className="size-7" /></span><h1 className="font-display mt-5 text-3xl font-bold tracking-[-.06em]" data-testid="title-account-auth-required">Twoje konto w Telegramie</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Otwórz Mini App w Telegramie, aby zobaczyć saldo i historię swoich zamówień.</p></div></div>;
  }

  return <div className="page-enter space-y-8 pt-5 sm:pt-9">
    <div><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-back-shop"><ArrowLeft className="size-4" /> Wróć do sklepu</Link><div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Centrum klienta</p><h1 className="font-display mt-2 text-4xl font-bold tracking-[-.07em] sm:text-5xl" data-testid="title-account">Twoje konto</h1></div>{user && <div className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--primary))] font-display text-lg font-bold text-[hsl(var(--primary-foreground))]" data-testid="text-account-initials">{(user.firstName?.slice(0, 1) || user.username?.slice(0, 1) || 'T').toUpperCase()}</div>}</div></div>
    {account.isLoading && <div className="space-y-4"><div className="skeleton h-40 rounded-[24px]" /><div className="skeleton h-24 rounded-[24px]" /></div>}
    {account.isError && <div className="rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.08)] p-5" data-testid="status-account-error"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-[hsl(var(--destructive))]" /><div><p className="font-bold">Nie udało się pobrać konta</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Spróbuj odświeżyć dane sesji.</p><button type="button" onClick={() => account.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-retry-account"><RefreshCw className="size-3.5" /> Odśwież konto</button></div></div></div>}
    {data && <><section className="grid gap-4 sm:grid-cols-[1.2fr_.8fr]"><div className="relative overflow-hidden rounded-[24px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[0_18px_40px_rgba(18,119,133,.2)] sm:p-8"><div className="absolute -right-14 -top-20 size-48 rounded-full border-[18px] border-[hsl(var(--primary-foreground)/.1)]" aria-hidden="true" /><div className="relative"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--primary-foreground)/.7)]"><CircleDollarSign className="size-4" /> Dostępne saldo</p><p className="font-display mt-5 text-5xl font-bold tracking-[-.07em]" data-testid="text-account-balance">{money(user?.balance ?? 0)}</p><p className="mt-4 text-sm text-[hsl(var(--primary-foreground)/.7)]">Możesz wykorzystać je przy kolejnym zamówieniu.</p></div></div><div className="rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-soft)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Aktywność</p><div className="mt-5 flex items-center justify-between"><span className="text-sm text-[hsl(var(--muted-foreground))]">Zamówienia</span><span className="font-display text-3xl font-bold" data-testid="text-purchase-count">{user?.purchaseCount ?? orders.length}</span></div><div className="mt-5 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4"><span className="text-sm text-[hsl(var(--muted-foreground))]">Bonusy</span><span className="font-display text-lg font-bold" data-testid="text-bonuses">{money(user?.bonuses ?? 0)}</span></div></div></section><section className="space-y-4"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Historia</p><h2 className="font-display mt-2 text-2xl font-bold tracking-[-.05em]">Ostatnie zamówienia</h2></div><span className="text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="text-order-count">{orders.length} łącznie</span></div>{orders.length === 0 ? <div className="rounded-[24px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] p-10 text-center" data-testid="status-orders-empty"><PackageCheck className="mx-auto size-8 text-[hsl(var(--muted-foreground))]" /><p className="mt-3 font-bold">Nie masz jeszcze zamówień</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Wybierz pozycję w katalogu, aby rozpocząć.</p><Link href="/" className="mt-5 inline-flex rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-start-order">Przejdź do katalogu</Link></div> : <div className="space-y-3">{orders.map((order) => <OrderRow order={order} key={order.id} />)}</div>}</section></>}
  </div>;
}

function OrderRow({ order }: { order: Order }) {
  return <article className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm transition hover:shadow-[var(--shadow-soft)]" data-testid={`row-order-${order.id}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><PackageCheck className="size-5" /></span><div className="min-w-0"><p className="truncate font-display font-bold" data-testid={`text-order-product-${order.id}`}>{order.productName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{order.cityName} · {order.districtName}</p></div></div><p className="font-display text-lg font-bold" data-testid={`text-order-amount-${order.id}`}>{money(order.amountPln)}</p></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3 text-[11px] font-bold"><span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary)/.1)] px-2.5 py-1.5 text-[hsl(var(--primary))]" data-testid={`status-order-${order.id}`}><BadgeCheck className="size-3.5" /> {orderLabel(order.status)}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1.5 text-[hsl(var(--secondary-foreground))]" data-testid={`status-payment-${order.id}`}><CircleDollarSign className="size-3.5" /> {paymentLabel(order.paymentStatus)}</span><span className="ml-auto inline-flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]" data-testid={`text-order-date-${order.id}`}><Clock3 className="size-3.5" /> {date(order.createdAt)}</span></div></article>;
}