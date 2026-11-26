import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { SHAHID_API } from "@/core/shahid";
import { DESKTOP_UA } from "../netflix/bridge";

/**
 * ====== 🆕 جسرُ شاهد — متصفّحُ التطبيق على موقع شاهد نفسِه (المهمّة ٥٦٧، الفحص S0 في ٢٦ نوفمبر) ======
 *
 * 🔑 **كلمةُ المرور لا تمرّ من هنا**: العضوُ يكتبها في صفحة شاهد. والسكربتُ المحقون لا يلمس نموذجاً ولا يقرأ حقلاً — يقرأ كوكيين
 * يضعهما الموقعُ نفسُه بعد الدخول (مقيس): `token` (رمزُ الجلسة) و`profileId` (الملفُّ المختار). ثمّ يطلب التطبيقُ ما يريد طلباً
 * طلباً (`api`): الطلبُ يخرج من الصفحة إلى واجهة شاهد بالترويسات التي يرسلها الموقعُ نفسُه (`token` · `profile` · `shahid_os`)،
 * والردُّ يعود نصّاً إلى التطبيق فيقرؤه `core/shahid.ts`. **الرمزُ لا يغادر الصفحة**: لا يُرسل إلى التطبيق ولا يُحفظ.
 *
 * حالُ الصفحة: `signed-out` (لا رمز) · `gate` (نافذةُ «اختر من يشاهد الآن» — نافذةٌ فوق الرئيسيّة لا صفحة، فتُعرف بنصّها) · `ready`
 * (داخل الحساب بملفٍّ مختار: معرّفُه واسمُه). والقرارُ في التطبيق لا هنا.
 *
 * ⚖️ وكيلُ المستخدم سطحُ مكتبٍ كنتفليكس وOSN+: الفحصُ قيس على Chrome المكتب. ⚠️ لم يُقَس بعدُ داخل متصفّح الجوّال.
 */
export const SHAHID_ORIGIN = "https://shahid.mbc.net";
export const SHAHID_HOME = `${SHAHID_ORIGIN}/ar`;

export type ShahidReady = { profileId: string; name: string };
/** 🆕 المهمّة ٥٦٨ — ما رآه سكربتُ الصفحة: أرقامٌ لا رموز (كوكي الجلسة · جلسةُ الحال المحفوظة · الملفّ · نافذةُ «اختر من يشاهد») */
export type ShahidSeen = { ck: number; st: number; pid: number; pick: number };
export type ShahidPageState = "signed-out" | "gate" | "ready";

export function shahidBootScript(): string {
  const api = JSON.stringify(SHAHID_API);
  return `(function () {
  if (window.__lz) return true;
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var cookie = function (n) {
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(n + "=") === 0) { try { return decodeURIComponent(c.slice(n.length + 1)); } catch (e) { return null; } }
    }
    return null;
  };
  /* الملفُّ المختار من حال الموقع المحفوظة — اسمُه للسؤال، و«default» علامةُ الملفّ الرئيسيّ في ترويسة الطلب */
  var store = function (k) {
    try { var pm = JSON.parse(localStorage.getItem("persist:modules") || "{}"); return JSON.parse(pm[k] || "null"); } catch (e) { return null; }
  };
  var selected = function () { var p = store("profiles"); return (p && p.selectedProfile) || null; };
  /* 🆕 المهمّة ٥٦٨ — **الجلسةُ من الكوكي، وإلّا من حال الموقع المحفوظة** (فيديو أحمد ٢٦ نوفمبر: دخل بالجوال وعلقت الصفحة ولم يلحظ
     Loopz دخوله). الموقعُ نفسُه يرسل \`token\` من \`user.sessionId\` (مقيسٌ في كوده)، والملفُّ من \`selectedProfile\` — فإن غاب الكوكي
     على الجوّال بقي الطريقُ الذي يمشيه الموقع */
  var token = function () { var c = cookie("token"); if (c) return c; var u = store("user"); return (u && u.sessionId) ? String(u.sessionId) : null; };
  var profileId = function () { var c = cookie("profileId"); if (c) return c; var sp = selected(); return (sp && sp.id != null) ? String(sp.id) : null; };
  var gateShown = function () {
    var b = document.body ? document.body.innerText || "" : "";
    return /اختر من يشاهد|who.?s watching/i.test(b.slice(0, 4000));
  };
  var state = function () {
    var q = location.pathname || "/";
    /* 🆕 المهمّة ٥٦٨ — ما رآه السكربتُ يُرسل مع كلِّ حال (أرقامٌ لا رموز): كوكي الجلسة · جلسةُ الحال المحفوظة · الملفّ · نافذةُ الاختيار */
    var d = { ck: cookie("token") ? 1 : 0, st: (store("user") || {}).sessionId ? 1 : 0, pid: profileId() ? 1 : 0, pick: gateShown() ? 1 : 0 };
    if (!token()) return { s: "signed-out", path: q, d: d };
    var id = profileId();
    if (!id || d.pick) return { s: "gate", path: q, d: d };
    var sp = selected();
    return { s: "ready", path: q, d: d, profileId: String(id), name: String(sp && String(sp.id) === String(id) ? sp.name || "" : "") };
  };
  var last = "";
  var tick = function () {
    var st = state();
    var key = st.s + "|" + (st.profileId || "") + "|" + st.path + "|" + JSON.stringify(st.d);
    if (key === last) return;
    last = key;
    if (st.s === "ready") post({ t: "ready", profileId: st.profileId, name: st.name, path: st.path, d: st.d });
    else post({ t: "state", state: st.s, path: st.path, d: st.d });
  };
  window.__lz = {
    api: async function (id, ep, query, auth) {
      try {
        var h = { "language": "AR", "Accept-Language": "ar", "shahid_os": "WEB", "uuid": "WEB" };
        if (auth) {
          var tk = token(), pid = profileId();
          if (!tk || !pid) { post({ t: "api", id: id, status: 401, body: "" }); return; }
          var sp = selected();
          h.token = tk;
          h.country = "SAU";
          h.profile = JSON.stringify({ id: pid, master: !!(sp && String(sp.id) === String(pid) ? sp["default"] : true) });
        }
        var r = await fetch(${api} + ep + (query ? "?" + query : ""), { method: "GET", headers: h });
        post({ t: "api", id: id, status: r.status, body: await r.text() });
      } catch (e) { post({ t: "api", id: id, status: 0, body: "" }); }
    }
  };
  /* أزرارُ الدخول بجوجل وأبل وفيسبوك تُخفى — كـOSN+ (المهمّة ٥٥٨): المزوّدون يرفضون الدخولَ من متصفّحٍ داخل تطبيق */
  var hideSocial = function () {
    var els = document.querySelectorAll("button, a, [role=button]");
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.getAttribute("data-lz-hidden")) continue;
      var s = ((e.textContent || "") + " " + (e.getAttribute("aria-label") || "") + " " + (e.getAttribute("title") || "")).toLowerCase();
      var img = e.querySelector("img[alt], svg[aria-label]");
      if (img) s += " " + (img.getAttribute("alt") || img.getAttribute("aria-label") || "").toLowerCase();
      if ((e.textContent || "").trim().length <= 60 && /google|apple|facebook|جوجل|أبل|فيسبوك/.test(s)) { e.style.display = "none"; e.setAttribute("data-lz-hidden", "1"); }
    }
  };
  tick();
  hideSocial();
  setInterval(function () { tick(); hideSocial(); }, 500);
  return true;
})();`;
}

const BOOT = shahidBootScript();
/* الخروجُ عند الفكّ: يمسح كوكيات الجلسة من الصفحة (للنطاق والمسار الجذر) ثمّ يقول «signed-out» — كـOSN+ */
const SIGN_OUT = `(function(){ ["token","profileId","profileType","profileLanguage","userType"].forEach(function(n){ document.cookie = n + "=; Max-Age=0; path=/; domain=.mbc.net"; document.cookie = n + "=; Max-Age=0; path=/; domain=shahid.mbc.net"; document.cookie = n + "=; Max-Age=0; path=/"; }); try { localStorage.removeItem("persist:modules"); } catch (e) {} try { window.ReactNativeWebView.postMessage(JSON.stringify({ t: "state", state: "signed-out", path: location.pathname })); } catch (e) {} true; })();`;

export type ShahidWebRef = {
  /** طلبُ `GET` إلى واجهة شاهد من الصفحة — `auth`: بجلسة العضو. الردُّ JSON، أو `null`، أو `"auth"` (انتهت الجلسة) */
  api: (ep: string, query: string, auth: boolean, ms?: number) => Promise<unknown>;
  go: (url: string) => void;
};

type Props = {
  url: string;
  mode: "visible" | "hidden";
  onReady?: (r: ShahidReady, path: string) => void;
  onPageState?: (s: ShahidPageState, path: string, seen: ShahidSeen | null) => void;
  onSocialBlocked?: () => void;
  /** 🆕 المهمّة ٥٦٨ — انتقالٌ إلى موقعٍ غير شاهد (مسموحٌ الآن) — اسمُه للقياس */
  onForeign?: (host: string) => void;
  signOut?: boolean;
};

/**
 * صفحاتُ شاهد — ويُسمح بغيرها الآن (المهمّة ٥٦٨): الدخولُ بالجوال علق بعد نجاحه (فيديو أحمد ٢٦ نوفمبر)، وأرجحُ الأسباب انتقالٌ إلى
 * خدمة دخولٍ خارجيّة كان يُمنع هنا. فكلُّ صفحةٍ آمنةٍ تُفتح، واسمُ ما ليس شاهد يُقاس (`onForeign`)؛ وجوجل وأبل وفيسبوك ممنوعةٌ كما كانت.
 */
const SHAHID_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(mbc\.net|shahid\.net)(\/|$)/i;
const SOCIAL = /^https:\/\/(accounts\.google\.com|appleid\.apple\.com|([a-z0-9-]+\.)?facebook\.com)(\/|$)/i;

export const ShahidWeb = forwardRef<ShahidWebRef, Props>(function ShahidWeb({ url, mode, onReady, onPageState, onSocialBlocked, onForeign, signOut }, ref) {
  const web = useRef<WebView<object>>(null);
  const seq = useRef(0);
  const pending = useRef(new Map<number, (v: unknown) => void>());

  useImperativeHandle(
    ref,
    () => ({
      api: (ep, query, auth, ms = 30_000) =>
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
          web.current?.injectJavaScript(`window.__lz && window.__lz.api(${id}, ${JSON.stringify(ep)}, ${JSON.stringify(query)}, ${auth ? "true" : "false"}); true;`);
        }),
      go: (next) => web.current?.injectJavaScript(`location.href = ${JSON.stringify(next)}; true;`),
    }),
    [],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: { t?: string; id?: number; status?: number; body?: string; state?: ShahidPageState; path?: string; profileId?: string; name?: string; d?: ShahidSeen };
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
        onPageState?.(m.state, m.path ?? "", m.d ?? null);
      }
    },
    [onReady, onPageState],
  );

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
        originWhitelist={["https://*"]}
        onShouldStartLoadWithRequest={(r) => {
          if (SOCIAL.test(r.url)) {
            onSocialBlocked?.();
            return false;
          }
          if (r.url === "about:blank" || SHAHID_HOSTS.test(r.url)) return true;
          if (!/^https:\/\//i.test(r.url)) return false;
          onForeign?.((/^https:\/\/([^/?#]+)/i.exec(r.url)?.[1] ?? "").toLowerCase());
          return true;
        }}
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
