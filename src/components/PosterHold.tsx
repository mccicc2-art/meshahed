"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow } from "@/lib/actions";
import { runOrQueue } from "@/lib/offline";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import { LongPressable } from "./LongPressable";

/**
 * **الضغطُ المطوَّل على أيّ ملصق** (D-229، طلبُ أحمد: «أيّ أحد يضغط HOLD
 * على البوستر يقدر يختار تو واتش أو شاهدته أو ريفيو — **وهذه قاعدة
 * طبّقها على أيّ بوستر في LOOPZ**»).
 *
 * ================= لماذا لا ورقة =================
 *
 * **«أهمّ شيء ما تطلع شاشة منبثقة — تطلع من نفس البوستر بشكل سموث»**
 * (نصُّ أحمد). **والحجّةُ تحته أعمق من الشكل:** الورقةُ السفلية تغطّي
 * الشاشة فتُخفي ما ضغطتَ عليه — **فتسأل «أيّ عملٍ هذا؟» بعد لمسةٍ
 * واحدة**، وتحتاج عنواناً يذكّرك (وهو ما تفعله ورقةُ المكتبة). **وطبقةٌ
 * داخل الملصق نفسِه لا تسأل السؤال**: العملُ تحتها، والاختيارُ فوقه.
 *
 * ⚠️ **وورقةُ المكتبة تبقى كما هي** (`LibraryGrid`): أفعالُها ستّة
 * وفيها «حلقة تالية» و«بطاقة حمراء» — **قائمةٌ من ستّة صفوف لا تُوضع
 * في ١١٢px**. سطحان بمقاسين لا عائلتان: **`LongPressable` واحدٌ
 * للاثنين**، والمختلفُ ما يُعرض بعده.
 *
 * ================= ثلاثةُ أفعال، ولا رابع =================
 *
 * **للمشاهدة · شاهدته · ريفيو** — بنصّ أحمد. **ولا «بطاقة حمراء» هنا**:
 * الإيقافُ فعلُ من يتابع، **ومن يتابع في المكتبة**.
 *
 * **و«ريفيو» ينتقل ولا يفتح**: كتابةُ رأيٍ تحتاج مساحةً وتقييماً ونصّاً،
 * **وحشرُها في ١١٢px هو الشاشةُ المنبثقة التي رفضها أحمد بلفظٍ آخر.**
 * فالطبقةُ تُغلق والصفحةُ تُفتح — **والفعلُ الذي يستحقّ صفحةً يأخذها**.
 *
 * ================= الحالةُ تفاؤلية =================
 *
 * تُقلب فوراً وتُراجَع إن فشلت الكتابة، **و«شاهدته» تمرّ بطابور دون
 * اتصال** (`runOrQueue`) كما في المكتبة: من أشّر في المصعد لا يخسر
 * تأشيره. **ولا `router.refresh()`**: الأفعالُ تُبطل مساراتها على
 * الخادم، فأوّلُ تنقّلٍ طبيعيّ يقرأ الحقيقة (نمط D-124).
 */
export function PosterHold({
  tmdbId,
  mediaType,
  title,
  posterPath,
  added,
  watched,
  locale,
  children,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /** في «للمشاهدة» أصلاً؟ — من المستدعي لا من نداءٍ هنا (D-205) */
  added: boolean;
  /** شوهد كاملاً؟ — يقلب صفَّ «شاهدته» إلى حالته المُنجَزة */
  watched: boolean;
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inList, setInList] = useState(added);
  const [seen, setSeen] = useState(watched);
  const [, start] = useTransition();

  /* مِفتاحُ الهروب يُغلق — طبقةٌ لا تُغلق بالمفتاح مصيدةٌ لمن لا يلمس */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toWatch() {
    const was = inList;
    tap(was ? 8 : [12, 30]);
    setInList(!was);
    setOpen(false);
    start(async () => {
      try {
        if (was) await unfollow({ tmdbId, mediaType });
        else {
          await follow({ tmdbId, mediaType, title, posterPath });
          toast(t.quickAddDone);
        }
      } catch (e) {
        setInList(was);
        flashError((e as Error).message);
      }
    });
  }

  function markWatched() {
    tap([12, 30]);
    setSeen(true);
    setOpen(false);
    start(async () => {
      try {
        if (mediaType === "tv") await runOrQueue("markShowWatched", tmdbId);
        else
          await runOrQueue("toggleMovieWatched", {
            movieTmdbId: tmdbId,
            runtime: null,
            watched: true,
          });
      } catch (e) {
        setSeen(false);
        flashError((e as Error).message);
      }
    });
  }

  function openReview() {
    setOpen(false);
    router.push(`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`);
  }

  return (
    <div className="relative">
      <LongPressable onLongPress={() => setOpen(true)}>{children}</LongPressable>

      {open && (
        <>
          {/* **ماسكُ النقر بلا لون** — يُغلق الطبقة ولا يُعتّم الشاشة:
              التعتيمُ هو الشاشةُ المنبثقة بعينها */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            aria-label={title}
            /* **داخل حدود الملصق تماماً**: نفسُ نصف قطره (`rounded-poster`)
               ونفسُ إطاره، **فالطبقةُ تبدو الملصقَ وقد انقلب** لا نافذةً
               حطّت فوقه. والضبابةُ تُبقي الصورةَ محسوسةً تحتها. */
            className="absolute inset-0 z-40 rounded-poster overflow-hidden border border-white/15 bg-black/70 backdrop-blur-md flex flex-col justify-center gap-0.5 p-1.5 poster-actions"
          >
            <HoldRow
              delay={0}
              icon={inList ? "check" : "plus"}
              label={inList ? t.quickAddRemove : t.quickAddLabel}
              active={inList}
              onClick={toWatch}
            />
            <HoldRow
              delay={35}
              icon="check-line"
              label={t.markAllWatched}
              active={seen}
              onClick={markWatched}
            />
            <HoldRow delay={70} icon="star" label={t.reviewSectionTitle} onClick={openReview} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * صفٌّ في الطبقة — **رمزٌ ونصٌّ صغير**. والنصُّ لا يُحذف وإن ضاق الملصق:
 * ثلاثةُ رموزٍ عارية فوق صورةٍ ملوّنة **لغزٌ لا قائمة** (نقيضُ حالة الذيل
 * حيث الرموزُ تسكن سطراً هادئاً وتُقرأ بالعُرف).
 */
function HoldRow({
  icon,
  label,
  active = false,
  delay,
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  delay: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{ ["--row-delay" as string]: `${delay}ms` }}
      className={`poster-actions-row w-full flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-start text-[11px] font-semibold leading-tight transition active:scale-95 ${
        active ? "bg-accent/20 text-accent" : "text-white hover:bg-white/10"
      }`}
    >
      <Icon name={icon} size={14} className="shrink-0" />
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}
