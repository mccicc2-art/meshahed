import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { PRIME_ORIGIN } from "@/core/prime";
import { DESKTOP_UA } from "../netflix/bridge";

/**
 * ====== 🆕 جسرُ برايم فيديو — متصفّحُ التطبيق على موقع برايم نفسِه (المهمّة ٦٠٤، الفحص S0 في ٢٨ نوفمبر) ======
 *
 * 🔑 **كلمةُ المرور لا تمرّ من هنا**: العضوُ يكتبها في صفحة أمازون، والسكربتُ المحقون لا يلمس نموذجاً ولا يقرأ حقلاً.
 * 🔑 **لا واجهةَ سجلٍّ في برايم**: البياناتُ JSON داخل صفحات الموقع، فالصفحةُ تطلب الصفحةَ بجلستها (`page`: `fetch` من الأصل نفسِه)
 * وتقرأ ما فيها **وتقلّمه قبل أن يغادرها**: أسماءٌ وأرقامٌ وأوقاتٌ وحالاتُ تشغيل — لا رمزَ ولا رابطَ حذفٍ (كلُّ عنصرٍ في السجلّ يحمل
 * رمزَ حذفه) ولا معرّفَ ملفّ. والتحليلُ في `core/prime.ts` (مختبَر).
 *
 * حالُ الصفحة: `signed-out` (لا ملفَّ مختار، أو صفحةُ دخول أمازون) · `gate` (اختيارُ الملفّ) · `ready` (داخلٌ بملفّ).
 * ⚖️ وكيلُ المستخدم سطحُ مكتبٍ كالمنصّات الثلاث: الفحصُ قيس على Chrome المكتب. ⚠️ لم يُقَس بعدُ داخل متصفّح الجوّال.
 */
export const PRIME_HOME = `${PRIME_ORIGIN}/`;
/** رابطُ الدخول كما في زرّ «تسجيل الدخول» على صفحة برايم بلا دخول (قِيس ٢٨ نوفمبر): يمضي إلى `amazon.com/ap/signin` ثمّ يعود إلى الرئيسية */
export const PRIME_SIGNIN = `${PRIME_ORIGIN}/auth-redirect?signin=1&returnUrl=%2F`;

export type PrimeReady = { profileId: string; name: string };
export type PrimePageState = "signed-out" | "gate" | "ready";
/** ما رآه السكربت: أرقامٌ لا رموز (بياناتُ الملفّ في الصفحة · ملفٌّ مختار · صفحةُ الاختيار) */
export type PrimeSeen = { pf: number; id: number; pick: number };
/** صفحةٌ مقلَّمة — السجلُّ (أيّامُه) أو صفحةُ عمل (عناوينُها وحالُ تشغيلها) */
export type PrimePageData = { kind: "history"; groups: unknown } | { kind: "detail"; pageTitleId: string; detail: unknown; playback: unknown };

export function primeBootScript(): string {
  return `(function () {
  if (window.__lz) return true;
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var jsons = function (doc) {
    var out = [], ss = doc.querySelectorAll("script");
    for (var i = 0; i < ss.length; i++) {
      var t = ss[i].textContent || "";
      if (ss[i].type === "application/json" || /^\\s*\\{/.test(t)) { try { out.push(JSON.parse(t)); } catch (e) {} }
    }
    return out;
  };
  var profileOf = function (js) { for (var i = 0; i < js.length; i++) if (js[i] && js[i].Profile) return js[i].Profile; return null; };
  /* بصمةٌ قصيرةٌ للملفّ — يعرف التطبيقُ بها أنّ الملفَّ تغيّر، ولا يغادر المعرّفُ نفسُه الصفحة */
  var mark = function (s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "p" + (h >>> 0).toString(36); };
  var picking = function () {
    var b = document.body ? document.body.innerText || "" : "";
    return /من يشاهد|who.?s watching/i.test(b.slice(0, 3000));
  };
  var state = function () {
    var q = location.pathname || "/";
    if (!/(^|\\.)primevideo\\.com$/i.test(location.host)) return { s: "signed-out", path: location.host, d: null };
    var p = profileOf(jsons(document));
    var d = { pf: p ? 1 : 0, id: p && p.currentProfileID ? 1 : 0, pick: picking() ? 1 : 0 };
    if (d.pick) return { s: "gate", path: q, d: d };
    if (!d.id) return { s: "signed-out", path: q, d: d };
    return { s: "ready", path: q, d: d, profileId: mark(p.currentProfileID) };
  };
  var last = "";
  var tick = function () {
    var st = state();
    var key = st.s + "|" + (st.profileId || "") + "|" + st.path + "|" + JSON.stringify(st.d);
    if (key === last) return;
    last = key;
    if (st.s === "ready") post({ t: "ready", profileId: st.profileId, name: "", path: st.path, d: st.d });
    else post({ t: "state", state: st.s, path: st.path, d: st.d });
  };
  /* ===== التقليم: ما يغادر الصفحة ===== */
  var slimHistory = function (groups) {
    return (groups || []).map(function (g) {
      return { titles: ((g && g.titles) || []).map(function (t) {
        return {
          gti: t.gti, titleType: t.titleType, time: t.time,
          title: { text: t.title && t.title.text, href: t.title && t.title.href },
          children: (t.children || []).map(function (c) { return { gti: c.gti, titleType: c.titleType, time: c.time }; })
        };
      }) };
    });
  };
  var slimDetail = function (body) {
    var states = [body.atf && body.atf.state, body.btf && body.btf.state].filter(Boolean);
    var pageId = null, detail = {}, playback = {};
    states.forEach(function (st) {
      pageId = pageId || st.pageTitleId || null;
      var maps = [st.detail && st.detail.detail, st.detail && st.detail.headerDetail];
      maps.forEach(function (m) {
        if (!m) return;
        Object.keys(m).forEach(function (g) {
          var v = m[g]; if (!v || detail[g]) return;
          detail[g] = { titleType: v.titleType, title: v.title, parentTitle: v.parentTitle, seasonNumber: v.seasonNumber, episodeNumber: v.episodeNumber, releaseYear: v.releaseYear, duration: v.duration };
        });
      });
      ["atf", "btf"].forEach(function (k) {
        var m = st.action && st.action[k]; if (!m) return;
        Object.keys(m).forEach(function (g) {
          var a = m[g] && m[g].primaryActions && m[g].primaryActions[0];
          var pb = a && a.payload && a.payload.playback;
          if (pb && !playback[g]) playback[g] = { playbackStatus: pb.playbackStatus, progress: pb.progress, resumeTime: pb.resumeTime };
        });
      });
    });
    return pageId ? { kind: "detail", pageTitleId: pageId, detail: detail, playback: playback } : null;
  };
  window.__lz = {
    page: async function (id, path) {
      try {
        var r = await fetch(path, { credentials: "include" });
        if (!/(^|\\.)primevideo\\.com$/i.test(new URL(r.url).host)) { post({ t: "page", id: id, status: 401 }); return; }
        var doc = new DOMParser().parseFromString(await r.text(), "text/html");
        var js = jsons(doc);
        var p = profileOf(js);
        if (!p || !p.currentProfileID) { post({ t: "page", id: id, status: 401 }); return; }
        var out = null;
        for (var i = 0; i < js.length && !out; i++) {
          var b = js[i] && js[i].init && js[i].init.preparations && js[i].init.preparations.body;
          if (!b) continue;
          (b.widgets || []).forEach(function (w) {
            var c = w && w.content;
            if (!out && c && c.content && Array.isArray(c.content.titles) && /ActivityHistory/.test(String(c.__type || c.content.__type || ""))) out = { kind: "history", groups: slimHistory(c.content.titles) };
          });
          if (!out && (b.atf || b.btf)) out = slimDetail(b);
        }
        post(out ? { t: "page", id: id, status: 200, body: JSON.stringify(out) } : { t: "page", id: id, status: 204 });
      } catch (e) { post({ t: "page", id: id, status: 0 }); }
    }
  };
  /* أزرارُ الدخول بجوجل وأبل وفيسبوك تُخفى — كالمنصّات الأخرى: المزوّدون يرفضون الدخولَ من متصفّحٍ داخل تطبيق */
  var hideSocial = function () {
    var els = document.querySelectorAll("button, a, [role=button]");
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.getAttribute("data-lz-hidden")) continue;
      var s = ((e.textContent || "") + " " + (e.getAttribute("aria-label") || "")).toLowerCase();
      if ((e.textContent || "").trim().length <= 60 && /google|apple|facebook|جوجل|أبل|فيسبوك/.test(s)) { e.style.display = "none"; e.setAttribute("data-lz-hidden", "1"); }
    }
  };
  tick();
  hideSocial();
  setInterval(function () { tick(); hideSocial(); }, 500);
  return true;
})();`;
}

const BOOT = primeBootScript();
/* الخروجُ عند الفكّ: يمسح ما تقرؤه الصفحةُ من كوكياتها (للنطاق والمسار الجذر) ثمّ يقول «signed-out».
   ⚠️ ما كان منها `HttpOnly` لا يصله سكربت — فالخروجُ الكاملُ من أمازون بيد العضو من صفحته إن أراده */
const SIGN_OUT = `(function(){ document.cookie.split(";").forEach(function(c){ var n = c.split("=")[0].trim(); if (!n) return; ["", "; domain=.primevideo.com", "; domain=www.primevideo.com"].forEach(function(d){ document.cookie = n + "=; Max-Age=0; path=/" + d; }); }); try { window.ReactNativeWebView.postMessage(JSON.stringify({ t: "state", state: "signed-out", path: location.pathname })); } catch (e) {} true; })();`;

export type PrimeWebRef = {
  /** صفحةٌ من برايم بجلسة العضو، مقلَّمةً — أو `null` (لم تُجب)، أو `"auth"` (لا جلسة) */
  page: (path: string, ms?: number) => Promise<PrimePageData | null | "auth">;
  go: (url: string) => void;
  /** لماذا فشل آخرُ طلب: `s<رقم>` · `nav` انتقلت الصفحة · `time` لا جواب · `parse` ردٌّ غيرُ مفهوم · `empty` صفحةٌ بلا بيانات */
  why: () => string;
};

type Props = {
  url: string;
  mode: "visible" | "hidden";
  onReady?: (r: PrimeReady, path: string) => void;
  onPageState?: (s: PrimePageState, path: string, seen: PrimeSeen | null) => void;
  onSocialBlocked?: () => void;
  /** انتقالٌ إلى موقعٍ غير برايم وأمازون (مسموح) — اسمُه للقياس */
  onForeign?: (host: string) => void;
  signOut?: boolean;
};

/** برايم وأمازون (الدخولُ في `amazon.*`) — وغيرُهما يُسمح ويُقاس، وجوجل وأبل وفيسبوك ممنوعة */
const PRIME_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(primevideo\.com|amazon\.[a-z.]+|media-amazon\.com|ssl-images-amazon\.com|amazonvideo\.com)(\/|$)/i;
const SOCIAL = /^https:\/\/(accounts\.google\.com|appleid\.apple\.com|([a-z0-9-]+\.)?facebook\.com)(\/|$)/i;

export const PrimeWeb = forwardRef<PrimeWebRef, Props>(function PrimeWeb({ url, mode, onReady, onPageState, onSocialBlocked, onForeign, signOut }, ref) {
  const web = useRef<WebView<object>>(null);
  const seq = useRef(0);
  const pending = useRef(new Map<number, (v: PrimePageData | null | "auth") => void>());
  const lastWhy = useRef("");
  const settle = useRef(new Set<() => void>());

  useImperativeHandle(
    ref,
    () => ({
      page: async (path, ms = 30_000) => {
        const once = () =>
          new Promise<PrimePageData | null | "auth">((resolve) => {
            const id = ++seq.current;
            const timer = setTimeout(() => {
              pending.current.delete(id);
              lastWhy.current = "time";
              resolve(null);
            }, ms);
            pending.current.set(id, (v) => {
              clearTimeout(timer);
              resolve(v);
            });
            web.current?.injectJavaScript(`window.__lz && window.__lz.page(${id}, ${JSON.stringify(path)}); true;`);
          });
        const v = await once();
        if (v !== null || lastWhy.current !== "nav") return v;
        /* انتقلت الصفحةُ أثناء الطلب: يُنتظر استقرارُها ثمّ يُعاد الطلبُ مرّةً واحدة (كشاهد — المهمّة ٥٧١) */
        await new Promise<void>((done) => {
          const t = setTimeout(() => {
            settle.current.delete(f);
            done();
          }, 12_000);
          const f = () => {
            clearTimeout(t);
            settle.current.delete(f);
            done();
          };
          settle.current.add(f);
        });
        return once();
      },
      why: () => lastWhy.current,
      go: (next) => web.current?.injectJavaScript(`location.href = ${JSON.stringify(next)}; true;`),
    }),
    [],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: { t?: string; id?: number; status?: number; body?: string; state?: PrimePageState; path?: string; profileId?: string; name?: string; d?: PrimeSeen | null };
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (m.t === "page" && typeof m.id === "number") {
        const done = pending.current.get(m.id);
        if (!done) return;
        pending.current.delete(m.id);
        if (m.status === 401) return done("auth");
        if (m.status !== 200 || !m.body) {
          lastWhy.current = m.status === 204 ? "empty" : `s${m.status ?? 0}`;
          return done(null);
        }
        try {
          done(JSON.parse(m.body) as PrimePageData);
        } catch {
          lastWhy.current = "parse";
          done(null);
        }
      } else if (m.t === "ready" && typeof m.profileId === "string") {
        for (const f of [...settle.current]) f();
        onReady?.({ profileId: m.profileId, name: m.name ?? "" }, m.path ?? "");
      } else if (m.t === "state" && m.state) {
        for (const f of [...settle.current]) f();
        onPageState?.(m.state, m.path ?? "", m.d ?? null);
      }
    },
    [onReady, onPageState],
  );

  const onLoadStart = useCallback(() => {
    if (pending.current.size) lastWhy.current = "nav";
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
          if (r.url === "about:blank" || PRIME_HOSTS.test(r.url)) return true;
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
