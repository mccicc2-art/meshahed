import { useState } from "react";
import { useApp, type Me } from "../state";
import { queryClient, qk } from "../api";
import { themePref } from "../theme";
import { haptic } from "../haptics";
import { webLocale } from "../i18n";
import { useSettings, saveSetting, invalidateMe, useOpenWeb, patchSettings } from "./api";
import { themeNeedsPlus } from "@/core/plan";
import type { Locale } from "@/core/i18n";
import type { LocaleBody, ThemeBody } from "../contracts";

/**
 * ====== 🆕 D-1505 — فعلا اللغة والثيم في مكانٍ واحد ======
 *
 * كانا داخل شاشة «المظهر» وحدَها؛ والقائمةُ الجانبيّة صار فيها زرُّ اللغة ومبدّلُ «فاتح / داكن» — **وصفتان لحفظٍ
 * واحدٍ تفترقان في أوّل تعديل** (القاعدة ٣). نُقلا هنا بحرفهما، والشاشتان تقرآن الخطّافَ نفسَه.
 */
export function useAppearanceActs(onFail: () => void) {
  const { me } = useApp();
  const q = useSettings();
  const s = q.data;
  const openWeb = useOpenWeb();
  const [busy, setBusy] = useState(false);

  async function pickLocale(next: Locale) {
    if (!s || next === s.appearance.locale || busy) return;
    setBusy(true);
    const out = await saveSetting<{ locale: Locale }>("/api/v1/me/settings/locale", { locale: next } satisfies LocaleBody, (x) => ({ ...x, appearance: { ...x.appearance, locale: next } }));
    setBusy(false);
    if (!out) return onFail();
    /* القاموسُ والاتّجاهُ من مصدرهما الواحد — وإن انقلب الاتّجاهُ أُعيد تحميلُ JS (1.11.7) */
    webLocale.set(out.locale);
  }

  async function pickTheme(id: string) {
    if (!s || busy) return;
    if (themeNeedsPlus(id) && !(me?.plus ?? s.account.plus)) {
      haptic.pick();
      openWeb("/plus");
      return;
    }
    if (id === (themePref.get() ?? s.appearance.theme)) return;
    haptic.pick();
    setBusy(true);
    /* الثيمُ يُلبَس لحظةَ اللمس من مخزن الجهاز، و`me` يُكتب معه كي لا يعيده «من أنا» القديم؛ ويعود
       الاثنان إن فشل الحفظ أو طُلب بلس */
    const meBefore = queryClient.getQueryData<Me>(qk.tag("user:me:profile"));
    /* D-1125 — اللونُ من مخزن الجهاز لحظةَ اللمس، لا من «من أنا» (الذي قد لا يتبدّل أبداً إن غاب الرمز) */
    const themeBefore = themePref.get() ?? s.appearance.theme;
    themePref.set(id);
    if (meBefore) queryClient.setQueryData<Me>(qk.tag("user:me:profile"), (m) => (m ? { ...m, theme: id } : m));
    const out = await saveSetting<{ theme: string; needsPlus?: true }>("/api/v1/me/settings/theme", { theme: id } satisfies ThemeBody, (x) => ({ ...x, appearance: { ...x.appearance, theme: id } }), invalidateMe);
    setBusy(false);
    if (!out || out.needsPlus) {
      themePref.set(themeBefore);
      if (meBefore) queryClient.setQueryData<Me>(qk.tag("user:me:profile"), () => meBefore);
      if (out?.needsPlus) patchSettings((x) => ({ ...x, appearance: { ...x.appearance, theme: meBefore?.theme ?? x.appearance.theme } }));
    }
    if (!out) return onFail();
    if (out.needsPlus) openWeb("/plus");
  }

  return { settings: s, busy, pickLocale, pickTheme };
}
