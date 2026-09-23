import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, Linking, Platform, Share, View } from "react-native";
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
import { shell, isReturnTo, rootOf, type NativeRoot, type ReturnTo } from "../src/shell";
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
/* D-1090 — صفحةُ الإقلاع الخفيفة: التخطيطُ والجسرُ بلا رئيسيّةِ الويب — الرمزُ في جزءٍ من ثانية لا تسع.
   تُحمَّل بدل `/` **فقط** حين يُرفع الإقلاعُ الأصليّ (جهازٌ رأى جلسةً، بلا رابطٍ من الودجت)، وبعد أوّل
   ردِّ جلسةٍ يبدّلها الغلافُ إلى `/` بـ`location.replace` — فالتاريخُ والرجوعُ كما كانا حرفاً. */
const BOOT = CONFIG.apiBase + "/app/boot";
/**
 * 🆕 **إعلانُ القدرة قبل المستند** (٩ سبتمبر — بلاغُ أحمد «لا أستطيع الدخول إلى
 * المكتبة»): الويبُ كان يبتلع ضغطةَ «المكتبة» لكلِّ غلافٍ يحمل الوسم، والمثبَّتُ
 * 1.2.3 لا يعرف `native`. **فالغلافُ الذي يعرف الشاشةَ يقولها** بحقن
 * `window.LoopzNative` قبل تحميل الصفحة، والويبُ لا يبتلع الضغطةَ بدونها.
 * تُحقن في كلِّ الإطارات لكنّ الرسالةَ تُقبل من `INSIDE` وحدَه (`onMessage`).
 */
/* D-1000 — `title`: الغلافُ يفتح صفحةَ العمل أصليّةً من أيّ رابط عملٍ في الويب */
/* D-1012 — `nav`: الشريطُ السفليُّ أصليٌّ فوق كلِّ صفحةٍ ويبيّة، والويبُ يخفي شريطَه */
/* Phase 11-G — `search`: البحثُ شاشةٌ أصليّة؛ الويبُ يسلّح الرجوعَ إليها (`loopz:return=search`) ولا يفتح `/search` مستنداً */
/* Phase 11-H — `home`: الرئيسيةُ شاشةٌ أصليّة (D-1066)؛ الويبُ يسلّح الرجوعَ إليها (`loopz:return=home`) */
/**
 * 🆕 D-1104 — **`navigator.share` أصليّةٌ داخل الغلاف** (بلاغُ أحمد بتسجيل على 1.11.11: «Link copied»
 * و«تم النسخ» معاً): WebView أندرويد بلا `navigator.share`، فكلُّ زرِّ مشاركةٍ في الويب كان يسقط إلى
 * الحافظة — أيقونةُ مشاركةٍ تنسخ، وأندرويد 13+ يؤكّد النسخَ بنفسه فوق توستنا. الآن الدالّةُ تُعرَّف
 * قبل المستند وتطلب ورقةَ النظام من الغلاف (`share` في `onMessage`)، فأزرارُ المشاركة كلُّها
 * (`ShareTitleButton` · `DetailTopBar` · `ShareListSheet` · الدعوات) تفتح واتساب/X دون أن تُمسّ.
 * الإطارُ الأعلى وحدَه (لا مشغّلُ يوتيوب)، ولا تُستبدل دالّةٌ موجودة. الوعدُ يُرفض `AbortError`
 * حين يُغلق المستخدمُ الورقة (iOS) — وهو ما يعدّه الويبُ «ليس خطأً» فلا ينسخ بعده.
 */
const SHARE_BRIDGE =
  "if(window.top===window&&!navigator.share&&window.ReactNativeWebView){navigator.share=function(d){return new Promise(function(res,rej){window.__loopzShareDone=function(ok){window.__loopzShareDone=null;ok?res():rej(new DOMException('Share canceled','AbortError'));};window.ReactNativeWebView.postMessage(JSON.stringify({type:'share',title:String((d&&d.title)||''),text:String((d&&d.text)||''),url:String((d&&d.url)||'')}));});};}";
const CAPABILITIES = "window.LoopzNative={library:true,discover:true,title:true,nav:true,search:true,home:true,share:true};" + SHARE_BRIDGE + ";true;";
/**
 * 🔴 **والحقنُ مرّتين (١٤ سبتمبر — بلاغُ أحمد على 1.6.0: «المكتبة رجعت ويب»)**:
 * أوّلُ فتحٍ بعد التثبيت أعاد الصفحةَ ويبيّةً من أوّل ضغطة، وإغلاقٌ كامل أصلحها،
 * وتشخيصُ `NativeGate` لم يسجّل شيئاً بعدها. **التفسيرُ الوحيدُ المتّسق**: WebView
 * أندرويد يستعيد مستندَ الجلسة السابقة بعد الترقية **دون أن يعيد تشغيلَ حقنِ
 * «قبل المستند»** — فيغيب `LoopzNative` ويبقى الرابطُ رابطاً (بقرار ٩ سبتمبر).
 * حقنُ «بعد التحميل» يجري على كلِّ `onLoadEnd` بما فيه الاستعادةُ، **وهو احتياطٌ
 * لا بديل**: الأوّلُ يسبق كودَ الصفحة، والثاني يلحقه لكنّه يسبق أوّلَ ضغطة.
 */
const CAPABILITIES_LATE = "if(!window.LoopzNative){" + CAPABILITIES + "}" + SHARE_BRIDGE + ";true;";
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
  const [origin, setOrigin] = useState<NativeRoot | null>(null);
  const handing = useRef(false);
  /**
   * 🆕 D-1101 — **العودةُ إلى الشاشة الأصليّة التي فُتحت منها الصفحة**، في مكانٍ واحدٍ لطريقَيها (رسالةُ
   * `native` من الصفحة، ورجوعُ النظام). الجذورُ كما كانت دفعةً واحدة؛ والإعداداتُ ليست جذراً فتُبنى
   * كما تركها المستخدم: الرئيسيّةُ تحتها (منها فُتحت، ورجوعُ الإعدادات يعود إليها) ثمّ الفهرسُ ثمّ
   * القسمُ إن كان — فرجوعٌ بعد رجوعٍ يمشي الطريقَ نفسَه عكساً كما في الويب.
   */
  const goNative = useCallback(
    (r: ReturnTo) => {
      if (r === "library") router.push("/library");
      else if (r === "discover") router.push("/discover");
      else if (r === "search") router.push("/search");
      else if (r === "home") router.push("/home");
      else {
        const section = r.split("/")[1];
        router.push("/home");
        router.push("/settings");
        if (section) router.push({ pathname: "/settings/[section]", params: { section } });
      }
    },
    [router],
  );
  /**
   * 🆕 D-1103 — **درعُ لمسٍ لحظةَ تنكشف الصفحة** (بلاغُ أحمد بتسجيل على 1.11.11: «تم نسخ الرابط» ولم
   * يضغط مشاركة). البابُ يأخذ ثانيةً حتى تصل الصفحة، فيكرّر الإصبعُ اللمس؛ آخرُ لمسةٍ كانت تقع على
   * الصفحة فورَ انكشافها — على زرّ المشاركة في ملفّه. ستُّمئةِ جزءٍ من الثانية بعد الوصول تبتلع اللمسَ
   * (نزولُ الشاشة ~٣٠٠ ثمّ هامش) — لا أحدَ يقصد زرّاً في صفحةٍ لم يرَها بعد.
   */
  const [shielded, setShielded] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    shell.onArrive = () => {
      setShielded(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShielded(false), 600);
    };
    return () => {
      shell.onArrive = null;
      if (timer) clearTimeout(timer);
    };
  }, []);
  /* الهدفُ المؤجَّل من الودجت — يُنفَّذ بعد أوّل تحميلٍ ناجحٍ لا قبله */
  const pending = useRef<string | null>(null);
  const { u } = useLocalSearchParams<{ u?: string }>();
  /* المصدرُ يُحسب مرّةً: الرئيسيّةُ دائماً — كوكي الـWebView تحمل الجلسةَ إن
     كانت. (تسليمٌ عند الإقلاع من جلسةٍ مخزونة لم يعد له مصدر: لا مخزن.) */
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    if (loading || source) return;
    /* D-1090 — مع الإقلاع الأصليّ (الشرطُ نفسُه أدناه) تُسأل الصفحةُ الخفيفةُ أوّلاً؛ وإلّا `/` كما كان */
    const lightBoot = !(typeof u === "string" && u) && session.seen();
    setSource({ uri: lightBoot ? BOOT : HOME });
  }, [loading, source, u]);
  /* D-1090 — بعد أوّل ردِّ جلسة (رمزٌ أو `session:clear`) من صفحة الإقلاع الخفيفة تُبدَّل إلى `/`:
     `replace` لا `href` فلا تدخل التاريخ، ولا تبديلَ للمصدر (يعيد تركيبَ العرض — D-1075 أعلاه) */
  const hopped = useRef(false);
  const hopHome = useCallback(() => {
    if (hopped.current) return;
    hopped.current = true;
    ref.current?.injectJavaScript(`location.replace(${JSON.stringify(HOME)});true;`);
  }, []);

  /* D-1075 — **الإقلاعُ إلى الرئيسيّة الأصليّة، لا الويب** (طلبُ أحمد ٢٢ سبتمبر: «الإقلاع أبغاه
     تطبيق وما يفتح ويب»): من رأى جهازُه جلسةً ولم يخرج تُرفع `/home` فوق هذه الشاشة **قبل** أن
     تُحمَّل الصفحة، فلا يرى وميضَ الويب. الـWebView تبقى تحتها وتحمّل `/` كما كانت — هي صاحبةُ
     الجلسة (D-922)، والرئيسيّةُ تنتظرها عبر طابور `session.request` (لا مصدرَ ثانياً للرمز).
     ⚖️ **لا رفعَ مع رابطٍ من الودجت** (`u`): هدفُه صفحةٌ ويبيّة تُنفَّذ بعد أوّل تحميل، والرئيسيّةُ
     فوقها تخفيها. ⚖️ **ولا رفعَ بلا أثر**: أوّلُ تثبيتٍ أو بعد خروجٍ ⇒ الويبُ يعرض الدخولَ كما كان. */
  const booted = useRef(false);
  useEffect(() => {
    if (loading || booted.current) return;
    booted.current = true;
    if (typeof u === "string" && u) return;
    if (session.seen()) router.push({ pathname: "/home", params: { boot: "1" } });
  }, [loading, u, router]);

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
    setOrigin(rootOf(shell.returnTo));
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
    if (nav.url.includes("/auth/signout") || nav.url.startsWith(CONFIG.apiBase + "/login")) {
      session.signOut(); /* D-1026: خروجٌ ⇒ يُمسح الكاشُ المحفوظ أيضاً */
      /* D-1075 — صفحةُ الدخول تحت شاشةٍ أصليّةٍ مرفوعةٍ عند الإقلاع (كوكي شاخت مثلاً): تُنزَل الشاشاتُ
         كلُّها فيرى المستخدمُ الدخولَ لا رئيسيّةً بلا بيانات */
      if (router.canDismiss()) router.dismissAll();
    }
    /* وصلنا الرئيسيّةَ بعد التسليم ⇢ الصفحةُ تملك الكوكي. **لا خروجَ هنا**:
       الرمزان في الذاكرة بلا تجديدٍ، ونداءُ `signOut` — حتى `local` — يُلغي
       الجلسةَ عند الخادم (علّةُ ٧ سبتمبر). */
    if (handing.current && !nav.loading && nav.url.startsWith(HOME) && !nav.url.includes("/session/handoff")) {
      handing.current = false;
      flush();
    }
  }, [flush, router]);

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
      if (session.receive(msg as Record<string, unknown>, hostOk)) {
        /* D-1090 — أوّلُ ردٍّ من صفحة الإقلاع الخفيفة ⇒ إلى `/` (المضيفُ والمسارُ من العنوان الفعليّ) */
        if (hostOk && e.nativeEvent.url.startsWith(BOOT)) hopHome();
        return;
      }
      /* 🆕 D-1083 — `SessionBridge` علّق سامعَ الطلب: يُصرف طابورُ الرمز الآن لا بعد آخر صورةٍ في
         الصفحة (`onLoadEnd` يبقى احتياطاً لصفحةٍ قديمة لا ترسل هذا) — من نطاقنا وحدَه */
      if (msg.type === "bridge:ready") {
        if (hostOk) session.ready(true);
        return;
      }
      /* 🆕 D-946 — لغةُ الويب: تُقبل من نطاقنا وحدَه، وتُفحص القيمةُ في `webLocale.set` */
      if (msg.type === "locale") {
        if (hostOk) webLocale.set((msg as { lang?: unknown }).lang);
        return;
      }
      /* 🆕 D-1104 — ورقةُ المشاركة للنظام بدل الحافظة؛ من نطاقنا وحدَه، والنتيجةُ تُعاد إلى وعد الصفحة */
      if (msg.type === "share") {
        if (!hostOk) return;
        const m = msg as { title?: unknown; text?: unknown; url?: unknown };
        const url = typeof m.url === "string" ? m.url : "";
        const text = typeof m.text === "string" ? m.text : "";
        const title = typeof m.title === "string" ? m.title : "";
        const message = [text, url].filter(Boolean).join("\n") || title;
        let ok = false;
        try {
          const r = await Share.share(Platform.OS === "ios" ? { message: text || title, url, title } : { message, title });
          ok = r.action !== Share.dismissedAction;
        } catch {
          ok = false;
        }
        ref.current?.injectJavaScript(`try{window.__loopzShareDone&&window.__loopzShareDone(${ok ? "true" : "false"})}catch(e){};true;`);
        return;
      }
      if (msg.type === "native") {
        /* الشاشةُ الأصليّةُ لا تُفتح لرسالةٍ من غير نطاقنا — المضيفُ شرطٌ هنا أيضاً */
        if (hostOk) {
          shell.returnTo = null; /* D-998 — العودةُ سُلِّمت */
          shell.doorPath = null;
        }
        /* library (D-949) · discover (D-955) · search (11-G) · home (11-H) · 🆕 settings[/قسم] (D-1101) —
           كلُّها من `goNative`؛ والقيمةُ تُفحص قبل أن تُدفع بها شاشة */
        if (hostOk && isReturnTo(msg.route)) goNative(msg.route);
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
    [signInWithGoogle, router, hopHome, goNative],
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
    session.ready(false);
    ref.current?.reload();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      /* 🆕 D-1102 — **على صفحة الوصول نفسِها الرجوعُ عودةٌ مباشرة** (بلاغُ أحمد بتسجيل على 1.11.11): كان
         `goBack()` يحمّل ما قبلها في تاريخ الـWebView — ملفَّه من زيارةٍ سابقة — فيُرسم هيكلُ تحميله ربعَ
         ثانية ثمّ سوادٌ ثمّ تُسلِّم الصفحةُ العودة. الوجهةُ واحدةٌ في الحالين؛ الفرقُ ألّا نمرّ بصفحةٍ لم تُطلب.
         وإن تنقّل داخل الويب بعد الوصول (المسارُ تغيّر) فالرجوعُ رجوعُ الويب حتى يعود إليها. */
      if (shell.returnTo && shell.doorPath === path) {
        const route = shell.returnTo;
        shell.disarm();
        goNative(route);
        return true;
      }
      if (canGoBack) {
        ref.current?.goBack();
        return true;
      }
      /* D-998 — لا رجوعَ في الـWebView لكنّ الصفحةَ فُتحت من شاشةٍ أصليّة: نعود إليها لا نخرج */
      if (shell.returnTo) {
        const route = shell.returnTo;
        shell.disarm();
        goNative(route);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, router, path, goNative]);

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
    : origin === "search" ? "search"
    : origin === "home" ? "home"
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
          onLoadEnd={() => { console.log(`[perf] onLoadEnd t=${perfMs()}ms`); setReady(true); session.ready(true); if (!handing.current) flush(); }}
          /* 🔴 **بلا هذه كان الانقطاعُ يعرض صفحةَ خطأ أندرويد الخام**
             (`net::ERR_INTERNET_DISCONNECTED` بخطٍّ إنجليزيٍّ صغير) داخل
             تطبيقٍ عربيٍّ أسود — **أسوأُ ما يراه مختبِرٌ في أوّل نفق.** */
          onError={() => { setFailed(true); setReady(true); session.abandon(); }}
          /* ولا تُحسب أخطاءُ HTTP انقطاعاً: صفحةُ 404 من موقعنا صفحتُنا. */
          onRenderProcessGone={() => { setReady(false); session.ready(false); ref.current?.reload(); }}
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
      {/* D-1103 — الدرعُ فوق الصفحة وحدَها لحظةَ انكشافها؛ لا يُرى ولا يغطّي الشريطَ الأصليّ */}
      {shielded ? <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="auto" /> : null}
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
            /* Phase 11-G — «بحث» شاشةٌ أصليّة كأختيها */
            if (k === "search") {
              router.push("/search");
              return;
            }
            /* Phase 11-H — «الرئيسيّة» شاشةٌ أصليّة (D-1066) */
            if (k === "home") {
              router.push("/home");
              return;
            }
            const to = "/people";
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
