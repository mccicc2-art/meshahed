import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { BackHandler, Linking, Platform, Share, StatusBar, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useGlobalSearchParams, useNavigationContainerRef, useRouter } from "expo-router";
import { supabase, useAuth } from "./auth";
import { CONFIG } from "./config";
import { File, Paths } from "expo-file-system";
import { currentLocale, webLocale } from "./i18n";
import { Button, Loading, Text } from "./ui";
import { SHELL_BG, space } from "./theme";
import { perfMs } from "./perf";
import { mark } from "./perfMarks";
import { session } from "./session";
import { own } from "./ownSession";
import { shell, isReturnTo, rootOf, type NativeRoot, type ReturnTo } from "./shell";
import { doorBack, doorKept, rootsBorn, rootsState, lastBack } from "./bootRoot";
import { rootStack, topOf, webLayer, type State } from "./webDoor";
import { BottomNav, type NavKey } from "./BottomNav";
import { prefetchDiscover } from "./discover/DiscoverScreen";

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
 * 🔴 D-1156 — التسليمُ **تبديلُ مصدرٍ إلى POST يرسله الغلاف** (`formBody`)، لا نموذجٌ يُحقن في
 * الصفحة: الحقنُ كان يضيع فيحتاج كلُّ دخولٍ محاولتين. المصدرُ حالةٌ تتغيّر بطلبٍ صريحٍ وحدَه،
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
/** 🆕 K6a — مهلةُ إعلان الترحيب بعد وصول التسليم: بعدها يُحكم «وصل» (قياسٌ فقط) */
const GATE_WAIT_MS = 5_000;
/**
 * 🆕 D-1148 — **صفحةُ الدخول بلا شريطٍ تحتها** (أحمد، ٢٧ سبتمبر: «إذا نمدي نخفيها أخفيها»): من لم يدخل قطّ يرى
 * البطلَ وزرَّيه — «المتابعة بـGoogle» و«تصفَّح أوّلاً» (D-886 باقٍ) — والشريطُ يظهر حين يتصفّح فعلاً.
 * `/` عتبةٌ للزائر وحدَه؛ للمسجَّل هي الرئيسيّة (وهي أصليّةٌ أصلاً).
 */
function atGate(p: string, landing: boolean): boolean {
  return p === "/login" || p.startsWith("/auth/") || landing;
}
/**
 * 🆕 **إعلانُ القدرة قبل المستند** (٩ سبتمبر — بلاغُ أحمد «لا أستطيع الدخول إلى
 * المكتبة»): الويبُ كان يبتلع ضغطةَ «المكتبة» لكلِّ غلافٍ يحمل الوسم، والمثبَّتُ
 * 1.2.3 لا يعرف `native`. **فالغلافُ الذي يعرف الشاشةَ يقولها** بحقن
 * `window.LoopzNative` قبل تحميل الصفحة، والويبُ لا يبتلع الضغطةَ بدونها.
 * تُحقن في كلِّ الإطارات لكنّ الرسالةَ تُقبل من `INSIDE` وحدَه (`onMessage`).
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
const CAPABILITIES = "window.LoopzNative={library:true,discover:true,title:true,nav:true,search:true,home:true,community:true,share:true,messages:true,profile:true,rotate:true};" + SHARE_BRIDGE + ";true;";
/**
 * 🔴 **والحقنُ مرّتين (١٤ سبتمبر — بلاغُ أحمد على 1.6.0: «المكتبة رجعت ويب»)**:
 * أوّلُ فتحٍ بعد التثبيت أعاد الصفحةَ ويبيّةً من أوّل ضغطة، وإغلاقٌ كامل أصلحها،
 * وتشخيصُ `NativeGate` لم يسجّل شيئاً بعدها. **التفسيرُ الوحيدُ المتّسق**: WebView
 * أندرويد يستعيد مستندَ الجلسة السابقة بعد الترقية **دون أن يعيد تشغيلَ حقنِ
 * «قبل المستند»** — فيغيب `LoopzNative` ويبقى الرابطُ رابطاً (بقرار ٩ سبتمبر).
 * حقنُ «بعد التحميل» يجري على كلِّ `onLoadEnd` بما فيه الاستعادةُ، **وهو احتياطٌ
 * لا بديل**: الأوّلُ يسبق كودَ الصفحة، والثاني يلحقه لكنّه يسبق أوّلَ ضغطة.
 */
/* D-1148 — والحزامُ الثاني لإخفاء شريط الويب بعد التحميل: لو فات الحقنُ المبكّرُ سطرَ الترويسة (`layout.tsx`) */
const CAPABILITIES_LATE =
  "if(!window.LoopzNative){" + CAPABILITIES + "}" + SHARE_BRIDGE + ";try{document.documentElement.setAttribute('data-native-nav','1')}catch(e){};true;";
/**
 * 🆕 K3b — **الصفحةُ تعرف أنّها مغطّاة** (`document.visibilityState`). كانت `react-native-screens` تنزع شاشةَ الويب من النافذة
 * متى غطّتها شاشةٌ أصليّة، فيراها Chromium مخفيّةً — ونبضُ الحضور والاستطلاعُ والتريلراتُ تهدأ كما في تبويبٍ خلفيّ. الطبقةُ الآن
 * مركَّبةٌ شفّافةٌ فوق الشاشات فلا يراها Chromium مخفيّةً أبداً؛ فالغلافُ يقولها: الحالةُ المعلنةُ «مخفيّة» ما دامت الطبقةُ
 * مخفيّة، **وإلّا الحالةُ الحقيقيّة** (التطبيقُ في الخلفيّة يبقى مخفيّاً كما كان)، ويُطلق `visibilitychange` مع كلِّ تبدّل.
 */
const coverJs = (hidden: boolean) =>
  `try{window.__loopzHidden=${hidden ? "true" : "false"};if(!window.__loopzVis){window.__loopzVis=1;var P=Document.prototype,v=Object.getOwnPropertyDescriptor(P,"visibilityState"),h=Object.getOwnPropertyDescriptor(P,"hidden");Object.defineProperty(document,"visibilityState",{configurable:true,get:function(){return window.__loopzHidden?"hidden":v.get.call(document)}});Object.defineProperty(document,"hidden",{configurable:true,get:function(){return window.__loopzHidden?true:h.get.call(document)}});}document.dispatchEvent(new Event("visibilitychange"));}catch(e){};true;`;
const HANDOFF = CONFIG.apiBase + "/api/v1/session/handoff";
const APP_VERSION = Constants.expoConfig?.version ?? "0";

/** النطاقاتُ التي تُعرض داخل الغلاف — ما عداها للمتصفّح الخارجيّ */
const INSIDE = new Set(["loopztv.com", "www.loopztv.com", "meshahed.vercel.app"]);

/* 🆕 D-1156 — المصدرُ قد يكون نموذجَ POST (التسليمُ والخروج) يُرسله الغلافُ نفسُه — انظر `formBody` */
type Source = { uri: string; method?: "POST"; headers?: Record<string, string>; body?: string };

/**
 * 🆕 **نصُّ شاشة الانقطاع هنا لا في `core/i18n`** — حجّةُ D-907 نفسُها:
 * القاموسُ يُشحن مع كلِّ شاشةِ ويب، **وهذه شاشةُ الغلاف وحدَه** ولا يراها
 * متصفّحٌ أبداً. سطران لا يستحقّان مفتاحين عامَّين.
 */
const OFFLINE = {
  ar: { title: "لا اتّصال بالإنترنت", hint: "تحقّق من الشبكة ثمّ أعِد المحاولة.", retry: "أعِد المحاولة" },
  en: { title: "No internet connection", hint: "Check your network and try again.", retry: "Try again" },
} as const;

/**
 * 🔴 D-1156 — **التسليمُ والخروجُ يُرسلهما الغلافُ لا سكربتٌ في الصفحة** (تسجيلُ خالد ٢٧ سبتمبر: كلُّ دخولٍ
 * وكلُّ خروجٍ احتاج محاولتين — ٨ من ٨ في سجلّ Supabase). كانا نموذجاً يُحقن بـ`injectJavaScript`، **والحقنُ
 * يضيع** متى لم تكن الصفحةُ حاضرة: تحت شاشةٍ أصليّةٍ تنزعها `react-native-screens` من العرض (D-1144 — الخروجُ من
 * الإعدادات الأصليّة)، أو لحظةَ العودة من نافذة Google قبل أن تستيقظ (الدخول). المحاولةُ الأولى تُظهر الويبَ فتنجح
 * الثانية. الآن تبديلُ المصدر ⇐ `WebView.postUrl` في جافا — تنقّلٌ أصليٌّ لا ينتظر جافاسكربت الصفحة.
 * القاعدةُ نفسُها التي نقضت D-1146: **لا يُعلَّق فعلٌ على طلبٍ قد لا يُجاب.**
 */
/**
 * 🔴 D-1330 — **ترويسةُ النموذج صريحة**: `postUrl` في أندرويد يضيفها بنفسه (ويتجاهل ما نمرّره)، أمّا
 * `WKWebView` في iOS فيرسل الجسمَ عارياً — فكان الخادمُ يعجز عن قراءة التسليم ويردّ `/login` (أوّلُ نسخة iOS،
 * ٨ أكتوبر). الخادمُ صار يقرأ الجسمَ بلا ترويسةٍ أيضاً؛ هذه تجعل الطلبَ صحيحاً من مصدره.
 */
const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
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

/**
 * ====== 🆕 K3b — الطبقة: ما كان شاشةَ `/web` يُرسم هنا فوق المكدّس (`app/_layout.tsx`) ======
 * المنطقُ كلُّه كما كان في `app/web.tsx` حرفاً إلّا أربعة: **متى تُرى** (`webLayer.visibleFor`) · **العودةُ من بابٍ ظهر طبقةً
 * تُخفيها** ولا تبني شيئاً (`goNative`) · **زرُّ الرجوع لها وهي ظاهرةٌ وحدَها** · **ضغطةُ الشريط فوق الباب** تنتقل إلى التبويب
 * الحيّ تحتها. وصار `app/web.tsx` مساراً فارغاً: مكانُ الطبقة في المكدّس (قاعدتُه وما يرجع إليه الرجوعُ الأخير).
 */
export function WebLayer() {
  const { loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const t = OFFLINE[currentLocale() === "ar" ? "ar" : "en"];
  const ref = useRef<WebView>(null);
  /* 🆕 K3b — **أعلى المكدّس الجذر وحدَه** يُعيد رسمَ الطبقة: منه تُحسب رؤيتُها. لا `useRootNavigationState` — كان يُعيد
     رسمَ هذه الشاشة الثقيلة (والـWebView) مع كلِّ ضغطة تبويبٍ في المجموعة، و`tab.switch` بندٌ مفتوح في 05. والحالةُ الكاملةُ
     تُقرأ حين تُحتاج (`goRoot`). */
  const navContainer = useNavigationContainerRef();
  const [top, setTop] = useState<{ key: string; name: string } | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => webLayer.subscribe(bump), []);
  useEffect(() => {
    webLayer.attach(true);
    const read = () => {
      const st = (navContainer.isReady() ? navContainer.getRootState() : undefined) as unknown as State;
      webLayer.sync(st);
      const t = topOf(st);
      setTop((prev) => (t ? (prev?.key === t.key && prev.name === t.name ? prev : { key: t.key, name: t.name }) : null));
    };
    read();
    const off = navContainer.addListener("state", read);
    return () => {
      off();
      webLayer.attach(false);
    };
  }, [navContainer]);
  const visible = webLayer.visibleFor(top);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [path, setPath] = useState("/");
  /* 🆕 M3-fix — المسارُ لـ`goNative` (يُنادى من مستمعاتٍ لا تُعاد مع كلِّ تنقّل) */
  const pathRef = useRef("/");
  /* 🔴 D-1150 — **الصفحةُ تقول إنّها العتبة، لا التطبيقُ يخمّن** (تسجيلُ أحمد: بعد الدخول رئيسيّةٌ بلا شريط —
     D-1148 حكم بـ`session.seen()` ساعةَ الرسم، والأثرُ يُكتب بعد أوّل رمز). `AppGateSignal` في بطل الترحيب يرسل
     `gate` عند التركيب والفكّ، ويُصفَّر مع كلِّ تحميل مستندٍ جديد (فكُّ المكوّن لا يجري عند مغادرة المستند). */
  const [landing, setLanding] = useState(false);
  /* 🆕 D-1293 (سؤالُ أحمد بتسجيل: «الدوكس ليش ظاهر اذا كبرت الفيديو؟») — **الصفحةُ في تكبيرٍ مسرحيّ**: التكبيرُ يملأ
     المستندَ والدوكُ أصليٌّ خارجَه (D-1012) فكان يبقى تحت الفيديو. الصفحةُ تُعلن الحالين (`immersive`) والغلافُ يطوي
     دوكَه لهما. **والعلمُ لا يعيش بعد صفحته**: يسقط بتبدّل المسار وبالتحميل وباختفاء الطبقة — دوكٌ يغيب ولا يعود
     أسوأُ من دوكٍ ظاهر. */
  const [immersive, setImmersive] = useState(false);
  /* 🆕 D-1302 (فكرةُ أحمد: «بضيف زر اذا ضغطته تنلف الشاشة بالعرض»؛ اختار التدويرَ الحقيقيَّ على رسمٍ مقلوب) —
     **التريلرُ المكبَّرُ يطلب العرضيّ** (`orient`). التطبيقُ مقفولٌ على الطوليّ (`app.json`)، فالقفلُ يُفكّ هنا لهذه الشاشة
     وحدَها ويعود. **والعرضيُّ لا يعيش بعد تكبيره**: يسقط مع `immersive` حيث سقط — وشاشةٌ أصليّةٌ تعلو الطبقةَ تعود
     طوليّةً (`immersed`) ويرجع العرضيُّ حين تنكشف الصفحةُ وهي ما زالت مكبَّرة. */
  const [landscape, setLandscape] = useState(false);
  const insets = useSafeAreaInsets();
  /* D-1035 — من أيِّ شاشةٍ أصليّةٍ فُتحت الصفحةُ الحاليّة؛ يُمسح عند أوّل صفحةٍ لها خانتُها، فلا يلاحق
     صاحبَه إلى صفحاتٍ فتحها بعد ذلك من «الرئيسيّة» */
  const [origin, setOrigin] = useState<NativeRoot | null>(null);
  const handing = useRef(false);
  /* 🆕 D-1152 — لحظةُ بدء التسليم إلى الويب (لقياس وصوله أو ارتداده مرّةً واحدة) */
  const handT0 = useRef(0);
  /* 🆕 K6a — الحكمُ على التسليم ينتظر قليلاً بعد الوصول: الترحيبُ يُعلن نفسَه (`gate`) بعد أن يُرسم لا عند
     انتهاء التحميل، فحكمٌ عند `onNav` كان يسجّل «وصل» لصفحة الترحيب نفسِها ثمّ يُسكت إعلانَها */
  const handTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (handTimer.current) clearTimeout(handTimer.current);
    },
    [],
  );
  /**
   * 🆕 D-1101 — **العودةُ إلى الشاشة الأصليّة التي فُتحت منها الصفحة**، في مكانٍ واحدٍ لطريقَيها (رسالةُ
   * `native` من الصفحة، ورجوعُ النظام). الجذورُ كما كانت دفعةً واحدة؛ والإعداداتُ ليست جذراً فتُبنى
   * كما تركها المستخدم: الرئيسيّةُ تحتها (منها فُتحت، ورجوعُ الإعدادات يعود إليها) ثمّ الفهرسُ ثمّ
   * القسمُ إن كان — فرجوعٌ بعد رجوعٍ يمشي الطريقَ نفسَه عكساً كما في الويب.
   */
  /**
   * 🆕 K3b — **إلى جذرٍ حيّ تحت الطبقة**: تُنزَل الشاشاتُ فوق مجموعة التبويبات ثمّ يُبدَّل التبويب (`switchTo` نفسُه) —
   * لا تُبنى المجموعة. الإعداداتُ كما كانت: الرئيسيّةُ ثمّ الفهرسُ ثمّ القسم. `false` ⇒ لا مجموعةَ في المكدّس (الطريقُ القديم).
   */
  const goRoot = useCallback(
    (r: ReturnTo) => {
      const st = rootStack((navContainer.isReady() ? navContainer.getRootState() : undefined) as unknown as State);
      if (!st) return false;
      const top = st.index ?? st.routes.length - 1;
      const at = st.routes.slice(0, top + 1).map((x) => x.name).lastIndexOf("(tabs)");
      if (at < 0) return false;
      if (top > at) router.dismiss(top - at);
      if (r === "library") router.navigate("/library");
      else if (r === "discover") router.navigate("/discover");
      else if (r === "search") router.navigate("/search");
      else if (r === "home") router.navigate("/home");
      else if (r === "community") router.navigate("/community");
      else {
        const section = r.split("/")[1];
        router.navigate("/home");
        router.push("/settings");
        if (section) router.push({ pathname: "/settings/[section]", params: { section } });
      }
      return true;
    },
    [router, navContainer],
  );
  const goNative = useCallback(
    (r: ReturnTo) => {
      /* 🆕 K3b — **بابٌ ظهر طبقةً**: العودةُ تُخفيها. من صفحة الباب نفسِها إلى جذرها ⇒ المرساةُ تحتها كما تُركت (الغرفة ·
         موضعُ التمرير) بلا سطرٍ آخر — هذا ما كانت `takeResume` تُعيد بناءه. ومن صفحةٍ غيرِها ⇒ إلى الجذر الحيّ. */
      const d = webLayer.door();
      if (d) {
        webLayer.closeDoor();
        doorKept();
        shell.resume = null;
        if (d.root === r && d.path === pathRef.current) return;
        if (goRoot(r)) return;
      }
      /* 🆕 K3a-fix — عودةٌ من باب: المجموعةُ تُكمل التي فتحته (إقلاعُها ورئيسيّتُها) لا تُولد «من الويب» —
         وإلّا كشف رجوعٌ منها الصفحةَ الويبيّةَ التي عاد منها للتوّ (`rootsState.ts`) */
      doorBack();
      if (r === "library") router.push("/library");
      else if (r === "discover") router.push("/discover");
      else if (r === "search") router.push("/search");
      else if (r === "home") router.push("/home");
      /* 🆕 11-M · M1 */
      else if (r === "community") router.push("/community");
      else {
        const section = r.split("/")[1];
        router.push("/home");
        router.push("/settings");
        if (section) router.push({ pathname: "/settings/[section]", params: { section } });
      }
      /* 🆕 M3-fix — **ثمّ ما كان فوق الجذر** (غرفةٌ، عملٌ تحتها…) بترتيبه: العودةُ إلى المكان نفسِه لا إلى الجذر
         (`nativeStack.ts`). من صفحة الباب وحدَها — من تنقّل في الويب بعدها ثمّ عاد بالشريط يعود إلى الجذر كما كان */
      for (const e of shell.takeResume(r, pathRef.current)) router.push({ pathname: e.pathname as never, params: e.params });
    },
    [router, goRoot],
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
  /* K3b — الطبقةُ خارج المسار: رابطُ الودجت (`/web?u=`) يُقرأ من العنوان المعروض (هو `/web` لحظةَ وصول الرابط) */
  const { u } = useGlobalSearchParams<{ u?: string }>();
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

  /* 🔴 D-1147 — **الرمزُ يُطلب صراحةً لحظةَ جاهزيّة الصفحة في الإقلاع** (مرّةً واحدة، ولا ينتظره أحد):
     هي النافذةُ الوحيدةُ التي قد يُجاب فيها الحقنُ قبل أن تغطّي الرئيسيّةُ هذه الشاشة (D-1144). كان يُؤخذ
     مصادفةً — دفعُ القياسات كان يطلب رمزاً (D-1141 أوقفه). ⚖️ **وD-1146 نُقض**: جعل كلَّ طلبٍ قبل التركيب
     يصطفّ، فانتظرت الرئيسيّةُ حتى ١٠ث (`boot.fresh`). هنا الطلبُ الأوّلُ يُرمى كما كان (`noinject` فوراً) ويسأل
     هذا وحدَه في الخلفيّة. وصل الرمزُ في إقلاعٍ من اثنين على جهاز خالد (٢٧ سبتمبر). K4b تُنهي هذا كلَّه. */
  const bootAsked = useRef(false);
  const bootAsk = useCallback(() => {
    if (bootAsked.current) return;
    bootAsked.current = true;
    if (session.seen() && !session.has()) void session.request();
    /* 🆕 K4b-c — والجلسةُ المملوكةُ تُسكّ من كوكي الصفحة التي جهزت للتوّ (لا تنتظر الجسرَ الذي لا يُجاب) */
    if (session.seen()) own.mintFromCookie();
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
    if (session.seen()) {
      /* K3 — العلامةُ حالةُ المجموعة لا معاملٌ في العنوان (`bootRoot`) */
      rootsBorn(true);
      router.push("/home");
    } else {
      /* 🩺 D-1256 — إقلاعٌ لم يرفع الرئيسيّةَ الأصليّة: إمّا زائرٌ حقّاً، وإمّا `seen()` أخطأ (قراءةُ SecureStore
         ترمي فيُحفظ `false` للجلسة كلِّها — الفرضيّةُ الأولى لبلاغ أحمد). العلامةُ تفرّق بينهما بعدد مرّاتها. */
      mark("web.home", 0, { why: "boot.unseen" });
    }
  }, [loading, u, router]);

  /* 🩺 D-1256 — بعد الإقلاع: الطبقةُ صارت هي الشاشة وهي على رئيسيّة الويب، والتطبيقُ يعرف صاحبَه ⇒ انكشافٌ لا يُفترض.
     يُسجَّل من أين: المجموعةُ وآخرُ قرارِ رجوع. تشخيصٌ فقط — لا يغيّر ما يُعرض. */
  const homeDiagWas = useRef(visible);
  useEffect(() => {
    const was = homeDiagWas.current;
    homeDiagWas.current = visible;
    if (!visible || was || !booted.current || pathRef.current !== "/" || !session.seen()) return;
    const r = rootsState();
    mark("web.home", 0, { why: lastBack(), src: r.boot ? "boot" : "web", ready: r.homeSeen ? 1 : 0 });
  }, [visible]);

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
    /* D-1293 — مسارٌ تبدّل أو مستندٌ يُحمَّل ⇒ لا تكبيرَ قائماً فيه */
    if (next !== pathRef.current || nav.loading) {
      setImmersive(false);
      setLandscape(false);
    }
    setPath(next);
    pathRef.current = next;
    if (next === "/" || ROOTS.some((r) => next.startsWith(r))) setOrigin(null);
    /* 🆕 11-M · M1-fix — **البابُ من جذرٍ يُضيء خانةَ جذره** (تسجيلُ أحمد ٢٨ سبتمبر: غرفةُ نقاشٍ فُتحت من «المجتمع»
       والشريطُ يُضيء «الرئيسيّة»). D-1035 وعد بأن يُؤخذ الأصلُ من `shell.returnTo` لحظةَ الفتح، لكنّه لم يُكتب إلّا
       لرابط الودجت (`u`) — فكلُّ بابٍ من جذرٍ بلا خانةٍ لمساره كان يسقط على «الرئيسيّة». */
    else if (shell.returnTo) setOrigin(rootOf(shell.returnTo));
    /* D-951 — الشاشةُ الأصليّة التي طلبت صفحةً تنتظر وصولَها قبل أن تُغلق */
    shell.arrived(nav.url, nav.loading);
    if (nav.loading) setLanding(false);
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
      /* D-1152 · K6a — الحكمُ على التسليم (قياسٌ فقط، لا يغيّر شيئاً). `HOME` يطابق كلَّ صفحةٍ في النطاق، فالمسارُ
         يُقرأ: الدخولُ أو ردُّ Google ⇒ ارتداد؛ وغيرُهما ⇒ «وصل» ما لم تُعلن الصفحةُ أنّها الترحيبُ خلال مهلة */
      if (handT0.current) {
        const arrivedMs = Date.now() - handT0.current;
        if (next.startsWith("/login") || next.startsWith("/auth")) {
          mark("auth.handoff", arrivedMs, { result: "none", why: "login" });
          handT0.current = 0;
        } else {
          if (handTimer.current) clearTimeout(handTimer.current);
          handTimer.current = setTimeout(() => {
            handTimer.current = null;
            if (!handT0.current) return; /* الترحيبُ أعلن نفسَه وحُكم بالارتداد */
            mark("auth.handoff", arrivedMs, { result: "ok" });
            handT0.current = 0;
          }, GATE_WAIT_MS);
        }
      }
      flush();
    }
  }, [flush, router]);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let msg: { type?: string; items?: unknown[]; mark?: string; path?: string; images?: number; sincePathChange?: number; route?: string; on?: boolean } = {};
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
        /* D-1143 — «وصلني» ليس ردّاً: الانتقالُ عنده كان يقطع الردَّ الحقيقيَّ قبل أن يصل */
        if (hostOk && e.nativeEvent.url.startsWith(BOOT) && msg.type !== "session:ack") hopHome();
        return;
      }
      /* 🆕 D-1083 — `SessionBridge` علّق سامعَ الطلب: يُصرف طابورُ الرمز الآن لا بعد آخر صورةٍ في
         الصفحة (`onLoadEnd` يبقى احتياطاً لصفحةٍ قديمة لا ترسل هذا) — من نطاقنا وحدَه */
      if (msg.type === "gate") {
        if (hostOk) setLanding(msg.on === true);
        /* D-1152 — صفحةُ الترحيب ظهرت والتسليمُ جارٍ ⇒ ارتدّ الدخولُ إليها (قياسٌ فقط، مرّة) */
        if (hostOk && msg.on === true && handT0.current) {
          mark("auth.handoff", Date.now() - handT0.current, { result: "none", why: "landing" });
          handT0.current = 0;
          if (handTimer.current) clearTimeout(handTimer.current);
          handTimer.current = null;
        }
        return;
      }
      /* 🆕 D-1293 — تكبيرُ التريلر: من نطاقنا وحدَه */
      if (msg.type === "immersive") {
        if (hostOk) {
          setImmersive(msg.on === true);
          if (msg.on !== true) setLandscape(false);
        }
        return;
      }
      /* 🆕 D-1302 — تدويرُ التريلر المكبَّر: من نطاقنا وحدَه */
      if (msg.type === "orient") {
        if (hostOk) setLandscape((msg as { landscape?: unknown }).landscape === true);
        return;
      }
      if (msg.type === "bridge:ready") {
        if (hostOk) {
          session.ready(true);
          bootAsk();
        }
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
        /* 🆕 11-M · M4 — «الرسائل» من رابطٍ في الويب (الظرف · خيطٌ `?with=` · `?tab=alerts`) ⇐ الشاشةُ الأصليّة فوق الصفحة،
           والرجوعُ إليها (`from=web`). المعرّفُ يُفحص قبل أن يُدفع — ما ليس معرّفاً يفتح الصندوقَ لا خيطاً */
        if (hostOk && msg.route === "messages") {
          const m = msg as { tab?: unknown; with?: unknown };
          const peer = typeof m.with === "string" && /^[0-9a-f-]{36}$/i.test(m.with) ? m.with : null;
          if (peer) router.push({ pathname: "/messages/[peer]", params: { peer, from: "web" } });
          else router.push({ pathname: "/messages", params: { tab: m.tab === "alerts" ? "alerts" : "inbox", from: "web" } });
        }
        /* 🆕 11-N · N1 — ملفُّ الشخص من رابطٍ في الويب ⇐ الشاشةُ الأصليّةُ فوق الصفحة، والرجوعُ إليها (`from=web`).
           الاسمُ يُفحص بشكله قبل أن يُدفع (الخادمُ يعيد فحصَه — `parseProfileHandle`) */
        if (hostOk && msg.route === "profile") {
          const name = (msg as { username?: unknown }).username;
          if (typeof name === "string" && /^[\w.-]{1,40}$/.test(name)) router.push({ pathname: "/u/[username]", params: { username: name, from: "web" } });
        }
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
      const loginT0 = Date.now();
      const r = await signInWithGoogle();
      const { data } = await supabase.auth.getSession();
      /* 🆕 D-1152 — نتيجةُ الدخول بسببها (رسالةُ الخطأ مختصرةً كلمةً — لا بريدَ ولا رمز) */
      const why = r.ok ? (data.session ? "ok" : "nosession") : String(r.message ?? "unknown").toLowerCase().replace(/[^\w.-]+/g, "_").slice(0, 16) || "unknown";
      mark("auth.login", Date.now() - loginT0, { result: r.ok && data.session ? "ok" : "none", why });
      if (r.ok && data.session) {
        handing.current = true;
        handT0.current = Date.now();
        /* 🆕 D-1151 (الحلّ أ) — دخل فعلاً: الأثرُ الآن لا بعد رمزٍ عبر الجسر، فلا يعامله التطبيقُ زائراً */
        session.markSeen();
        /* 🆕 D-1152 — والجلسةُ المملوكةُ تُسكّ من رمز الدخول نفسِه الآن (لا تنتظر جسراً ولا كوكياً) */
        own.fresh(data.session.access_token);
        /* 🆕 D-1156 — الرمزان في جسم POST كما كانا (لا في العنوان) — لكن يرسله الغلافُ لا الصفحة */
        setSource({ uri: HANDOFF, method: "POST", headers: FORM_HEADERS, body: formBody({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }) });
        /* D-1003 — الجلسةُ جاهزة: نسخّن «اكتشف» بينما الويبُ يحمّل الرئيسيّة */
        prefetchDiscover();
      } else {
        ref.current?.injectJavaScript("window.dispatchEvent(new Event('loopz:login-cancel'));true;");
      }
    },
    [signInWithGoogle, router, hopHome, goNative, bootAsk],
  );

  /* Phase 11 · B1 — الجسرُ يعرف كيف يحقن في هذه الـWebView ما دامت مركَّبة */
  useEffect(() => {
    const fn = (js: string) => ref.current?.injectJavaScript(js);
    session.attach(fn);
    shell.attach(fn);
    /* 🆕 D-1156 — نموذجُ POST من الغلاف (الخروج): تبديلُ المصدر لا حقن. `n` يجعل كلَّ طلبٍ مصدراً جديداً —
       مصدرٌ مطابقٌ لسابقه لا يُعاد إرسالُه، فخروجٌ ثانٍ في الجلسة نفسِها كان سيضيع. */
    shell.attachPost((path) => setSource({ uri: CONFIG.apiBase + path, method: "POST", headers: FORM_HEADERS, body: formBody({ n: String(Date.now()) }) }));
    return () => {
      session.attach(null);
      shell.attach(null);
      shell.attachPost(null);
      session.clear();
    };
  }, []);

  /* 🔴 D-1144 — **زال مسحُ الرمز بعد خمس دقائق في الخلفيّة** (كان Phase 11 · B1 §٦-ج).
     **لماذا**: الرمزُ لا يُطلب من هذه الصفحة إلّا وهي ظاهرة — `react-native-screens` على أندرويد **ينزع
     شاشةَ الويب من العرض** متى غطّتها شاشةٌ أصليّة (`ScreenStack.kt`: «Remove all screens underneath
     visibleBottom»)، والحقنُ في WebView منزوعٍ لا يُنفَّذ (`token.wait` = `why=noack` كلَّ مرّة، ٢٦ سبتمبر).
     فكان الرمزُ يُؤخذ عند الإقلاع ثمّ يُمسح بعد أوّل خروجٍ طويل **ولا يعود** — وصفحةُ العمل تبقى معطَّلة (تسجيلُ
     خالد). الآن يعيش حتى صلاحيته (`has()` يرفضه قبل انتهائه بـ٣٠ث). ⚖️ الرمزُ في الذاكرة وحدَها، والخروجُ
     يمسحه فوراً (`session:clear`) — وK4b تنهي الحاجةَ إلى هذا كلِّه (التطبيقُ يجدّد رمزَه بنفسه). */

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

  /* 🆕 K3b — **زرُّ الرجوع للطبقة وهي ظاهرةٌ وحدَها**: مخفيّةً هو للشاشة الأصليّة تحتها. والتسجيلُ بعد دورةٍ لا فورًا: رجوعُ
     شاشةٍ دُفعت من الصفحة يُعيد المرساةَ إلى التركيز فتسجّل مستمعَها (`useFocusEffect`) في الدورة نفسِها — والأحدثُ يُسأل
     أوّلاً (`BackHandler`)، فالطبقةُ تسجّل بعدها كي تبقى الأولى ما دامت فوق. (يحلّ بندَ 05 (ب): مستمعُ الويب كان يسبق الأصليّ.) */
  const topKey = top?.key ?? "";
  /* D-1293 — التكبيرُ يُحسب للطبقة الظاهرة وحدَها */
  const immersed = immersive && visible;
  /* D-1302 — العرضيُّ للتكبير الظاهر وحدَه. شريطُ الحالة يُطوى معه: في العرضيّ يأكل من ارتفاع الفيديو. لا يُنفَّذ عند
     التركيب (الشاشةُ طوليّةٌ أصلاً)، والفشلُ يُبقي الشاشةَ كما هي */
  const wide = landscape && immersed;
  const wideWas = useRef(false);
  useEffect(() => {
    if (wide === wideWas.current) return;
    wideWas.current = wide;
    StatusBar.setHidden(wide, "fade");
    void ScreenOrientation.lockAsync(wide ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, [wide]);
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    let sub: { remove: () => void } | null = null;
    const timer = setTimeout(() => {
      sub = BackHandler.addEventListener("hardwareBackPress", () => {
      /* 🆕 D-1293 — **الرجوعُ والفيديو مكبَّرٌ يصغّره ولا يغادر**: مغادرةٌ من تحت التكبير تترك صاحبَها في صفحةٍ
         أخرى لم يرَ أنّه خرج إليها. والعلمُ يسقط هنا لا بانتظار ردِّ الصفحة — فإن لم تُجب عاد الدوكُ على أيِّ حال. */
      if (immersed) {
        ref.current?.injectJavaScript("try{window.__loopzTrailerCollapse&&window.__loopzTrailerCollapse()}catch(e){};true;");
        setImmersive(false);
        setLandscape(false);
        return true;
      }
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
    }, 0);
    return () => {
      clearTimeout(timer);
      sub?.remove();
    };
  }, [canGoBack, router, path, goNative, visible, topKey, immersed]);

  /* 🆕 K3b — **الطبقةُ تختفي ⇒ ما يُشغَّل فيها يتوقّف** (تريلرُ صفحةِ بابٍ عاد منها المستخدم، أو عملٌ دُفع فوقها). كانت
     الصفحةُ تُنزع من العرض فلا تُرى؛ الآن هي مركَّبةٌ شفّافةٌ فوق الشاشات — والصوتُ لا تحجبه الشفافيّة. */
  const wasVisible = useRef(visible);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (wasVisible.current === visible) return;
    if (!visible) ref.current?.injectJavaScript(`try{document.querySelectorAll("video,audio").forEach(function(m){try{m.pause()}catch(e){}})}catch(e){};true;`);
    ref.current?.injectJavaScript(coverJs(!visible));
    wasVisible.current = visible;
  }, [visible]);

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
    /* 🆕 D-1114 — **التريلراتُ من «اكتشف» أينما فُتحت** (أحمد: «ظاهر إني في هوم مع إن التريلرات تعتبر من
       اكتشف»): صفُّها يسكن «اكتشف» (D-955)، فالضوءُ لها لا للأصل — والرجوعُ يبقى إلى حيث جاء (`origin`). */
    : path.startsWith("/trailers") ? "news"
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
    : origin === "community" ? "people"
    : path.startsWith("/list") ? "library"
    : "home";
  return (
    /* 🆕 D-1136 — **بلا الحافّة السفليّة** (أحمد بتسجيل: «الدكس اللي تحت مقاسه فالبروفايل غير عن الهوم والمكتبة»):
       الشريطُ الأصليُّ (`BottomNav`، D-1012) يُرسم هنا تحت الصفحة، و`SafeAreaView` بكلِّ الحوافّ كان يرفعه فوق شريط
       الإيماءات **ثمّ** يضيف هو حشوتَه (`insets.bottom × 0.5`) — فعلا ~١٤pt عن أخيه في الشاشات الأصليّة. الآن يصل
       إلى حافّة الشاشة كما هناك، وحشوتُه وحدَها تحجز الشريط. الصفحةُ لم تتغيّر: تنتهي عند رأس الشريط كما كانت.
       ⚠️ الحافّةُ العليا باقية — الشريطُ الأسودُ فوق غلاف الملفّ مؤجَّلٌ بقرار أحمد («لا بس الدكس»). */
    /* 🆕 K3b — الطبقةُ تملأ الشاشةَ فوق المكدّس؛ مخفيّةً شفّافةٌ ولا تُلمس ولا يقرؤها قارئُ الشاشة (انظر `webDoor.ts`:
       لماذا شفّافةٌ لا مطويّة) */
    <View
      pointerEvents={visible ? "auto" : "none"}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!visible}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: visible ? 1 : 0 }}
    >
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: SHELL_BG }}>
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
          onLoadEnd={() => { console.log(`[perf] onLoadEnd t=${perfMs()}ms`); if (!visibleRef.current) ref.current?.injectJavaScript(coverJs(true)); setReady(true); session.ready(true); bootAsk(); if (!handing.current) flush(); }}
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
      {/* 🔴 D-1294 — **منطقةُ الإيماءات سوداءُ والفيديو مكبَّر** (بلاغُ أحمد بتسجيل: «اللي تحت فالطرف تشوفه»):
          D-1293 طوت الدوكَ فامتدّت الصفحةُ تحت شريط الإيماءات لأوّل مرّة — وستارةُ التكبير تقف عند الحافّة
          الآمنة، فأطلّت البطاقةُ التي خلفها شريطاً ~١٠dp. الدوكُ كان يملأ تلك المنطقةَ بحشوته؛ فمن طواه يملؤها. */}
      {immersed ? <View style={{ height: insets.bottom, backgroundColor: "#000" }} /> : null}
      {ready && !failed && !atGate(path, landing) && !immersed ? (
        <BottomNav
          shell
          active={navKey}
          onGo={(k) => {
            /* 🔴 🆕 D-1115 — **الزائرُ يتصفّح الويبَ لا الشاشاتِ الأصليّة** (فيديو مختبِرٍ نزّل التطبيقَ للتوّ:
               «مكتبتي» و«اكتشف» هيكلٌ رماديٌّ لا ينتهي). الشاشاتُ الأصليّةُ تقرأ `/api/v1` برمز الجلسة، ومن
               لم يدخل قطّ لا رمزَ له — فتنتظر للأبد. وبابُ «تصفَّح أوّلاً» (D-886) وعدٌ بالتصفّح: فلمن لم يدخل
               (`session.seen()` — أثرُ أوّل دخولٍ، D-1075) تفتح الخاناتُ صفحاتِ الويب التي تخدم الزائرَ أصلاً. */
            if (!session.seen()) {
              const guestTo = k === "library" ? "/library" : k === "news" ? "/news" : k === "search" ? "/search" : k === "home" ? "/" : "/people";
              ref.current?.injectJavaScript(`(function(){try{window.__loopzGo?window.__loopzGo(${JSON.stringify(guestTo)}):(location.href=${JSON.stringify(CONFIG.apiBase + guestTo)});}catch(e){location.href=${JSON.stringify(CONFIG.apiBase + guestTo)};}})();true;`);
              return;
            }
            /* 🆕 K3a-fix — ضغطةُ الشريط على صفحةٍ فُتحت من جذر = عودةٌ من الباب: تُكمل المجموعةَ التي فتحته، ويُنزع
               السلاحُ (كان يبقى `returnTo` قديماً — `result=search` في علامات خالد — فيوجّه رجوعاً لاحقاً إلى غير أهله).
               وصفحةٌ لم تُفتح من جذر ⇐ مجموعةٌ من الويب كما كانت (K3). */
            /* 🆕 K3b — فوق بابٍ ظهر طبقةً: المجموعةُ حيّةٌ تحته — تختفي الطبقةُ وينتقل إلى التبويب (لا بناء) */
            if (webLayer.door()) {
              shell.disarm();
              webLayer.closeDoor();
              doorKept();
              shell.resume = null;
              if (goRoot(k === "news" ? "discover" : k === "people" ? "community" : k)) return;
            }
            if (shell.returnTo) {
              shell.disarm();
              doorBack();
            } else rootsBorn(false);
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
            /* 🆕 11-M · M1 — «المجتمع» شاشةٌ أصليّة كأخواتها (D-1171: الخانةُ في مكانها) */
            router.push("/community");
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
    </View>
  );
}
