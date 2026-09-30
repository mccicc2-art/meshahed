"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTalkFollowedOnly, setTalkSort, setFeedStrangers, setFeedSort } from "@/lib/actions";
import { chipClass, chipRow } from "./ui/controls";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";
import { QuietHint } from "./QuietHint";

/**
 * 🆕 D-1201 — **شرائحُ «النقاشات» وسطرُ ترتيبها** (أحمد ٣٠ سبتمبر: التصميمُ B).
 *
 * - **«الكل · أعمالي»** — شرائحُ ملفّ الشخص نفسُها (`chipClass` في `chipRow` — `ActivityScreen`)، **وتحلّ محلَّ مفتاح الأدوات**
 *   «أعمالي المتابَعة فقط» (D-306): الكوكيُ نفسُه يُكتب، فمن كان مفعّلاً يجد «أعمالي» مختارةً ولا يتبدّل ما يراه.
 * - **سطرٌ هادئٌ تحتها** — نظيرُ سطر الحصيلة في «النشاط»: عددُ ما يُعرض، ثمّ «الأحدث · الأكثر تفاعلاً» خياران ظاهران (لا زرٌّ
 *   يتبدّل فيُخفي بديلَه). كلاهما تفضيلٌ يُكتب ثمّ تُقرأ الصفحةُ من جديد — الخادمُ يُرشِّح ويرتّب (`sortTalkRooms`).
 * التطبيقُ يرسم الشيءَ نفسَه أصليّاً ويُرشِّح في يده.
 *
 * 🆕 D-1207 — **و«النشاط» يلبسه** (`kind="feed"`، أحمد: «ابغى اضيف ف اكتفتي الكل وناس اتابعهم ولاتيست و موست اكتيف»): الشريحتان
 * مفتاحُ الغرباء (D-900 — «الكل» = الغرباءُ ظاهرون) والسطرُ ترتيبُ الخطّ (`smart` = «الأكثر تفاعلاً» بنافذة الشهر). غادرا الأدوات.
 * و`quiet` ⇐ سطرُ الشهر الصامت تحته (النقاشات؛ والنشاطُ يرسمه `ActivityFeed` لأنّه من يعرفه).
 */
export function TalkFilters({
  locale,
  kind = "talk",
  mine: mineInitial,
  sort: sortInitial,
  count,
  quiet = false,
}: {
  locale: Locale;
  /** `talk` — «الكل · أعمالي» · `feed` — «الكل · من أتابعهم» */
  kind?: "talk" | "feed";
  /** الشريحةُ الثانية مختارة (أعمالي / من أتابعهم) */
  mine: boolean;
  sort: "latest" | "active";
  /** عددُ ما يُعرض — النشاطُ بلا عدد */
  count?: number;
  quiet?: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [mine, setMine] = useState(mineInitial);
  const [sort, setSort] = useState(sortInitial);
  const [, start] = useTransition();
  const save = (job: () => Promise<void>, undo: () => void) =>
    start(async () => {
      try {
        await job();
        router.refresh();
      } catch (e) {
        undo();
        flashError((e as Error).message);
      }
    });
  const pickMine = (next: boolean) => {
    if (next === mine) return;
    tap(8);
    setMine(next);
    save(() => (kind === "feed" ? setFeedStrangers(!next) : setTalkFollowedOnly(next)), () => setMine(!next));
  };
  const pickSort = (next: "latest" | "active") => {
    if (next === sort) return;
    tap(8);
    const prev = sort;
    setSort(next);
    save(() => (kind === "feed" ? setFeedSort(next === "active" ? "smart" : "latest") : setTalkSort(next)), () => setSort(prev));
  };
  return (
    <div className="space-y-3 mb-3">
      <div className={chipRow}>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={!mine} onClick={() => pickMine(false)} className={chipClass(!mine)}>
            {t.allWord}
          </button>
          <button type="button" aria-pressed={mine} onClick={() => pickMine(true)} className={chipClass(mine)}>
            {kind === "feed" ? t.feedScopeFollowing : t.talkScopeMine}
          </button>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[color:var(--divider)] text-14">
        <span className="text-muted tabular-nums">{count === undefined ? null : t.talkRoomsCount(count)}</span>
        <span role="group" aria-label={t.talkSortAria} className="flex items-center gap-3">
          {(["latest", "active"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={sort === k}
              onClick={() => pickSort(k)}
              className={
                sort === k
                  ? "font-semibold text-foreground border-b-2 border-accent pb-0.5"
                  : "text-muted hover:text-foreground transition pb-0.5 border-b-2 border-transparent"
              }
            >
              {k === "latest" ? t.talkSortLatest : t.talkSortActive}
            </button>
          ))}
        </span>
      </div>
      {quiet ? <QuietHint text={t.activeQuietHint} /> : null}
    </div>
  );
}
