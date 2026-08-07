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

  const shows = follows.filter((f) => f.media_type === "tv").length;
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

  const rated = ratings.length;
  const avg = rated ? ratings.reduce((a, r) => a + r.rating, 0) / rated : 0;

  const [arabic, latin] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/cairo-700-arabic.woff")),
    readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff")),
  ]);

  const name = profile?.nickname?.trim() || profile?.username || "Loopz";
  const timeText = days >= 1 ? t.days(days) : t.hours(hours);

  const stats: [string, string][] = [
    [String(shows), t.shareShows],
    [String(episodeCount), t.shareEpisodes],
    [String(movies), t.shareMovies],
    [timeText, t.shareTime],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#0A0A0A",
          color: "#F5F5F5",
          fontFamily: "Cairo, CairoLatin",
          direction: rtl ? "rtl" : "ltr",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: "linear-gradient(135deg, #FFD200, #FBBF24 55%, #F59E0B)",
            }}
          />
          <div style={{ fontSize: 34, letterSpacing: -1 }}>Loopz</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 30, color: "#A3A3A3" }}>{t.shareHeadline}</div>
          <div style={{ fontSize: 68 }}>{name}</div>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {stats.map(([value, label]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flex: 1,
                padding: "26px 28px",
                borderRadius: 26,
                background: "#161616",
                border: "1px solid #2A2A2A",
              }}
            >
              <div style={{ fontSize: 46, color: "#F5F5F5" }}>{value}</div>
              <div style={{ fontSize: 24, color: "#A3A3A3" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#A3A3A3" }}>
          {/* النجمة مرسومة لا محرفاً: محرف ★ ليس في خطّ القاهرة فيخرج مربّعاً */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#F59E0B">
            <path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 5.9 20.6 7.2 13.8 2.2 9.1l6.8-.8z" />
          </svg>
          <div>
            {rated > 0 ? t.shareRated(rated, avg.toFixed(1)) : t.shareNoRatings}
          </div>
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
