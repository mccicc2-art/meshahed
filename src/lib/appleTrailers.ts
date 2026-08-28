import "server-only";

/**
 * 🔴 🆕 **ملفُّ الترايلر الأصليّ — طريقُ «مثل Netflix»** (D-758، سؤالُ
 * أحمد بنصّه: «كيف يكون مثل Netflix؟»).
 *
 * 🔑 **والجوابُ فيزياءُ لا ضبطُ إعدادات**: **Netflix تُشغّل ملفَّ فيديو
 * من CDN خاصّتها في `<video>` أصيل** — أوّلُ إطارٍ في مئاتِ المللي ثانية.
 * **ونحن كنّا نُشغّل صفحةَ يوتيوب كاملةً داخل إطار**: وثيقةٌ ثمّ
 * `base.js` (~ميغابايت على الجوّال) ثمّ إقلاعُ مشغّلٍ ثمّ بيانُ بثٍّ ثمّ
 * المقاطع — **أرضيّتُه ثوانٍ لا يُزيلها أيُّ تحسينٍ حولَه** (D-757 قاست
 * حدَّه الأدنى). **فمن أراد فتحَ Netflix فليُشغّل ملفّاً لا صفحة.**
 *
 * **والمصدرُ الشرعيُّ الوحيدُ المتاح: معايناتُ iTunes.** بحثُ
 * `itunes.apple.com/search` عامٌّ وموثَّقٌ وبلا مفتاح، **ويعيد
 * `previewUrl` — ملفَّ MP4 حقيقيّاً على `video-ssl.itunes.apple.com`**
 * وُجد لهذا الغرض (معاينةُ العمل). **ولا تنزيلَ ولا إعادةَ استضافة** —
 * نقرأ الرابطَ ونشغّله من عندهم، كما يشغَّل ملصقُ TMDB من عندهم.
 *
 * ⚠️ **والتغطيةُ أفلامٌ في المقام الأوّل** (previewUrl للمسلسلات غيرُ
 * منتظم) **وبأسماءَ إنجليزيّة** — **فالميزةُ تُبنى سقوطاً مرتَّباً**:
 * ملفٌّ إن وُجد، **ويوتيوب D-757 خلفه لكلِّ ما سواه** — لا شرطَ نجاحٍ
 * على أحدٍ منهما.
 *
 * ⚠️ **والنداءُ مسقوفٌ زمناً ومخبَّأٌ أسبوعاً**: بحثُ آبل محدودُ المعدّل
 * (~عشرون في الدقيقة للعنوان الشبكيّ الواحد) — **وخبيئةُ Next للبيانات
 * تجعل الكلفةَ مرّةً لكلِّ عملٍ في الأسبوع لا لكلِّ فتحة**، **ومهلةُ
 * ٢٫٥ث تضمن ألّا يُبطئ غيابُ آبل صفَّنا شعرة.**
 */

const SEARCH = "https://itunes.apple.com/search";
const WEEK = 604800;

interface ItunesResult {
  trackName?: string;
  releaseDate?: string;
  previewUrl?: string;
}

/** **تطبيعُ اسمٍ للمقارنة** — حروفٌ صغيرة، بلا علاماتٍ ولا فراغاتٍ زائدة */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * **هل الاسمان الاسمُ نفسُه؟** — تطابقٌ تامٌّ بعد التطبيع، أو أحدُهما
 * بادئةُ الآخر (iTunes يذيّل أحياناً بمثل «(2010)» أو اسمِ نسخة).
 * ⚠️ **والبادئةُ تُقبل من جهة آبل وحدَها**: «Dune» عندنا لا يلتقط
 * «Dune: Part Two» عندهم — **بادئةٌ قصيرةٌ جدّاً بابُ التقاطٍ خاطئ**،
 * فشرطُها طولُ الأقصر ≥ ٧٠٪ من الأطول.
 */
function sameTitle(ours: string, theirs: string): boolean {
  const a = norm(ours);
  const b = norm(theirs);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return longer.startsWith(shorter) && shorter.length / longer.length >= 0.7;
}

/**
 * **رابطُ ملفِّ الترايلر لفيلمٍ — أو لا شيء.**
 *
 * ⚠️ **الاسمُ الإنجليزيُّ شرطُ الدخول**: بحثُ آبل بأسمائهم — **واسمٌ
 * عربيٌّ أو يابانيٌّ يعيد ضجيجاً لا تطابقاً**، فمن لا اسمَ لاتينيّاً له
 * يسقط إلى يوتيوب بلا نداء.
 * ⚠️ **والسنةُ ±١ شرطُ القبول**: أسماءٌ تتكرّر عبر العقود («Dune» ١٩٨٤
 * و٢٠٢٤) — **وترايلرُ النسخة الأخرى أسوأُ من ملصقٍ صامت.**
 */
export async function getAppleTrailerUrl(
  title: string | undefined | null,
  year: string | undefined | null,
): Promise<string | null> {
  const t = (title ?? "").trim();
  const y = Number(year);
  /* حروفٌ لاتينيّةٌ كافية؟ — وإلّا فالبحثُ ضجيجٌ مدفوعُ الثمن */
  if (!t || !/[a-z]/i.test(t) || !Number.isFinite(y)) return null;

  try {
    const url = `${SEARCH}?media=movie&limit=8&country=US&term=${encodeURIComponent(t)}`;
    /* ⚠️ **مهلةٌ بسباقٍ لا بإشارة إجهاض** (D-758): **`AbortSignal` داخل
       `fetch` المخبَّأ يعبث بخبيئة Next ويُسقط النداءَ كلَّه صامتاً** —
       والسباقُ يترك النداءَ يُكمل في الخلفيّة ويُخلي طريقَ الصفّ فقط. */
    const res = await Promise.race([
      fetch(url, { next: { revalidate: WEEK } }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2500);
      }),
    ]);
    if (!res || !res.ok) return null;
    const data = (await res.json()) as { results?: ItunesResult[] };
    for (const r of data.results ?? []) {
      if (!r.previewUrl || !r.trackName) continue;
      const ry = Number((r.releaseDate ?? "").slice(0, 4));
      if (!Number.isFinite(ry) || Math.abs(ry - y) > 1) continue;
      if (!sameTitle(t, r.trackName)) continue;
      /* **و`https` وحدُه يُقبل** — رابطٌ غيرُه لا يعبر CSP ولا يستحقّ */
      if (!r.previewUrl.startsWith("https://")) continue;
      return r.previewUrl;
    }
    return null;
  } catch {
    /* غيابُ آبل — مهلةٌ أو حجبٌ أو تغيّرُ عقد — يعني يوتيوب، لا عطلاً */
    return null;
  }
}
