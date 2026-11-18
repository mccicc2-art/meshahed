import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { formatDateShort } from "@/core/when";
import { roomAiring, type RoomAiring } from "@/core/talkEpisodes";
import type { TalkRoom } from "@/lib/data";
import { LoopzLogo } from "../Logo";
import { Icon } from "../Icon";
import { TalkRoomCard } from "../WorksTalk";
import { webWords } from "../webWords";

/**
 * 🆕 R264 — **تبويبُ «نقاش» على الحاسوب** (أحمد ١٨ نوفمبر — «ب»؛ البند ١٥ من جدول التطابق).
 *
 * ترتيبُ التطبيق نفسُه (`CommunityScreen`): «النقاش العام» أوّلاً، ثمّ «يعرض الآن» من مكتبتك بوسمِ كلِّ غرفة
 * («نزلت الحلقة…» · «يعرض · القادمة…» · «متوقّف مؤقتاً»)، ثمّ بقيّةُ الغرف. **والبطاقةُ هي `TalkRoomCard` نفسُها**
 * (القاعدة ٣) — الحاسوبُ يغيّر عددَ الأعمدة لا شكلَ البطاقة. والجوالُ لا يمرّ من هنا: يبقى `WorksTalk` كما هو.
 *
 * ⚠️ **ووسمُ الغرفة فوق البطاقة لا داخلها**: البطاقةُ رابطٌ واحدٌ إلى الغرفة، ورقعةٌ مطلقةٌ في ركنها تُقرأ ولا تُضغط
 * — **ولا متغيّرَ جديدٌ في `TalkRoomCard`** يحمل حقلاً لا يعرفه إلّا هذا السطح.
 */
export function TalkDeskBoard({
  rooms,
  followed,
  nextAir,
  general,
  mineOnly,
  pins,
  globalPins,
  admin,
  activity,
  locale,
}: {
  rooms: TalkRoom[];
  followed: ReadonlySet<string> | null;
  nextAir: ReadonlyMap<string, string> | null;
  general: { posts: number } | null;
  mineOnly: boolean;
  pins?: Set<string>;
  globalPins?: Set<string>;
  admin: boolean;
  activity: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const w = webWords(locale);
  const today = new Date().toISOString().slice(0, 10);

  const airing = followed
    ? rooms
        .filter((r) => r.mediaType === "tv" && followed.has(`tv-${r.tmdbId}`))
        .map((r) => ({ r, a: roomAiring(r.bulletin, nextAir?.get(`tv-${r.tmdbId}`), today) }))
        .filter((x): x is { r: TalkRoom; a: RoomAiring } => !!x.a)
        /* الحلقةُ التي نزلت أوّلاً، ثمّ ما له موعد، ثمّ المتوقّف — ترتيبُ «يعرض الآن» في العمود المجاور */
        .sort((x, y) => rank(x.a) - rank(y.a) || (x.a.next ?? "9").localeCompare(y.a.next ?? "9") || y.r.postsWeek - x.r.postsWeek)
    : [];
  const airingKeys = new Set(airing.map((x) => `${x.r.mediaType}-${x.r.tmdbId}`));
  const rest = rooms.filter((r) => !airingKeys.has(`${r.mediaType}-${r.tmdbId}`));

  const day = (d: string) => {
    const days = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    return days <= 6
      ? new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en" : "ar", { weekday: "long", timeZone: "UTC" })
      : formatDateShort(d, t);
  };
  const tag = (a: RoomAiring) =>
    a.pause
      ? { text: t.talkAiringBreak, tone: "text-muted" }
      : a.out != null
        ? { text: t.talkAiringOut(a.out), tone: "text-[color:var(--success)]" }
        : a.next === today
          ? { text: t.talkAiringToday, tone: "text-[color:var(--success)]" }
          : a.next
            ? { text: t.talkAiringNext(day(a.next)), tone: "text-accent" }
            : { text: t.talkAiringNow, tone: "text-accent" };

  const card = (r: TalkRoom) => (
    <TalkRoomCard
      key={`${r.mediaType}-${r.tmdbId}`}
      room={r}
      locale={locale}
      pinned={pins ? pins.has(`${r.mediaType}-${r.tmdbId}`) : undefined}
      globalPinned={globalPins?.has(`${r.mediaType}-${r.tmdbId}`) ?? false}
      admin={admin}
      activity={activity}
    />
  );
  const heading = (icon: "tv" | "library" | "comment", text: string, n: number) => (
    <h2 className="mb-2.5 mt-6 flex items-center gap-2 text-15 font-bold">
      <Icon name={icon} size={17} className="shrink-0 text-accent" />
      {text}
      <span className="text-12 font-semibold text-muted tabular-nums">{n}</span>
    </h2>
  );

  return (
    <div>
      {general ? (
        <Link
          href="/talk/general/0"
          prefetch={false}
          className="group flex items-center gap-3.5 rounded-2xl border border-accent/35 bg-accent/[0.06] p-3.5 hover:border-accent transition"
        >
          <LoopzLogo variant="mark" size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-15 font-bold group-hover:text-accent transition">{t.talkGeneralTitle}</span>
            <span className="block truncate text-12 text-muted">{t.talkGeneralSub}</span>
          </span>
          {general.posts > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-12 font-bold tabular-nums text-muted">
              <Icon name="comment" size={14} />
              {general.posts}
            </span>
          ) : null}
        </Link>
      ) : null}

      {airing.length ? (
        <>
          {heading("tv", t.talkAiringNow, airing.length)}
          <div className="grid grid-cols-2 gap-3">
            {airing.map(({ r, a }) => {
              const g = tag(a);
              return (
                <div key={`${r.mediaType}-${r.tmdbId}`} className="relative">
                  {card(r)}
                  <span className={`pointer-events-none absolute bottom-2.5 end-3 z-10 rounded-full bg-[color:var(--background)]/85 px-2 py-0.5 text-[11px] font-bold ${g.tone}`}>
                    {g.text}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {rest.length ? (
        <>
          {heading(mineOnly ? "library" : "comment", mineOnly ? w.talkRestMine : w.talkRestAll, rest.length)}
          <div className="grid grid-cols-2 gap-3">{rest.map(card)}</div>
        </>
      ) : null}
    </div>
  );
}

function rank(a: RoomAiring): number {
  return a.pause ? 3 : a.out != null ? 0 : a.next ? 1 : 2;
}
