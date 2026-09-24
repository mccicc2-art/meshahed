import React, { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useApp, type Me } from "../state";
import { api, queryClient, qk } from "../api";
import { session } from "../session";
import { BUILD_TAG } from "../ota";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius, themePref } from "../theme";
import { haptic } from "../haptics";
import { webLocale } from "../i18n";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, ExpandRow, OptionRow, OptionList, RowsSkeleton } from "./ui";
import { useSettings, saveSetting, invalidateMe, useOpenWeb, patchSettings } from "./api";
import { fontPrefs } from "../fontScale";
import { THEMES, themeName } from "@/core/themes";
import { themeNeedsPlus } from "@/core/plan";
import { FONT_SIZES, type FontSize } from "@/core/fontPrefs";
import type { Locale } from "@/core/i18n";
import type { FontBody, LocaleBody, ThemeBody } from "../contracts";

/**
 * ====== المظهر — اللغة · الثيم · حجما الخطّ (Phase 11-I · I1) ======
 *
 * ترجمةُ `appearance/page.tsx`: ثلاثةُ صفوفٍ تطوي ألواحَها في المكان (D-569).
 * • اللغة: البابُ يكتب الكوكي والعمود، **والتطبيقُ يبدّل نفسَه بـ`webLocale.set`**
 *   (D-946 + 1.11.7: يعيد تحميلَ JS إن انقلب الاتّجاه) — فالصفحةُ تحت والشاشاتُ
 *   الأصليّةُ بلغةٍ واحدة.
 * • الثيم: يُطبَّق لحظةَ اللمس على التطبيق كلِّه (الرموزُ تتبع `themePref` على الجهاز) —
 *   اللوحُ لا يُغلق عند الاختيار ليُجرَّب الثاني والثالث. المقفولُ للبلس نجمةٌ
 *   ويفتح بابَ البلس (D-633/D-791) — والحارسُ في الخادم لا هنا.
 * • الخطّ: يُحفظ للحساب والصفحةُ تتبعه؛ ⚠️ **الشاشاتُ الأصليّةُ لا تكبر به بعد**
 *   (قرارٌ مؤجَّل — يمسّ `Text` والتصميمَ المجمَّد D-1076).
 */
export function AppearanceScreen() {
  const { t, tokens, locale, me } = useApp();
  const q = useSettings();
  const s = q.data;
  const toast = useRef<ToastHostRef>(null);
  const openWeb = useOpenWeb();
  const [open, setOpen] = useState<"lang" | "theme" | "ui" | "content" | null>(null);
  const [busy, setBusy] = useState(false);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const fail = () => toast.current?.say(t.errSaveShort);
  const toggle = (k: typeof open) => setOpen((v) => (v === k ? null : k));

  const langs: { id: Locale; label: string }[] = [
    { id: "ar", label: t.arabicLang },
    { id: "en", label: t.englishLang },
  ];
  const fontLabel: Record<FontSize, string> = { sm: t.fontSizeSm, md: t.fontSizeMd, lg: t.fontSizeLg, xl: t.fontSizeXl };

  async function pickLocale(next: Locale) {
    if (!s || next === s.appearance.locale || busy) return;
    setBusy(true);
    const out = await saveSetting<{ locale: Locale }>("/api/v1/me/settings/locale", { locale: next } satisfies LocaleBody, (x) => ({ ...x, appearance: { ...x.appearance, locale: next } }));
    setBusy(false);
    if (!out) return fail();
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
    if (id === s.appearance.theme) return;
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
    if (out && !out.needsPlus) probeTheme(id, tokensRef);
    if (!out) return fail();
    if (out.needsPlus) openWeb("/plus");
  }

  async function pickFont(which: "ui" | "content", size: FontSize) {
    if (!s) return;
    const ui = which === "ui" ? size : s.appearance.font_ui;
    const content = which === "content" ? size : s.appearance.font_content;
    /* D-1105 — التطبيقُ كلُّه يتبع لحظةَ اللمس (الشاشةُ التي أنت فيها أوّلُها)، ويعود إن فشل الحفظ */
    const before = fontPrefs.get();
    fontPrefs.set(ui, content);
    const out = await saveSetting<{ ui: string; content: string }>("/api/v1/me/settings/font", { ui, content } satisfies FontBody, (x) => ({ ...x, appearance: { ...x.appearance, font_ui: ui, font_content: content } }));
    if (!out) {
      fontPrefs.set(before.ui, before.content);
      fail();
      return;
    }
    invalidateMe();
  }

  const theme = s ? THEMES.find((x) => x.id === s.appearance.theme) ?? THEMES[0] : THEMES[0];
  const plus = me?.plus ?? s?.account.plus ?? false;

  return (
    <SettingsScreen title={t.setAppearance} toast={toast}>
      {!s ? (
        <RowsSkeleton rows={4} />
      ) : (
        <Group>
          <ExpandRow icon="compass" title={t.languageSection} value={langs.find((l) => l.id === s.appearance.locale)?.label} open={open === "lang"} onToggle={() => toggle("lang")}>
            <OptionList>
              {langs.map((l) => (
                <OptionRow key={l.id} selected={l.id === s.appearance.locale} title={l.label} onSelect={() => void pickLocale(l.id)} disabled={busy} />
              ))}
            </OptionList>
          </ExpandRow>

          <ExpandRow icon="palette" title={t.themeSection} value={themeName(theme, locale)} open={open === "theme"} onToggle={() => toggle("theme")}>
            {/* شبكةُ عمودين: شريطُ ألوانٍ (accent · accent-2 · surface → bg) واسمٌ تحته */}
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, opacity: busy ? 0.7 : 1 }}>
              {THEMES.map((th) => {
                const on = th.id === s.appearance.theme;
                const locked = !plus && themeNeedsPlus(th.id);
                return (
                  <Pressable
                    key={th.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => void pickTheme(th.id)}
                    style={({ pressed }) => [{ width: "48%", flexGrow: 1, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: on ? tokens.accent : "transparent", backgroundColor: tokens.surface2, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  >
                    <View style={{ height: 32, flexDirection: "row" }}>
                      <View style={{ flex: 38, backgroundColor: th.vars.accent }} />
                      <View style={{ flex: 24, backgroundColor: th.vars["accent-2"] }} />
                      <View style={{ flex: 19, backgroundColor: th.vars.surface }} />
                      <View style={{ flex: 19, backgroundColor: th.vars.background }} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, minHeight: 40 }}>
                      <Text size={12} weight="600" numberOfLines={1} style={{ flex: 1 }}>{themeName(th, locale)}</Text>
                      {on ? <Icon name="check" size={14} color={tokens.accent} /> : locked ? <Icon name="sparkle-star" size={13} color={tokens.accent + "B3"} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ExpandRow>

          <ExpandRow icon="sliders" title={t.fontUiLabel} value={fontLabel[s.appearance.font_ui]} open={open === "ui"} onToggle={() => toggle("ui")}>
            <OptionList>
              {FONT_SIZES.map((f) => (
                <OptionRow key={f} selected={f === s.appearance.font_ui} title={fontLabel[f]} onSelect={() => void pickFont("ui", f)} />
              ))}
            </OptionList>
          </ExpandRow>
          <ExpandRow icon="comment" title={t.fontContentLabel} value={fontLabel[s.appearance.font_content]} open={open === "content"} onToggle={() => toggle("content")}>
            <OptionList>
              {FONT_SIZES.map((f) => (
                <OptionRow key={f} selected={f === s.appearance.font_content} title={fontLabel[f]} onSelect={() => void pickFont("content", f)} />
              ))}
            </OptionList>
          </ExpandRow>
        </Group>
      )}
    </SettingsScreen>
  );
}

/**
 * ====== مسبارُ الثيم — مؤقّت (D-1125) ======
 * سببُ بلاغ 1.11.15 لم يُثبت بالكود وحده: «من أنا» غائب؟ أم لم يتبدّل؟ أم الرمزُ مفقود؟ بعد أوّل حفظٍ
 * ناجحٍ في الجلسة، وبعد ثانيتين، يُكتب سطرٌ واحدٌ في سجلّ الأعطال بما رآه التطبيقُ فعلاً — فيُحسم السببُ
 * من تجربةٍ واحدة. **يُحذف بعد قراءته.**
 */
let probed = false;
function probeTheme(picked: string, tokensRef: { current: { bg: string } }) {
  if (probed) return;
  probed = true;
  setTimeout(() => {
    const key = qk.tag("user:me:profile");
    const me = queryClient.getQueryData<Me>(key);
    const st = queryClient.getQueryState(key);
    const ageS = st?.dataUpdatedAt ? Math.round((Date.now() - st.dataUpdatedAt) / 1000) : -1;
    const message = `ThemeProbe picked=${picked} pref=${themePref.get() ?? "-"} me=${me ? (me.theme ?? "null") : "none"} meStatus=${st?.status ?? "-"}/${st?.fetchStatus ?? "-"} meAge=${ageS}s token=${session.has() ? 1 : 0} bg=${tokensRef.current.bg}`;
    void api("/api/v1/app/crash", { method: "POST", body: { screen: "settings", message, version: BUILD_TAG } }).catch(() => {});
  }, 2000);
}
