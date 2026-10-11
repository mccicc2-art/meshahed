import React, { useCallback } from "react";
import { ActivityIndicator, BackHandler, Platform, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "./api";
import { BUILD_TAG } from "./ota";
import { shell } from "./shell";
import { useBootRoot, type RootPath } from "./bootRoot";
import { dropAfterCrash } from "./cachePersist";
import { useApp } from "./state";
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
 *
 * 🔴 **V-B (D-1356 · ١١ أكتوبر ٢٠٢٦) — الشاشةُ الساقطة لا تفتح الويب** (قرارا أحمد ٦ و١٠ في خطّة 11-V: «حاول مجدداً»،
 * وبلا زرّ «افتح نسخة الويب»). ما فوق تاريخٌ: كان الويبُ البديلَ يومَ كان المنتجَ (D-922)، وصار ما نُخرج المستخدمَ منه.
 * الآن: البلاغُ كما هو، ثمّ رسالةٌ بثيم المستخدم و«حاول مجدداً» **يعيد تركيبَ الشاشة من الصفر** (`round` مفتاحُ الأبناء).
 *  - **سقوطٌ ثانٍ ⇒ المحاولةُ التالية تمسح الكاش أوّلاً** (`dropAfterCrash`، مرّةً لكلِّ حارس): الحمولاتُ تُحفظ على الجهاز
 *    سبعةَ أيام (D-1026)، فحمولةٌ تُسقط الرسمَ تُسقطه في كلِّ تركيبٍ وبعد كلِّ إقلاع — وكان الويبُ يستر ذلك.
 *  - **الجذورُ الخمسة (`root`)**: الشاشةُ الساقطة أخذت معها مستمعَ رجوع النظام (`useBootRoot` داخلها)، فرجوعُ أندرويد كان
 *    سينزع مجموعةَ التبويبات ويكشف رئيسيّةَ الويب تحتها — تسريبٌ جديد. الرسالةُ تحمل القاعدةَ نفسَها (`bootBack`) وهي ظاهرة.
 *    والشريطُ السفليّ يبقى: `DockLink` الساقطُ يُنزع فيعود `TabDock` إلى تبديله العامّ ظاهراً غيرَ مقفول.
 *  - **الشاشاتُ المدفوعة**: «إغلاق» تحت «حاول مجدداً» — بلا ترويسةٍ لا يبقى في iOS إلّا سحبُ الحافّة.
 *  - ⚖️ **الترحيبُ وحدَه يبقى يسقط إلى ترحيب الويب** (`web`، استثناءٌ مؤقّتٌ حتى V-D بقرار أحمد): بوّابةٌ عمرُها يوم، ومن
 *    يسقط عندها بلا بديلٍ لا يدخل التطبيقَ أصلاً.
 */
const ACCENT = tokensOf(null).accent;

/** نصّا بديل الترحيب (`web`) كما كانا — رسالةُ بقيّة الشاشات من القاموس (`errorTitle` · `errorRetry` · `closeLabel`) */
const FALLBACK = {
  ar: { title: "صار خلل غير متوقّع", open: "افتح في الويب" },
  en: { title: "Something went wrong", open: "Open in the web" },
} as const;

type Props = {
  /** اسمُ الشاشة كما يُسجَّل (`library` · `discover` · `title`) */
  screen: "library" | "discover" | "title" | "person" | "list" | "search" | "home" | "settings" | "community" | "thread" | "messages" | "profile" | "welcome";
  /** جذرٌ في مجموعة التبويبات: الرسالةُ تمسك رجوعَ النظام بقاعدة الجذر، وبلا «إغلاق» (الشريطُ السفليّ بابُه) */
  root?: RootPath;
  /** ⚖️ الترحيبُ وحدَه (حتى V-D): صفحتُه الويبيّةُ بديلُه، و`leave` يُغلق الشاشةَ الساقطة بعد وصولها */
  web?: { path: string; leave: () => void };
  children: React.ReactNode;
};

type State = { error: Error | null; round: number };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, round: 0 };
  private left = false;
  private crashes = 0;
  private healed = false;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.crashes += 1;
    /* الإبلاغُ أوّلاً وبلا انتظار — كلُّ سقوطٍ يُبلَّغ، والمعادُ منه كذلك */
    void api("/api/v1/app/crash", {
      method: "POST",
      body: {
        screen: this.props.screen,
        message: `${error.name}: ${error.message}`,
        stack: (info.componentStack ?? error.stack ?? "").split("\n").slice(0, 8).join("\n"),
        version: BUILD_TAG,
      },
    }).catch(() => {});
    if (this.props.web) this.escape();
  }

  /** الترحيبُ وحدَه: صفحتُه الويبيّةُ تحت الشاشة، ثمّ الخروج — مرّةً واحدة */
  private escape = () => {
    const web = this.props.web;
    if (!web || this.left) return;
    this.left = true;
    void shell.open(web.path).then(() => web.leave());
  };

  /** تركيبٌ جديدٌ للشاشة؛ وبعد سقوطٍ ثانٍ يُمسح الكاشُ قبله (مرّةً — مسحٌ مع كلِّ ضغطةٍ هياكلُ بلا نهاية) */
  private retry = () => {
    if (this.crashes >= 2 && !this.healed) {
      this.healed = true;
      dropAfterCrash();
    }
    this.setState((s) => ({ error: null, round: s.round + 1 }));
  };

  render() {
    if (!this.state.error) return <React.Fragment key={this.state.round}>{this.props.children}</React.Fragment>;
    if (this.props.web) {
      const t = FALLBACK[currentLocale() === "ar" ? "ar" : "en"];
      return (
        <View style={{ flex: 1, backgroundColor: SHELL_BG, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl }}>
          <ActivityIndicator color={ACCENT} />
          <Text muted style={{ textAlign: "center" }}>{t.title}</Text>
          <Button label={t.open} onPress={() => { this.left = false; this.escape(); }} style={{ minWidth: 180 }} />
        </View>
      );
    }
    return <CrashMessage root={this.props.root} onRetry={this.retry} />;
  }
}

/**
 * رسالةُ السقوط — مكوّنٌ دالّيٌّ لأنّ الثيمَ والقاموسَ والتركيزَ خطّافات. ⚠️ **يبقى صغيراً**: لا حارسَ فوقه، فخطأٌ فيه
 * هو الشاشةُ السوداء التي وُجد الحارسُ ليمنعها.
 */
function CrashMessage({ root, onRetry }: { root?: RootPath; onRetry: () => void }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const { bootBack } = useBootRoot();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  /* مستمعُ الجذر وهو ظاهرٌ وحدَه (K3: الجذورُ مركَّبةٌ معاً) — نصُّ ما في كلِّ جذرٍ سليم. المدفوعةُ يكفيها رجوعُ المكدّس */
  useFocusEffect(
    useCallback(() => {
      if (!root || Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (bootBack(root)) return true;
        back();
        return true;
      });
      return () => sub.remove();
    }, [root, bootBack, back]),
  );
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl }}>
      <Text muted style={{ textAlign: "center" }}>{t.errorTitle}</Text>
      <Button label={t.errorRetry} onPress={onRetry} style={{ minWidth: 180 }} />
      {root ? null : <Button label={t.closeLabel} variant="ghost" onPress={back} style={{ minWidth: 180 }} />}
    </View>
  );
}
