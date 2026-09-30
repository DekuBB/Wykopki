import { useEffect, useState } from 'react';
import { useCreateTelegramMiniAppSession } from '@workspace/api-client-react';
import type { BotUser } from '@workspace/api-client-react';

type TelegramWebApp = { initData?: string; ready?: () => void; expand?: () => void };

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export type SessionState = 'checking' | 'outside' | 'authenticated' | 'error';

export function useTelegramSession() {
  const session = useCreateTelegramMiniAppSession();
  const [state, setState] = useState<SessionState>('checking');
  const [user, setUser] = useState<BotUser | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData?.trim() ?? '';
    webApp?.ready?.();
    webApp?.expand?.();

    if (!initData) {
      setState('outside');
      return;
    }

    session.mutate(
      { data: { initData } },
      {
        onSuccess: (result) => {
          setUser(result.user);
          setState('authenticated');
        },
        onError: (error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Nie udało się potwierdzić sesji.');
          setState('error');
        },
      },
    );
  }, []);

  return {
    state,
    user,
    isAuthenticating: session.isPending,
    errorMessage,
  };
}