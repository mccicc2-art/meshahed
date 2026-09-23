import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, queryClient, write, ApiError } from "../api";
import { shell } from "../shell";
import type { SettingsPayload } from "../contracts";

/**
 * ====== طبقةُ بيانات الإعدادات (Phase 11-I) ======
 *
 * 🔑 **قراءةٌ واحدة** (`GET /me/settings`) بمفتاحٍ ثابت، **وكلُّ كتابةٍ ترقّعها
 * تفاؤليّاً ثمّ تعيدها إلى المؤكَّد عند الفشل** — وصفةُ الويب في كلِّ قسم
 * (`ThemeSection` · `AccountSettings` · `ContentPrefsSection`): الشاشةُ تستجيب
 * لحظةَ اللمس، والخادمُ يلحق، والفشلُ يعيد ما كان لا ما قبل الضغطة الأخيرة وحدَها.
 *
 * المفتاحُ ليس وسماً من `tags.ts`: لا كتابةَ خارجَ هذه الشاشات تُبطله، **ويُعاد
 * جلبُه عند كلِّ فتحٍ للفهرس** (`staleTime` صفر) لأنّ الويبَ قد يكون غيّر شيئاً تحت.
 */
export const SETTINGS_KEY = ["me:settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => (await api<SettingsPayload>("/api/v1/me/settings")).data,
    staleTime: 0,
    gcTime: 10 * 60_000,
  });
}

export function patchSettings(fn: (s: SettingsPayload) => SettingsPayload) {
  queryClient.setQueryData<SettingsPayload>(SETTINGS_KEY, (s) => (s ? fn(s) : s));
}

export function invalidateSettings() {
  void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
}

/**
 * كتابةٌ تفاؤليّة: ترقّع الحمولةَ، تكتب، وتعيد المؤكَّدَ عند الفشل. `after` لما يلي
 * النجاح (إبطالُ الملفّ للثيم، تبديلُ اللغة…). تعيد `false` عند الفشل ليقول
 * المستدعي «تعذّر الحفظ» بالإشعار الواحد.
 */
export async function saveSetting<T>(path: string, body: unknown, optimistic: (s: SettingsPayload) => SettingsPayload, after?: (out: T) => void): Promise<T | null> {
  const prev = queryClient.getQueryData<SettingsPayload>(SETTINGS_KEY);
  patchSettings(optimistic);
  try {
    const out = await write<T>(path, body);
    after?.(out);
    return out;
  } catch {
    if (prev) queryClient.setQueryData(SETTINGS_KEY, prev);
    return null;
  }
}

export function messageOf(e: unknown, t: Record<string, unknown>, fallback: string): string {
  const key = e instanceof ApiError ? e.error.message_key : "";
  const msg = t[key];
  return typeof msg === "string" ? msg : fallback;
}

/**
 * بابٌ إلى الويب من الإعدادات (وصفةُ `HomeScreen.openWeb`): الصفحةُ تُفتح تحت
 * والشاشاتُ الأصليّةُ كلُّها تُنزَل (`dismissAll`) — فالرجوعُ من الصفحة يعود إلى
 * الرئيسيّة الأصليّة (`returnTo:"home"`) لا إلى إعداداتٍ معلَّقةٍ فوقها.
 */
export function useOpenWeb() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const open = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      void shell.open(path, { returnTo: "home" }).then(() => {
        setLeaving(false);
        if (router.canDismiss()) router.dismissAll();
        else router.replace("/web");
      });
    },
    [leaving, router],
  );
  return open;
}

/** إبطالُ «من أنا» بعد تبدّل الثيم — الرموزُ تتبع `me.theme` (state.tsx) */
export function invalidateMe() {
  void queryClient.invalidateQueries({ queryKey: qk.tag("user:me:profile") });
}

export function useQc() {
  return useQueryClient();
}
