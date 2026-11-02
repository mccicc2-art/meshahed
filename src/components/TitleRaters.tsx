"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDict, num, type Locale } from "@/core/i18n";
import type { TitleCommunityPayload } from "@/core/contracts/title";
import { profileHref } from "@/core/people";
import { coalescedRefresh } from "@/core/refresh";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { RatingBox } from "./RatingBox";
import { TitlePulse } from "./TitlePulse";

/**
 * ====== 🆕 D-1628 — «من قيّم العمل» في الويب ======
 *
 * أحمد ٢ نوفمبر: «كيف أشوف من قيم العمل؟» — النبضُ («★ 8.0 (1)») كان رقماً يُقرأ ولا يُفتح، ومن قيّم برقمٍ وحده لا يظهر في أيِّ
 * مكان (تبويبُ المراجعات لمن كتب نصّاً). الآن النبضُ زرٌّ يفتح الورقةَ الوسطى:
 * - **لم أقيّم**: صندوقُ التقييم (`RatingBox` نفسُه — لا عائلةَ تقييمٍ ثانية، D-139) وتحته «عرض جميع التقييمات» («٣»).
 * - **قيّمت · أو زائر**: القائمةُ — تقييمي أوّلاً ثمّ الأحدث — وفي رأسها «تقييمي» يعيد الصندوقَ بقيمه.
 * - **الحسابُ الخاصُّ الذي لا أتابعه يُعدّ ولا يُسمّى** («٢أ»): الصفوفُ من `title_reviews` (`can_view_profile`)، والفرقُ عن عدد النبض سطرٌ.
 * النصوصُ محلّيّةٌ هنا: `i18n.ts` محجوزٌ لمهمّة الودجت (٢٧٤) في السجلّ — والتطبيقُ يقول الكلماتِ نفسَها (`RATERS_WORDS`).
 */
const WORDS = {
  ar: { title: "تقييمات المجتمع", all: "عرض جميع التقييمات", mine: "تقييمي", rate: "قيّم العمل", review: "مراجعة", hidden: (n: string) => `و${n} من حسابات خاصة`, empty: "لا تقييمات بعد", failed: "تعذّر التحميل" },
  en: { title: "Community ratings", all: "See all ratings", mine: "My rating", rate: "Rate it", review: "Review", hidden: (n: string) => `+${n} from private accounts`, empty: "No ratings yet", failed: "Couldn't load" },
} as const;

export function TitleRaters({
  kind,
  tmdbId,
  title,
  posterPath,
  backdropPath,
  votes,
  avg,
  hearts,
  locale,
}: {
  kind: "tv" | "movie";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  votes: number;
  avg: number;
  hearts: number;
  locale: Locale;
}) {
  const t = getDict(locale);
  const w = WORDS[locale === "en" ? "en" : "ar"];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "rate">("list");
  const [data, setData] = useState<TitleCommunityPayload | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async (): Promise<TitleCommunityPayload | null> => {
    try {
      const res = await fetch(`/api/v1/title/${kind}/${tmdbId}/community`, { cache: "no-store" });
      const body = (await res.json()) as { ok: boolean; data?: TitleCommunityPayload };
      if (!body.ok || !body.data) throw new Error("bad");
      setData(body.data);
      setFailed(false);
      return body.data;
    } catch {
      setFailed(true);
      return null;
    }
  };

  const openSheet = async () => {
    setOpen(true);
    setView("list");
    const d = await load();
    /* لم يقيّم وهو صاحبُ جلسة ⇒ التقييمُ أوّلاً (والقائمةُ زرٌّ تحته) */
    if (d?.signed_in && !d.my_review) setView("rate");
  };

  const rows = data?.raters ?? [];
  const hidden = data ? Math.max(0, votes - rows.length) : 0;
  const mine = data?.my_review ?? null;

  return (
    <>
      {votes > 0 ? (
        <button type="button" onClick={() => void openSheet()} aria-haspopup="dialog" className="rounded-md hover:opacity-80 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          <TitlePulse hearts={hearts} votes={votes} avg={avg} locale={locale} />
        </button>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} closeLabel={t.closeLabel} variant="center" labelledBy="raters-title">
        <SheetHeader title={view === "rate" ? title : w.title} closeLabel={t.closeLabel} onClose={() => setOpen(false)} id="raters-title" />
        <div className="px-5 pb-5 pt-3 space-y-3">
          {view === "rate" ? (
            <>
              <RatingBox
                tmdbId={tmdbId}
                mediaType={kind}
                title={title}
                posterPath={posterPath}
                backdropPath={backdropPath}
                locale={locale}
                initialRating={mine?.rating ?? null}
                initialReview={mine?.review ?? null}
                initialHasSpoiler={mine?.has_spoiler ?? false}
                onSaved={() => {
                  coalescedRefresh(router);
                  void load().then(() => setView("list"));
                }}
              />
              {votes > 0 ? (
                <button type="button" onClick={() => setView("list")} className={buttonClass({ variant: "ghost", full: true })}>
                  {w.all}
                </button>
              ) : null}
            </>
          ) : (
            <>
              {data?.signed_in ? (
                <button type="button" onClick={() => setView("rate")} className={buttonClass({ variant: mine ? "ghost" : "primary", full: true })}>
                  {mine ? `${w.mine} · ★ ${num(mine.rating, locale)}` : w.rate}
                </button>
              ) : null}
              {!data && !failed ? (
                <p className="text-center text-13 text-muted py-6">…</p>
              ) : failed ? (
                <p className="text-center text-13 text-muted py-6">{w.failed}</p>
              ) : !rows.length && !hidden ? (
                <p className="text-center text-13 text-muted py-6">{w.empty}</p>
              ) : (
                <ul className="max-h-[360px] overflow-y-auto">
                  {rows.map((r) => {
                    const href = profileHref({ username: r.username });
                    const body = (
                      <>
                        <span className="w-8 h-8 rounded-full overflow-hidden bg-surface-2 shrink-0">
                          {r.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block truncate text-14 ${r.mine ? "font-bold" : "font-semibold"}`}>{r.name}</span>
                          {r.has_review ? <span className="block text-11 text-muted">{w.review}</span> : null}
                        </span>
                        <span className="text-13 font-bold text-accent tabular-nums">★ {num(r.rating, locale)}</span>
                      </>
                    );
                    return (
                      <li key={r.user_id} className="border-b border-[color:var(--divider)]">
                        {href ? (
                          <Link href={href} className="flex items-center gap-2.5 py-2 hover:opacity-80 transition">{body}</Link>
                        ) : (
                          <div className="flex items-center gap-2.5 py-2">{body}</div>
                        )}
                      </li>
                    );
                  })}
                  {hidden ? <li className="text-center text-12 text-muted pt-2.5">{w.hidden(num(hidden, locale))}</li> : null}
                </ul>
              )}
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
