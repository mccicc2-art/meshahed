import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  I18nManager,
  Platform,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "./state";
import { radius, space } from "./theme";
import { ARABIC_RE, familyOf, type Weight } from "./fonts";
import { deviceLocale } from "./i18n";
import { isRtl } from "@/core/i18n";
import { SYSTEM_FONT_CAP, useFontScale } from "./fontScale";

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

/** أوّلُ حرفٍ قويّ: `true` عربيّ · `false` لاتينيّ · `null` لا حروف (أرقامٌ · رموز · فارغ) */
export function firstStrongRtl(text: string): boolean | null {
  for (const ch of text) {
    if (ARABIC_RE.test(ch) && !/[\u0660-\u0669\u06F0-\u06F9\u060C\u061B\u061F\u066A-\u066D]/.test(ch)) return true;
    if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return false;
  }
  return null;
}

export function Text({
  muted,
  size = 15,
  weight = "400",
  color,
  content,
  autoDir,
  chat,
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
  /** 🆕 D-1434 — نصُّ الرسائل: يتبع الأكبرَ من «خطّ الواجهة» و«خطّ المحتوى» — أيُّ تكبيرٍ يعمله العضوُ يظهر في المحادثة */
  chat?: boolean;
  /** 🆕 D-1234 — النصُّ يبدأ من جهة لغته هو (`dir="auto"` الويب). `content` يتضمّنه؛ يُكتب وحدَه لكلام الناس الذي لا يتبع «خطَّ المحتوى» (النبذة) */
  autoDir?: boolean;
}) {
  const { tokens, fontsReady } = useApp();
  /* 🆕 D-1105 — حجمُ الخطّ: المقاسُ وارتفاعُ السطر يُضربان معاً (سطرٌ ثابتٌ تحت خطٍّ أكبر يقصّ الحروف)،
     وما كُتب في `style` مباشرةً يُضرب كذلك — فلا نصَّ ينجو من الإعداد لأنّه كُتب بطريقةٍ أخرى */
  const kOwn = useFontScale(content);
  const kContent = useFontScale(true);
  const k = chat ? Math.max(kOwn, kContent) : kOwn;
  /* 🆕 D-1484 — **كلامُ الناس أكبرُ بدرجة** (أحمد ٢٠ أكتوبر: «كبّر الخط درجة واحدة في المحتوى… في الكل»): مراجعةٌ ومنشورٌ
     وردٌّ ورسالة — كلُّ ما يحمل `content` أو `chat` — يزيد نقطةً قبل ضربه بالمعامل، والسطرُ نقطتين كي لا يضيق تحت الحرف.
     هنا لا في كلِّ شاشة: عشرُ شاشاتٍ تكتب `size={14} content` ولا تُعدَّل واحدةً واحدة (وتُنسى الحادية عشرة) */
  const step = content || chat ? 1 : 0;
  let style = rawStyle;
  if ((k !== 1 || step) && rawStyle) {
    const flat = StyleSheet.flatten(rawStyle);
    if (flat && (flat.fontSize || flat.lineHeight)) {
      const scaled: { fontSize?: number; lineHeight?: number } = {};
      if (flat.fontSize) scaled.fontSize = (flat.fontSize + step) * k;
      if (flat.lineHeight) scaled.lineHeight = (flat.lineHeight + step * 2) * k;
      style = [rawStyle, scaled];
    }
  }
  const base = {
    color: color ?? (muted ? tokens.muted : tokens.fg),
    fontSize: (size + step) * k,
    fontWeight: weight,
    textAlign: "left" as "left" | "right",
    writingDirection: undefined as "rtl" | "ltr" | undefined,
  };
  /* 🆕 D-1234 — **كلامُ الناس يبدأ من جهة لغته لا من جهة الواجهة** (أحمد، ٣ أكتوبر: «العربية تبدأ من اليمين،
     الإنجليزي من اليسار» — مراجعةٌ عربيّةٌ في واجهةٍ إنجليزيّة كان سطرُها الأخير يقف يساراً). الجهةُ من **أوّل
     حرفٍ قويّ** (عربيّ أو لاتينيّ؛ الأرقامُ والرموزُ لا تقرّر — قاعدةُ `dir="auto"`)، ونصٌّ بلا حروفٍ يبقى على الواجهة.
     ⚠️ `"left"` في RN هي **بدايةُ اتجاه الواجهة** و`"right"` نهايتُه (تُقلبان في RTL)، فالمكتوبُ «عكسُ الواجهة أم لا»
     لا «يمين أم يسار». و`style` الصريح (توسيط) ما زال يغلب لأنّه يأتي بعد `base`. */
  if ((content || autoDir || chat) && typeof children === "string") {
    const rtl = firstStrongRtl(children);
    if (rtl !== null) {
      base.textAlign = rtl === I18nManager.isRTL ? "left" : "right";
      base.writingDirection = rtl ? "rtl" : "ltr";
    }
  }
  if (!fontsReady || typeof children !== "string") {
    return <RNText maxFontSizeMultiplier={SYSTEM_FONT_CAP} {...rest} style={[base, style]}>{children}</RNText>;
  }
  const runs = runsOf(children);
  const family = (ar: boolean) => ({ fontFamily: familyOf(ar, weight), fontWeight: undefined });
  /* 🆕 D-1498 — **العربيُّ ينزل إلى وسط سطره على الآيفون** (لقطةُ أحمد ٢١ أكتوبر: «النص ماهو متوسط الأيقونة طالع فوق سطر
     الأيقونة بشوي»). مقاييسُ Tajawal (من ملفّه: صعود ٦٤٣ · هبوط ٣٥٧ · فجوة ٢٠٠ من ١٠٠٠) تجعل صندوقَ السطر أطولَ من جسم الحرف
     في أسفله، فتتوسّط الأيقونةُ الصندوقَ ويقع الحرفُ فوق وسطه — قيس في اللقطة نحو ٠٫١٢–٠٫١٨ من مقاس الخطّ. الإزاحةُ رسمٌ لا
     تخطيط (`translateY`): الصندوقُ ومن حوله لا يتحرّكان، والحرفُ وحدَه ينزل. أندرويد يحسب السطرَ بمقاييس أخرى ولم يُقَس — لا يُمسّ */
  const nudge = Platform.OS === "ios" && runs.length > 0 && runs[0].ar ? arabicNudge([base, style]) : null;
  /* 🔴 D-981 — **النصُّ الفارغ بلا مقاطع**: `runs[0].ar` على `""` كان يُسقط الشجرةَ كلَّها
     (أوّلُ `AppCrash` في السجلّ، D-974: «Cannot read property 'ar' of undefined» في
     `TitleScreen` — الشاشةُ السوداء عند فتح فيلم بلا شعارٍ أو وصف). الفارغُ يُرسم فارغاً. */
  if (runs.length === 0) {
    return <RNText maxFontSizeMultiplier={SYSTEM_FONT_CAP} {...rest} style={[base, style]}>{children}</RNText>;
  }
  if (runs.length === 1) {
    return <RNText maxFontSizeMultiplier={SYSTEM_FONT_CAP} {...rest} style={[base, family(runs[0].ar), style, nudge]}>{children}</RNText>;
  }
  return (
    <RNText maxFontSizeMultiplier={SYSTEM_FONT_CAP} {...rest} style={[base, family(runs[0].ar), style, nudge]}>
      {runs.map((r, i) => (
        <RNText key={i} style={family(r.ar)}>{r.s}</RNText>
      ))}
    </RNText>
  );
}

/** D-1498 — نسبةُ النزول من مقاس الخطّ (انظر رأسَ `Text`). تُضاف إلى `transform` القائم إن وُجد فلا تمحوه */
const AR_NUDGE = 0.12;
function arabicNudge(style: StyleProp<TextStyle>): TextStyle | null {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fs = flat?.fontSize;
  if (!fs) return null;
  const own = Array.isArray(flat?.transform) ? flat.transform : [];
  return { transform: [...own, { translateY: Math.round(fs * AR_NUDGE * 10) / 10 }] } as TextStyle;
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
          /* D-1324 — المعطَّلُ يبهت كالويب (`disabled:opacity-60`): كان يبدو فعّالاً فيُضغط ولا يحدث شيء */
          opacity: rest.disabled && !busy ? 0.6 : pressed || busy ? 0.7 : 1,
        },
        typeof style === "function" ? undefined : style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <RNText maxFontSizeMultiplier={SYSTEM_FONT_CAP} style={{ color: fg, fontWeight: "600", fontSize: (sm ? 12 : 15) * k }}>{label}</RNText>}
    </Pressable>
  );
}

/**
 * 🆕 D-1460 — **سهمُ الرجوع الواحد** (كان مرسوماً بيده في تسع شاشات، فخرج «^» في الحساب كما خرج في صفحة العمل — D-1458).
 * حدّان منطقيّان (بدايةٌ + أعلى) يُقلبان مع اللغة، **والدورانُ يتبع الاتّجاه معهما**: ‎-45° في LTR تعطي «<»، وفي RTL
 * يصير حدُّ البداية الأيمن فتعطي ‎-45° «^» — لذا +45° ⇒ «>». السهمُ يشير دائماً إلى حيث يعود الرجوع.
 */
export function BackChevron({ color }: { color: string }) {
  return <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: I18nManager.isRTL ? "45deg" : "-45deg" }], marginStart: 4 }} />;
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
/**
 * 🆕 D-1323 — **`tone` كنغمات `ToastHost` (الويب) الثلاث** (مراجعةُ «التخصيص» ٨ أكتوبر: «حُفظت التغييرات» كانت تُرسم
 * بلون الخطأ). الإشعارُ نُقل إلى التطبيق بنغمة الخطأ وحدَها فلبستها رسائلُ النجاح. **الافتراضيُّ يبقى `error`** —
 * فكلُّ منادٍ قائمٍ يرسم كما كان حرفاً، والنجاحُ يُعلَن صراحةً حيث يُعرف (`success` · `info`).
 */
export type ToastTone = "error" | "success" | "info";
/** إشعارُ شاشةٍ تحمله في حالتها (ملفّ الشخص · الفنّان · البحث · صفحة العمل) — `useReducer(toastReducer, null)`:
 *  نصٌّ وحدَه خطأ (كما كان)، و`{ text, tone }` لما يُعلن نغمتَه، و`null` يمحو. `dispatch` ثابتُ الهويّة فلا يدخل قوائمَ الاعتماد. */
export type ToastNote = { text: string; tone: ToastTone };
export function toastReducer(_: ToastNote | null, next: string | ToastNote | null): ToastNote | null {
  return next == null ? null : typeof next === "string" ? { text: next, tone: "error" } : next;
}
export function Toast({ text, bottom, action, tone = "error" }: { text: string; bottom: number; action?: { label: string; onPress: () => void }; tone?: ToastTone }) {
  const { tokens } = useApp();
  const ink = tone === "success" ? tokens.success : tone === "info" ? tokens.fg : tokens.error;
  const edge = tone === "info" ? tokens.border : ink + "66";
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
          borderColor: edge,
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }}
      >
        {action ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Text size={14} color={ink} numberOfLines={1} style={{ flexShrink: 1 }}>{text}</Text>
            <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
              <Text size={14} weight="700" color={tokens.accent}>{action.label}</Text>
            </Pressable>
          </View>
        ) : (
          <Text size={14} color={ink}>{text}</Text>
        )}
      </View>
    </View>
  );
}
