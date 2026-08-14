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
import { Dropdown, dropdownItem } from "./ui/Dropdown";

/**
 * **الضغطُ المطوَّل على أيّ ملصق** (D-229، طلبُ أحمد: «أيّ أحد يضغط HOLD
 * على البوستر يقدر يختار تو واتش أو شاهدته أو ريفيو — **وهذه قاعدة
 * طبّقها على أيّ بوستر في LOOPZ**»).
 *
 * ================= لماذا منسدلةٌ لا ورقة ولا طبقة =================
 *
 * **الورقةُ السفلية تغطّي الشاشة فتُخفي ما ضغطتَ عليه** — فتسأل «أيّ عملٍ
 * هذا؟» بعد لمسةٍ واحدة، وتحتاج عنواناً يذكّرك (وهو ما تفعله ورقةُ
 * المكتبة). **والمنسدلةُ ملتصقةٌ بمقبضها فلا تسأل السؤال.**
 *
 * ⚠️ **وشُحنت أوّلاً طبقةً داخل الملصق ورُدَّت** (نصُّ أحمد يومها: «يطلع
 * من نفس البوستر»). **والتنفيذُ كذّب الفكرة**: الملصقُ ٩٢–١١٢px، **فثلاثةُ
 * صفوفٍ بنصٍّ عربيّ وإنجليزيّ داخله تُقصّ كلُّها** — «Add to To…» و«Watche
 * it all». **وقائمةٌ مقصوصةُ الكلمات أسوأ من قائمةٍ خارج الإطار.**
 * **والحكم: مساحةُ العنصر تحدّ ما يُوضع فيه، لا نيّةُ المصمّم.**
 *
 * **فصارت `Dropdown` نفسَها التي تفتحها النقاط** (D-226): بطاقةٌ مرتفعة
 * تخرج من مقبضها بحركةٍ سريعة، تُغلق بالنقر خارجها وبـ`Escape`.
 * **وقائمةٌ واحدة لكل «المزيد» في التطبيق** — لا ثالثة.
 *
 * ⚠️ **وورقةُ المكتبة تبقى كما هي** (`LibraryGrid`): أفعالُها ستّة وفيها
 * «حلقة تالية» و«بطاقة حمراء». **`LongPressable` واحدٌ للاثنين**،
 * والمختلفُ ما يُعرض بعده.
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

  /**
   * **«شاهدته» تُضيفه إلى المكتبة أوّلاً** (D-235، بلاغُ أحمد: «اخترتُ
   * شاهدته كامل ولا سجّلها في المكتبة»).
   *
   * **والعلّةُ في نيّة الفعل لا في تنفيذه:** `markShowWatched` تكتب في
   * `watched_episodes` وحدها — **وهي مصمَّمةٌ لسطح المكتبة حيث العملُ
   * مضافٌ أصلاً**. ومن ضغطها من الخطّ كتب حلقاتِ عملٍ **لا يملكه**، فلا
   * يظهر في مكتبته ولا يُحسب في تقدّمه: **سجلٌّ يتيم.**
   * **و«شاهدتُه» تعني «هذا لي وقد انتهيت منه»** — فالإضافةُ جزءٌ من
   * المعنى لا خطوةٌ سابقة له.
   */
  function markWatched() {
    tap([12, 30]);
    const wasIn = inList;
    setSeen(true);
    setInList(true);
    setOpen(false);
    start(async () => {
      try {
        /* الترتيبُ مقصود: الإضافةُ أوّلاً فإن سقط التأشيرُ بقي العملُ
           في المكتبة — **والعكسُ يترك حلقاتٍ بلا عمل** */
        if (!wasIn) await follow({ tmdbId, mediaType, title, posterPath });
        if (mediaType === "tv") await runOrQueue("markShowWatched", tmdbId);
        else
          await runOrQueue("toggleMovieWatched", {
            movieTmdbId: tmdbId,
            runtime: null,
            watched: true,
          });
      } catch (e) {
        setSeen(false);
        setInList(wasIn);
        flashError((e as Error).message);
      }
    });
  }

  function openReview() {
    setOpen(false);
    router.push(`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`);
  }

  return (
    /* **الملصقُ نفسُه يُضاء ما دامت القائمةُ مفتوحة** (D-233): إطارٌ
       بلون الهوية حول حدوده — **فالعينُ تصل القائمةَ بمصدرها في لمحة**،
       وهو ما عجز عنه الموضعُ وحده. ولا تعتيمَ للشاشة: التعتيمُ هو
       الشاشةُ المنبثقة التي رُفضت. */
    <div
      className={`relative rounded-poster transition ${
        open ? "ring-2 ring-accent ring-offset-2 ring-offset-[color:var(--background)]" : ""
      }`}
    >
      <LongPressable onLongPress={() => setOpen(true)}>{children}</LongPressable>

      {/* **خيطُ الحالة يرسمه هذا المكوّن لا البطاقة** (D-235): الحالةُ
          تفاؤليةٌ وتسكن هنا، **وخيطٌ في `PosterCard` لا يراها فلا يتغيّر
          لونُه إلا بعد تنقّلٍ كامل** — فيضغط المستخدم «شاهدته» ولا يرى
          شيئاً، **ويظنّ الفعلَ سقط**. أخضرُ للمنتهي ورماديٌّ للمحفوظ. */}
      {(seen || inList) && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 rounded-b-poster overflow-hidden bg-black/50"
        >
          <span
            className="block h-full w-full transition-colors"
            style={{ background: seen ? "var(--success)" : "var(--border)" }}
          />
        </span>
      )}

      <Dropdown open={open} onClose={() => setOpen(false)} align="end" caret>
        <HoldRow
          icon={inList ? "check" : "plus"}
          label={inList ? t.quickAddRemove : t.quickAddLabel}
          active={inList}
          onClick={toWatch}
        />
        <HoldRow
          icon="check-line"
          label={t.markAllWatched}
          active={seen}
          onClick={markWatched}
        />
        <HoldRow icon="star" label={t.reviewSectionTitle} onClick={openReview} />
      </Dropdown>
    </div>
  );
}

/** صفٌّ في القائمة — **بوصفة `dropdownItem` نفسِها** التي تستعملها النقاط */
function HoldRow({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
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
      className={dropdownItem}
    >
      <Icon
        name={icon}
        size={18}
        className={active ? "text-accent shrink-0" : "text-muted shrink-0"}
      />
      <span className={active ? "text-accent" : undefined}>{label}</span>
    </button>
  );
}
