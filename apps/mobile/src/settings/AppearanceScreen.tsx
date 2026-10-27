import React, { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, ExpandRow, OptionRow, OptionList, RowsSkeleton, Row } from "./ui";
import { ChatBgSheet, useChatBg } from "../messages/chatBg";
import { useSettings, saveSetting, invalidateMe, useOpenWeb } from "./api";
import { useAppearanceActs } from "./appearanceActs";
import { fontPrefs } from "../fontScale";
import { THEMES, themeName } from "@/core/themes";
import { themeNeedsPlus } from "@/core/plan";
import { FONT_SIZES, type FontSize } from "@/core/fontPrefs";
import type { Locale } from "@/core/i18n";
import type { FontBody } from "../contracts";

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
  const { t, tokens, locale, me, themeId } = useApp();
  const q = useSettings();
  const s = q.data;
  const toast = useRef<ToastHostRef>(null);
  const openWeb = useOpenWeb();
  const [open, setOpen] = useState<"lang" | "theme" | "ui" | "content" | null>(null);
  /* 🆕 D-1505 — اللغةُ والثيمُ من الخطّاف الواحد (القائمةُ الجانبيّة تقرؤه أيضاً) */
  const { busy, pickLocale, pickTheme } = useAppearanceActs(() => toast.current?.say(t.errSaveShort));
  /* 🆕 D-1382 — خلفيّةُ المحادثات: بابُها الثاني هنا (الأوّلُ ⋯ داخل المحادثة) — المنتقي نفسُه */
  const chatBg = useChatBg();
  const [bgSheet, setBgSheet] = useState(false);
  const fail = () => toast.current?.say(t.errSaveShort);
  const toggle = (k: typeof open) => setOpen((v) => (v === k ? null : k));

  const langs: { id: Locale; label: string }[] = [
    { id: "ar", label: t.arabicLang },
    { id: "en", label: t.englishLang },
  ];
  const fontLabel: Record<FontSize, string> = { sm: t.fontSizeSm, md: t.fontSizeMd, lg: t.fontSizeLg, xl: t.fontSizeXl };

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

  /* 🆕 D-1128 — **مصدرٌ واحدٌ للثيم**: العلامةُ والاسمُ من الثيم الملبوس (`themePref` ← `themeId`)
     لا من إعدادات الخادم — كانا مصدرين فسبقت العلامةُ اللونَ إلى «النهاري» (تسجيلُ أحمد على 1.12.0) */
  const currentTheme = themeId ?? s?.appearance.theme ?? null;
  const theme = THEMES.find((x) => x.id === currentTheme) ?? THEMES[0];
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
                const on = th.id === theme.id;
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

          <Row
            icon="chat"
            title={t.chatBgTitle}
            value={chatBg.k === "loopz" ? t.chatBgLoopz : chatBg.k === "plain" ? t.chatBgPlain : t.chatBgFavs}
            onPress={() => setBgSheet(true)}
          />

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
      {bgSheet ? (
        <ChatBgSheet
          onClose={() => setBgSheet(false)}
          onPlus={() => {
            setBgSheet(false);
            openWeb("/plus");
          }}
        />
      ) : null}
    </SettingsScreen>
  );
}
