"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow, setWatchState, startRewatch } from "@/lib/actions";
import { runOrQueue } from "@/lib/offline";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict } from "@/core/i18n";
import { Dropdown, DropdownRow } from "./ui/Dropdown";

type Dict = ReturnType<typeof getDict>;

/**
 * 🆕 D-1299 — **خرجت من `LibraryGrid` لمّا جاء قارئاها الثاني والثالث** (ملصقُ «للمشاهدة» وبطاقةُ «تابِع المشاهدة»
 * في رئيسيّة الويب — طلبُ أحمد ٦ أكتوبر: قائمةُ التطبيق نفسُها في الويب). لحظةُ الاستخراج القارئُ الثاني (D-002)،
 * وقائمةٌ ثانيةٌ بالصفوف نفسِها كانت ستفترق عند أوّل تعديل (D-145). ما تعرفه عن العمل حقولٌ صريحة لا `GridItem`:
 * كلُّ سطحٍ يعلن حالَ عمله كما يعلنها `asItem` في التطبيق.
 */
export interface HoldMenuItem {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  dropped?: boolean;
  /** موقوفٌ مؤقّتاً (`follows.watch_state`) */
  paused?: boolean;
  completed?: boolean;
  /** يُعلنه من يعرف حالَ العمل حقّاً — به تصير «البطاقة الحمراء» «إزالة» ويظهر «ابدأ» */
  unstarted?: boolean;
  /** بلا صفِّ «الحلقة التالية» (D-1282) */
  noNext?: boolean;
}

/**
 * 🆕 **قائمةُ الضغط المطوَّل في المكتبة — منسدلةٌ لا ورقة** (D-376، طلبُ
 * أحمد: «القائمة بعد ما اعمل hold ما هي واضحة… في المكتبة ما أبغى هذي
 * المنبثقة، أبغى نفس تبع الاكسبلورر»).
 *
 * ⚖️ **وهو نقضٌ مسجَّلٌ لشطرٍ من D-229/D-353** — «ورقةُ المكتبة تبقى
 * ورقةً لأن أفعالَها ستّةٌ ولا تسع في منسدلة». **والحجّةُ سقطت بالقياس
 * لا بالرأي**: الأفعالُ المعروضةُ في أيّ لحظةٍ **ثلاثةٌ أو أربعة** (حلقةٌ
 * تالية *أو* إعادةُ مشاهدة، ثم «شاهدته»، ثم «ريفيو»، ثم «بطاقة حمراء») —
 * **والستّةُ كانت مجموعَ الحالات كلِّها لا ما يُرسم معاً.**
 * **والثمنُ الذي دفعناه بالورقة حقيقيّ**: تغطّي الشبكةَ فتُخفي الملصقَ
 * الذي ضغطتَه، **فتحتاج عنواناً يذكّرك بما ضغطت** — وهو نصُّ D-229 في
 * وصف الورقة، **ولقطةُ أحمد أرَت العنوان «Room» وحدَه فوق شاشةٍ مطموسة.**
 *
 * **والمعنى لم يتغيّر بحرف** (D-353): البنودُ نفسُها وترتيبُها نفسُه
 * وأيقوناتُها نفسُها والاهتزازةُ نفسُها — **والذي تغيّر السطحُ وحدَه.**
 *
 * **والصفُّ `DropdownRow` المشترك** (D-376/D-002) لا نسخةٌ من صفوف الورقة.
 */
export function LibraryHoldMenu({
  item,
  t,
  onClose,
  onDone,
}: {
  item: HoldMenuItem;
  t: Dict;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  /**
   * القائمةُ تُغلق فوراً والخادم يلحق في الخلفية. **والفشلُ توستٌ،
   * ولا سطرَ نجاحٍ داخل القائمة**: المنسدلةُ تُغلق عند الفعل
   * (`PosterHold` حرفاً)، **ورسالةٌ في قائمةٍ مغلقةٍ لا يقرؤها أحد.**
   *
   * 🔴 🆕 D-769: **التجديدُ بعد الكتابة لا قبلها** — كان `onDone()` يسبق
   * `fn()` فتنطلق نافذةُ الـ800م.ث **قبل أن يكتب الخادمُ حرفاً**، وفعلٌ
   * يتجاوزها («شفته كله» لمسلسلٍ طويل) يجعل التجديدَ يقرأ بياناتِ ما
   * قبل الكتابة: شبكةٌ تُعاد رسمتها كاملةً **بلا أثرٍ للفعل**، ثم يصحّح
   * تجديدُ الضغطة التالية — وهو نصفُ «الريفرش» الذي صوّره أحمد (ونصفُه
   * الآخر هويّةُ `LibraryCell` أعلاه). الآن الكتابةُ أوّلاً والتجديدُ
   * على حقيقتها، **والفشلُ لا يجدّد شيئاً** — لا شيءَ تغيّر ليُقرأ.
   */
  function run(fn: () => Promise<unknown>) {
    /* **والاهتزازةُ نفسُها في السطحين** (D-353) */
    tap([12, 30]);
    onClose();
    start(async () => {
      try {
        await fn();
        onDone();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const isTv = item.mediaType === "tv";
  /* 🆕 D-1280 — **الصفوفُ حسب حال العمل، كالتطبيق حرفاً** (`libraryRows` في `HoldMenu.tsx`):
     لم يبدأ ⇒ «ابدأ» للمسلسل و«إزالة» بدل البطاقة الحمراء (الإيقافُ فعلُ من بدأ) · يتابعه ⇒ «إيقاف مؤقّت»
     أوّلاً · موقوفٌ مؤقّتاً ⇒ «كمّل» بلا «الحلقة التالية» (تعليمُ حلقةٍ ينقض الإيقاف). والفيلمُ بلا بدءٍ ولا إيقاف. */
  const unstarted = !!item.unstarted;
  const paused = isTv && !!item.paused && !item.completed;
  const watching = isTv && !item.completed && !unstarted;

  return (
    <Dropdown open onClose={onClose} align="end" caret>
      {item.dropped ? (
        /* عملٌ موقوف: الإجراء الوحيد المنطقي هو التراجع عن الإيقاف.
           🆕 **والكلمةُ صارت «تابع من جديد» لا «تراجع»** (D-636): الصفُّ
           يستأنف متابعةً، **و«تراجع» كلمةٌ عامّةٌ تصف آلةً لا فعلاً** —
           **والمفتاحُ قائمٌ ويقرؤه شريطُ صفحة العمل لنفس الفعل**، فصار
           السطحان يقولان الشيءَ بكلمةٍ واحدة (D-145). */
        <DropdownRow
          icon="play"
          label={t.resumeWatching}
          disabled={pending}
          onClick={() =>
            run(() => runOrQueue("setDropped", item.tmdbId, item.mediaType, false))
          }
        />
      ) : (
        <>
          {isTv && unstarted && (
            <DropdownRow
              icon="play"
              label={t.holdStart}
              disabled={pending}
              onClick={() => run(() => setWatchState(item.tmdbId, "started"))}
            />
          )}
          {watching && (
            <DropdownRow
              icon={paused ? "play" : "pause"}
              label={paused ? t.holdResume : t.holdPause}
              disabled={pending}
              onClick={() => run(() => setWatchState(item.tmdbId, paused ? null : "paused"))}
            />
          )}

          {/* D-1282 — `noNext`: حيث للبطاقة دائرةُ صحٍّ تفعلها («تابِع المشاهدة») أو العملُ في «للمشاهدة» */}
          {watching && !paused && !item.noNext && (
            <DropdownRow
              icon="play"
              label={t.markNextEp}
              disabled={pending}
              onClick={() => run(() => runOrQueue("markNextEpisode", item.tmdbId))}
            />
          )}

          {/* عملٌ مكتمل: بابه «أشاهده من جديد» — دورةٌ جديدة واليوميات سليمة */}
          {isTv && item.completed && (
            <DropdownRow
              icon="repeat"
              label={t.rewatchBtn}
              disabled={pending}
              onClick={() => run(() => startRewatch(item.tmdbId))}
            />
          )}

          {/* **`check-line` كالمنسدلة لا `check`** (D-353) */}
          <DropdownRow
            icon="check-line"
            label={!isTv && unstarted ? t.holdWatchedMovie : t.markAllWatched}
            tone="success"
            disabled={pending}
            onClick={() =>
              run(() =>
                isTv
                  ? runOrQueue("markShowWatched", item.tmdbId)
                  : runOrQueue("toggleMovieWatched", {
                      movieTmdbId: item.tmdbId,
                      runtime: null,
                      watched: true,
                    }),
              )
            }
          />

          {/* **«ريفيو» ينتقل ولا يفتح** — ما يستحقّ صفحةً يأخذها (D-353) */}
          <DropdownRow
            icon="star"
            label={t.reviewSectionTitle}
            onClick={() => {
              tap(8);
              onClose();
              router.push(`/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`);
            }}
          />

          {/* **وما لا رجعةَ سهلةَ فيه آخِراً** (D-322/D-353). 🆕 D-1280 — لِما لم يبدأ «إزالة» من المكتبة،
              ورجعتُها متابعةٌ من جديد (لا تقدّمَ يضيع: لم يبدأ)؛ والبطاقةُ الحمراء لمن بدأ */}
          {unstarted ? (
            <DropdownRow
              icon="close"
              label={t.holdRemove}
              tone="danger"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const ref = { tmdbId: item.tmdbId, mediaType: item.mediaType };
                  await unfollow(ref);
                  toast(t.holdRemoved, {
                    action: {
                      label: t.undoWatched,
                      run: () =>
                        void follow({ ...ref, title: item.title, posterPath: item.posterPath })
                          .then(onDone)
                          .catch((e) => flashError((e as Error).message)),
                    },
                  });
                })
              }
            />
          ) : (
            <DropdownRow
              icon="red-card"
              label={t.dropTitle}
              tone="danger"
              disabled={pending}
              onClick={() =>
                run(() => runOrQueue("setDropped", item.tmdbId, item.mediaType, true))
              }
            />
          )}
        </>
      )}
    </Dropdown>
  );
}
