import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { session as bridge } from "./session";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "./api";
import { useAuth } from "./auth";
import { currentLocale, dictFor, webLocale } from "./i18n";
import { themePref, tokensOf, type Tokens } from "./theme";
import { fontPrefs } from "./fontScale";
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
  /** D-1105 — حجما الخطّ (خادمٌ أقدمُ لا يرسلهما ⇒ يبقى المحفوظُ على الجهاز) */
  font_ui?: string;
  font_content?: string;
} | null;

type AppState = { locale: Locale; t: Dict; tokens: Tokens; themeId: string | null; me: Me; meLoading: boolean; fontsReady: boolean };
const Ctx = createContext<AppState | null>(null);

/**
 * حالةُ التطبيق الواحدة: اللغةُ والقاموسُ والثيمُ ومن أنا.
 * **الثيمُ من الجهاز** (`themePref`) و«من أنا» يصحّحه — فلا وميضَ عند الإقلاع ولا لمسةَ بلا أثر.
 */
export function AppStateProvider({ children, fontsReady }: { children: React.ReactNode; fontsReady: boolean }) {
  const { session } = useAuth();
  /* 🆕 D-946 — اللغةُ من الويب حين بلّغها، وتتبدّل حيّةً حين يبدّلها المستخدم */
  const locale = useSyncExternalStore(webLocale.subscribe, currentLocale, currentLocale);
  /* 🆕 Phase 11 · B1 — الرمزُ من الجسر لا من جلسةٍ مخزونة: «مَن أنا» (والثيمُ
     معه) يُجلب حين يحمل الغلافُ رمزَ وصولٍ، أي حين تُفتح شاشةٌ أصليّة. */
  const bridged = useSyncExternalStore(bridge.subscribe, bridge.has, bridge.has);
  /* 🔴 D-1128 — **«من أنا» يُفعَّل بأثر الجلسة لا بالرمز الحاضر** (مسبارُ 1.12.0 مرّتين:
     `me=none meStatus=pending/idle token=0` بعد حفظٍ ناجح): `has()` يرفض رمزاً باقيه دون ٣٠ث،
     فكان الاستعلامُ معطَّلاً لا فاشلاً — لا يُطلب أصلاً، وهيكلُ الإعدادات ينتظر ما لن يأتي.
     و`api()` يطلب الرمزَ بنفسه قبل النداء، فشرطُ الرمز هنا لم يكن يحمي شيئاً. */
  const seen = useSyncExternalStore(bridge.subscribe, bridge.seen, bridge.seen);
  const on = !!session || bridged || seen;
  const me = useQuery({
    queryKey: qk.tag("user:me:profile"),
    queryFn: async () => (await api<Me>("/api/v1/me")).data,
    enabled: on,
  });
  /* D-1105 — «من أنا» يصحّح حجمَ الخطّ المحفوظ على الجهاز إن غيّره صاحبُه من الويب أو من جهازٍ آخر */
  const fu = me.data?.font_ui;
  const fc = me.data?.font_content;
  useEffect(() => {
    if (fu && fc) fontPrefs.set(fu, fc);
  }, [fu, fc]);
  /* D-1125 — الثيمُ من الجهاز أوّلاً؛ و«من أنا» يصحّحه حين تتبدّل قيمتُه هو (من الويب أو جهازٍ آخر أو
     بعد الحفظ). الاعتمادُ على القيمة لا على الكائن: لمسةٌ جديدةٌ لا يعيدها «من أنا» القديمُ إلى ما كان */
  const localTheme = useSyncExternalStore(themePref.subscribe, themePref.get, themePref.get);
  const meTheme = me.data?.theme;
  useEffect(() => {
    if (meTheme) themePref.set(meTheme);
  }, [meTheme]);
  const themeId = localTheme ?? meTheme ?? null;
  const value = useMemo<AppState>(
    () => ({
      locale,
      t: dictFor(locale),
      tokens: tokensOf(themeId),
      themeId,
      me: me.data ?? null,
      meLoading: on && me.isLoading,
      fontsReady,
    }),
    [locale, me.data, me.isLoading, on, fontsReady, themeId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppStateProvider");
  return v;
}
