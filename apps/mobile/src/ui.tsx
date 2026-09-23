import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "./state";
import { radius, space } from "./theme";
import { ARABIC_RE, familyOf, type Weight } from "./fonts";
import { deviceLocale } from "./i18n";
import { isRtl } from "@/core/i18n";
import { useFontScale } from "./fontScale";

/**
 * ====== العائلاتُ الأساسيّة — مصنعُ زرٍّ واحد، نصٌّ واحد، ملصقٌ واحد ======
 *
 * نفسُ قاعدةِ الويب (القاعدة ٣ في المشروع): **مصنعُ زرٍّ واحدٌ** بثلاثة
 * أشكالٍ لا ثلاثةُ أزرار؛ ونصٌّ واحدٌ يحمل الثيمَ فلا يُكتب لونٌ في شاشة.
 */

export function Screen({ children, style, ...rest }: ViewProps) {
  const { tokens } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * 🆕 Phase 11 · B2 — **الخطُّ يتبع الحرفَ لا الشاشة** (D-454): الويبُ يكتب
 * `Poppins, Tajawal` فيحلّ المتصفّحُ كلَّ حرفٍ من عائلته. RN لا يملك سلسلةَ
 * سقوطٍ، **فالنصُّ يُقسَّم إلى مقاطعَ عربيّةٍ ولاتينيّة** كلٌّ بعائلته
 * ووزنه — عنوانٌ مثل «Breaking Bad — الموسم ٣» يُرسم بخطّين كما في الصفحة.
 * وقبل تحميل الخطوط يُرسم بخطّ النظام بالوزن نفسِه، لا فراغاً.
 */
/* D-1028 (F4) — النتيجةُ محفوظةٌ بالنصّ: الدالّةُ تمرّ بتعبيرٍ نمطيٍّ على **كلِّ حرف** في **كلِّ رسمةٍ**
   لكلِّ `Text`، والنصوصُ تتكرّر (عناوينُ الصفوف، أسماءُ الأعمال). سقفٌ ٥٠٠ ثمّ يُفرَّغ — أبسطُ من LRU
   ويكفي: ما على الشاشة يعود إليها في رسمةٍ واحدة. والمصفوفةُ تُقرأ ولا تُعدَّل. */
const RUNS_CACHE = new Map<string, { s: string; ar: boolean }[]>();
const RUNS_MAX = 500;
function runsOf(text: string): { s: string; ar: boolean }[] {
  const hit = RUNS_CACHE.get(text);
  if (hit) return hit;
  const out = splitRuns(text);
  if (RUNS_CACHE.size >= RUNS_MAX) RUNS_CACHE.clear();
  RUNS_CACHE.set(text, out);
  return out;
}

function splitRuns(text: string): { s: string; ar: boolean }[] {
  const out: { s: string; ar: boolean }[] = [];
  let cur = "";
  let curAr: boolean | null = null;
  for (const ch of text) {
    /* المسافاتُ وعلاماتُ الترقيم المشتركة تتبع المقطعَ الجاري فلا تُقطّعه */
    const ar: boolean | null = ARABIC_RE.test(ch) ? true : /[A-Za-z0-9]/.test(ch) ? false : curAr;
    if (curAr === null || ar === null || ar === curAr) {
      cur += ch;
      if (curAr === null && ar !== null) curAr = ar;
    } else {
      out.push({ s: cur, ar: curAr });
      cur = ch;
      curAr = ar;
    }
  }
  if (cur) out.push({ s: cur, ar: curAr ?? isRtl(deviceLocale()) });
  return out;
}

export function Text({
  muted,
  size = 15,
  weight = "400",
  color,
  content,
  children,
  style: rawStyle,
  ...rest
}: TextProps & {
  muted?: boolean;
  size?: number;
  weight?: Weight;
  color?: string;
  /** 🆕 D-1105 — كلامُ الناس (مراجعة · ردّ · منشور): يتبع «خطَّ المحتوى» لا «خطَّ الواجهة» */
  content?: boolean;
}) {
  const { tokens, fontsReady } = useApp();
  /* 🆕 D-1105 — حجمُ الخطّ: المقاسُ وارتفاعُ السطر يُضربان معاً (سطرٌ ثابتٌ تحت خطٍّ أكبر يقصّ الحروف)،
     وما كُتب في `style` مباشرةً يُضرب كذلك — فلا نصَّ ينجو من الإعداد لأنّه كُتب بطريقةٍ أخرى */
  const k = useFontScale(content);
  let style = rawStyle;
  if (k !== 1 && rawStyle) {
    const flat = StyleSheet.flatten(rawStyle);
    if (flat && (flat.fontSize || flat.lineHeight)) {
      const scaled: { fontSize?: number; lineHeight?: number } = {};
      if (flat.fontSize) scaled.fontSize = flat.fontSize * k;
      if (flat.lineHeight) scaled.lineHeight = flat.lineHeight * k;
      style = [rawStyle, scaled];
    }
  }
  const base = {
    color: color ?? (muted ? tokens.muted : tokens.fg),
    fontSize: size * k,
    fontWeight: weight,
    textAlign: "left" as const,
  };
  if (!fontsReady || typeof children !== "string") {
    return <RNText {...rest} style={[base, style]}>{children}</RNText>;
  }
  const runs = runsOf(children);
  const family = (ar: boolean) => ({ fontFamily: familyOf(ar, weight), fontWeight: undefined });
  /* 🔴 D-981 — **النصُّ الفارغ بلا مقاطع**: `runs[0].ar` على `""` كان يُسقط الشجرةَ كلَّها
     (أوّلُ `AppCrash` في السجلّ، D-974: «Cannot read property 'ar' of undefined» في
     `TitleScreen` — الشاشةُ السوداء عند فتح فيلم بلا شعارٍ أو وصف). الفارغُ يُرسم فارغاً. */
  if (runs.length === 0) {
    return <RNText {...rest} style={[base, style]}>{children}</RNText>;
  }
  if (runs.length === 1) {
    return <RNText {...rest} style={[base, family(runs[0].ar), style]}>{children}</RNText>;
  }
  return (
    <RNText {...rest} style={[base, family(runs[0].ar), style]}>
      {runs.map((r, i) => (
        <RNText key={i} style={family(r.ar)}>{r.s}</RNText>
      ))}
    </RNText>
  );
}

/**
 * Phase 11-I — `size:"sm"` هو `buttonClass({size:"sm"})` في الويب (٣٢ ارتفاعاً · نصٌّ ١٢): زرُّ
 * «سحب»/«رفع الحظر» في صفوف الناس. **مقاسٌ في المصنع نفسِه لا زرٌّ ثانٍ** (القاعدة ٣).
 */
export function Button({
  label,
  variant = "primary",
  size = "md",
  busy,
  style,
  ...rest
}: PressableProps & { label: string; variant?: "primary" | "ghost" | "danger"; size?: "md" | "sm"; busy?: boolean }) {
  const { tokens } = useApp();
  const k = useFontScale(); /* D-1105 — نصُّ الزرّ نصُّ واجهة؛ ارتفاعُه أدنى لا ثابت فيتّسع */
  const sm = size === "sm";
  const bg =
    variant === "primary" ? tokens.accent : variant === "danger" ? tokens.error : "transparent";
  const fg = variant === "primary" ? tokens.onAccent : variant === "danger" ? "#fff" : tokens.fg;
  return (
    <Pressable
      {...rest}
      disabled={busy || rest.disabled}
      style={({ pressed }) => [
        styles.button,
        sm ? { minHeight: 32, paddingVertical: 0, paddingHorizontal: space.md } : null,
        {
          backgroundColor: bg,
          borderColor: variant === "ghost" ? tokens.border : bg,
          opacity: pressed || busy ? 0.7 : 1,
        },
        typeof style === "function" ? undefined : style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <RNText style={{ color: fg, fontWeight: "600", fontSize: (sm ? 12 : 15) * k }}>{label}</RNText>}
    </Pressable>
  );
}

export function Loading() {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={tokens.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
});

/* 🗑️ D-944: `Poster` · `Card` · `Rail` · `PosterTile` حُذفت — كانت وحداتِ الشاشات
   الأصليّة التسع (D-919) التي أُلغيت بـD-922، وبقيت بلا قارئٍ منذ ٥ سبتمبر (دَينُ
   `05` رقم ٢١/٢٩). بطاقةُ المكتبة الأصليّة لها `library/PosterCard.tsx` بقيم الويب. */

/** مضيفُ الرسائل الواحد في التطبيق (انتقل من `LibraryScreen` إلى هنا في D-958 — «اكتشف» تحتاجه، ومضيفٌ ثانٍ خطأ) — نسخةُ `ToastHost` (الويب) بنغمة الخطأ: كبسولةٌ `rounded-full border bg-elevated ps-4 py-2.5 text-sm` بحدٍّ ونصٍّ بلون `--error`، على ارتفاع `5.5rem + safe-area` */
/**
 * 🆕 D-1047 (F5) — `action` اختياريّ: **«تراجع» داخل الإشعار الواحد** لا إشعارٌ ثانٍ (مضيفُ الإشعار واحد). بلا فعلٍ
 * يبقى كما كان حرفاً ولا يلتقط لمساً؛ وبفعلٍ تصير حبّتُه وحدَها قابلةً للضغط (`box-none` حولها).
 */
export function Toast({ text, bottom, action }: { text: string; bottom: number; action?: { label: string; onPress: () => void } }) {
  const { tokens } = useApp();
  return (
    <View pointerEvents={action ? "box-none" : "none"} style={{ position: "absolute", left: 16, right: 16, bottom: bottom + 72, alignItems: "center" }}>
      <View
        style={{
          maxWidth: 448,
          paddingStart: 16,
          paddingEnd: 16,
          paddingVertical: 10,
          borderRadius: radius.pill,
          backgroundColor: tokens.elevated,
          borderWidth: 1,
          borderColor: tokens.error + "66",
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }}
      >
        {action ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Text size={14} color={tokens.error} numberOfLines={1} style={{ flexShrink: 1 }}>{text}</Text>
            <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
              <Text size={14} weight="700" color={tokens.accent}>{action.label}</Text>
            </Pressable>
          </View>
        ) : (
          <Text size={14} color={tokens.error}>{text}</Text>
        )}
      </View>
    </View>
  );
}
