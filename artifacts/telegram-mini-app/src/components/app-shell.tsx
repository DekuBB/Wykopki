import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { CircleUserRound, LayoutGrid, LockKeyhole, ShieldCheck } from 'lucide-react';

export function AppShell({
  children,
  sessionState,
  userName,
}: {
  children: ReactNode;
  sessionState: 'checking' | 'outside' | 'authenticated' | 'error';
  userName?: string | null;
}) {
  const [location] = useLocation();
  const outside = sessionState === 'outside';
  const authenticated = sessionState === 'authenticated';

  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-3 pt-5 sm:px-8 sm:pt-7">
        <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
          <span className="grid size-10 place-items-center rounded-[14px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_18px_rgba(18,119,133,.22)]" aria-hidden="true">
            <span className="font-display text-lg font-bold">ts</span>
          </span>
          <span>
            <span className="block font-display text-[15px] font-bold tracking-tight">Telegram Shop</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">local / discreet</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {authenticated ? (
            <span className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold text-[hsl(var(--foreground))] shadow-sm sm:flex" data-testid="status-session-authenticated">
              <ShieldCheck className="size-3.5 text-[hsl(var(--primary))]" />
              {userName ? `Witaj, ${userName}` : 'Sesja potwierdzona'}
            </span>
          ) : outside ? (
            <span className="flex items-center gap-2 rounded-full border border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.12)] px-3 py-2 text-xs font-semibold text-[hsl(var(--foreground))]" data-testid="status-outside-telegram">
              <LockKeyhole className="size-3.5" /> Otwórz w Telegramie
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8">{children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.92)] px-5 pt-3 backdrop-blur-xl sm:hidden" aria-label="Nawigacja">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <Link href="/" className={`flex min-w-20 flex-col items-center gap-1 rounded-2xl px-4 py-2 text-[11px] font-bold transition ${location === '/' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="link-home">
            <LayoutGrid className="size-4" /> Sklep
          </Link>
          <Link href="/account" className={`flex min-w-20 flex-col items-center gap-1 rounded-2xl px-4 py-2 text-[11px] font-bold transition ${location === '/account' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="link-account">
            <CircleUserRound className="size-4" /> Konto
          </Link>
        </div>
      </nav>
    </div>
  );
}