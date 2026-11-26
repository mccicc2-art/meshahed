import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { NETFLIX_LANG_HEADER, NETFLIX_OPS } from "@/core/netflix";

/**
 * ====== 🆕 جسرُ نتفليكس — متصفّحُ التطبيق على صفحات نتفليكس نفسِها (خطّة `PLAN-NETFLIX-SYNC.md`) ======
 *
 * 🔑 **كلمةُ المرور لا تمرّ من هنا**: العضوُ يكتبها في صفحة نتفليكس، و**لا سكربتَ يعمل على صفحة الدخول** — السكربتُ المحقون لا
 * يفعل شيئاً إلا على `/settings/viewed` (صفحةُ سجلّ المشاهدة)، وهناك يقرأ ثلاثةً لا غير: معرّفَ الملفّ الشخصيّ واسمَه، ورقمَي
 * الطلبين المحفوظين من حزمة الموقع (`persistedIdIn` — يتغيّران مع نشرات نتفليكس، فيُقرآن في كلِّ مرّة).
 * ثمّ يطلب التطبيقُ ما يريد طلباً طلباً (`gql`): الطلبُ يخرج من الصفحة بجلسة نتفليكس (الكوكي لا يغادر الجهاز)، والردُّ يعود نصّاً
 * إلى التطبيق فيقرؤه `core/netflix.ts` — منطقٌ واحدٌ مُختبَرٌ لا نسخةٌ في سكربت.
 *
 * 🆕 **اختيارُ الملفّ الشخصيّ يكفي** (أحمد ٢٥ نوفمبر «٢ب» — لا زرَّ «تم»): خارج صفحة السجلّ يراقب السكربتُ الصفحةَ نصفَ ثانيةٍ
 * بنصف ثانية ويقول حالها فقط: «gate» — صفحةُ «مَن يشاهد؟» أو خاناتُ رمز القفل ظاهرة، و«browse» — الصفحةُ الرئيسيّة مستقرّةً
 * ثانيةً ونصفاً بلا شيءٍ منهما. والقرارُ (الانتقالُ إلى السجلّ) في التطبيق لا هنا. لا نقرةَ ولا قراءةَ حقل.
 * العلاماتُ مقيسةٌ في Chrome المكتب (٢٥ نوفمبر): `profile-gate-screen` على «مَن يشاهد؟»، ثمّ تختفي بعد الاختيار ويبقى شريطُ
 * `navigation` على `/browse`. وخاناتُ الرمز لم تُرَ بعد (لا ملفَّ مقفلاً في الحساب المقيس) — فعلاماتُها أعمُّ: حقلٌ رقميّ أو بخانةٍ واحدة،
 * و🆕 T552: **على صفحات نتفليكس الداخليّة وحدها** (`/browse` · `/profiles`) — صفحةُ رمز البريد عند الدخول خاناتُها مثلُها، فكانت تُحسب
 * «مَن يشاهد؟» ظهرت واختفت، فيُقرأ ملفٌّ لم يختره العضو. والاختيارُ لا يُحسب إلا من `profile-gate-screen` نفسِها.
 *
 * ⚖️ **وكيلُ المستخدم سطحُ مكتبٍ عن قصد**: كلُّ ما قيس في الفحص S0 (٢٥ نوفمبر) قيس على Chrome المكتب؛ وصفحاتُ نتفليكس للجوّال
 * قد تحوّل إلى «حمّل التطبيق» فلا حزمةَ فيها ولا طلبات.
 */
export const NETFLIX_ORIGIN = "https://www.netflix.com";
export const NETFLIX_LOGIN = `${NETFLIX_ORIGIN}/login`;
export const NETFLIX_VIEWED = `${NETFLIX_ORIGIN}/settings/viewed`;
export const NETFLIX_SIGNOUT = `${NETFLIX_ORIGIN}/SignOut`;
/** صفحةُ «مَن يشاهد؟» — تحوّل إلى `/browse` وعليها الملفّات (مقيس ٢٥ نوفمبر)؛ ومَن لم يسجّل دخوله تحوّله إلى الدخول */
export const NETFLIX_GATE = `${NETFLIX_ORIGIN}/ProfilesGate`;
export const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type NfxReady = { guid: string; name: string; historyId: string | null; seasonId: string | null; moviesId: string | null };
/** 🆕 `left`: «مَن يشاهد؟» اختفت لتوّها بعد أن ظهرت — يُقال فوراً لتغطّي شاشةُ التحميل نتفليكس، و`browse` يؤكّد بعده */
/** 🆕 T552 — `pin`: خاناتُ رمز قفل الملفّ على صفحات نتفليكس الداخليّة — لا تُعدّ «مَن يشاهد؟» (خاناتُ رمز البريد عند الدخول
 *  أوهمت بأنّ الملفّ اختير، أحمد ٢٥ نوفمبر) */
export type NfxPageState = "signed-out" | "page" | "no-profile" | "error" | "gate" | "pin" | "left" | "browse";

/** السكربتُ المحقون بعد كلِّ تحميل — لا يقرأ حقلاً في صفحة الدخول ولا يلمس نموذجاً */
export function netflixBootScript(): string {
  const lang = JSON.stringify({ "content-type": "application/json", ...NETFLIX_LANG_HEADER });
  const hist = JSON.stringify(NETFLIX_OPS.history);
  const season = JSON.stringify(NETFLIX_OPS.season);
  const movies = JSON.stringify(NETFLIX_OPS.movies);
  return `(function () {
  var post = function (m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var findIds = async function (srcs, ops) {
    var out = {}; var left = ops.length;
    for (var i = 0; i < srcs.length && left; i++) {
      var t = ""; try { t = await (await fetch(srcs[i])).text(); } catch (e) { continue; }
      for (var k = 0; k < ops.length; k++) {
        if (out[ops[k]]) continue;
        var re = new RegExp("\\\\b" + ops[k] + "Document=\\\\{__meta__:\\\\{q:\\"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\"");
        var m = re.exec(t); if (m) { out[ops[k]] = m[1]; left--; }
      }
    }
    return out;
  };
  var watch = function () {
    var last = "", calm = 0, had = false;
    setInterval(function () {
      var q = location.pathname || "/";
      if (q.indexOf("/login") === 0 || q.indexOf("/signup") === 0 || q === "/") { calm = 0; return; }
      var inner = q.indexOf("/browse") === 0 || q.indexOf("/profiles") === 0 || q.indexOf("/ProfilesGate") === 0;
      var gate = !!document.querySelector('[data-uia="profile-gate-screen"]');
      var pin = inner && !gate && !!document.querySelector('[data-uia*="profile-lock" i],[data-uia*="pin-entry" i],[data-uia*="pin-input" i],[data-uia*="pin-number" i],input[inputmode="numeric"],input[maxlength="1"]');
      var nav = !!document.querySelector('[data-uia="navigation"],[data-uia="navigation+logo"]');
      if (gate) had = true;
      else if (had && !pin) { had = false; post({ t: "state", state: "left", path: q }); }
      var s = gate ? "gate" : pin ? "pin" : nav && q.indexOf("/browse") === 0 ? "browse" : "";
      if (s === "browse") { calm++; if (calm < 3) return; } else calm = 0;
      if (s && s !== last) { last = s; post({ t: "state", state: s, path: q }); }
    }, 500);
  };
  window.__lz = {
    gql: async function (id, body) {
      try {
        var r = await fetch("/graphql", { method: "POST", credentials: "include", headers: ${lang}, body: body });
        post({ t: "gql", id: id, status: r.status, body: await r.text() });
      } catch (e) { post({ t: "gql", id: id, status: 0, body: "" }); }
    }
  };
  (async function () {
    try {
      var p = location.pathname || "/";
      if (p.indexOf("/login") === 0 || p.indexOf("/signup") === 0 || p === "/" || p.indexOf("/LoginHelp") === 0) { post({ t: "state", state: "signed-out", path: p }); return; }
      if (p.indexOf("/settings/viewed") !== 0) { post({ t: "state", state: "page", path: p }); watch(); return; }
      var m = window.netflix && window.netflix.reactContext && window.netflix.reactContext.models;
      var act = m && m.profilesModel && m.profilesModel.data && m.profilesModel.data.active;
      if (!act || !act.guid) { post({ t: "state", state: "no-profile", path: p }); return; }
      var own = [].slice.call(document.scripts).map(function (s) { return s.src; }).filter(Boolean);
      var historyId = (await findIds(own, [${hist}]))[${hist}] || null;
      var html = await (await fetch("/browse", { credentials: "include" })).text();
      var bs = []; html.replace(/<script[^>]+src="([^"]+)"/g, function (_, u) { bs.push(u.replace(/&amp;/g, "&")); return _; });
      var ids = await findIds(bs, [${season}, ${movies}]);
      post({ t: "ready", guid: String(act.guid), name: String(act.firstName || ""), historyId: historyId, seasonId: ids[${season}] || null, moviesId: ids[${movies}] || null });
    } catch (e) { post({ t: "state", state: "error", path: location.pathname }); }
  })();
  return true;
})();`;
}

const BOOT = netflixBootScript();

export type NetflixWebRef = {
  /** طلبٌ محفوظٌ يخرج من الصفحة بجلستها — الردُّ JSON أو `null` (شبكةٌ أو ردٌّ ليس JSON) */
  gql: (body: object, ms?: number) => Promise<unknown>;
  go: (url: string) => void;
};

type Props = {
  url: string;
  /** `visible`: صفحةُ الدخول يراها العضو · `hidden`: المزامنةُ في الخلفيّة بلا أثرٍ على الشاشة */
  mode: "visible" | "hidden";
  onReady?: (r: NfxReady) => void;
  onPageState?: (s: NfxPageState, path: string) => void;
  onNav?: (url: string) => void;
};

export const NetflixWeb = forwardRef<NetflixWebRef, Props>(function NetflixWeb({ url, mode, onReady, onPageState, onNav }, ref) {
  const web = useRef<WebView<object>>(null);
  const seq = useRef(0);
  const pending = useRef(new Map<number, (v: unknown) => void>());

  useImperativeHandle(
    ref,
    () => ({
      gql: (body, ms = 30_000) =>
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
          web.current?.injectJavaScript(`window.__lz && window.__lz.gql(${id}, ${JSON.stringify(JSON.stringify(body))}); true;`);
        }),
      go: (next) => web.current?.injectJavaScript(`location.href = ${JSON.stringify(next)}; true;`),
    }),
    [],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: { t?: string; id?: number; body?: string; state?: NfxPageState; path?: string } & Partial<NfxReady>;
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (m.t === "gql" && typeof m.id === "number") {
        const done = pending.current.get(m.id);
        if (!done) return;
        pending.current.delete(m.id);
        try {
          done(m.body ? JSON.parse(m.body) : null);
        } catch {
          done(null);
        }
      } else if (m.t === "ready" && typeof m.guid === "string") {
        onReady?.({ guid: m.guid, name: m.name ?? "", historyId: m.historyId ?? null, seasonId: m.seasonId ?? null, moviesId: m.moviesId ?? null });
      } else if (m.t === "state" && m.state) {
        onPageState?.(m.state, m.path ?? "");
      }
    },
    [onReady, onPageState],
  );

  /* الصفحةُ تُبدَّل (تحويلٌ أو دخول): ما ينتظر ردّاً من الصفحة السابقة لن يصله — يُصرف بـ`null` لا ينتظر نهايةَ مهلته */
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
        injectedJavaScript={BOOT}
        onMessage={onMessage}
        onLoadStart={onLoadStart}
        onNavigationStateChange={(n: WebViewNavigation) => onNav?.(n.url)}
        /* صفحاتُ نتفليكس وحدها: رابطٌ إلى غيرها لا يُفتح هنا */
        originWhitelist={["https://*"]}
        onShouldStartLoadWithRequest={(r) => /^https:\/\/([a-z0-9-]+\.)*(netflix\.com|nflxext\.com|nflxso\.net|nflximg\.net|nflxvideo\.net)(\/|$)/i.test(r.url) || r.url === "about:blank"}
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
  /* مخفيٌّ بحجمٍ يرسمه النظامُ (WebView بحجم صفرٍ لا يُحمَّل على أندرويد) — خارجَ اللمس والقراءة الآليّة */
  hidden: { position: "absolute", top: 0, left: 0, width: 2, height: 2, opacity: 0 },
});
