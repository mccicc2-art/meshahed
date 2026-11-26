import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { OSN_API } from "@/core/osn";
import { DESKTOP_UA } from "../netflix/bridge";

/**
 * ====== 🆕 جسرُ OSN+ — متصفّحُ التطبيق على موقع OSN+ نفسِه (المهمّة ٥٥٧، الفحص S0 في ٢٦ نوفمبر) ======
 *
 * 🔑 **كلمةُ المرور لا تمرّ من هنا**: العضوُ يكتبها في صفحة OSN+. والسكربتُ المحقون لا يلمس نموذجاً ولا يقرأ حقلاً — يقرأ كوكيين
 * يضعهما الموقعُ نفسُه بعد الدخول (مقيس): `auth` (رمزُ الطلب) و`profile` (الملفُّ المختار ورمزُه). ثمّ يطلب التطبيقُ ما يريد طلباً
 * طلباً (`api`): الطلبُ يخرج من الصفحة إلى واجهة OSN+ بالترويسات التي يرسلها الموقعُ نفسُه (`access_token` · `profile_token` ·
 * `client_platform`)، والردُّ يعود نصّاً إلى التطبيق فيقرؤه `core/osn.ts`. **الرموزُ لا تغادر الصفحة**: لا تُرسل إلى التطبيق ولا تُحفظ.
 *
 * حالُ الصفحة: `signed-out` (لا رمزَ دخول) · `gate` (صفحةُ «اختر الملف الشخصي» `/profiles`) · `ready` (داخل الحساب بملفٍّ مختار:
 * معرّفُه واسمُه). والقرارُ في التطبيق لا هنا.
 *
 * ⚖️ **وكيلُ المستخدم سطحُ مكتبٍ عن قصد** كنتفليكس: الفحصُ قيس على Chrome المكتب. ⚠️ لم يُقَس بعدُ داخل متصفّح الجوّال.
 */
export const OSN_ORIGIN = "https://osnplus.com";
/** «اختر الملف الشخصي» — ومَن لم يسجّل دخوله يحوّله الموقعُ إلى الدخول (لم يُقَس: الحسابُ المفحوص كان مسجَّلاً) */
export const OSN_PROFILES = `${OSN_ORIGIN}/ar-sa/profiles`;
export const OSN_HOME = `${OSN_ORIGIN}/ar-sa/home`;

export type OsnReady = { profileId: string; name: string };
export type OsnPageState = "signed-out" | "gate" | "ready";

export function osnBootScript(): string {
  const api = JSON.stringify(OSN_API);
  return `(function () {
  if (window.__lz) return true;
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var cookie = function (n) {
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(n + "=") === 0) { try { return JSON.parse(decodeURIComponent(c.slice(n.length + 1))); } catch (e) { return null; } }
    }
    return null;
  };
  var state = function () {
    var q = location.pathname || "/";
    var a = cookie("auth");
    if (!a || !a.requestToken) return { s: "signed-out", path: q };
    if (/\\/profiles(\\/|$)/i.test(q)) return { s: "gate", path: q };
    var p = cookie("profile");
    if (!p || !p.profileToken || p.id == null) return { s: "gate", path: q };
    return { s: "ready", path: q, profileId: String(p.id), name: String(p.name || "") };
  };
  var last = "";
  var tick = function () {
    var st = state();
    var key = st.s + "|" + (st.profileId || "") + "|" + st.path;
    if (key === last) return;
    last = key;
    if (st.s === "ready") post({ t: "ready", profileId: st.profileId, name: st.name, path: st.path });
    else post({ t: "state", state: st.s, path: st.path });
  };
  window.__lz = {
    api: async function (id, ep, body) {
      try {
        var a = cookie("auth"), p = cookie("profile");
        if (!a || !a.requestToken || !p || !p.profileToken) { post({ t: "api", id: id, status: 401, body: "" }); return; }
        var r = await fetch(${api} + ep, { method: "POST", headers: { "content-type": "application/json", "access_token": a.requestToken, "profile_token": p.profileToken, "client_platform": "web-osn", "language": "en" }, body: body });
        post({ t: "api", id: id, status: r.status, body: await r.text() });
      } catch (e) { post({ t: "api", id: id, status: 0, body: "" }); }
    }
  };
  tick();
  setInterval(tick, 500);
  return true;
})();`;
}

const BOOT = osnBootScript();
/* 🆕 الخروجُ عند الفكّ: يمسح الكوكيين اللذين يحملان الجلسة من الصفحة نفسِها (للنطاق والمسار الجذر)، ثمّ يقول «signed-out».
   OSN+ بلا رابط خروجٍ ثابتٍ مقيس، والمسحُ يكفي: الجلسةُ لا تعيش إلا فيهما (الفحص S0) */
const SIGN_OUT = `(function(){ ["auth","profile","entitlement"].forEach(function(n){ document.cookie = n + "=; Max-Age=0; path=/; domain=.osnplus.com"; document.cookie = n + "=; Max-Age=0; path=/"; }); try { window.ReactNativeWebView.postMessage(JSON.stringify({ t: "state", state: "signed-out", path: location.pathname })); } catch (e) {} true; })();`;

export type OsnWebRef = {
  /** طلبٌ إلى واجهة OSN+ بجلسة الصفحة — الردُّ JSON، أو `null` (شبكةٌ أو ردٌّ ليس JSON)، أو `"auth"` (انتهت الجلسة) */
  api: (ep: string, body: object, ms?: number) => Promise<unknown>;
  go: (url: string) => void;
};

type Props = {
  url: string;
  mode: "visible" | "hidden";
  onReady?: (r: OsnReady, path: string) => void;
  onPageState?: (s: OsnPageState, path: string) => void;
  onNav?: (url: string) => void;
  /** فكُّ الربط: تُمسح الجلسةُ بدل أن تُقرأ */
  signOut?: boolean;
};

export const OsnWeb = forwardRef<OsnWebRef, Props>(function OsnWeb({ url, mode, onReady, onPageState, onNav, signOut }, ref) {
  const web = useRef<WebView<object>>(null);
  const seq = useRef(0);
  const pending = useRef(new Map<number, (v: unknown) => void>());

  useImperativeHandle(
    ref,
    () => ({
      api: (ep, body, ms = 30_000) =>
        new Promise((resolve) => {
          const id = ++seq.current;
          const timer = setTimeout(() => {
            pending.current.delete(id);
            resolve(null);
          }, ms);
          pending.current.set(id, (v) => {
            clearTimeout(timer);
            resolve(v);
          });
          web.current?.injectJavaScript(`window.__lz && window.__lz.api(${id}, ${JSON.stringify(ep)}, ${JSON.stringify(JSON.stringify(body))}); true;`);
        }),
      go: (next) => web.current?.injectJavaScript(`location.href = ${JSON.stringify(next)}; true;`),
    }),
    [],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: { t?: string; id?: number; status?: number; body?: string; state?: OsnPageState; path?: string; profileId?: string; name?: string };
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (m.t === "api" && typeof m.id === "number") {
        const done = pending.current.get(m.id);
        if (!done) return;
        pending.current.delete(m.id);
        if (m.status === 401) return done("auth");
        try {
          done(m.status === 200 && m.body ? JSON.parse(m.body) : null);
        } catch {
          done(null);
        }
      } else if (m.t === "ready" && typeof m.profileId === "string") {
        onReady?.({ profileId: m.profileId, name: m.name ?? "" }, m.path ?? "");
      } else if (m.t === "state" && m.state) {
        onPageState?.(m.state, m.path ?? "");
      }
    },
    [onReady, onPageState],
  );

  /* الصفحةُ تُبدَّل: ما ينتظر ردّاً من الصفحة السابقة لن يصله — يُصرف بـ`null` */
  const onLoadStart = useCallback(() => {
    for (const done of pending.current.values()) done(null);
    pending.current.clear();
  }, []);

  return (
    <View style={mode === "hidden" ? styles.hidden : styles.full} pointerEvents={mode === "hidden" ? "none" : "auto"}>
      <WebView
        ref={web}
        source={{ uri: url }}
        userAgent={DESKTOP_UA}
        injectedJavaScript={signOut ? SIGN_OUT : BOOT}
        onMessage={onMessage}
        onLoadStart={onLoadStart}
        onNavigationStateChange={(n: WebViewNavigation) => onNav?.(n.url)}
        originWhitelist={["https://*"]}
        /* صفحاتُ OSN+ ودخولُها وحدها: رابطٌ إلى غيرها لا يُفتح هنا. ⚠️ نطاقاتُ الدخول (جوجل · أبل) لم تُقَس — تُضاف بعد أوّل تجربة */
        onShouldStartLoadWithRequest={(r) => /^https:\/\/([a-z0-9-]+\.)*(osnplus\.com|osn\.com|anghcdn\.co|anghami\.com|accounts\.google\.com|appleid\.apple\.com)(\/|$)/i.test(r.url) || r.url === "about:blank"}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled={false}
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "#000" }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  full: { flex: 1 },
  hidden: { position: "absolute", top: 0, left: 0, width: 2, height: 2, opacity: 0 },
});
