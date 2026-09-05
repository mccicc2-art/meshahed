import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { supabase, useAuth } from "../src/auth";
import { CONFIG } from "../src/config";
import { File, Paths } from "expo-file-system";
import { deviceLocale } from "../src/i18n";
import { Button, Loading, Text } from "../src/ui";
import { space } from "../src/theme";

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
 * 🔑 **بعد التسليم يُمسح المخزنُ المحلّيّ** (`signOut({ scope: "local" })`):
 * رموزُ التجديد تُدوَّر، وعميلان يجدّدان رمزاً واحداً يُسقط أحدُهما الآخر.
 * صاحبُ الجلسة هو كوكي الـWebView — ونبضةُ الحضور تأتي منه بوسم
 * `LoopzApp/<version>` في وكيل المتصفّح، فتُكتب `is_app` من الترويسة.
 *
 * 🔑 **الروابطُ الخارجيّة تفتح خارجَ الغلاف** (يوتيوب، المتاجر): الغلافُ
 * لنطاق Loopz وحدَه. **وزرُّ الرجوع** يرجع في تاريخ الصفحة قبل أن يغلق.
 *
 * 🆕 **ولقطةُ الودجت تمرّ من هنا** (D-929): الصفحةُ ترسل `widget` عبر الجسر،
 * والغلافُ يكتبها ملفّاً واحداً يقرؤه كوتلن. **ولا وحدةَ أصليّةً للكتابة**:
 * `documentDirectory/widget.json` هو نفسُه `context.filesDir/widget.json`.
 */
const HOME = CONFIG.apiBase + "/";
const HANDOFF = CONFIG.apiBase + "/api/v1/session/handoff";
const APP_VERSION = Constants.expoConfig?.version ?? "0";

/** النطاقاتُ التي تُعرض داخل الغلاف — ما عداها للمتصفّح الخارجيّ */
const INSIDE = new Set(["loopztv.com", "www.loopztv.com", "meshahed.vercel.app"]);

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

function handoffSource(access: string, refresh: string): Source {
  return {
    uri: HANDOFF,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "access_token=" + encodeURIComponent(access) + "&refresh_token=" + encodeURIComponent(refresh),
  };
}

/** نموذجُ تسليمٍ يُحقن في الصفحة ويُرسَل فوراً — الرمزان في الجسم لا في العنوان */
function handoffScript(access: string, refresh: string): string {
  return `(function(){var f=document.createElement('form');f.method='POST';f.action=${JSON.stringify(HANDOFF)};
var a=document.createElement('input');a.type='hidden';a.name='access_token';a.value=${JSON.stringify(access)};
var r=document.createElement('input');r.type='hidden';r.name='refresh_token';r.value=${JSON.stringify(refresh)};
f.appendChild(a);f.appendChild(r);document.body.appendChild(f);f.submit();})();true;`;
}

export default function Web() {
  const { session, loading, signInWithGoogle } = useAuth();
  const t = OFFLINE[deviceLocale() === "ar" ? "ar" : "en"];
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const handing = useRef(false);
  /* المصدرُ يُحسب مرّةً عند أوّل جلسةٍ مقروءة: رمزان في المخزن ⇢ تسليم،
     وإلا الرئيسيّةُ (كوكي الـWebView تحمل الجلسةَ إن كانت). */
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    if (loading || source) return;
    if (session) {
      handing.current = true;
      setSource(handoffSource(session.access_token, session.refresh_token));
    } else {
      setSource({ uri: HOME });
    }
  }, [loading, session, source]);

  const onNav = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    /* وصلنا الرئيسيّةَ بعد التسليم ⇢ الصفحةُ تملك الكوكي؛ يُمسح المخزنُ المحلّيّ
       حتّى لا يجدّد الغلافُ رمزاً صار للـWebView. */
    if (handing.current && !nav.loading && nav.url.startsWith(HOME) && !nav.url.includes("/session/handoff")) {
      handing.current = false;
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }, []);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let msg: { type?: string; items?: unknown[] } = {};
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      /* 🆕 D-929 — لقطةُ الودجت: تُكتب ملفّاً ويقرؤها `LoopzWidget.kt` كلَّ
         نصف ساعة. **والفشلُ صمتٌ**: ودجتٌ قديمةٌ خيرٌ من شاشةٍ تسقط. */
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
      } else {
        ref.current?.injectJavaScript("window.dispatchEvent(new Event('loopz:login-cancel'));true;");
      }
    },
    [signInWithGoogle],
  );

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
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D0D" }}>
      {source ? (
        <WebView
          ref={ref}
          source={source}
          style={{ flex: 1, backgroundColor: "#0D0D0D" }}
          applicationNameForUserAgent={`LoopzApp/${APP_VERSION}`}
          onMessage={onMessage}
          onNavigationStateChange={onNav}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadEnd={() => setReady(true)}
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
          mediaPlaybackRequiresUserAction={false}
          textZoom={100}
        />
      ) : null}
      {failed ? (
        <View
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "#0D0D0D", alignItems: "center", justifyContent: "center",
            gap: space.md, padding: space.xl,
          }}
        >
          <Text size={18} weight="700" style={{ textAlign: "center" }}>{t.title}</Text>
          <Text muted style={{ textAlign: "center" }}>{t.hint}</Text>
          <Button label={t.retry} onPress={retry} style={{ minWidth: 180 }} />
        </View>
      ) : !ready ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0D0D0D" }}>
          <Loading />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
