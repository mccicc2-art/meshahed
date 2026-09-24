/**
 * 🆕 D-1116 — **«متصفّحُ جهازك قديم»** (فيديو صديقٍ لأحمد: التطبيقُ وChrome كلاهما يعرضان Loopz خاماً —
 * أزرارُ المتصفّح الرماديّة وروابطُ زرقاء وملصقاتٌ بحجمها الحقيقيّ — وأحمد في نافذةٍ متخفّية يراه سليماً).
 *
 * 🔑 **التنسيقُ Tailwind v4**: طبقاتُ CSS و`oklch()` و`color-mix()` — أدنى محرّكٍ يفهمها Chrome 111.
 * ما دونه **يُسقط التنسيقَ كلَّه صامتاً** فلا يرى الزائرُ صفحةً مكسورةً فحسب بل صفحةً لا تشرح شيئاً.
 * وداخل التطبيق المحرّكُ «Android System WebView» لا Chrome — فللزرّين بابان.
 *
 * ⚖️ **ولذلك كلُّ ما هنا خارج Tailwind**: أنماطٌ مكتوبةٌ على العناصر نفسِها وقاعدةُ `<style>` واحدةٌ بلا
 * طبقات — تعمل على أقدم محرّك. والإظهارُ من سكربت الرأس (`OLD_ENGINE_SCRIPT`) قبل أوّل رسمة، **والمحرّكُ
 * الحديث لا يرى العنصرَ أبداً** (`hidden`). وهو في HTML الخادم لا يُحقن بعد التحميل — فالمطابقةُ سليمة.
 */
const CHROME = "https://play.google.com/store/apps/details?id=com.android.chrome";
const WEBVIEW = "https://play.google.com/store/apps/details?id=com.google.android.webview";

/** ثابتٌ حرفيّاً بلا مدخلٍ من المستخدم — يسأل المحرّكَ عمّا يحتاجه Tailwind v4 */
export const OLD_ENGINE_SCRIPT =
  "try{var s=window.CSS&&CSS.supports;if(!(s&&CSS.supports('color','oklch(0 0 0)')&&CSS.supports('color','color-mix(in srgb, red, blue)')))" +
  "document.documentElement.setAttribute('data-old-engine','1')}catch(e){document.documentElement.setAttribute('data-old-engine','1')}";

/** قاعدةٌ واحدةٌ بلا طبقات: العنصرُ يظهر، وكلُّ ما سواه في `body` يختفي */
export const OLD_ENGINE_CSS =
  "html[data-old-engine] body>*{display:none!important}" +
  "html[data-old-engine] body>#lz-old{display:block!important}" +
  "html[data-old-engine],html[data-old-engine] body{background:#090909!important;margin:0}";

export function OldEngineNotice({ ar }: { ar: boolean }) {
  const btn = { display: "block", textDecoration: "none", borderRadius: 14, padding: "13px 12px", fontSize: 15, fontWeight: 600, marginBottom: 10 } as const;
  const main = ar
    ? { dir: "rtl" as const, title: "متصفّح جهازك قديم", body: "Loopz يحتاج نسخةً أحدث من Chrome لتظهر صفحاته كما ينبغي. حدّثه من متجر Play ثمّ افتح Loopz من جديد.", chrome: "حدّث Chrome", webview: "حدّث مكوّن العرض (Android System WebView)" }
    : { dir: "ltr" as const, title: "Your browser is out of date", body: "Loopz needs a newer Chrome to show its pages properly. Update it from Google Play, then reopen Loopz.", chrome: "Update Chrome", webview: "Update the display component (Android System WebView)" };
  const other = ar ? { dir: "ltr" as const, text: "Your browser is out of date — update Chrome from Google Play, then reopen Loopz." } : { dir: "rtl" as const, text: "متصفّح جهازك قديم — حدّث Chrome من متجر Play ثمّ افتح Loopz من جديد." };
  return (
    <div id="lz-old" hidden style={{ minHeight: "100vh", background: "#090909", color: "#fff", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", textAlign: "center", padding: "56px 24px 40px", boxSizing: "border-box" }}>
      <div dir={main.dir} style={{ maxWidth: 420, margin: "0 auto" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- عنصرٌ خامٌ عمداً: يعمل بلا تنسيق */}
        <img src="/loopz-mark.png" alt="Loopz" width={56} height={56} style={{ display: "block", width: 56, height: 56, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>{main.title}</p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "#a3a3a3", margin: "0 0 24px" }}>{main.body}</p>
        <a href={CHROME} style={{ ...btn, background: "#F5C84C", color: "#111" }}>{main.chrome}</a>
        <a href={WEBVIEW} style={{ ...btn, border: "1px solid #444", color: "#fff", fontWeight: 500, fontSize: 14, marginBottom: 22 }}>{main.webview}</a>
        <p dir={other.dir} style={{ fontSize: 12, color: "#777", margin: 0 }}>{other.text}</p>
      </div>
    </div>
  );
}
