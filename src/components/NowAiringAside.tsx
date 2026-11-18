import Image from "next/image";
import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl } from "@/core/media";
import { formatDateShort } from "@/core/when";
import { roomAiring, type RoomAiring } from "@/core/talkEpisodes";
import type { TalkRoom } from "@/lib/data";
import { Icon } from "./Icon";

/**
 * 🆕 R255 — **«يُعرض الآن» بجانب الخطّ على الحاسوب** (أحمد ١٨ نوفمبر: «خليها مثل ب القديم اللي قلتلك عدل عليه»).
 *
 * الحاسوبُ كان يرسم الخطَّ عموداً واحداً بعرض الجوّال وفراغين على جانبيه. والعمودُ الثاني لا يخترع محتوًى: هو قسمُ «يعرض الآن»
 * في تبويب «نقاش» بالتطبيق (R56 — غرفُ مكتبتي التي عليها الشارة) منقولاً إلى حيث يراه وهو يقرأ الخطّ — ملصقٌ وشارتُه بنصّ التطبيق
 * حرفاً (`AiringBadge`: «نزلت الحلقة N» · «يعرض اليوم» · «القادمة الخميس» · «يعرض الآن»)، وعددُ المشاركات، وكلُّ صفٍّ يفتح غرفته.
 * **و«On break» خارجه** (D-1603: ليست «يعرض الآن»). و«النقاش العام» آخرُه دائماً — بابُ الكلام بلا عمل.
 * والجوّالُ لا يراه (`desk:` وحده) — له تبويبُ «نقاش».
 */
const MAX = 6;

export function NowAiringAside({
  rooms,
  followed,
  nextAir,
  general,
  locale,
}: {
  rooms: TalkRoom[];
  followed: ReadonlySet<string>;
  nextAir: ReadonlyMap<string, string>;
  general: { posts: number } | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const today = new Date().toISOString().slice(0, 10);
  const airing = rooms
    .filter((r) => r.mediaType === "tv" && followed.has(`tv-${r.tmdbId}`))
    .map((r) => ({ r, a: roomAiring(r.bulletin, nextAir.get(`tv-${r.tmdbId}`), today) }))
    .filter((x): x is { r: TalkRoom; a: RoomAiring } => !!x.a && !x.a.pause)
    /* ما نزل أوّلاً، ثمّ الأقربُ موعداً، ثمّ «يعرض» بلا موعد */
    .sort((x, y) => rank(x.a) - rank(y.a) || (x.a.next ?? "9").localeCompare(y.a.next ?? "9") || y.r.postsWeek - x.r.postsWeek)
    .slice(0, MAX);

  const day = (d: string) => {
    const days = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    return days <= 6
      ? new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en" : "ar", { weekday: "long", timeZone: "UTC" })
      : formatDateShort(d, t);
  };
  const label = (a: RoomAiring) =>
    a.out != null ? t.talkAiringOut(a.out) : a.next === today ? t.talkAiringToday : a.next ? t.talkAiringNext(day(a.next)) : t.talkAiringNow;

  return (
    <aside aria-label={t.talkAiringNow} className="hidden desk:block sticky top-6 self-start">
      <div className="flex items-center gap-2 pb-3">
        <Icon name="tv" size={18} className="text-accent shrink-0" />
        <h2 className="text-15 font-bold">{t.talkAiringNow}</h2>
        <Link href="/people?tab=talk" prefetch={false} className="ms-auto text-12 text-muted hover:text-accent transition">
          {t.seeAll}
        </Link>
      </div>

      {airing.length ? (
        <ul className="space-y-1">
          {airing.map(({ r, a }) => {
            const poster = posterUrl(r.posterPath, "w185");
            const out = a.out != null;
            return (
              <li key={r.tmdbId}>
                <Link href={`/talk/tv/${r.tmdbId}`} prefetch={false} className="group flex items-center gap-3 rounded-xl p-1.5 -mx-1.5 hover:bg-surface transition">
                  <span className="relative block h-20 w-[54px] shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {poster ? <Image src={poster} alt="" fill sizes="54px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <bdi className="block truncate text-14 font-bold group-hover:text-accent transition">{r.title ?? ""}</bdi>
                    <span className={`mt-1 inline-flex max-w-full items-center gap-1.5 text-12 font-bold ${out ? "text-[color:var(--success)]" : "text-muted"}`}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--success)]" />
                      <span className="truncate">{label(a)}</span>
                    </span>
                    {r.posts > 0 ? (
                      <span className="mt-0.5 flex items-center gap-1 text-12 text-muted tabular-nums">
                        <Icon name="comment" size={13} className="shrink-0" />
                        {r.posts}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null /* لا شيءَ يُعرض الآن في مكتبتك ⇐ «النقاش العام» وحده — لا جملةَ فراغٍ فوقه */}

      <Link
        href="/talk/general/0"
        prefetch={false}
        className={`flex items-center gap-3 group ${airing.length ? "mt-4 border-t border-[color:var(--divider)] pt-4" : ""}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-[color:var(--on-accent)]">
          <Icon name="comment" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-bold group-hover:text-accent transition">{t.talkGeneralTitle}</span>
          <span className="block truncate text-12 text-muted">{t.talkGeneralSub}</span>
        </span>
        {general && general.posts > 0 ? (
          <span className="shrink-0 flex items-center gap-1 text-12 text-muted tabular-nums">
            <Icon name="comment" size={13} />
            {general.posts}
          </span>
        ) : null}
      </Link>
    </aside>
  );
}

/** «نزلت» أوّلاً، ثمّ ما له موعد، ثمّ «يعرض» بلا موعد */
function rank(a: RoomAiring): number {
  return a.out != null ? 0 : a.next ? 1 : 2;
}
