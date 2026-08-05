import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getWatchHistory, getFollows, getAllMovieProgress } from "@/lib/data";
import { getT } from "@/lib/locale";
import { posterUrl } from "@/lib/media";
import { formatDate } from "@/lib/when";
import {
  DiaryList,
  type DiaryDay,
  type DiaryEntry,
  type DiaryMonth,
} from "@/components/DiaryList";

/**
 * سجلّ المشاهدة.
 *
 * أيامٌ مطويّة تُفتح بالضغط، وحلقات المسلسل الواحد في اليوم الواحد
 * صفٌّ واحد باسمه وعدد حلقاته ومداها — «S2 · E3–E7» — لا سطرٌ لكل
 * حلقة. التجميع كلّه هنا على الخادم من بياناتٍ مخزّنة عندنا، والعميل
 * لا يحمل إلا الطيّ والفتح.
 */
export default async function DiaryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  // نافذة أوسع: صفوف اليوميات خفيفة، وألف صفٍّ تغطي شهوراً من المشاهدة
  const [history, follows, movieProgress] = await Promise.all([
    getWatchHistory(1000),
    getFollows(),
    getAllMovieProgress(),
  ]);

  // خريطة العنوان والملصق: المتابعات أولاً ثم مواضع الأفلام المتوقّفة
  const meta = new Map<string, { title: string; poster: string | null }>();
  for (const f of follows) {
    meta.set(`${f.media_type}-${f.tmdb_id}`, { title: f.title, poster: f.poster_path });
  }
  for (const m of movieProgress) {
    const key = `movie-${m.movie_tmdb_id}`;
    if (!meta.has(key) && m.title) meta.set(key, { title: m.title, poster: m.poster_path });
  }

  // ===== تجميع باليوم، وداخل اليوم بالعمل =====
  interface Group {
    kind: "tv" | "movie";
    tmdbId: number;
    count: number;
    minutes: number;
    minS: number;
    maxS: number;
    minE: number;
    maxE: number;
  }

  const dayGroups = new Map<string, Map<string, Group>>();
  for (const row of history) {
    const day = row.watchedAt.slice(0, 10);
    const kind = row.kind === "movie" ? "movie" : "tv";
    const key = `${kind}-${row.tmdbId}`;
    if (!dayGroups.has(day)) dayGroups.set(day, new Map());
    const groups = dayGroups.get(day)!;
    const g = groups.get(key);
    const s = row.season ?? 0;
    const e = row.episode ?? 0;
    if (!g) {
      groups.set(key, {
        kind,
        tmdbId: row.tmdbId,
        count: 1,
        minutes: row.runtime ?? (kind === "movie" ? 110 : 40),
        minS: s,
        maxS: s,
        minE: e,
        maxE: e,
      });
    } else {
      g.count++;
      g.minutes += row.runtime ?? (kind === "movie" ? 110 : 40);
      // أول حلقة في المدى: موسمٌ أصغر يستبدل، وموسمٌ مساوٍ يقارن الحلقة
      if (s < g.minS) {
        g.minS = s;
        g.minE = e;
      } else if (s === g.minS) {
        g.minE = Math.min(g.minE, e);
      }
      // آخر حلقة في المدى بنفس المنطق معكوساً
      if (s > g.maxS) {
        g.maxS = s;
        g.maxE = e;
      } else if (s === g.maxS) {
        g.maxE = Math.max(g.maxE, e);
      }
    }
  }

  // التسميات تُحسب مرة واحدة: «اليوم» و«أمس» تُقارَن بتاريخ الطلب
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  const days: DiaryDay[] = [...dayGroups.entries()].map(([day, groups]) => {
    const entries: DiaryEntry[] = [...groups.entries()].map(([key, g]) => {
      const info = meta.get(key);
      let label: string;
      if (g.kind === "movie") {
        label = t.typeMovie;
      } else if (g.count === 1) {
        label = t.diaryEpisode(g.minS, g.minE);
      } else if (g.minS === g.maxS) {
        // مدى داخل موسمٍ واحد — أدقّ وصفٍ وأقصره
        label = `${t.diaryEpsGrouped(g.count)} · S${g.minS} · E${g.minE}–E${g.maxE}`;
      } else {
        label = `${t.diaryEpsGrouped(g.count)} · S${g.minS}–S${g.maxS}`;
      }
      return {
        key: `${day}-${key}`,
        href: g.kind === "movie" ? `/movie/${g.tmdbId}` : `/show/${g.tmdbId}`,
        title: info?.title ?? `#${g.tmdbId}`,
        poster: posterUrl(info?.poster ?? null, "w185"),
        kind: g.kind,
        label,
        minutes: g.minutes,
      };
    });

    return {
      day,
      label:
        day === today ? t.diaryToday : day === yesterday ? t.diaryYesterday : formatDate(day, t),
      countLabel: t.diaryDayCount(entries.length),
      entries,
    };
  });

  // شرائح الأشهر: شهرٌ لكل شريحة، والقفزة إلى أول أيامه في السجلّ
  const monthFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    calendar: "gregory",
  });
  const months: DiaryMonth[] = [];
  for (const d of days) {
    const key = d.day.slice(0, 7);
    if (!months.some((m) => m.key === key)) {
      months.push({
        key,
        label: monthFmt.format(new Date(`${d.day}T00:00:00Z`)),
        firstDay: d.day,
      });
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold">{t.diaryTitle}</h1>
        <Link href="/library" className="text-xs text-accent hover:brightness-110 transition">
          {t.libraryTitle} ›
        </Link>
      </div>
      <p className="text-xs text-muted mb-5">{t.diarySub}</p>

      {days.length === 0 ? (
        <p className="text-center text-muted py-20 text-sm">{t.diaryEmpty}</p>
      ) : (
        <DiaryList days={days} months={months} locale={locale} />
      )}
    </div>
  );
}
