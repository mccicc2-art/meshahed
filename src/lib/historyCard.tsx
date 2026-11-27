/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import { shareFooter } from "@/lib/shareFooter";
import { shapedText } from "@/lib/reviewCard";
import type { Locale } from "@/core/i18n";

/**
 * ====== 🆕 بطاقةُ سجلّ المشاهدة — «بطل الأسبوع/الشهر» (أحمد ٢٦ نوفمبر، استوديو المشاركة «ن٥ ب») ======
 *
 * **١٠٨٠×١٩٢٠**، ومنطقةُ الأمان مرسومة: الرأسُ يبدأ عند ٢٧٠ والذيلُ ينتهي قبل ١٥٦٠. الملصقُ الأوّل (أكثرُ عملٍ دقائقَ في المدّة)
 * يملأ أعلاها خلف الرأس، ثمّ «بطل أسبوعي» واسمُه وتقييمُه، ثمّ لوحةُ الأرقام (رقمٌ أصفرُ كبيرٌ وتحته اسمُ الخانة — والواحدُ
 * والاثنان كلمةٌ بلا رقم «فيلمان»، كما طلب: «الإحصائيات في بطل الشهر حلوة نبغا مثلها في الأسبوعي»)، ثمّ **رفٌّ من أربعة ملصقات**
 * بحلقاتها وتقييمها («يفضل يظهر تقييمه لكل عمل»)، ثمّ ما بقي **باسمه بالضبط** («لا تذكر ومعه عملٌ آخر، اذكر اسمه بالضبط»):
 * عملٌ أو عملان باسميهما، وما زاد عددٌ بتمييزه.
 * **المجموعُ صادق** (مراجعةُ الوكيلين): البطلُ وما معه = أعمالُ اللوحة، فما أخفاه صاحبُها يسقط من الأرقام أيضاً.
 * كلُّ النصوص مساراتٌ مُشكَّلةٌ بخطّي التطبيق (`shapedText`) — لا نصَّ خامّاً في `satori`.
 */
export const HISTORY_CARD = { width: 1080, height: 1920 };
const W = HISTORY_CARD.width;
const SIDE = 64;
const INNER = W - SIDE * 2;
const Y = "#FFD400";
const FG = "#F7F7F7";
const MUTED = "#A0A0A0";
const STAR = "M12 2.4l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.6l1.2-6.6L2.5 9.4l6.6-.9z";


export type HistoryCardWork = { title: string; poster: string | null; episodes: number; movie: boolean; rating: number | null };
export type HistoryCardInput = {
  locale: Locale;
  month: boolean;
  range: string;
  name: string;
  username: string | null;
  avatar: string | null;
  /** خلفيّةُ البطل (رابطُ بيانات) */
  heroArt: string | null;
  hero: HistoryCardWork;
  /** حتى أربعة بعد البطل */
  shelf: HistoryCardWork[];
  /** ما بعد الرفّ: اسمٌ أو اسمان، أو جملةُ العدد */
  rest: string | null;
  stats: { value: string | null; unit: string }[];
  /** وحدةُ ما تحت الملصق: «6 حلقات» · «فيلم» */
  workLine: (w: HistoryCardWork) => string;
};

const star = (s: number) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={Y} style={{ position: "absolute", top: 0, left: 0 }}>
    <path d={STAR} />
  </svg>
);

export async function historyCardElement(c: HistoryCardInput) {
  const ar = c.locale !== "en";
  const dir = ar ? "rtl" : "ltr";
  const row = ar ? "row-reverse" : "row";
  const handle = c.username ? `@${c.username}` : "";
  const titleDir = /[؀-ۿ]/.test(c.hero.title) ? "rtl" : "ltr";
  const PW = 200;
  const PH = 300;
  const shelfGap = Math.floor((INNER - PW * 4) / 3);

  const [footer, nameT, handleT, rangeT, labelT, titleT, restT, ...rest] = await Promise.all([
    /* 🆕 الذيلُ الواحد (أحمد ٢٧ نوفمبر): لا رابطَ شخصيّ، و«سجلّ المشاهدة» مكانَ «Join now!» */
    shareFooter({ width: INNER, height: 96, cta: ar ? "سجلّ المشاهدة" : "Watch history", icon: "clock", rtl: ar }),
    shapedText(c.name, { width: 520, size: 42, lineHeight: 1.2, maxLines: 1, color: FG, dir, face: "app" }),
    handle ? shapedText(handle, { width: 520, size: 34, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular" }) : null,
    shapedText(c.range, { width: 330, size: 34, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular", align: "center" }),
    shapedText(ar ? (c.month ? "بطل شهري" : "بطل أسبوعي") : c.month ? "Hero of the month" : "Hero of the week", { width: INNER, size: 84, lineHeight: 1.2, maxLines: 1, color: Y, dir, face: "app" }),
    /* اتّجاهُ الصفحة: العنوانُ يلتصق بالحافّة البادئة كالسطر فوقه (اللاتينيُّ في العربيّة يميناً) */
    shapedText(c.hero.title, { width: INNER - (c.hero.rating ? 120 : 0), size: 74, lineHeight: 1.1, maxLines: 2, color: FG, dir: titleDir === "rtl" || ar ? "rtl" : "ltr", face: "app" }),
    c.rest ? shapedText(c.rest, { width: INNER, size: 38, lineHeight: 1.3, maxLines: 2, color: MUTED, dir, face: "app-regular" }) : null,
    ...c.stats.flatMap((s) => [
      s.value ? shapedText(s.value, { width: 260, size: 86, lineHeight: 1.1, maxLines: 1, color: Y, dir, face: "app" }) : Promise.resolve(null),
      shapedText(s.unit, { width: 300, size: s.value ? 36 : 58, lineHeight: 1.2, maxLines: 1, color: s.value ? MUTED : Y, dir, face: s.value ? "app-regular" : "app" }),
    ]),
    ...c.shelf.map((w) => shapedText(c.workLine(w), { width: c.shelf.length === 1 ? 600 : PW, size: 36, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular", align: c.shelf.length === 1 ? "start" : "center" })),
    ...[c.hero.rating, ...c.shelf.map((w) => w.rating)].map((r, i) =>
      r ? shapedText(String(r), { width: i ? 92 : 112, size: i ? 32 : 38, lineHeight: 1, maxLines: 1, color: "#050505", dir: "ltr", face: "app", align: "center" }) : Promise.resolve(null),
    ),
    /* عملٌ واحدٌ معه: «ومعه» واسمُه في سطرٍ واحد بجانب ملصقه (لا «ومعه» وحدها فوق الاسم — مراجعةُ الوكيلين) */
    c.shelf.length === 1 ? shapedText(`${ar ? "ومعه" : "With"} ${c.shelf[0].title}`, { width: 600, size: 46, lineHeight: 1.2, maxLines: 2, color: FG, dir, face: "app" }) : Promise.resolve(null),
  ]);
  const statT = rest.slice(0, c.stats.length * 2);
  const shelfT = rest.slice(c.stats.length * 2, c.stats.length * 2 + c.shelf.length);
  const rateT = rest.slice(c.stats.length * 2 + c.shelf.length, c.stats.length * 2 + c.shelf.length * 2 + 1);
  const oneT = rest[c.stats.length * 2 + c.shelf.length * 2 + 1] ?? null;

  const img = (t: { src: string; width: number; height: number } | null, style: Record<string, unknown> = {}) =>
    t ? <img src={t.src} width={t.width} height={t.height} style={{ display: "flex", ...style }} /> : null;
  /** نجمةُ التقييم وفيها الرقم — نجمةُ مجموعة الأيقونات نفسُها */
  const badge = (t: { src: string; width: number; height: number } | null, s: number) =>
    t ? (
      <div style={{ width: s, height: s, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {star(s)}
        <img src={t.src} width={t.width} height={t.height} style={{ position: "absolute", top: s * 0.33, left: (s - t.width) / 2, width: t.width, height: t.height }} />
      </div>
    ) : null;

  return (
    <div style={{ width: W, height: HISTORY_CARD.height, display: "flex", backgroundColor: "#050505", position: "relative" }}>
      {c.heroArt ? <img src={c.heroArt} width={W} height={1620} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", objectPosition: "50% 8%" }} /> : null}
      {/* ظلٌّ أعلى البطاقة يحمل الرأسَ فوق أيّ ملصق، ثمّ يذوب الملصقُ في الأسود تحت الاسم */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: HISTORY_CARD.height,
          display: "flex",
          backgroundImage:
            "linear-gradient(180deg, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.75) 16%, rgba(5,5,5,0) 22%, rgba(5,5,5,0.25) 24%, rgba(5,5,5,0.88) 31%, #050505 40%)",
        }}
      />

      {/* الرأس */}
      <div style={{ position: "absolute", top: 270, left: SIDE, width: INNER, display: "flex", flexDirection: row, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 22 }}>
          <div style={{ width: 108, height: 108, borderRadius: 54, border: `6px solid ${Y}`, display: "flex", overflow: "hidden", backgroundColor: "#181818" }}>
            {c.avatar ? <img src={c.avatar} width={96} height={96} style={{ objectFit: "cover" }} /> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {img(nameT)}
            {img(handleT)}
          </div>
        </div>
        {img(rangeT)}
      </div>

      {/* البطل: الصفة والاسم وتقييمه، ثمّ اللوحة والرفّ وما بقي */}
      <div style={{ position: "absolute", top: 470, left: SIDE, width: INNER, display: "flex", flexDirection: "column", gap: 8 }}>
        {img(labelT)}
        {/* النجمةُ بعد الاسم مباشرةً لا في الطرف الآخر: الاسمُ يُقصّ إلى عرضه الفعليّ (`used`) */}
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
          <div style={{ width: titleT.used || titleT.width, height: titleT.height, overflow: "hidden", display: "flex", justifyContent: ar ? "flex-end" : "flex-start" }}>
            <img src={titleT.src} width={titleT.width} height={titleT.height} style={{ display: "flex", flexShrink: 0 }} />
          </div>
          {badge(rateT[0] ?? null, 112)}
        </div>
        <div style={{ display: "flex", flexDirection: row, alignItems: "flex-end", gap: 80, marginTop: 14 }}>
          {c.stats.map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: ar ? "flex-end" : "flex-start", gap: 6 }}>
              {img(statT[i * 2] ?? null)}
              {img(statT[i * 2 + 1] ?? null)}
            </div>
          ))}
        </div>
        {c.shelf.length === 1 ? (
          <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 36, marginTop: 30 }}>
            <div style={{ width: PW, height: PH, borderRadius: 26, overflow: "hidden", display: "flex", position: "relative", border: "3px solid rgba(255,255,255,0.12)", backgroundColor: "#111111" }}>
              {c.shelf[0].poster ? <img src={c.shelf[0].poster} width={PW} height={PH} style={{ objectFit: "cover" }} /> : null}
              {rateT[1] ? <div style={{ position: "absolute", bottom: 8, ...(ar ? { left: 8 } : { right: 8 }), display: "flex" }}>{badge(rateT[1] ?? null, 92)}</div> : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {img(oneT)}
              {img(shelfT[0] ?? null)}
            </div>
          </div>
        ) : c.shelf.length ? (
          <div style={{ display: "flex", flexDirection: row, gap: shelfGap, marginTop: 30 }}>
            {c.shelf.map((w, i) => (
              <div key={i} style={{ width: PW, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: PW, height: PH, borderRadius: 26, overflow: "hidden", display: "flex", position: "relative", border: "3px solid rgba(255,255,255,0.12)", backgroundColor: "#111111" }}>
                  {w.poster ? <img src={w.poster} width={PW} height={PH} style={{ objectFit: "cover" }} /> : null}
                  {rateT[i + 1] ? <div style={{ position: "absolute", bottom: 8, ...(ar ? { left: 8 } : { right: 8 }), display: "flex" }}>{badge(rateT[i + 1] ?? null, 92)}</div> : null}
                </div>
                {img(shelfT[i] ?? null)}
              </div>
            ))}
          </div>
        ) : null}
        {restT ? <div style={{ display: "flex", marginTop: 22 }}>{img(restT)}</div> : null}
      </div>

      {/* الذيل — فوق منطقة الردّ (`shareFooter`) */}
      <div style={{ position: "absolute", top: 1480, left: SIDE, width: INNER, display: "flex" }}>{footer}</div>
    </div>
  );
}
