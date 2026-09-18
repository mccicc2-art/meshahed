import React from "react";
import { ActivityIndicator, View } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";
import { shell } from "./shell";
import { Button, Text } from "./ui";
import { SHELL_BG, space, tokensOf } from "./theme";
import { currentLocale } from "./i18n";

/**
 * ====== حارسُ الشاشات الأصليّة — D-974 (١٥ سبتمبر ٢٠٢٦) ======
 *
 * **بلاغُ أحمد بتسجيل على 1.8.5**: «ضغطت على فلم ما دخلني صفحته، الشاشة صارت
 * سوداء، ثمّ رجعت للخلف وخرجني من التطبيق». لم يكن في التطبيق حارسُ أخطاءٍ
 * واحد: خطأُ رسمٍ في `TitleScreen` يُسقط شجرةَ React كلَّها — **فالشاشةُ سوداء لأنّ
 * لا شيءَ يُرسم، والرجوعُ يخرج لأنّ لا مكدّسَ بقي.**
 *
 * 🔑 **الويبُ هو البديل** (D-922: الويبُ المنتجُ والتطبيقُ بابٌ إليه): الشاشةُ
 * التي تسقط تفتح صفحتَها الويبيّةَ في الغلاف تحتها فوراً (`shell.open`) ثمّ
 * تُغلق — فما يراه المستخدم هو الصفحةُ نفسُها التي كان يراها قبل Phase 11،
 * لا شاشةَ خطأ. **وزرٌّ يبقى** لمن لم يصل الغلافُ إليه (مهلةُ D-951).
 *
 * 🔑 **ويبلّغ سقوطَه** إلى `/api/v1/app/crash` (⇢ `runtime_errors` بنوع
 * `AppCrash`): الحاويةُ لا تصل الهاتف، و`logcat` محجوبٌ بالهاتف (A0) — **فالسطرُ
 * الذي سقط يُقرأ في لوحة الإدارة لا يُخمَّن.** الإبلاغُ صامتٌ ولا يحبس البديل.
 *
 * ⚖️ **حارسٌ لكلِّ شاشةٍ لا للجذر**: حارسٌ فوق `Stack` كلِّه يستبدل الموجِّهَ
 * فيخسر المكدّس — وهو العطلُ نفسُه بوجهٍ آخر. كلُّ مسارٍ أصليّ (`library` ·
 * `discover` · `title`) يلفّ نفسَه ويقول أين يهرب.
 */
const APP_VERSION = Constants.expoConfig?.version ?? "0";
const ACCENT = tokensOf(null).accent;

const FALLBACK = {
  ar: { title: "صار خلل غير متوقّع", open: "افتح في الويب" },
  en: { title: "Something went wrong", open: "Open in the web" },
} as const;

type Props = {
  /** اسمُ الشاشة كما يُسجَّل (`library` · `discover` · `title`) */
  screen: "library" | "discover" | "title" | "person" | "list";
  /** مسارُ الصفحة الويبيّة البديلة (`/library` · `/news` · `/show/123`) */
  webPath: string;
  /** الشاشةُ الأصليّة التي يعود إليها الرجوعُ من البديل (D-949) — لصفحة العمل */
  returnTo?: "library" | "discover";
  /** يُنادى بعد فتح البديل لإغلاق الشاشة الساقطة (`router.back` أو `replace("/web")`) */
  onLeave: () => void;
  children: React.ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  private left = false;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    /* الإبلاغُ أوّلاً وبلا انتظار — ثمّ البديل */
    void api("/api/v1/app/crash", {
      method: "POST",
      body: {
        screen: this.props.screen,
        message: `${error.name}: ${error.message}`,
        stack: (info.componentStack ?? error.stack ?? "").split("\n").slice(0, 8).join("\n"),
        version: APP_VERSION,
      },
    }).catch(() => {});
    this.escape();
  }

  /** الصفحةُ الويبيّةُ نفسُها تحت الشاشة، ثمّ الخروج — مرّةً واحدة */
  private escape = () => {
    if (this.left) return;
    this.left = true;
    void shell.open(this.props.webPath, this.props.returnTo ? { returnTo: this.props.returnTo } : undefined).then(() => this.props.onLeave());
  };

  render() {
    if (!this.state.error) return this.props.children;
    const t = FALLBACK[currentLocale() === "ar" ? "ar" : "en"];
    return (
      <View style={{ flex: 1, backgroundColor: SHELL_BG, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl }}>
        <ActivityIndicator color={ACCENT} />
        <Text muted style={{ textAlign: "center" }}>{t.title}</Text>
        <Button label={t.open} onPress={() => { this.left = false; this.escape(); }} style={{ minWidth: 180 }} />
      </View>
    );
  }
}
