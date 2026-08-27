import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  getUser,
  getProfile,
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovies,
  watchedMovieMinutes,
  getMyRatings,
} from "@/lib/data";
import { getT } from "@/lib/locale";

export const runtime = "nodejs";

/**
 * بطاقة المشاركة.
 *
 * صورة ١٢٠٠×٦٣٠ تُولَّد على الخادم: المستخدم يشاركها في تويتر أو واتساب
 * فتظهر أرقامه صورةً لا رابطاً يحتاج تسجيل دخول ليُفتح. والخطّ يُقرأ من
 * `public/` لا من الشبكة — التوليد لا يتعطّل لو تعذّر الوصول لخادم خطوط،
 * والعربية تُرسم فعلاً بدل مربّعات فارغة.
 */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { t, locale } = await getT();
  const rtl = locale === "ar";

  const [profile, follows, summary, episodes, watchedMovies, ratings] = await Promise.all([
    getProfile(),
    getFollows(),
    getWatchSummary(),
    getAllWatchedEpisodes(),
    getWatchedMovies(),
    getMyRatings(),
  ]);

  const movies = watchedMovies.length;
  const episodeCount = episodes.length;

  // دقائق الحلقات من الملخّص إن وُجد وإلا من زمن كل حلقة (افتراضي ٤٥)، ثم
  // **نضيف دقائق الأفلام الفعلية** — كانت البطاقة تُسقط الأفلام من الوقت
  const episodeMinutes =
    summary?.reduce((a, r) => a + (r.minutes ?? 0), 0) ??
    episodes.reduce((a, e) => a + (e.runtime ?? 45), 0);
  const minutes = episodeMinutes + watchedMovieMinutes(watchedMovies);
  const hours = Math.round(minutes / 60);
  const days = Math.floor(hours / 24);


  const [arabic, latin] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/cairo-700-arabic.woff")),
    readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff")),
  ]);

  const name = profile?.nickname?.trim() || profile?.username || "Loopz";
  /* 🔴 **الوقتُ الكبيرُ أرقامٌ كبيرةٌ ووحداتٌ صغيرة، مركَّباً يدويّاً**:
     satori يقيس الكلمةَ العربيّة بأشكال حروفها المنفصلة ويرسمها
     موصولةً — ففي «يوم» بحجم ٨٠ فراغٌ داخليٌّ فاضح (قِيس بصناديق
     ملوّنة). الوحدةُ تُشتقّ من مفاتيح القاموس نفسِها (بلا مفتاحٍ
     جديد)، وصِغَرُها يبتلع الخطأ. */
  const dayUnit = t.days(9).replace(/[0-9٠-٩,\s]/g, "");
  const hourUnit = t.hours(9).replace(/[0-9٠-٩,\s]/g, "");
  /* ⚖️ D-709: **الأيّامُ وحدَها** — والبطاقةُ تتبع الصفحةَ (D-697):
     **رقمان لشيءٍ واحدٍ بوجهين يفترقان.** */
  const timeParts: { v: string; u: string }[] =
    days >= 1
      ? [{ v: String(days), u: dayUnit }]
      : [{ v: String(hours), u: hourUnit }];
  if (rtl) timeParts.reverse();

  /* ⚖️ 🆕 D-697 (بلاغُه: «زر المشاركة يرسل الكارد القديمة»): البطاقةُ
     تلبس وجهَ صفحة الإحصائيات الجديد (D-682 → D-696) — **الوقتُ الكبيرُ
     رقمَ البطاقة، والشريطُ العاري بأيقوناته الصفراء تحته، وبمفاتيح
     الصفحة نفسِها** (`statsCell*`) فلا مفردتين لشيءٍ واحد. */
  /* D-698: خاناتُ أحمد الأربع — كما في صفحة الإحصائيات حرفاً */
  const shows = follows.filter((f) => f.media_type === "tv").length;
  const reviewCount = ratings.filter((r) => (r.review ?? "").trim().length > 0).length;
  const strip: { icon: string; value: string; label: string }[] = [
    { icon: "tv", value: String(shows), label: t.statsCellShows },
    { icon: "film", value: String(movies), label: t.statsCellMoviesWatched },
    { icon: "play", value: episodeCount.toLocaleString("en-US"), label: t.statsCellEpisodesWatched },
    { icon: "comment", value: String(reviewCount), label: t.statsCellComments },
  ];
  const stripView = rtl ? [...strip].reverse() : strip;
  const ICON_PATHS: Record<string, React.ReactNode> = {
    /* ⚠️ **لا Fragment داخل svg هنا**: مولّد الصور (satori) يرمي
       «Cannot convert a Symbol value to a string» — <g> تقوم مقامها
       (قِيس محليّاً قبل النشرة الثانية). */
    play: (
      <g>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.8v6.4l5-3.2-5-3.2Z" />
      </g>
    ),
    film: (
      <g>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <path d="M3.5 9.5h17M8 5v14M16 5v14" />
      </g>
    ),
    tv: (
      <g>
        <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
        <path d="m8.5 3.5 3.5 3 3.5-3" />
      </g>
    ),
    comment: <path d="M12 4.5c-4.7 0-8.5 3.1-8.5 7 0 3.9 3.8 7 8.5 7 .9 0 1.8-.1 2.6-.3L19 20l-.7-3.5c1.4-1.2 2.2-3 2.2-5 0-3.9-3.8-7-8.5-7Z" />,
  };

  /* 🔴 **مولّدُ الصور يبعثر الجملةَ العربيّة** (satori بلا bidi للجمل):
     «وقت المشاهدة» كانت تخرج «المشاهدة وقت» — **فكلُّ كلمةٍ عقدةٌ
     والصفُّ flex باتّجاه القراءة يرتّبها**، والتشكيلُ داخل الكلمة
     الواحدة سليمٌ أصلاً (قِيس محليّاً بلقطة قبل النشر). */
  const Line = ({ text, size, color }: { text: string; size: number; color?: string }) => {
    const words = text.split(/\s+/);
    /* **الترتيبُ بأيدينا لا بيد المحرّك**: نعكس الكلماتِ بأنفسنا ونرصّ
       LTR دائماً — `direction` في Yoga تذبذب بين سطرٍ وآخر (قِيس). */
    if (rtl) words.reverse();
    return (
      <div style={{ display: "flex", gap: Math.round(size * 0.24), fontSize: size, color: color ?? "#F7F7F7" }}>
        {words.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
    );
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 64px",
          background: "#050505",
          color: "#F7F7F7",
          fontFamily: "Cairo, CairoLatin",
          direction: rtl ? "rtl" : "ltr",
        }}
      >
        <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: "linear-gradient(135deg, #FFD400, #FBBF24 55%, #F59E0B)",
              }}
            />
            <div style={{ fontSize: 32, letterSpacing: -1 }}>Loopz</div>
          </div>
          <Line text={t.shareHeadline} size={26} color="#9A9A9A" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 2 }}>
          <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 44 }}>{name}</div>
            {/* نجمةُ لوبز الرباعية بجانب الاسم — كما في الترويسة */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFD400">
              <path d="M12 3.5c.6 4.4 4.1 7.9 8.5 8.5-4.4.6-7.9 4.1-8.5 8.5-.6-4.4-4.1-7.9-8.5-8.5 4.4-.6 7.9-4.1 8.5-8.5Z" />
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginTop: 4 }}>
            {timeParts.map((p2) => (
              <div key={p2.u + p2.v} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                {rtl ? (
                  <div style={{ fontSize: 30, color: "#9A9A9A", paddingBottom: 12 }}>{p2.u}</div>
                ) : null}
                <div style={{ fontSize: 84, lineHeight: 1 }}>{p2.v}</div>
                {!rtl ? (
                  <div style={{ fontSize: 30, color: "#9A9A9A", paddingBottom: 12 }}>{p2.u}</div>
                ) : null}
              </div>
            ))}
          </div>
          <Line text={t.statWatchTime} size={26} color="#9A9A9A" />
          {/* الخطُّ الأصفرُ المنحني — زينةُ الصفحة نفسُها */}
          <svg width="200" height="20" viewBox="0 0 220 24" style={{ marginTop: 6 }}>
            <path
              d="M2 20 C 58 4, 140 24, 218 6"
              stroke="#FFD400"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.75"
            />
          </svg>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 26,
          }}
        >
          {stripView.map((c, i) => (
            <div
              key={c.label}
              /* ⚠️ **ولا مفتاحَ نمطٍ قيمتُه undefined**: satori يستدعي
                 `.trim()` على القيمة فينهار الرسمُ كلُّه — الفاصلُ يُبنى
                 بالنشر الشرطيّ فلا يوجد المفتاحُ أصلاً حين لا فاصل. */
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                ...(i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.08)" } : {}),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFD400"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICON_PATHS[c.icon]}
                </svg>
                <div style={{ fontSize: 44 }}>{c.value}</div>
              </div>
              <Line text={c.label} size={24} color="#9A9A9A" />
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        // عائلتان لا واحدة: المحرّك يختار خطاً واحداً لكل اسم عائلة، فلو
        // سمّيناهما باسم واحد ضاعت الأرقام والحروف اللاتينية مربّعاتٍ فارغة
        { name: "Cairo", data: arabic, weight: 700, style: "normal" },
        { name: "CairoLatin", data: latin, weight: 700, style: "normal" },
      ],
      headers: {
        // الصورة تتغيّر مع كل حلقة يؤشّرها صاحبها، فلا تُخزَّن على الحافة
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
