import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, Linking, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase, useAuth } from "../src/auth";
import { CONFIG } from "../src/config";
import { File, Paths } from "expo-file-system";
import { currentLocale, webLocale } from "../src/i18n";
import { Button, Loading, Text } from "../src/ui";
import { SHELL_BG, space } from "../src/theme";
import { perfMs } from "../src/perf";
import { BACKGROUND_CLEAR_MS, session } from "../src/session";
import { shell } from "../src/shell";
import { BottomNav, type NavKey } from "../src/BottomNav";
import { prefetchDiscover } from "../src/discover/DiscoverScreen";

/**
 * ====== الغلافُ الهجين — الويبُ نفسُه داخل التطبيق (D-922) ======
 *
 * 🔴 **لماذا هجين؟** قرارُ أحمد (٥ سبتمبر): «لازم يكون مطابق ١٠٠٪». الشاشاتُ
 * الأصليّة (D-919) كانت تعيد بناءَ ما في الويب بأدواتٍ أخرى، وكلُّ سطرٍ
 * فيها فرقٌ محتمل. الويبُ هو المنتج؛ التطبيقُ **بابٌ** إليه لا نسخةٌ منه.
 *
 * 🔑 **الدخولُ وحدَه أصليّ**: Google ترفض OAuth داخل WebView، فالصفحةُ ترسل
 * `login` عبر الجسر (`GoogleButton`)، ونفتح متصفّحَ النظام (PKCE، الطريقُ
 * الذي شحن في 1.0)، ثمّ **نسلّم الرمزين في جسم POST** إلى
 * `/api/v1/session/handoff` فيكتب الخادمُ كوكيَ الجلسة نفسَه الذي يكتبه للويب.
 * التسليمُ نموذجٌ يُحقن في الصفحة ويُرسَل — لا تبديلَ لمصدر الـWebView،
 * فلا إعادةَ تحميلٍ ثانية حين تتغيّر الجلسةُ الأصليّة بعده.
 *
 * 🔴 **بعد التسليم لا يُنادى `signOut` أبداً — ولا بـ`scope: "local"`**
 * (٧ سبتمبر): هذا النداءُ يصل إلى الخادم ويُلغي الجلسةَ التي سُلِّمت للتوّ،
 * فكان كلُّ دخولٍ من التطبيق يُطرد بعد ثانيتين (`session_not_found`).
 * الجلسةُ الأصليّةُ الآن في الذاكرة فقط بلا تجديدٍ (`src/auth.tsx`)، وصاحبُ
 * الجلسة هو كوكي الـWebView — ونبضةُ الحضور تأتي منه بوسم
 * `LoopzApp/<version>` في وكيل المتصفّح، فتُكتب `is_app` من الترويسة.
 *
 * 🔑 **الروابطُ الخارجيّة تفتح خارجَ الغلاف** (يوتيوب، المتاجر): الغلافُ
 * لنطاق Loopz وحدَه. **وزرُّ الرجوع** يرجع في تاريخ الصفحة قبل أن يغلق.
 *
 * 🆕 **ولقطةُ الودجت تمرّ من هنا** (D-929): الصفحةُ ترسل `widget` عبر الجسر،
 * والغلافُ يكتبها ملفّاً واحداً يقرؤه كوتلن. **ولا وحدةَ أصليّةً للكتابة**:
 * `documentDirectory/widget.json` هو نفسُه `context.filesDir/widget.json`.
 *
 * 🆕 **والودجتُ تفتح صفحةَ العمل لا الرئيسيّة**: تُرسل
 * `com.loopztv.app://web?u=/show/123`، **ومسارُ `web` هذا موجودٌ في الموجِّه**
 * فلا تظهر «غير موجود»، والوسيطُ يُقرأ هنا.
 * ⚠️ **ولا يُنتقل قبل أوّل تحميلٍ ناجح**: طلبُ التسليم (POST) يجب أن يكتب
 * الكوكي أوّلاً — **وانتقالٌ يسبقه يفتح الصفحةَ ضيفاً ثمّ يقفز**، وهو وميضُ
 * «مسجَّلٌ ثمّ غيرُ مسجَّل» الذي عولج في D-910. فيُحفظ الهدفُ ويُنفَّذ بعدها.
 *
 * 🆕 **Phase 11 · B1 (D-936) — الشاشةُ الأصليّةُ فوق الـWebView**: رسالةُ
 * `native {route:"library"}` (من زرّ المكتبة، للإدارة وحدَها) تدفع `/library`
 * فوق هذه الشاشة **وهذه تبقى مركَّبةً تحتها** — الرجوعُ لا يُعيد تحميلَ شيء.
 * ورمزُ الوصول للشاشة الأصليّة يمرّ من `src/session.ts` **بطلبٍ بـnonce
 * وذاكرةٍ فقط** — انظر عقدَ الأمان هناك. **والمسحُ من ثلاثة أبواب**: رسالةُ
 * الصفحة، وعنوانُ الخروج في التاريخ (حزامٌ لا يعتمد على JS الصفحة)،
 * وخلفيّةٌ أطولُ من خمس دقائق.
 */
const HOME = CONFIG.apiBase + "/";
/**
 * 🆕 **إعلانُ القدرة قبل المستند** (٩ سبتمبر — بلاغُ أحمد «لا أستطيع الدخول إلى
 * المكتبة»): الويبُ كان يبتلع ضغطةَ «المكتبة» لكلِّ غلافٍ يحمل الوسم، والمثبَّتُ
 * 1.2.3 لا يعرف `native`. **فالغلافُ الذي يعرف الشاشةَ يقولها** بحقن
 * `window.LoopzNative` قبل تحميل الصفحة، والويبُ لا يبتلع الضغطةَ بدونها.
 * تُحقن في كلِّ الإطارات لكنّ الرسالةَ تُقبل من `INSIDE` وحدَه (`onMessage`).
 */
/* D-1000 — `title`: الغلافُ يفتح صفحةَ العمل أصليّةً من أيّ رابط عملٍ في الويب */
/* D-1012 — `nav`: الشريطُ السفليُّ أصليٌّ فوق كلِّ صفحةٍ ويبيّة، والويبُ يخفي شريطَه */
const CAPABILITIES = "window.LoopzNative={library:true,discover:true,title:true,nav:true};true;";
/**
 * 🔴 **والحقنُ مرّتين (١٤ سبتمبر — بلاغُ أحمد على 1.6.0: «المكتبة رجعت ويب»)**:
 * أوّلُ فتحٍ بعد التثبيت أعاد الصفحةَ ويبيّةً من أوّل ضغطة، وإغلاقٌ كامل أصلحها،
 * وتشخيصُ `NativeGate` لم يسجّل شيئاً بعدها. **التفسيرُ الوحيدُ المتّسق**: WebView
 * أندرويد يستعيد مستندَ الجلسة السابقة بعد الترقية **دون أن يعيد تشغيلَ حقنِ
 * «قبل المستند»** — فيغيب `LoopzNative` ويبقى الرابطُ رابطاً (بقرار ٩ سبتمبر).
 * حقنُ «بعد التحميل» يجري على كلِّ `onLoadEnd` بما فيه الاستعادةُ، **وهو احتياطٌ
 * لا بديل**: الأوّلُ يسبق كودَ الصفحة، والثاني يلحقه لكنّه يسبق أوّلَ ضغطة.
 */
const CAPABILITIES_LATE = "if(!window.LoopzNative)" + CAPABILITIES;
const HANDOFF = CONFIG.apiBase + "/api/v1/session/handoff";
const APP_VERSION = Constants.expoConfig?.version ?? "0";

/** النطاقاتُ التي تُعرض داخل الغلاف — ما عداها للمتصفّح الخارجيّ */
const INSIDE = new Set(["loopztv.com", "www.loopztv.com", "meshahed.vercel.app"]);

type Source = { uri: string };

/**
 * 🆕 **نصُّ شاشة الانقطاع هنا لا في `core/i18n`** — حجّةُ D-907 نفسُها:
 * القاموسُ يُشحن مع كلِّ شاشةِ ويب، **وهذه شاشةُ الغلاف وحدَه** ولا يراها
 * متصفّحٌ أبداً. سطران لا يستحقّان مفتاحين عامَّين.
 */
const OFFLINE = {
  ar: { title: "لا اتّصال بالإنترنت", hint: "تحقّق من الشبكة ثمّ أعِد المحاولة.", retry: "أعِد المحاولة" },
  en: { title: "No internet connection", hint: "Check your network and try again.", retry: "Try again" },
} as const;

/** نموذجُ تسليمٍ يُحقن في الصفحة ويُرسَل فوراً — الرمزان في الجسم لا في العنوان */
function handoffScript(access: string, refresh: string): string {
  return `(function(){var f=document.createElement('form');f.method='POST';f.action=${JSON.stringify(HANDOFF)};
var a=document.createElement('input');a.type='hidden';a.name='access_token';a.value=${JSON.stringify(access)};
var r=document.createElement('input');r.type='hidden';r.name='refresh_token';r.value=${JSON.stringify(refresh)};
f.appendChild(a);f.appendChild(r);document.body.appendChild(f);f.submit();})();true;`;
}

/** هل عنوانُ الرسالة/الصفحة من نطاقنا؟ — شرطُ قبول أيِّ رسالةٍ ذاتِ أثر */
function insideUrl(url: string | undefined): boolean {
  try {
    return !!url && INSIDE.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/* D-1035 — مساراتٌ لها خانتُها في الشريط: بلوغُ أحدها يُنهي «من أين جئت» */
const ROOTS = ["/library", "/news", "/discover", "/people", "/community", "/search"];

export default function Web() {
  const { loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const t = OFFLINE[currentLocale() === "ar" ? "ar" : "en"];
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [path, setPath] = useState("/");
  /* D-1035 — من أيِّ شاشةٍ أصليّةٍ فُتحت الصفحةُ الحاليّة؛ يُمسح عند أوّل صفحةٍ لها خانتُها، فلا يلاحق
     صاحبَه إلى صفحاتٍ فتحها بعد ذلك من «الرئيسيّة» */
  const [origin, setOrigin] = useState<"library" | "discover" | null>(null);
  const handing = useRef(false);
  /* الهدفُ المؤجَّل من الودجت — يُنفَّذ بعد أوّل تحميلٍ ناجحٍ لا قبله */
  const pending = useRef<string | null>(null);
  const { u } = useLocalSearchParams<{ u?: string }>();
  /* المصدرُ يُحسب مرّةً: الرئيسيّةُ دائماً — كوكي الـWebView تحمل الجلسةَ إن
     كانت. (تسليمٌ عند الإقلاع من جلسةٍ مخزونة لم يعد له مصدر: لا مخزن.) */
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    if (loading || source) return;
    setSource({ uri: HOME });
  }, [loading, source]);

  /** ينقل الـWebView إلى الهدف المحفوظ — بحقن `location.href` لا بتبديل
      المصدر: تبديلُ المصدر يُعيد تركيبَ العرض ويفقد تاريخَ الرجوع. */
  const flush = useCallback(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    ref.current?.injectJavaScript(`location.href=${JSON.stringify(target)};true;`);
  }, []);

  useEffect(() => {
    if (typeof u !== "string" || !u || !u.startsWith("/")) return;
    pending.current = CONFIG.apiBase + u;
    setOrigin(shell.returnTo);
    if (ready && !handing.current) flush();
  }, [u, ready, flush]);

  const onNav = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    /* D-1012 — الخانةُ المضيئةُ تُقرأ من المسار (الويبُ لم يعد يرسم شريطَه داخل الغلاف) */
    let next = "/";
    try {
      next = new URL(nav.url).pathname;
    } catch {
      /* عنوانٌ لا يُقرأ ⇒ الرئيسيّة */
    }
    setPath(next);
    if (next === "/" || ROOTS.some((r) => next.startsWith(r))) setOrigin(null);
    /* D-951 — الشاشةُ الأصليّة التي طلبت صفحةً تنتظر وصولَها قبل أن تُغلق */
    shell.arrived(nav.url, nav.loading);
    /* Phase 11 · B1 §٣ — الحزامُ الثاني للمسح: خروجٌ أو صفحةُ دخولٍ في
       التاريخ = لا جلسةَ للشاشة الأصليّة، بصرف النظر عمّا بثّته الصفحة. */
    if (nav.url.includes("/auth/signout") || nav.url.startsWith(CONFIG.apiBase + "/login")) session.signOut(); /* D-1026: خروجٌ ⇒ يُمسح الكاشُ المحفوظ أيضاً */
    /* وصلنا الرئيسيّةَ بعد التسليم ⇢ الصفحةُ تملك الكوكي. **لا خروجَ هنا**:
       الرمزان في الذاكرة بلا تجديدٍ، ونداءُ `signOut` — حتى `local` — يُلغي
       الجلسةَ عند الخادم (علّةُ ٧ سبتمبر). */
    if (handing.current && !nav.loading && nav.url.startsWith(HOME) && !nav.url.includes("/session/handoff")) {
      handing.current = false;
      flush();
    }
  }, [flush]);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let msg: { type?: string; items?: unknown[]; mark?: string; path?: string; images?: number; sincePathChange?: number; route?: string } = {};
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      const hostOk = insideUrl(e.nativeEvent.url);
      /* Phase 11 · B1 — رسائلُ الجلسة تُفحص في `session.ts` (nonce · JWT · exp · المضيف) */
      if (session.receive(msg as Record<string, unknown>, hostOk)) return;
      /* 🆕 D-946 — لغةُ الويب: تُقبل من نطاقنا وحدَه، وتُفحص القيمةُ في `webLocale.set` */
      if (msg.type === "locale") {
        if (hostOk) webLocale.set((msg as { lang?: unknown }).lang);
        return;
      }
      if (msg.type === "native") {
        /* الشاشةُ الأصليّةُ لا تُفتح لرسالةٍ من غير نطاقنا — المضيفُ شرطٌ هنا أيضاً */
        if (hostOk) shell.returnTo = null; /* D-998 — العودةُ سُلِّمت */
        if (hostOk && msg.route === "library") router.push("/library");
        /* Phase 11-C (D-955) — «اكتشف» الأصليّة فوق الـWebView بالطريقة نفسِها */
        if (hostOk && msg.route === "discover") router.push("/discover");
        /* 🆕 D-1000 — **رابطُ عملٍ في أيّ صفحةٍ ويبيّة يفتح `TitleScreen` الأصليّة** (سؤالُ أحمد:
           «إذا دخلت على فلم من داخل ليست يفتح ويبيّة، ليش؟»): الصفحاتُ التي لم تُنقل بعد
           (القوائم · البحث · الرئيسيّة · المجتمع) تبقى ويبيّة، لكنّ الأعمالَ منها أصليّة.
           `from=web`: الرجوعُ يعود إلى الصفحة الويبيّة نفسِها، وأبوابُ الشاشة تفتح بلا `returnTo`. */
        if (hostOk && msg.route === "title") {
          const m = msg as { kind?: unknown; id?: unknown };
          const kind = m.kind === "movie" ? "movie" : m.kind === "tv" ? "tv" : null;
          const id = Number(m.id);
          if (kind && Number.isInteger(id) && id > 0) router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: "web" } });
        }
        return;
      }
      /* 🆕 D-929 — لقطةُ الودجت: تُكتب ملفّاً ويقرؤها `LoopzWidget.kt` كلَّ
         نصف ساعة. **والفشلُ صمتٌ**: ودجتٌ قديمةٌ خيرٌ من شاشةٍ تسقط. */
      /* Phase 11 · A0-prep — علاماتُ الصفحة تُختم بساعة الغلاف عند الاستلام
         (`adb logcat -s ReactNativeJS`)؛ تسجيلٌ لا سلوك، ولا يُرسَل شيءٌ لأحد. */
      if (msg.type === "perf") {
        console.log(`[perf] ${msg.mark} t=${perfMs()}ms (js-entry clock) path=${msg.path} images=${msg.images} sincePathChange=${msg.sincePathChange}`);
        return;
      }
      if (msg.type === "widget") {
        try {
          const f = new File(Paths.document, "widget.json");
          f.write(JSON.stringify(Array.isArray(msg.items) ? msg.items.slice(0, 3) : []));
        } catch {
          /* لا شيء */
        }
        return;
      }
      if (msg.type !== "login") return;
      const r = await signInWithGoogle();
      const { data } = await supabase.auth.getSession();
      if (r.ok && data.session) {
        handing.current = true;
        ref.current?.injectJavaScript(handoffScript(data.session.access_token, data.session.refresh_token));
        /* D-1003 — الجلسةُ جاهزة: نسخّن «اكتشف» بينما الويبُ يحمّل الرئيسيّة */
        prefetchDiscover();
      } else {
        ref.current?.injectJavaScript("window.dispatchEvent(new Event('loopz:login-cancel'));true;");
      }
    },
    [signInWithGoogle, router],
  );

  /* Phase 11 · B1 — الجسرُ يعرف كيف يحقن في هذه الـWebView ما دامت مركَّبة */
  useEffect(() => {
    const fn = (js: string) => ref.current?.injectJavaScript(js);
    session.attach(fn);
    shell.attach(fn);
    return () => {
      session.attach(null);
      shell.attach(null);
      session.clear();
    };
  }, []);

  /* Phase 11 · B1 §٦-ج — خلفيّةٌ أطولُ من خمس دقائق تمسح الرمز؛ العودةُ تطلب
     رمزاً جديداً قبل أوّل نداء (`api.ts` يطلب حين لا يجد). */
  useEffect(() => {
    let hiddenAt = 0;
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        if (hiddenAt && Date.now() - hiddenAt > BACKGROUND_CLEAR_MS) session.clear();
        hiddenAt = 0;
      } else if (!hiddenAt) {
        hiddenAt = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    let host = "";
    try {
      host = new URL(req.url).hostname;
    } catch {
      return true;
    }
    if (!host || INSIDE.has(host)) return true;
    // حزامُ أمان: لو وصلت الصفحةُ إلى Google بطريقٍ آخر يُفتح خارج الغلاف لا داخله
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  /** إعادةُ المحاولة: تُخفي الشاشةَ ثمّ تُعيد التحميل — **لا تبدّل المصدر**
      فلا يُعاد تسليمُ جلسةٍ سُلِّمت أصلاً. */
  const retry = useCallback(() => {
    setFailed(false);
    setReady(false);
    ref.current?.reload();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        ref.current?.goBack();
        return true;
      }
      /* D-998 — لا رجوعَ في الـWebView لكنّ الصفحةَ فُتحت من شاشةٍ أصليّة: نعود إليها لا نخرج */
      if (shell.returnTo) {
        const route = shell.returnTo;
        shell.returnTo = null;
        router.push(route === "discover" ? "/discover" : "/library");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, router]);

  /**
   * 🆕 D-1012 — **الشريطُ السفليُّ أصليٌّ في كلِّ مكان** (طلبُ أحمد بتسجيل: «الدوك في الأسفل
   * خلّه تطبيق أصليّ حتى عند الهوم والكوميونتي والسيرش، فيسير على نفس الخطّ والشكل وقت
   * التنقّل»): كان أصليّاً في المكتبة و«اكتشف» وويبيّاً في الباقي — فيرتجف عند كلِّ انتقال.
   * الآن الغلافُ يرسمه فوق الـWebView، والويبُ يخفي شريطَه داخل الغلاف (`nav` في القدرات).
   * الخانةُ المضيئةُ من مسار الصفحة، و«المكتبة»/«اكتشف» تدفعان الشاشةَ الأصليّة كما يفعل
   * شريطُ الويب اليوم.
   */
  const navKey: NavKey =
    path.startsWith("/library") ? "library"
    : path.startsWith("/news") || path.startsWith("/discover") ? "news"
    : path.startsWith("/people") || path.startsWith("/community") ? "people"
    : path.startsWith("/search") ? "search"
    /* 🔴 D-1035 — **صفحةٌ فُتحت من شاشةٍ أصليّة تُبقي خانتَها مضيئة** (بلاغُ أحمد بلقطة على 1.10.0: «دخلت
       لقائمة في ليست.. ليش فكّها لي في الهوم؟»): مسارُ `/list/…` لا يطابق خانةً فكان يسقط على «الرئيسيّة»
       — فيبدو أنّ التطبيق نقله إلى قسمٍ آخر. الآن ما لا خانةَ لمساره يرث **من أين جاء** (`origin` — تُؤخذ من
       `shell.returnTo` لحظةَ الفتح، وهي التي يعود إليها زرُّ الرجوع: الضوءُ والرجوعُ يقولان الشيءَ نفسَه)، والقوائمُ بلا أصلٍ
       معروفٍ بيتُها «المكتبة». الصفحةُ الرئيسيّةُ نفسُها (`/`) تبقى «الرئيسيّة» مهما كان الأصل. */
    : path === "/" || path === "" ? "home"
    : origin === "library" ? "library"
    : origin === "discover" ? "news"
    : path.startsWith("/list") ? "library"
    : "home";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SHELL_BG }}>
      {source ? (
        <WebView
          ref={ref}
          source={source}
          style={{ flex: 1, backgroundColor: SHELL_BG }}
          applicationNameForUserAgent={`LoopzApp/${APP_VERSION}`}
          injectedJavaScriptBeforeContentLoaded={CAPABILITIES}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
          injectedJavaScript={CAPABILITIES_LATE}
          onMessage={onMessage}
          onNavigationStateChange={onNav}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadStart={() => console.log(`[perf] onLoadStart t=${perfMs()}ms`)}
          onLoadEnd={() => { console.log(`[perf] onLoadEnd t=${perfMs()}ms`); setReady(true); if (!handing.current) flush(); }}
          /* 🔴 **بلا هذه كان الانقطاعُ يعرض صفحةَ خطأ أندرويد الخام**
             (`net::ERR_INTERNET_DISCONNECTED` بخطٍّ إنجليزيٍّ صغير) داخل
             تطبيقٍ عربيٍّ أسود — **أسوأُ ما يراه مختبِرٌ في أوّل نفق.** */
          onError={() => { setFailed(true); setReady(true); }}
          /* ولا تُحسب أخطاءُ HTTP انقطاعاً: صفحةُ 404 من موقعنا صفحتُنا. */
          onRenderProcessGone={() => { setReady(false); ref.current?.reload(); }}
          /* السحبُ للتحديث: غلافٌ بلا تحديثٍ يُجبر على قتل التطبيق لإعادة الفتح.
             ⚠️ **و`overScrollMode="never"` رُفعت من هنا**: المكتبةُ تلفّ العرضَ
             بـ`SwipeRefreshLayout` وتفرض `always` معه — **وخاصّيّتان تتنازعان
             تنتجان إيماءةً ميتةً بلا خطأ**، وهو أسوأُ من وهجٍ أزرق. */
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          domStorageEnabled
          javaScriptEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          /* 🔴 D-976 — **ملءُ الشاشة داخل النشاط لا خارجه** (بلاغُ أحمد بتسجيل على
             1.8.5: الخروجُ من ملء شاشة التريلر أعاد تحميلَ الصفحة — شعارُ الإقلاع ثمّ
             «اكتشف»): بلا هذه الخاصّيّة لا يملك WebView أندرويد عرضاً لملء الشاشة،
             فيرتجل يوتيوب طريقَه ويُترك المستندُ خلفه للسقوط. معها يعرض الغلافُ
             الفيديو في طبقةٍ فوق الصفحة والصفحةُ حيّةٌ تحتها — والاتّجاهُ اتّجاهُ
             التطبيق (عموديّ) لأنّ الخلاصةَ العموديّة لملء الشاشة بندٌ مؤجَّل. */
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          textZoom={100}
        />
      ) : null}
      {/* D-1012 — الشريطُ الأصليّ فوق الصفحة (لا يُرسم قبل أن تجهز الصفحة ولا فوق شاشة الخطأ) */}
      {ready && !failed ? (
        <BottomNav
          active={navKey}
          onGo={(k) => {
            if (k === "library") {
              router.push("/library");
              return;
            }
            if (k === "news") {
              router.push("/discover");
              return;
            }
            const to = k === "home" ? "/" : k === "people" ? "/people" : "/search";
            /* الملاحةُ في الصفحة نفسِها (تاريخُ الـWebView محفوظ) — لا تحميلَ مستندٍ جديد */
            ref.current?.injectJavaScript(`(function(){try{window.__loopzGo?window.__loopzGo(${JSON.stringify(to)}):(location.href=${JSON.stringify(CONFIG.apiBase + to)});}catch(e){location.href=${JSON.stringify(CONFIG.apiBase + to)};}})();true;`);
          }}
        />
      ) : null}
      {failed ? (
        <View
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: SHELL_BG, alignItems: "center", justifyContent: "center",
            gap: space.md, padding: space.xl,
          }}
        >
          <Text size={18} weight="700" style={{ textAlign: "center" }}>{t.title}</Text>
          <Text muted style={{ textAlign: "center" }}>{t.hint}</Text>
          <Button label={t.retry} onPress={retry} style={{ minWidth: 180 }} />
        </View>
      ) : !ready ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: SHELL_BG }}>
          <Loading />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
