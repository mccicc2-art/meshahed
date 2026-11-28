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
/** 🆕 المهمّة ٥٦٩ — ملفٌّ من ملفّات الحساب كما يصل التطبيق: معرّفُه واسمُه · للأطفال · الرئيسيّ · مقفلٌ برمز */
export type ShahidProfile = { id: string; name: string; kid: number; def: number; lock: number };
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
  /* 🆕 المهمّة ٥٦٩ — **ملفّاتُ الحساب** (قياسُ جوال أحمد بعد R318: داخلٌ بلا ملفٍّ مختار و«اختر من يشاهد» لا تظهر، فعلقت الصفحة).
     القائمةُ من حال الموقع المحفوظة، وإلّا من واجهة شاهد نفسِها (\`userprofile/profiles/me\` — يطلبها الموقعُ بالرمز وحده، مقيسٌ في كوده
     ٢٦ نوفمبر). الكائناتُ كاملةً تبقى في الصفحة؛ والتطبيقُ يرى الاسمَ والنوع وهل هو مقفلٌ — لا رمزَ ولا رقمَ قفل */
  var known = null;
  var list = function () {
    var pr = store("profiles");
    var l = (pr && pr.profileList) || [];
    if (!l.length && known) l = known;
    return l.filter(function (x) { return x && x.id != null; });
  };
  /* مقفلٌ برمز: اختيارُه من خارج شاهد يتخطّى قفلاً وضعه صاحبُ الحساب — فيُختار في نافذة شاهد نفسِها حيث يُكتب الرمز */
  var locked = function (x) { return x.type !== "KID" && !!(x.pinCode || x.pin || x.isPinProtected || x.pinProtected || x.hasPin || x.locked); };
  var slim = function (x) { return { id: String(x.id), name: String(x.name || ""), kid: x.type === "KID" ? 1 : 0, def: x["default"] ? 1 : 0, lock: locked(x) ? 1 : 0 }; };
  var saveProfiles = function (fn) {
    try {
      var pm = JSON.parse(localStorage.getItem("persist:modules") || "{}");
      var pr = JSON.parse(pm.profiles || "null") || {};
      fn(pr);
      pm.profiles = JSON.stringify(pr);
      localStorage.setItem("persist:modules", JSON.stringify(pm));
    } catch (e) {}
  };
  /* 🆕 المهمّة ٥٧١ — **ترويسةُ الملفّ كما يبنيها شاهد حرفاً** (قياسُ جوال أحمد بعد R319: الدخولُ نجح والقراءةُ فشلت في أقلَّ من ثانية،
     وكنّا نرسل \`{id, master}\` وحدها). شاهد يبني من كوكي \`profileType\` (وإلّا الملفِّ المختار): \`profile\` = عمرُ الطفل إن كان ·
     \`ageRestriction\` (أو طفل) · المعرّف · \`master\` (كبارٌ ورئيسيّ)؛ و\`profile-key\` = العمر · \`ageRestriction\` · \`isAdult\`؛
     ولغةُ الطلب لغةُ الملفّ (\`profileLanguage\`). مقيسٌ في كوده ٢٦ نوفمبر. ونوعٌ مجهول ⇐ كبارٌ رئيسيّ كما كان يعمل في الفحص */
  var profileHeaders = function (pid) {
    var b = null;
    try { var c = cookie("profileType"); b = c ? JSON.parse(c) : null; } catch (e) { b = null; }
    var sp = selected();
    if (!b || !b.type) b = (sp && String(sp.id) === String(pid)) ? sp : b;
    var known = !!(b && b.type);
    var kid = known && b.type === "KID", adult = !known || b.type === "ADULT";
    var age = kid ? (b.age || b.ageRangeMaxAge || null) : null;
    var o = {}, k = {};
    if (age) { o.age = age; k.age = age; }
    o.ageRestriction = !!((b && b.ageRestriction) || kid);
    o.id = pid;
    o.master = known ? (adult && !!b["default"]) : true;
    k.ageRestriction = o.ageRestriction;
    k.isAdult = adult;
    return { profile: JSON.stringify(o), key: JSON.stringify(k) };
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
    profiles: async function (id) {
      var l = list(), src = "st";
      if (!l.length) {
        var tk = token();
        src = "none";
        if (tk) {
          try {
            var r = await fetch(${api} + "proxy/v2.1/userprofile/profiles/me", { method: "GET", headers: { "language": "AR", "Accept-Language": "ar", "shahid_os": "WEB", "uuid": "WEB", "token": tk } });
            src = "api" + r.status;
            if (r.ok) { var j = await r.json(); known = ((j && j.profiles) || []).filter(function (x) { return x && x.id != null; }); l = known; }
          } catch (e) { src = "apierr"; }
        }
      }
      post({ t: "profiles", id: id, list: l.map(slim), src: src });
    },
    /* 🆕 المهمّة ٥٦٩ — الملفُّ الذي اختاره العضوُ يُكتب كما يكتبه شاهد حين يُختار من نافذته (مقيسٌ في كوده): كوكي \`profileId\`
       (١٠٠ يوم) و\`profileType\` و\`profileLanguage\`، و\`selectedProfile\` في حاله المحفوظة — ثمّ تُفتح الرئيسيّةُ من جديد فتُبنى بالملفّ */
    pick: function (pid) {
      var p = list().filter(function (x) { return String(x.id) === String(pid); })[0];
      if (!p || locked(p)) { post({ t: "picked", ok: 0 }); return; }
      var pt = { type: p.type, ageRestriction: p.ageRestriction, "default": p["default"] };
      if (p.type === "KID" && p.ageRangeMaxAge != null) pt.age = p.ageRangeMaxAge;
      document.cookie = "profileId=" + encodeURIComponent(String(p.id)) + "; path=/; max-age=8640000";
      document.cookie = "profileType=" + encodeURIComponent(JSON.stringify(pt)) + "; path=/";
      var lang = p.preference && p.preference.language;
      if (lang) document.cookie = "profileLanguage=" + encodeURIComponent(String(lang)) + "; path=/; max-age=8640000";
      var all = list();
      saveProfiles(function (pr) { pr.selectedProfile = p; if (!pr.profileList || !pr.profileList.length) pr.profileList = all; pr.isShowModal = false; });
      post({ t: "picked", ok: 1 });
      location.href = ${JSON.stringify(SHAHID_HOME)};
    },
    /* نافذةُ «اختر من يشاهد» نفسُها (للملفّ المقفل، ولمن لم يقبل شاهدُ اختيارَه): الحالُ التي يكتبها شاهد ليعرضها، ثمّ الرئيسيّة */
    picker: function () {
      saveProfiles(function (pr) { pr.isShowModal = true; pr.profileModalType = "PROFILE_SELECTION"; });
      location.href = ${JSON.stringify(SHAHID_HOME)};
    },
    api: async function (id, ep, query, auth) {
      try {
        var h = { "language": "AR", "Accept-Language": "ar", "shahid_os": "WEB", "uuid": "WEB" };
        if (auth) {
          var tk = token(), pid = profileId();
          if (!tk || !pid) { post({ t: "api", id: id, status: 401, body: "" }); return; }
          h.token = tk;
          h.country = "SAU";
          var ph = profileHeaders(pid);
          h.profile = ph.profile;
          h["profile-key"] = ph.key;
          var pl = cookie("profileLanguage");
          if (pl) { h.language = String(pl).toUpperCase(); h["Accept-Language"] = String(pl).toLowerCase(); }
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
  /** 🆕 المهمّة ٥٦٩ — ملفّاتُ الحساب ومصدرُها للقياس (`st` الحال المحفوظة · `api200` واجهةُ شاهد…) — `null` إن لم تُجب الصفحة */
  profiles: () => Promise<{ list: ShahidProfile[]; src: string } | null>;
  /** يختار الملفَّ في الموقع ثمّ يفتح الرئيسيّة به */
  pick: (profileId: string) => void;
  /** يفتح نافذةَ «اختر من يشاهد» في شاهد نفسِه */
  picker: () => void;
  /** 🆕 المهمّة ٥٧١ — لماذا فشل آخرُ طلب: `s<رقم>` ردُّ شاهد · `nav` انتقلت الصفحة · `time` لا جواب · `parse` ردٌّ غيرُ مفهوم */
  why: () => string;
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
  /* 🆕 المهمّة ٥٧١ — سببُ آخر فشل، ومن ينتظر استقرارَ الصفحة بعد انتقالها */
  const lastWhy = useRef("");
  const settle = useRef(new Set<() => void>());

  useImperativeHandle(
    ref,
    () => ({
      api: async (ep, query, auth, ms = 30_000) => {
        const once = () =>
          new Promise<unknown>((resolve) => {
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
            web.current?.injectJavaScript(`window.__lz && window.__lz.api(${id}, ${JSON.stringify(ep)}, ${JSON.stringify(query)}, ${auth ? "true" : "false"}); true;`);
          });
        const v = await once();
        if (v !== null || lastWhy.current !== "nav") return v;
        /* 🆕 المهمّة ٥٧١ — انتقلت الصفحةُ أثناء الطلب (لغةُ الملفّ أو صفحةُ الأطفال): يُنتظر استقرارُها ثمّ يُعاد الطلبُ مرّةً واحدة */
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
      profiles: () =>
        new Promise((resolve) => {
          const id = ++seq.current;
          const timer = setTimeout(() => {
            pending.current.delete(id);
            resolve(null);
          }, 15_000);
          pending.current.set(id, (v) => {
            clearTimeout(timer);
            resolve((v as { list: ShahidProfile[]; src: string } | null) ?? null);
          });
          web.current?.injectJavaScript(`window.__lz && window.__lz.profiles(${id}); true;`);
        }),
      pick: (pid) => web.current?.injectJavaScript(`window.__lz && window.__lz.pick(${JSON.stringify(pid)}); true;`),
      picker: () => web.current?.injectJavaScript(`window.__lz && window.__lz.picker(); true;`),
    }),
    [],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: { t?: string; id?: number; status?: number; body?: string; state?: ShahidPageState; path?: string; profileId?: string; name?: string; d?: ShahidSeen; list?: ShahidProfile[]; src?: string };
      /* A-84 (المدقّق ٢٧ نوفمبر) — المتصفّحُ يفتح الآن صفحاتٍ ليست من شاهد (المهمّة ٥٦٨)، فلا يُقبل ردٌّ إلّا من صفحةٍ على نطاقات شاهد:
         ما يصل من غيرها لا يُجيب طلباً ولا يغيّر حالة الربط */
      if (!SHAHID_HOSTS.test(e.nativeEvent.url ?? "")) return;
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
        if (m.status !== 200 || !m.body) {
          lastWhy.current = `s${m.status ?? 0}`;
          return done(null);
        }
        try {
          done(JSON.parse(m.body));
        } catch {
          lastWhy.current = "parse";
          done(null);
        }
      } else if (m.t === "profiles" && typeof m.id === "number") {
        const done = pending.current.get(m.id);
        if (!done) return;
        pending.current.delete(m.id);
        done({ list: Array.isArray(m.list) ? m.list : [], src: typeof m.src === "string" ? m.src : "" });
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
