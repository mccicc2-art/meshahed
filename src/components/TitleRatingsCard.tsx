"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRating, saveRating } from "@/lib/actions";
import { getDict, num, type Locale } from "@/core/i18n";
import type { PersonLite } from "@/core/people";
import { flashError, toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { PersonName } from "./PersonRow";

/**
 * **من قيّم هذا العمل، وبكم** (D-538، تصميمُ أحمد: «التقييمات: يظهر
 * المقيمون وتقييم كل شخص، ويمكنك تعديل تقييمك أو حذفه»).
 *
 * ================= ⚖️ ونقضٌ مسجَّلٌ يُقال باسمه =================
 *
 * **كان مكتوباً في `TitleCommunityTab` أنّ «تقييماً بلا كلامٍ رقمٌ لا
 * صفّ، وقد أُخذ متوسّطُه في البطاقة فوق»** — **وهي حجّةٌ صحيحةٌ لخطِّ
 * القراءة**: سطرٌ فارغٌ بين آراءٍ مكتوبةٍ يقطع القراءة. **وهي ليست حجّةً
 * لإخفاء الناس.** **المتوسّطُ يقول «كم»، ولا يقول «من»** — **وسطحٌ
 * اجتماعيٌّ يخفي أصحابَ الأرقام خلف رقمٍ واحد** يناقض ما بُني عليه
 * (D-371: كلُّ سطحٍ اجتماعيٍّ يُظهر كلامَ الناس).
 *
 * **فالخطُّ يبقى للآراء المكتوبة، وهذه بطاقةٌ مستقلّةٌ فوقه** — **صفٌّ
 * قصيرٌ لكلِّ مقيّم**، لا سطرَ رأيٍ فارغ في مجرى القراءة.
 *
 * ================= ولا نداءَ جديد =================
 *
 * **الصفوفُ هي `getTitleReviews` نفسُها** التي يقرؤها الخطُّ أصلاً
 * (D-205): **الخطُّ يرشّح منها ما كُتب، وهذه تعرضها كلَّها.**
 *
 * ================= والتعديلُ لا يفتح مؤلّفاً ثانياً =================
 *
 * **القلمُ يوقظ الورقةَ التي في `TitleJoinCard`** بحدثٍ على النافذة —
 * **ونسخةٌ ثانيةٌ من `RatingBox` في الشاشة نفسِها هي ما تمنعه القاعدة
 * ٦** (وسابقةُ `HelpTourRows` التي تبثّ حدثاً ولا تركّب الجولة).
 */
export const WRITE_REVIEW_EVENT = "lz:write-review";

export interface RaterRow extends PersonLite {
  rating: number;
  review: string | null;
  isMine: boolean;
}

export function TitleRatingsCard({
  tmdbId,
  mediaType,
  title,
  posterPath,
  raters,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  raters: RaterRow[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [removed, setRemoved] = useState(false);
  const [, start] = useTransition();

  /* **والمحذوفُ يختفي فوراً** (D-241): الصفُّ صفُّك، **وانتظارُ رحلةٍ
     قبل أن يختفي يجعل الحذفَ يبدو معطّلاً** — والتراجعُ يعيده. */
  const rows = raters.filter((r) => !(r.isMine && removed));
  /* **وبطاقةٌ بلا صفٍّ لا تُرسم** (D-222) — ولا عنوانٌ فوق فراغ */
  if (!rows.length) return null;

  const mine = raters.find((r) => r.isMine) ?? null;

  function remove() {
    if (!mine) return;
    tap(10);
    setRemoved(true);
    start(async () => {
      try {
        await deleteRating({ tmdbId, mediaType });
        router.refresh();
        toast(t.ratingDeleted, {
          action: {
            label: t.undoWatched,
            run: () => {
              setRemoved(false);
              start(async () => {
                try {
                  /* **والتراجعُ يعيد الرقمَ والنصَّ معاً** — الصفُّ
                     واحدٌ في القاعدة، **وإعادةُ نصفه محوٌ لنصفه.** */
                  await saveRating({
                    tmdbId,
                    mediaType,
                    rating: mine.rating,
                    review: mine.review ?? "",
                    title,
                    posterPath,
                  });
                  router.refresh();
                } catch (e) {
                  flashError((e as Error).message);
                  setRemoved(true);
                }
              });
            },
          },
        });
      } catch (e) {
        flashError((e as Error).message);
        setRemoved(false);
      }
    });
  }

  return (
    <section className="mt-3 rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex items-baseline gap-2 px-4 pt-3 pb-2">
        <h3 className="font-bold text-15">{t.ratingsHeading}</h3>
        <span className="text-12 text-muted tabular-nums">{num(rows.length, locale)}</span>
      </div>

      <ul className="divide-y divide-[color:var(--divider)]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              {/* **واسمُك «أنت» لا اسمُك** — الصفُّ يقول أين تقف بلا أن
                  تبحث عن نفسك في القائمة (عُرفُ كلِّ سطحٍ فيه أنت). */}
              {r.isMine ? (
                <div className="flex items-center gap-2 min-w-0">
                  <PersonName person={r} t={t} size={28} />
                  <span className="text-12 text-muted shrink-0">· {t.ratingsYou}</span>
                </div>
              ) : (
                <PersonName person={r} t={t} size={28} />
              )}
            </div>

            <span className="shrink-0 inline-flex items-center gap-1 font-bold tabular-nums">
              <Icon name="star" size={14} style={{ color: "var(--accent)" }} />
              {num(r.rating, locale)}
            </span>

            {/* **والقلمُ والسلّةُ لصفِّك وحدَه** — وزرٌّ لا وجهةَ له على
                صفِّ غيرك وعدٌ كاذب (D-217). */}
            {r.isMine && (
              <span className="shrink-0 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    tap(8);
                    window.dispatchEvent(new Event(WRITE_REVIEW_EVENT));
                  }}
                  aria-label={t.ratingEditAria}
                  title={t.ratingEditAria}
                  className="grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground active:scale-95 transition"
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  type="button"
                  onClick={remove}
                  aria-label={t.ratingDeleteAria}
                  title={t.ratingDeleteAria}
                  className="grid place-items-center w-9 h-9 rounded-full text-muted hover:text-[color:var(--error)] active:scale-95 transition"
                >
                  <Icon name="trash" size={16} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
