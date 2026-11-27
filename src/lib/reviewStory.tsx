/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import { OG_FAMILY } from "@/lib/og";
import { hasArabic, shapedText, type ReviewCardInput } from "@/lib/reviewCard";
import { shareFooter } from "@/lib/shareFooter";

/**
 * ====== 🆕 بطاقةُ المراجعة للقصص — ١٠٨٠×١٩٢٠ (ن٧ «ص٣»، أحمد ٢٧ نوفمبر «اكمل المتبقي ونفذها») ======
 *
 * **لماذا**: بطاقةُ المراجعة العريضة (١٢٠٠×٦٣٠) صورةُ رابطٍ في X وواتساب؛ في قصّة إنستغرام وسناب تصغر شريطاً في وسط الشاشة.
 * هذه للقصص: **الرأيُ هو الأكبر وعلى أرضٍ صلبة** لا فوق شعار الملصق، والملصقُ فوقه يملأ أعلى الشاشة، وصاحبُ الرأي في رأسه.
 * - **المنطقةُ الآمنة**: لا كلامَ في أعلى ٢٥٠ (شريطُ القصّة) ولا تحت ١٥٧٠ (منطقةُ الردّ) — والذيلُ الواحدُ عند ١٤٧٠ كالحصاد.
 * - **المدخلُ مدخلُ البطاقة العريضة بعينه** (`ReviewCardInput`): قاعدةُ الاسم، والحرقُ يعطي التقييمَ وحده، و`hide_name` يُحترم —
 *   الحارسُ في المسار نفسِه لا هنا.
 * - **جهةُ الكلام جهةُ الرأي**: رأيٌ عربيٌّ يُقرأ من اليمين ومعه صاحبُه ونجمتُه، والإنجليزيُّ من اليسار.
 */
export const REVIEW_STORY = { width: 1080, height: 1920 };
const W = 1080;
const SIDE = 72;
const INNER = W - SIDE * 2;
const POSTER_H = 1180;
const Y = "#FFD400";
const FG = "#F7F7F7";
const STAR = "M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z";

const shaped = async (text: string, o: { width: number; size: number; lines: number; color?: string; regular?: boolean; rtl: boolean }) => {
  const t = await shapedText(text, { width: o.width, size: o.size, lineHeight: 1.3, maxLines: o.lines, color: o.color ?? FG, dir: o.rtl ? "rtl" : "ltr", face: o.regular ? "app-regular" : "app" });
  return t;
};

export async function reviewStoryElement(c: ReviewCardInput & { username: string | null }) {
  const ar = c.arabicWork;
  const review = c.mode === "review" && c.review ? c.review : null;
  const rtl = review ? hasArabic(review) : ar || hasArabic(c.name);
  const align = rtl ? "flex-end" : "flex-start";
  const [footer, title, quote, name, handle] = await Promise.all([
    shareFooter({ width: INNER, height: 96, cta: ar ? (c.mode === "review" ? "مراجعة" : "تقييم") : c.mode === "review" ? "Review" : "Rating", icon: "star", rtl: ar }),
    shaped(c.work, { width: INNER, size: 52, lines: 2, rtl: hasArabic(c.work) }),
    /* الرأيُ يصغر بطوله ولا يُقصّ ما دام التصغيرُ يكفي (قاعدةُ بطاقة الخيط) */
    review ? shaped(review, { width: INNER - 30, size: review.length <= 90 ? 46 : review.length <= 180 ? 38 : 32, lines: review.length <= 90 ? 4 : 6, rtl }) : Promise.resolve(null),
    shaped(c.name, { width: 640, size: 34, lines: 1, rtl: hasArabic(c.name) }),
    c.username ? shaped(`@${c.username}`, { width: 640, size: 24, lines: 1, color: "#D4D4D4", regular: true, rtl: false }) : Promise.resolve(null),
  ]);
  /* اسمُ صاحب الرأي وحده يُقصّ إلى عرضه فيلتصق بالصورة في جهته */
  const crop = (t: { src: string; width: number; height: number; used: number }, isRtl: boolean) => {
    /* هامشٌ لذيل الحرف الأخير: «د» و«ن» تمتدّ خلف عرض تقدّمها */
    const used = Math.min(t.width, t.used + 18);
    return (
      <div style={{ display: "flex", width: used, overflow: "hidden" }}>
        <img src={t.src} width={t.width} height={t.height} style={isRtl ? { marginLeft: used - t.width } : {}} />
      </div>
    );
  };
  const score = c.rating.toFixed(1);
  const big = !review;
  return (
    <div style={{ width: W, height: 1920, display: "flex", flexDirection: "column", background: "#050505", fontFamily: OG_FAMILY, position: "relative" }}>
      {/* الملصقُ يملأ أعلى الشاشة ويذوب في الأرض السوداء — الرأيُ تحته على أرضٍ صلبة */}
      {c.poster ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: POSTER_H, display: "flex" }}>
          <img src={c.poster} width={W} height={POSTER_H} style={{ objectFit: "cover", objectPosition: "top" }} />
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(5,5,5,0.85) 0%, rgba(5,5,5,0.45) 20%, rgba(5,5,5,0) 32%, rgba(5,5,5,0) 55%, #050505 100%)" }} />
        </div>
      ) : null}
      {/* الرأس: صاحبُ الرأي تحت شريط القصّة */}
      <div style={{ position: "absolute", top: 260, left: SIDE, width: INNER, display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", width: 84, height: 84, borderRadius: 84, border: `4px solid ${Y}`, overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#141414" }}>
          {c.avatar ? <img src={c.avatar} width={84} height={84} style={{ objectFit: "cover" }} /> : <div style={{ display: "flex", fontSize: 38, color: Y }}>{c.initial}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 2 }}>
          {crop(name, hasArabic(c.name))}
          {handle ? crop(handle, false) : null}
        </div>
      </div>
      {/* الكلام: يُرصّ من أسفل فوق الذيل — الرأيُ القصيرُ يترك للملصق مساحتَه */}
      <div style={{ position: "absolute", left: SIDE, top: 0, width: INNER, height: 1430, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: align, gap: 26 }}>
        <div style={{ display: "flex", width: INNER, justifyContent: hasArabic(c.work) ? "flex-end" : "flex-start" }}>
          <img src={title.src} width={title.width} height={title.height} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: big ? 22 : 14, flexDirection: rtl ? "row-reverse" : "row" }}>
          <svg width={big ? 96 : 56} height={big ? 96 : 56} viewBox="0 0 24 24">
            <path d={STAR} fill={Y} />
          </svg>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ display: "flex", fontSize: big ? 150 : 84, lineHeight: 1, color: Y, letterSpacing: -3 }}>{score}</div>
            <div style={{ display: "flex", fontSize: big ? 46 : 34, color: "#A08A1E" }}>/10</div>
          </div>
        </div>
        {quote ? (
          <div style={{ display: "flex", width: INNER, gap: 22, flexDirection: rtl ? "row-reverse" : "row" }}>
            <div style={{ display: "flex", width: 6, height: quote.height, background: Y, borderRadius: 3 }} />
            <img src={quote.src} width={quote.width} height={quote.height} />
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: SIDE, top: 1470, display: "flex" }}>{footer}</div>
    </div>
  );
}
