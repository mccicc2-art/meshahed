import React, { createContext, useContext, useEffect, useMemo } from "react";
import { AppState as RNAppState } from "react-native";
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
 * 🆕 D-917 — **نبضةُ الحضور** (أختُ `PresencePing` في الويب، D-765): دقّةٌ
 * بعد ثوانٍ من الدخول، ثمّ كلَّ أربع دقائق ما دام التطبيقُ في المقدّمة،
 * ودقّةٌ عند العودة من الخلفيّة. لوحةُ المختبِرين تقدّر منها «كم جلس».
 * **الخنقُ مزدوج**: دقيقةٌ هنا، وثلاثٌ في القاعدة. **والفشلُ صمتٌ مطلق** —
 * إحصاءٌ يكسر شاشةً أسوأُ صفقةٍ ممكنة.
 */
function usePresencePing(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const beat = () => {
      if (RNAppState.currentState !== "active") return;
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      api("/api/v1/me/ping", { method: "POST", body: {} }).catch(() => {});
    };
    const first = setTimeout(beat, 3000);
    const every = setInterval(beat, 240_000);
    const sub = RNAppState.addEventListener("change", (s) => {
      if (s === "active") beat();
    });
    return () => {
      clearTimeout(first);
      clearInterval(every);
      sub.remove();
    };
  }, [enabled]);
}

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
  usePresencePing(!!session);
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
