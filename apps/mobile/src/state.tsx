import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "./api";
import { useAuth } from "./auth";
import { deviceLocale, dictFor } from "./i18n";
import { tokensOf, type Tokens } from "./theme";
import type { Dict, Locale } from "@/core/i18n";

/** ما يعيده `GET /api/v1/me` — الملفُّ بما يكفي للترويسة والإعدادات */
export type Me = {
  id: string;
  username: string | null;
  nickname: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  theme: string | null;
  theme_accent: string | null;
  is_private: boolean | null;
  timezone: string | null;
  plan: string | null;
  plus: boolean;
  partner: boolean;
  verified: boolean;
  founder: boolean;
} | null;

type AppState = { locale: Locale; t: Dict; tokens: Tokens; me: Me; meLoading: boolean };
const Ctx = createContext<AppState | null>(null);

/**
 * حالةُ التطبيق الواحدة: اللغةُ والقاموسُ والثيمُ ومن أنا.
 * **الثيمُ يتبع الملفَّ** (`me.theme`) — وقبل وصوله الافتراضيُّ، لا وميض.
 */
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const locale = deviceLocale();
  const me = useQuery({
    queryKey: qk.tag("user:me:profile"),
    queryFn: async () => (await api<Me>("/api/v1/me")).data,
    enabled: !!session,
  });
  const value = useMemo<AppState>(
    () => ({
      locale,
      t: dictFor(locale),
      tokens: tokensOf(me.data?.theme),
      me: me.data ?? null,
      meLoading: !!session && me.isLoading,
    }),
    [locale, me.data, me.isLoading, session],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppStateProvider");
  return v;
}
