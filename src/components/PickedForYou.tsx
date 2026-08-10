"use client";

import { useState } from "react";
import { PosterRail, RailItem } from "./PosterRail";
import { PosterCard } from "./PosterCard";
import { LongPressable } from "./LongPressable";
import { OneTimeHint } from "./OneTimeHint";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { dismissTitle, undoDismissTitle } from "@/lib/actions";

/** ما تحمله البطاقة — مُسلسَلٌ من الخادم، لا كائنات TMDB كاملة */
export interface PickedItem {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  year?: string;
  note: string;
}

/** كم بطاقةً تُعرض من البِركة في كل صفحة */
const PAGE = 10;

/**
 * «مقترح لك» — عشرةٌ من بِركةٍ كبيرة، بزرّ تحديثٍ و«غير مهتم».
 *
 * كان الصفّ اثني عشر عملاً ثابتاً طوال اليوم (شكوى المالك). الآن الخادم
 * يبني بِركةً تصل المئة من مزيج الذوق نفسه (D-048/المحرّك في suggest.ts)،
 * والعميل يعرض عشراً ويقلّبها **محلياً** بزرّ التحديث — لا طلبَ TMDB لكل
 * ضغطة، والدورة تعود للبداية بعد آخر صفحة.
 *
 * و«غير مهتم» زرٌّ في زاوية الملصق (خارج رابط البطاقة — قاعدة
 * FranchisePanel): يخفي العمل فوراً، يخزّنه في `dismissed_titles` فلا
 * يعود مع أي تحديثٍ قادم، ويعرض توست «تراجع» (D-019) يعيده ويمحو الصفّ.
 */
export function PickedForYou({
  items,
  title,
  locale,
}: {
  items: PickedItem[];
  title: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  /* عيّنة عشوائية لا صفحات متتابعة: التقليب المتسلسل أعاد الوجوه نفسها
     بترتيبها («الريفرش يظهر نفس الأشياء») — الآن كل ضغطة تسحب عشراً
     عشوائيةً من البِركة كلّها وتستبعد المعروضة حالياً ما دامت البِركة
     تسمح، فلا تتكرّر دفعتان متتاليتان أبداً (D-064). null الابتدائية =
     أول عشرٍ كما رتّبها المحرّك، فلا يختلف رسم الخادم عن العميل */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);

  const keyOf = (i: PickedItem) => `${i.mediaType}-${i.tmdbId}`;
  const pool = items.filter((i) => !hidden.has(keyOf(i)));
  if (pool.length === 0) return null;

  const visible =
    picked === null
      ? pool.slice(0, PAGE)
      : pool.filter((i) => picked.has(keyOf(i))).slice(0, PAGE);

  function refresh() {
    tap(8);
    const currentKeys = new Set(visible.map(keyOf));
    // استبعاد المعروض الآن إن بقي ما يكفي — ثم سحبٌ عشوائي (Fisher–Yates)
    const source = pool.length > PAGE * 2 ? pool.filter((i) => !currentKeys.has(keyOf(i))) : pool;
    const arr = [...source];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setPicked(new Set(arr.slice(0, PAGE).map(keyOf)));
  }

  function dismiss(item: PickedItem) {
    tap([10, 20]);
    const k = keyOf(item);
    setHidden((prev) => new Set(prev).add(k));
    dismissTitle({ tmdbId: item.tmdbId, mediaType: item.mediaType }).catch((e) =>
      flashError((e as Error).message),
    );
    toast(t.dismissedToast, {
      tone: "info",
      action: {
        label: t.undoWatched,
        run: () => {
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(k);
            return next;
          });
          undoDismissTitle({ tmdbId: item.tmdbId, mediaType: item.mediaType }).catch(() => {});
        },
      },
    });
  }

  return (
    <div className="space-y-2.5">
      <OneTimeHint id="picked-dismiss" text={t.hintDismiss} closeLabel={t.closeLabel} />
    <PosterRail
      title={title}
      icon="sparkles"
      action={
        /* التحديث في طرف العنوان — موضع فعل الصفّ (D-052's action slot).
           يظهر فقط حين توجد أكثر من صفحة، فزرٌّ لا يغيّر شيئاً كذبة */
        pool.length > PAGE ? (
          <button
            type="button"
            onClick={refresh}
            aria-label={t.pickedRefreshAria}
            className="shrink-0 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-muted hover:text-foreground hover:border-accent/50 active:scale-[0.97] transition"
          >
            <Icon name="repeat" size={15} strokeWidth={2} />
            <span>{t.pickedRefresh}</span>
          </button>
        ) : undefined
      }
    >
      {visible.map((s) => (
        <RailItem key={keyOf(s)}>
          {/* «غير مهتم»: الضغط المطول **أو** الزرّ في الزاوية.
              **نقضُ م٢ من تقييم 9 Aug** (بطلب أحمد ١٠ أغسطس): أُخفي
              الزرّ حينها لأنه «يزاحم زوايا البطاقة»، فصار `opacity-0`
              حتى المرور — أي **معدوماً على الجوال** حيث لا مرور أصلاً،
              ولا يعرف بالضغط المطول إلا من عُلِّم به. وهو مرض أسهم
              الصفوف نفسه في D-138: **أداةٌ لا تُرى لا توجد**.
              والعلاج علاجُه: ٦٥٪ في السكون وكاملٌ عند المرور أو التركيز
              — ظاهرٌ لمن لا يدري، وخافتٌ فلا يزاحم الملصق. */}
          <LongPressable onLongPress={() => dismiss(s)}>
            <div className="relative group/pk">
              <PosterCard
                href={`/${s.mediaType === "movie" ? "movie" : "show"}/${s.tmdbId}`}
                title={s.title}
                posterPath={s.posterPath}
                year={s.year}
                note={s.note}
              />
              <button
                type="button"
                onClick={() => dismiss(s)}
                aria-label={t.notInterestedAria(s.title)}
                title={t.notInterested}
                className="absolute top-1.5 end-1.5 z-10 grid place-items-center w-7 h-7 rounded-full bg-black/55 text-white/85 opacity-65 group-hover/pk:opacity-100 focus-visible:opacity-100 hover:bg-black/75 hover:text-white active:scale-95 transition backdrop-blur-sm"
              >
                <Icon name="eye-off" size={14} strokeWidth={2} />
              </button>
            </div>
          </LongPressable>
        </RailItem>
      ))}
    </PosterRail>
    </div>
  );
}
