import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser, getWatchHistory, getFollows, getAllMovieProgress } from "@/lib/data";
import { getT } from "@/lib/locale";
import { posterUrl } from "@/lib/media";
import { formatDate } from "@/lib/when";
import { Icon } from "@/components/Icon";

/**
 * سجلّ المشاهدة.
 *
 * مجموعٌ باليوم لا مسرودٌ صفّاً صفّاً: من يفتح سجلّه يسأل «وش سويت أمس»
 * لا «ما رقم الحلقة الرابعة والعشرين». وأسماء الأعمال وملصقاتها من صفوف
 * المتابعة المخزّنة عندنا — لا طلب TMDB واحد، فالصفحة تفتح فوراً مهما طال
 * السجلّ.
 */
export default async function DiaryPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { t } = await getT();

  const [history, follows, movieProgress] = await Promise.all([
    getWatchHistory(),
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

  // تجميع باليوم مع الحفاظ على ترتيب الأحدث
  const days = new Map<string, typeof history>();
  for (const row of history) {
    const day = row.watchedAt.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(row);
  }

  // التسميات تُحسب مرة واحدة خارج الرسم: «اليوم» و«أمس» تُقارَن بتاريخ
  // الطلب لا بتاريخ كل صفّ، فلا يختلف الجواب بين سطرٍ وآخر
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const labels = new Map<string, string>(
    [...days.keys()].map((day) => [
      day,
      day === today ? t.diaryToday : day === yesterday ? t.diaryYesterday : formatDate(day, t),
    ]),
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold">{t.diaryTitle}</h1>
        <Link href="/library" className="text-xs text-accent hover:brightness-110 transition">
          {t.libraryTitle} ›
        </Link>
      </div>
      <p className="text-xs text-muted mb-5">{t.diarySub}</p>

      {days.size === 0 ? (
        <p className="text-center text-muted py-20 text-sm">{t.diaryEmpty}</p>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([day, rows]) => (
            <section key={day}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-bold">{labels.get(day)}</h2>
                <span className="text-[11px] text-muted">{t.diaryDayCount(rows.length)}</span>
              </div>

              <ul className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border">
                {rows.map((r, i) => {
                  const key = `${r.kind === "movie" ? "movie" : "tv"}-${r.tmdbId}`;
                  const info = meta.get(key);
                  const href =
                    r.kind === "movie" ? `/movie/${r.tmdbId}` : `/show/${r.tmdbId}`;
                  const img = posterUrl(info?.poster ?? null, "w185");
                  return (
                    <li key={`${key}-${r.season ?? 0}-${r.episode ?? 0}-${i}`}>
                      <Link
                        href={href}
                        prefetch={false}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 transition"
                      >
                        <span className="relative w-8 h-12 shrink-0 rounded-md overflow-hidden bg-surface-2 border border-border">
                          {img && (
                            <Image src={img} alt="" fill sizes="32px" className="object-cover" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium truncate leading-tight">
                            {info?.title ?? `#${r.tmdbId}`}
                          </span>
                          <span className="block text-[11px] text-muted mt-0.5">
                            {r.kind === "episode" && r.season != null && r.episode != null
                              ? t.diaryEpisode(r.season, r.episode)
                              : t.typeMovie}
                            {r.runtime ? ` · ${t.runtimeMin(r.runtime)}` : ""}
                          </span>
                        </span>

                        <Icon
                          name={r.kind === "movie" ? "film" : "tv"}
                          size={15}
                          className="text-muted/70"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
