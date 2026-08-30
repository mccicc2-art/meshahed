"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteList,
  renameList,
  reorderList,
  setListKind,
  setListPlaylist,
  setSavedListPlaylist,
  toggleInList,
  saveList,
} from "@/lib/actions";
import { backdropUrl, posterUrl } from "@/lib/media";
import { profileHref } from "@/lib/people";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { getDict, num, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import type { ListItem, ListKind } from "@/lib/data";
import type { TitleState } from "@/lib/libState";
import { StatusThread } from "./StatusThread";
import { BackCrumb } from "./BackButton";
import { Logo } from "./Logo";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { QuickAdd } from "./QuickAdd";
/* ⚖️ 🆕 **ورقةُ الترتيب خرجت إلى ملفِّها** (D-567): صفوفُ المفضّلة
   في البروفايل تحتاجها أيضاً — **وهي هنا خمسون سطراً من رياضيّات
   سحبٍ لا تُنسخ** (القاعدة ٣/D-145). */
import { ReorderSheet, listItemKey as keyOf } from "./ReorderSheet";
import dynamic from "next/dynamic";
/* الورقةُ تُحمَّل عند أوّل فتحٍ لا مع الصفحة (نمطُ TitleSearchSheet في
   الشريط السفليّ): لا تُرسم إلا بضغطةٍ، فشحنُها مع أوّل رسمةٍ ثمنٌ بلا
   قارئ — و`ssr: false` لأن لا HTML لها قبل الضغطة. */
const ShareListSheet = dynamic(() => import("./ShareListSheet").then((m) => m.ShareListSheet), { ssr: false });
/* الورقةُ تُحمَّل عند أوّل فتحٍ لا مع الصفحة (نمطُ TitleSearchSheet في
   الشريط السفليّ): لا تُرسم إلا بضغطةٍ، فشحنُها مع أوّل رسمةٍ ثمنٌ بلا
   قارئ — و`ssr: false` لأن لا HTML لها قبل الضغطة. */
const ListCoverSheet = dynamic(() => import("./ListCoverSheet").then((m) => m.ListCoverSheet), { ssr: false });
import { TitleSearchSheet, type PickedTitle } from "./TitleSearchSheet";

type Dict = ReturnType<typeof getDict>;

/** الأرقام لاتينية في اللغتين (D-015) */
const NUMBERED: ListKind[] = ["ranked", "watch_order"];

/**
 * صفحة القائمة الواحدة.
 *
 * القائمة ثلاثة أنواع لا نوعٌ واحد: مجموعةٌ لا ترتيب لها، وقائمةٌ مرتّبة،
 * وترتيبُ مشاهدة. النوع هو ما يمنح الرقم على الملصق معناه — ولذلك لا رقم
 * على قائمةٍ عادية أصلاً.
 *
 * والأفعال كلّها انتقلت إلى قائمة النقاط الثلاث: كان القلم يعيش في الترويسة
 * والحذف في شبكة القوائم فقط، فصار للاسم بابان وللحذف بابٌ بعيد. بابٌ واحد
 * لكل فعل: تسمية، نوع، ترتيب، حذف.
 *
 * والترتيب لا يجري إلا داخل ورقة «أعد الترتيب»: السحب في الشبكة نفسها كان
 * سيتنازع مع التمرير ومع فتح العمل، وفصلُ الوضع يجعل كل لمسةٍ في مكانها
 * تعني شيئاً واحداً.
 */
export function ListDetail({
  brandPlus = false,
  listId,
  name,
  subtitle,
  isPublic,
  kind,
  smart = null,
  items,
  ratings,
  isOwner,
  owner,
  locale,
  initialSaved,
  cover,
  reviews,
  reviewsSlot,
  libState,
  initialPlaylist,
  saves,
  initialSavedPlaylist,
}: {
  /** 🆕 تجربةُ Loopz+ (D-773ب) — `isPlus || isPartner` عند المستدعي */
  brandPlus?: boolean;
  listId: string;
  name: string;
  subtitle: string | null;
  isPublic: boolean;
  kind: ListKind;
  /**
   * 🆕 **القائمةُ الذكيّة** (D-823) — **نصُّ استعلامِ شرطها، أو `null`**.
   * **وقيمةٌ واحدةٌ تحمل معنيين عمداً**: **«أهي ذكيّة» و«أين شرطُها»** —
   * **ورايةٌ منفصلةٌ عن الشرط تفترقان يوماً** (D-462: حقلٌ واحد، كاتبٌ
   * واحد). **والقائمةُ تُقرأ ولا تُحرَّر**: **زرُّ إضافةٍ في قائمةٍ تملأ
   * نفسَها زرٌّ لا أثرَ له** (D-346)، **وحذفُ عملٍ منها يعود عند أوّل
   * فتحة** — **وهو أسوأُ من منعه** (D-217).
   */
  smart?: string | null;
  items: ListItem[];
  ratings: Record<string, number>;
  isOwner: boolean;
  /**
   * 🆕 **تثبيتُ «يرشّحها لوبز»** (D-349) — **يُرسم للإداريّ وحدَه**:
   * `undefined` تعني «لستُ إداريّاً» فلا زرّ. **والحارسُ الحقيقيُّ
   * `am_admin()` في جسم دالّة القاعدة** (D-011/D-193).
   */
  /** صاحب القائمة — يُمرَّر حين يفتحها غيرُه. قائمةٌ بلا صاحبٍ ظاهرٍ
      مجهولةُ المصدر، ومن أخفى اسمه يصل هنا فارغاً فلا يُنسب شيء */
  owner?: {
    /** 🆕 معرّفُه — بابُ ملفِّه حين لا اسمَ مستخدمٍ له (D-655) */
    id?: string | null;
    nickname: string | null;
    username: string | null;
    avatar: string | null;
  } | null;
  locale: Locale;
  /** حالة الحفظ لغير المالك (D-068) — الغياب يعني زائراً بلا حساب فلا زرّ */
  initialSaved?: boolean | null;
  /** غلافُ القائمة (D-208) — يُعرض لكل من يفتحها، ولا يبدّله إلا صاحبها.
      الغيابُ (أو هجرةٌ لم تُشغَّل بعد) يعني صفحةً كما كانت بالضبط */
  cover?: {
    backdrop: string | null;
    tmdbId?: number | null;
    mediaType?: "tv" | "movie" | null;
  } | null;
  /** 🆕 خلاصةُ التقييم لسطر الرأس (D-332) — الغيابُ يعني قائمةً خاصّة
      أو صفحةً لا تعرض التقييمات فلا رقم */
  reviews?: { avg: number | null; count: number } | null;
  /** 🆕 **قسمُ التقييمات تبويباً** (D-333، طلبُ أحمد: «أبغاها شي يشبه
      صفحة العمل — تبويب قائمة الأفلام وتبويب التعليقات»). يُرسم في
      الصفحة ويُمرَّر جاهزاً — **والغيابُ يعني شبكةً بلا تبويبات** كما
      كانت (قائمةٌ خاصّة أو زائرٌ بلا حساب). */
  reviewsSlot?: React.ReactNode;
  /**
   * ⚖️ 🆕 **حالةُ كلِّ عملٍ عندك لا بولياناً واحداً** (D-542، طلبُ أحمد
   * بلقطةٍ للقائمة: «البوسترات في اللستات حطّ تحتها خط الأخضر والأزرق
   * بحيث أعرف موجود عندي أو لا وهل شاهدته أو لا»).
   *
   * **كان `Record<string, boolean>` يجيب سؤالاً واحداً** («عندك؟»)
   * **لأن قارئَه كان زرَّ «+» وحدَه** (D-495). **والسؤالان الآن
   * أربعة** — وهي بعينها حقولُ `TitleState` التي يقرؤها كلُّ رفٍّ في
   * التطبيق (D-322). **ونداءُ `getLibState` هو النداءُ نفسُه**، **وما
   * كان يُرمى بعد قراءة `added` صار يُسلسَل كلُّه**: لا استعلامَ زائد.
   *
   * **يُحسب في الصفحة مرّةً للقائمة كلِّها ويُسلسَل** (D-205): **ولو
   * سأل كلُّ ملصقٍ عن نفسه لصارت القائمةُ خمسةَ عشرَ استعلاماً.**
   * **والغيابُ يعني نداءً سقط** — فلا خيطَ ولا زرّ (D-063).
   */
  libState?: Record<string, TitleState>;
  /** 🆕 رايةُ قائمة التشغيل (D-505) — الغيابُ يعني هجرةً لم تُشغَّل فلا صفّ */
  initialPlaylist?: boolean | null;
  /** 🆕 **عددُ من حفظها** (D-677) — لخانة ♥ في شريط الحال؛ الغيابُ صفر */
  saves?: number;
  /** 🆕 **رايةُ تشغيلي على المحفوظة** (D-674/١٤٩) — لغير المالك؛
      `null` = زائرٌ بلا حساب فلا مفتاح */
  initialSavedPlaylist?: boolean | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  /* حفظ القائمة مرجعاً حيّاً — متفائلٌ مع تراجُع (D-007) */
  const [saved, setSaved] = useState(initialSaved ?? false);
  const canSave = !isOwner && initialSaved !== undefined && initialSaved !== null;
  /* 🆕 رايةُ قائمة التشغيل (D-505) — متفائلةٌ مع تراجُع كالحفظ سواء.
     ⚖️ 🆕 **ولغير المالك رايتُه على صفِّ حفظه** (D-674/D-677): **حالةٌ
     واحدةٌ وكاتبان لأن المالكَ اثنان** — `setListPlaylist` لقائمتك
     و`setSavedListPlaylist` لمحفوظتك. */
  const [playlist, setPlaylist] = useState(
    isOwner ? !!initialPlaylist : !!initialSavedPlaylist,
  );
  function togglePlaylist() {
    const next = !playlist;
    tap(next ? [12, 30] : 8);
    setPlaylist(next);
    (isOwner ? setListPlaylist : setSavedListPlaylist)(listId, next)
      .then(() => toast(next ? t.listPlaylistOnToast : t.listPlaylistOffToast))
      .catch((err) => {
        setPlaylist(!next);
        flashError((err as Error).message);
      });
  }

  function toggleSave() {
    const next = !saved;
    tap(next ? [12, 30] : 8);
    setSaved(next);
    saveList(listId, next)
      /* رسالة الحفظ تحمل باب الوجهة (تدقيق 8 Aug م٣-١): «حفظت وما
         حصلتها» كان قابلية اكتشاف لا عطلاً — القسم يسكن أسفل /lists.
         الزر يأخذك إليه فلا تبحث (نمط زرّ «افتح» في D-074) */
      .then(() =>
        toast(
          next ? t.listSavedToast : t.listUnsavedToast,
          next
            ? {
                tone: "success",
                /* الوجهة تبويب الليستات في المكتبة — بيت القوائم المحفوظة
                   (طلب أحمد: المكتبة لا صفحة منفصلة) */
                action: { label: t.openMyLists, run: () => router.push("/library?filter=list") },
              }
            : undefined,
        ),
      )
      .catch((e) => {
        setSaved(!next);
        flashError((e as Error).message);
      });
  }
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<
    "menu" | "rename" | "type" | "reorder" | "delete" | "share" | "add" | "cover" | null
  >(null);
  /* الأعمال المضافة في هذه الجلسة تُرسم فوراً ثم يلحق `router.refresh()`:
     الانتظار كان سيجعل الورقة تُغلق على شبكةٍ لم تتغيّر، فيُقرأ الفعل
     فاشلاً (نفس منطق الترتيب المحليّ أعلاه). */
  const [added, setAdded] = useState<ListItem[]>([]);

  /* الترتيب المحليّ يسبق الخادم: بعد «تمّ» تتبدّل الأرقام في اللحظة نفسها،
     ثم يلحق `router.refresh()` بالتأكيد. الانتظار كان سيجعل أهم لحظةٍ في
     الميزة تبدو معطّلة نصف ثانية. */
  const [order, setOrder] = useState<string[] | null>(null);

  /* 🆕 **«أضف الكل»** (D-495) — **ولا حالةَ تفاؤليّةٍ هنا**: الفعلُ
     يمسّ خمسةَ عشرَ ملصقاً لا واحداً، **وقلبُها كلَّها قبل الجواب
     يجعل الفشلَ يتراجع عن خمسةَ عشرَ شيئاً أمام العين.** فالانتظارُ
     ظاهرٌ في الزرّ، **والتجديدُ بعده يقلب علاماتِ الملصقات من الحقيقة.** */
  const visible = useMemo(() => {
    const seen = new Set(items.map(keyOf));
    const live = [...items, ...added.filter((a) => !seen.has(keyOf(a)))].filter(
      (i) => !removed.has(keyOf(i)),
    );
    if (!order) return live;
    const rank = new Map(order.map((k, i) => [k, i]));
    return [...live].sort((a, b) => (rank.get(keyOf(a)) ?? 1e9) - (rank.get(keyOf(b)) ?? 1e9));
  }, [items, added, removed, order]);

  /* ⚖️ 🆕 **`startWatching` وزرُّها حُذفا** (D-681، حكمُ أحمد: «احذف
     ستارت واتشينغ») — **نقضٌ صريحٌ لـD-538 بيد صاحب تصميمها**: مفتاحُ
     التشغيل في شريط الحال (D-674) هو طريقُ «تابِع المشاهدة» الآن،
     وأزرارُ «+» على الملصقات باقيةٌ لعملٍ بعينه. */

  const numbered = NUMBERED.includes(kind);
  /* 🔑 **وصاحبُ القائمة الذكيّة مالكٌ لا محرّر** — **شرطٌ واحدٌ يُشتقّ
     منه كلُّ منعٍ** (D-145)، **ولا يُكتب `!smart` في ستّة مواضعَ تُنسى
     واحدةٌ منها.** */
  const canEditItems = isOwner && !smart;
  /* `w780` لا الأصل: الغلافُ يُرسم بعرض الصفحة على الجوال، والأصلُ ملفٌّ
     بحجم ثلاثة أضعافه لا تراه العين (نفس مقاس منتقي D-131) */
  const coverUrl = backdropUrl(cover?.backdrop ?? null, "w780");


  function remove(it: ListItem) {
    setRemoved((prev) => new Set(prev).add(keyOf(it)));
    start(async () => {
      try {
        await toggleInList({
          listId,
          tmdbId: it.tmdb_id,
          mediaType: it.media_type,
          title: it.title ?? "",
          posterPath: it.poster_path,
          add: false,
        });
        router.refresh();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  /**
   * إضافةُ عملٍ من داخل القائمة نفسها (D-167).
   *
   * **بلاغ أحمد:** «إضافة لستة ما تشتغل من قائمة اللستات بالمكتبة».
   * ولم يكن زرٌّ معطّلاً بل **باباً غير موجود**: القائمة الفارغة كانت
   * تقول «افتح أي عمل وأضفه من زر أضف لقائمة» — أي تُرسل صاحبها إلى
   * مكانٍ آخر ليفعل ما جاء ليفعله هنا.
   *
   * ولا فعلَ خادمٍ جديد: `toggleInList` هي نفسها التي يستدعيها زرّ صفحة
   * العمل، و`upsert` عندها يجعل الإضافة المكرّرة بلا أثر — فالرسالة
   * تفرّق بين «أُضيف» و«موجودٌ أصلاً» بما نعرفه محلياً لا بنداءٍ ثانٍ.
   */
  function addPicked(p: PickedTitle) {
    const key = `${p.kind}-${p.id}`;
    if (visible.some((i) => keyOf(i) === key)) {
      toast(t.listAlreadyIn, { tone: "info" });
      return;
    }
    tap([12, 30]);
    setAdded((prev) => [
      ...prev,
      {
        tmdb_id: p.id,
        media_type: p.kind,
        title: p.title,
        poster_path: p.posterPath,
        /* الصفّ المتفائل كاملُ الشكل لا مقولَبٌ بـ`as`: القالب كان
           سيُخفي أيّ حقلٍ يُضاف إلى `ListItem` غداً. والوقت في معالج
           حدثٍ لا في الرسم، فلا يمسّ نقاء التصيير (D-073). */
        added_at: new Date().toISOString(),
        sort_order: null,
      },
    ]);
    setRemoved((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    start(async () => {
      try {
        await toggleInList({
          listId,
          tmdbId: p.id,
          mediaType: p.kind,
          title: p.title,
          posterPath: p.posterPath,
          add: true,
        });
        toast(t.listAddedToast(p.title));
        router.refresh();
      } catch (e) {
        setAdded((prev) => prev.filter((i) => keyOf(i) !== key));
        flashError((e as Error).message);
      }
    });
  }

  /* الزرّ نفسه في موضعين — الترويسة وحالةُ الفراغ — فوصفتُه هنا مرّةً
     واحدة (قاعدة D-145) */
  const addButton = (
    <button
      type="button"
      onClick={() => {
        tap(8);
        setSheet("add");
      }}
      aria-haspopup="dialog"
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1.5 text-14 font-semibold text-[color:var(--on-accent)] hover:brightness-110 active:scale-95 transition"
    >
      <Icon name="plus" size={14} strokeWidth={2.2} />
      {t.listAddTitles}
    </button>
  );

  return (
    <div>
      {/* الغلاف فوق الاسم لا خلفه (D-208): نصٌّ فوق صورةٍ لا يملكها
          المصمّم يعني تباينَ لونٍ يتغيّر مع كل قائمة — والاسمُ أهمّ من
          أن يُقامر به. وحين لا غلاف لا يبقى فراغُه: العنصرُ غائبٌ أصلاً */}
      {coverUrl && (
        <div className="relative mb-4 -mx-1 aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden bg-surface-2 border border-[color:var(--background)]">
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 640px"
            priority
            className="object-cover"
          />
        </div>
      )}

      {/* ⚖️ 🆕 **ترويسةُ الصفحة بتصميم D-681**: رجوعٌ في الطرف،
          **الشعارُ وسطاً**، والمشاركةُ والنقاطُ في الطرف الآخر — وشريطُ
          التطبيق مخفيٌّ (`chromeRules`) **فترويسةٌ واحدةٌ لا اثنتان**
          (حجّةُ D-643 حرفاً). **وزرُّ «أضف أعمالاً» انتقل إلى قائمة
          النقاط** — الترويسةُ ترويسةُ اللقطة، **والبابُ باقٍ في القائمة
          وفي حالة الفراغ** (D-167 لا تُنقض: بابان قائمان). */}
      {/* 🔴 D-685: الصفُّ كان يبدأ من صفر الشاشة فركب شريطَ حالة iOS —
          **وموضعُ الترويسة يُشتقّ من `--safe-top` لا يُفترض** (قاعدة
          D-561، وهندسةُ `SettingsHeader` حرفاً: `-mt-6` تُبطل حشوةَ
          الصفحة ثم `--safe-top` يبني فوق النتوء) */}
      <div className="-mx-4 px-4 -mt-6 pt-[calc(var(--safe-top)+0.5rem)] pb-2 mb-2 flex items-center gap-2 min-h-11">
        <BackCrumb label={t.listsTitle} fallback="/library?filter=list" />
        <span className="flex-1 grid place-items-center" aria-hidden>
          {/* 🆕 **والشعارُ يتبع خطّةَ القارئ** (D-773ب): صاحبُ البلس
              والبارتنر يرى `Loopz+` هنا كما يراه في الشريط والرئيسيّة
              — **والعلامةُ لا تختلف من صفحةٍ إلى صفحة.** */}
          <Logo size={26} plus={brandPlus} />
        </span>
        {(isOwner || isPublic) && (
          <button
            type="button"
            onClick={() => {
              tap(8);
              setSheet("share");
            }}
            aria-label={t.listShare}
            title={t.listShare}
            aria-haspopup="dialog"
            className="shrink-0 -m-1 p-1 grid place-items-center"
          >
            <span className="grid place-items-center w-9 h-9 rounded-full border border-border bg-surface text-muted transition active:scale-95 hover:border-accent hover:text-foreground">
              <Icon name="share" size={16} />
            </span>
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              tap(8);
              setSheet("menu");
            }}
            aria-label={t.listMenu}
            aria-haspopup="dialog"
            className="shrink-0 -m-1 p-1 grid place-items-center"
          >
            <span className="grid place-items-center w-9 h-9 rounded-full border border-border bg-surface text-muted transition active:scale-95 hover:border-accent hover:text-foreground">
              <Icon name="dots" size={16} />
            </span>
          </button>
        )}
      </div>

      <h1 className="text-22 leading-tight font-bold break-words mb-1.5">{name}</h1>

      {/* الوصف امتدادٌ للاسم لا منافسٌ له: نصف وزنه ولونٌ خافت وسطران على
          الأكثر ثم قصّ. وحين لا وصف لا يبقى فراغه — لا هامش ولا عنصر أصلاً */}
      {subtitle && (
        <p className="mt-2 text-14 font-normal leading-snug text-muted line-clamp-2 max-w-[46ch]">
          {subtitle}
        </p>
      )}

      {/* 🆕 **وسطرٌ يقول لماذا لا يوجد زرُّ إضافة** (D-823 · D-063:
          الغيابُ يُكتب غياباً): **قائمةٌ بلا «أضف» وبلا تفسيرٍ تُقرأ
          معطوبةً** — **وهي مملوءةٌ بشرطها لا معطّلة.**
          **والرابطُ يفتح الشرطَ نفسَه في «اكتشف»**: **من أراد تعديله
          يعدّله حيث بُني** — **ولا ورقةَ فلاترَ ثانيةً بلغةٍ ثانية**
          (D-145). */}
      {smart && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-muted">
          <Icon name="sparkle-star" size={13} className="shrink-0 text-accent" />
          <span>
            {locale === "en"
              ? "Fills itself from the Loopz catalogue — nothing is added by hand."
              : "تمتلئ وحدَها من كتالوج Loopz — لا يُضاف إليها شيءٌ يدويّاً."}
          </span>
          <Link href={`/news?${smart}`} className="text-accent hover:opacity-80 transition">
            {locale === "en" ? "Open in Discover" : "افتحه في اكتشف"}
          </Link>
        </p>
      )}

      {/* نسبة القائمة إلى صاحبها: صفٌّ واحدٌ تحت الوصف يظهر لغير المالك
          وحده. من أخفى اسمه لا اسم له هنا ولا رابط — القرار محفوظٌ في
          SQL لا في هذا السطر (D-011) */}
      {/* 🆕 **وصفُّ الصاحب يحمل «أضف الكل» في طرفه** (D-495، طلبُ أحمد:
          «فوق في نفس سطر لوبز أقصى اليمين خيار أضف اللستة تو واتش»).
          **ولماذا هذا الصفّ لا صفُّ الأزرار فوقه**: ذاك صفُّ القائمة
          نفسِها (حفظٌ ومشاركة)، **وهذا فعلٌ على محتواها** — والفرقُ
          يُقرأ من الموضع قبل أن يُقرأ من الاسم.
          **والصفُّ يُرسم إن وُجد أحدُهما**: قائمةٌ بلا صاحبٍ ظاهر
          تحتفظ بزرّها، **وزرٌّ يختفي لأن اسماً غاب عطلٌ لا ترتيب.** */}
      {!isOwner && owner && (owner.nickname || owner.username) && (
        <div className="flex items-center gap-2 mt-3.5">
          {owner && (owner.nickname || owner.username) && (
            <>
              <span className="relative w-6 h-6 rounded-full overflow-hidden bg-surface-2 border border-border shrink-0">
                {owner.avatar ? (
                  <Image src={owner.avatar} alt="" fill sizes="24px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-muted">
                    <Icon name="people" size={12} />
                  </span>
                )}
              </span>
              {profileHref(owner) ? (
                <Link
                  href={profileHref(owner)!}
                  className="text-12 text-muted hover:text-foreground transition min-w-0 truncate"
                >
                  {owner.nickname || `@${owner.username}`}
                </Link>
              ) : (
                <span className="text-12 text-muted min-w-0 truncate">{owner.nickname}</span>
              )}
            </>
          )}

          {/* ⚖️ 🆕 **وزرُّ «ابدأ المشاهدة» حُذف** (D-681، حكمُ أحمد:
              «احذف ستارت واتشينغ») — **نقضٌ صريحٌ لـD-538/D-495 بيد
              صاحبهما**: مفتاحُ التشغيل في شريط الحال (D-674) صار
              الطريقَ إلى «تابِع المشاهدة»، وأزرارُ «+» على الملصقات
              باقيةٌ لمن أراد عملاً بعينه. */}
        </div>
      )}

      {/* ⚖️ 🆕 **صفُّ التعريف كلماتٍ لا رقائق** (D-677، تصميمُه:
          «🎬 15 titles · ☰ Watch order · 🌐 Public list»): رمزٌ وكلمةٌ
          لكلِّ صفة — **والرقاقةُ لبوسُ فعلٍ لا صفة** (D-217)، فبقيت
          لمفتاح العلانية وحدَه لأنه زرٌّ يقلبها.
          **ورقاقةُ التقييم غادرت إلى شريط الحال** (أدناه). */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-3.5 mb-4">
        <span className="inline-flex items-center gap-1.5 text-12 text-muted">
          <Icon name="film" size={14} className="text-accent" />
          {t.listCount(visible.length)}
        </span>
        {numbered && (
          <span className="inline-flex items-center gap-1.5 text-12 text-muted">
            <Icon name="list" size={14} className="text-accent" />
            {kind === "ranked" ? t.listTypeRanked : t.listTypeWatch}
          </span>
        )}
        {isOwner ? (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                try {
                  await renameList(listId, name, !isPublic);
                  router.refresh();
                } catch (e) {
                  flashError((e as Error).message);
                }
              })
            }
            disabled={pending}
            className={`text-12 px-2 py-0.5 rounded-full border transition disabled:opacity-50 ${
              isPublic
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/50"
            }`}
            title={t.listPublicHint}
          >
            {isPublic ? t.listPublic : t.listPrivate}
          </button>
        ) : (
          isPublic && (
            <span className="inline-flex items-center gap-1.5 text-12 text-muted">
              <Icon name="eye" size={14} className="text-accent" />
              {t.listOwnerOther}
            </span>
          )
        )}
      </div>


      {/* ⚖️ 🆕 **صفحةٌ واحدةٌ بلا تبويبات** (D-678، حكمُ أحمد على
          المنشور: «من الداخل سيء، نفّذه مثل التصميم بدون تبويب
          التعليقات — كلها في صفحة وحدة») — **نقضٌ صريحٌ لتبويبَي
          D-333 بيد صاحبهما**: الأعمالُ رفٌّ أفقيٌّ مرقَّمٌ كلقطته،
          **ثمّ شريطُ الحال، ثمّ الآراءُ تحتَه مباشرة.**
          ⚠️ **والرفُّ الأفقيُّ ثمنُه مُعلَن**: قائمةُ مئةِ عملٍ تُقرأ
          بالتمرير الأفقيِّ وحدَه — **وهو حكمُه بعد أن رأى الشبكةَ
          ورفضها.** */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-sm text-muted text-center">{t.listItemsEmpty}</p>
          {/* والبابُ في حالة الفراغ أيضاً: هنا يقف من لا يملك شيئاً
              يفعله غيرَ الإضافة — فالنصّ وحده كان يتركه واقفاً */}
          {canEditItems && addButton}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          {visible.map((it, i) => (
            <div key={keyOf(it)} className="w-[126px] sm:w-[150px] shrink-0 snap-start">
              <PosterTile
                item={it}
                n={numbered ? i + 1 : null}
                rating={ratings[keyOf(it)] ?? null}
                canRemove={canEditItems}
                onRemove={() => remove(it)}
                /* **زرُّ «+» على الملصق** (D-495): `undefined` تعني
                   «لا زرّ» — للزائر بلا حساب، **ولصاحب القائمة**
                   الذي تسكن زاويتُه علامةُ الإزالة (D-205). */
                quickAdd={
                  libState && !isOwner
                    ? { added: !!libState[keyOf(it)]?.added, locale }
                    : undefined
                }
                /* 🆕 **وخيطُ الحالة لصاحب القائمة أيضاً** (D-542) */
                state={libState?.[keyOf(it)]}
                t={t}
              />
            </div>
          ))}
        </div>
      )}

      {/* 🆕 **شريطُ الحال** (D-677/D-678، تصميمُه): ♥ عددُ الحفظ · 💬 عددُ
          الآراء · ★ المتوسّط · **ومفتاحُ التشغيل في طرفه** — **تشريحُ
          بطاقة القائمة نفسُه من الداخل** (`ListCardShell`)، فالخارجُ
          والداخلُ يقرآن واحداً. **والقلبُ هنا هو زرُّ الحفظ نفسُه**
          (D-324: القلبُ هو الحفظ) — **وعدُّه يتبع ضغطتك في مكانه.**
          ⚠️ **والمفتاحُ لمن يملك صفّاً يكتب فيه وحدَه** (D-217/D-674):
          المالكُ في صفِّ قائمته، والحافظُ في صفِّ حفظه — **وزائرٌ
          بلا حسابٍ يرى الأرقامَ ساكنة.** */}
      <div className="flex items-center gap-5 mt-4 mb-5 pb-4 border-b border-[color:var(--divider)] min-w-0">
        {canSave ? (
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            aria-label={saved ? t.listSavedBtn : t.listSaveBtn}
            title={saved ? t.listSavedBtn : t.listSaveBtn}
            className="flex items-center gap-2 text-15 font-bold tabular-nums transition active:scale-95"
            dir="ltr"
          >
            <Icon
              name={saved ? "heart-filled" : "heart"}
              size={19}
              className={`text-accent ${saved ? "fill-current" : ""}`}
            />
            {num(
              Math.max(0, (saves ?? 0) + (saved ? 1 : 0) - (initialSaved ? 1 : 0)),
              locale,
            )}
          </button>
        ) : (
          <span className="flex items-center gap-2 text-15 font-bold tabular-nums" dir="ltr">
            <Icon name="heart-filled" size={19} className="fill-current text-accent" />
            {num(saves ?? 0, locale)}
          </span>
        )}
        <span className="flex items-center gap-2 text-15 font-bold tabular-nums" dir="ltr">
          <Icon name="comment" size={18} className="text-accent" />
          {num(reviews?.count ?? 0, locale)}
        </span>
        <span className="flex items-center gap-2 text-15 font-bold tabular-nums min-w-0" dir="ltr">
          <Icon name="star" size={18} className="text-accent" />
          {num(reviews?.avg ?? 0, locale)}
          {(reviews?.count ?? 0) > 0 && (
            <span className="text-12 font-medium text-muted truncate">
              · {t.listReviewCount(num(reviews!.count, locale))}
            </span>
          )}
        </span>
        {(isOwner
          ? initialPlaylist !== null && initialPlaylist !== undefined
          : initialSavedPlaylist !== null && initialSavedPlaylist !== undefined && saved) &&
          visible.length > 0 && (
            /* 🆕 **مفتاحٌ بقرصٍ منزلق** (D-681، لقطتُه: «On ⬤——») —
               **الكلمةُ باقيةٌ** (D-142) والكاتبُ كاتبُ D-674 نفسُه. */
            <button
              type="button"
              onClick={togglePlaylist}
              aria-pressed={playlist}
              aria-label={t.listPlaylist}
              title={t.listPlaylist}
              className="ms-auto shrink-0 flex items-center gap-2 ps-4 border-s border-[color:var(--divider)] transition active:scale-95"
            >
              <span className={`text-14 font-bold ${playlist ? "" : "text-muted"}`}>
                {playlist ? t.toWatchOn : t.toWatchOff}
              </span>
              <span
                aria-hidden
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  playlist ? "bg-accent" : "bg-surface-2 border border-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full transition-transform ${
                    playlist
                      ? "bg-[color:var(--on-accent)] translate-x-5 rtl:-translate-x-5"
                      : "bg-[color:var(--divider)]"
                  }`}
                />
              </span>
            </button>
          )}
      </div>

      {/* **والآراءُ في القاع بلا تبويب** — `ListReviews` بعنوانه
          وصندوقِ كتابته كما هو، **والذي تبدّل بابُه لا جسدُه.** */}
      {reviewsSlot && <div className="mt-2">{reviewsSlot}</div>}

      {sheet === "add" && (
        <TitleSearchSheet
          locale={locale}
          onClose={() => setSheet(null)}
          onPick={(p) => {
            addPicked(p);
            setSheet(null);
          }}
        />
      )}

      {sheet === "menu" && (
        <Sheet open onClose={() => setSheet(null)} closeLabel={t.closeLabel} labelledBy="list-menu-title">
          <SheetHeader
            id="list-menu-title"
            title={name}
            closeLabel={t.closeLabel}
            onClose={() => setSheet(null)}
          >
            <p className="text-xs text-muted mt-0.5">{t.listCount(visible.length)}</p>
          </SheetHeader>
          {/* «عدّل القائمة» لا «غيّر الاسم»: الورقة تحمل الاسم والوصف معاً،
              فهما هويّة القائمة الواحدة — وصفٌّ لكلٍّ منهما بابان إلى ورقةٍ
              واحدة */}
          {/* 🆕 **«أضف أعمالاً» أوّلَ القائمة** (D-681) — غادر الترويسةَ
              مع تصميمها، **والبابُ لا يُغلق**: هنا وفي حالة الفراغ. */}
          {canEditItems && (
            <MenuRow icon="plus" label={t.listAddTitles} onClick={() => setSheet("add")} />
          )}
          <MenuRow icon="edit" label={t.listEditTitle} onClick={() => setSheet("rename")} />
          {/* مشاركة القائمة — في المجتمع (تظهر في ملفّك العام) أو خارج
              التطبيق (رابط). بابٌ واحد لكل فعل، فمكانها هنا لا على البطاقة */}
          <MenuRow icon="share" label={t.listShare} onClick={() => setSheet("share")} />
          {/* غلافُ القائمة (D-208): بابٌ واحد لفعلٍ واحد — من قائمة النقاط
              لا من البطاقة، كما التسميةُ والنوعُ والحذف */}
          <MenuRow
            icon="image"
            label={t.listCover}
            value={cover?.backdrop ? t.listCoverSet : undefined}
            onClick={() => setSheet("cover")}
          />
          {/* ⚠️ **ولا تبديلَ نوعٍ لقائمةٍ ذكيّة**: **الأنواعُ الثلاثةُ
              في الورقة لا تشمل `smart`** — **فصفٌّ يقول «عاديّة» عن
              قائمةٍ ليست كذلك يكذب، وضغطُه يمحو شرطَها** (D-217). */}
          {!smart && (
            <MenuRow
              icon="list"
              label={t.listType}
              value={
                kind === "ranked"
                  ? t.listTypeRanked
                  : kind === "watch_order"
                    ? t.listTypeWatch
                    : t.listTypeRegular
              }
              onClick={() => setSheet("type")}
            />
          )}
          {/* «أعد الترتيب» لا يظهر على قائمةٍ عادية: صفٌّ يفتح وضعاً بلا أثرٍ
              مرئيّ هو وعدٌ كاذب — ومن أراده غيّر النوع أوّلاً */}
          {numbered && !smart && visible.length > 1 && (
            <MenuRow icon="grip" label={t.listReorder} onClick={() => setSheet("reorder")} />
          )}
          {/* 🆕 **قائمةُ التشغيل** (D-505): تُعرض في «تابِع المشاهدة»
              وكلُّ صحٍّ على فيلمٍ يقلبها إلى الذي بعده. **الصفُّ يظهر
              فقط حين وصلت الرايةُ من الخادم** — غيابُها يعني هجرةً لم
              تُشغَّل، **وصفٌّ يَعِد بما لا تحفظه القاعدة وعدٌ كاذب**
              (D-217/D-462). والفعلُ يقلب فوراً ويغلق الورقةَ بلا
              تأكيدٍ ثانٍ — راية، لا عمليّة. */}
          {/* 🔴 🆕 **ولا مفتاحَ تشغيلٍ لقائمةٍ ذكيّة** (D-823 · وجدتُه في
              القياس الحيِّ بعد النشر): **طابورُ «تابِع المشاهدة» يقرأ
              `user_list_items`** — **ولا صفَّ للقائمة الذكيّة فيه** —
              **فالرايةُ تُرفع ولا يظهر شيء.** **وشرطُ `visible.length`
              يمرّ لأنّ الستّين محسوبةٌ في الصفحة لا مخزَّنةٌ في
              القاعدة** — **وهو بالضبط ما جعل الحارسَ القديم أعمى.**
              ⚖️ **والحلُّ منعٌ لا حسابٌ في الطابور**: **الطابورُ يُقرأ
              في الرئيسيّة** — **ونداءُ TMDB لكلِّ قائمةٍ ذكيّةٍ هناك
              مسارٌ حرجٌ يُدفع ثمنُه في كلِّ فتحة** (D-515). */}
          {!smart && initialPlaylist !== undefined && initialPlaylist !== null && visible.length > 0 && (
            <MenuRow
              icon="play"
              label={t.listPlaylist}
              value={playlist ? t.listPlaylistOnState : undefined}
              onClick={() => {
                togglePlaylist();
                setSheet(null);
              }}
            />
          )}
          <MenuRow icon="trash" label={t.listDeleteThis} danger onClick={() => setSheet("delete")} />
        </Sheet>
      )}

      {sheet === "cover" && (
        <ListCoverSheet
          listId={listId}
          /* الأعمالُ المرئية لا الأصلية: من حذف عملاً قبل قليل لا يُعرض
             عليه غلافٌ من عملٍ لم يعد في قائمته */
          items={visible}
          current={{
            tmdbId: cover?.tmdbId ?? null,
            mediaType: cover?.mediaType ?? null,
            backdrop: cover?.backdrop ?? null,
          }}
          locale={locale}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "share" && (
        <ShareListSheet
          listId={listId}
          name={name}
          isPublic={isPublic}
          locale={locale}
          onClose={() => setSheet(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {sheet === "rename" && (
        <RenameSheet
          listId={listId}
          name={name}
          subtitle={subtitle}
          isPublic={isPublic}
          t={t}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      )}

      {sheet === "type" && (
        <Sheet open onClose={() => setSheet(null)} closeLabel={t.closeLabel} labelledBy="list-type-title">
          <SheetHeader
            id="list-type-title"
            title={t.listType}
            closeLabel={t.closeLabel}
            onClose={() => setSheet(null)}
          />
          {(
            [
              { id: "regular", label: t.listTypeRegular, hint: t.listTypeRegularHint, icon: "grid" },
              { id: "ranked", label: t.listTypeRanked, hint: t.listTypeRankedHint, icon: "chart" },
              { id: "watch_order", label: t.listTypeWatch, hint: t.listTypeWatchHint, icon: "play" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              onClick={() => {
                tap(8);
                setSheet(null);
                start(async () => {
                  try {
                    await setListKind(listId, o.id);
                    router.refresh();
                  } catch (e) {
                    flashError((e as Error).message);
                  }
                });
              }}
              className="flex items-center gap-3 w-full text-start px-5 py-3.5 border-t border-[color:var(--divider)] first-of-type:border-t-0 transition active:bg-surface-2 disabled:opacity-40"
            >
              <Icon
                name={o.icon}
                size={20}
                className={`shrink-0 ${kind === o.id ? "text-accent" : "text-muted"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-12 text-muted mt-0.5 leading-snug">{o.hint}</span>
              </span>
              {kind === o.id && (
                <Icon name="check" size={18} className="shrink-0 text-accent" strokeWidth={2.4} />
              )}
            </button>
          ))}
        </Sheet>
      )}

      {sheet === "reorder" && (
        <ReorderSheet
          items={visible}
          t={t}
          onClose={() => setSheet(null)}
          onDone={(keys) => {
            setOrder(keys);
            setSheet(null);
            start(async () => {
              try {
                await reorderList(listId, keys);
                router.refresh();
              } catch (e) {
                flashError((e as Error).message);
              }
            });
          }}
        />
      )}

      {sheet === "delete" && (
        <Sheet
          open
          variant="center"
          onClose={() => setSheet(null)}
          closeLabel={t.closeLabel}
          labelledBy="list-del-title"
        >
          <div className="p-5">
            <h3 id="list-del-title" className="text-15 font-bold mb-1.5">
              {t.listDeleteThis}
            </h3>
            <p className="text-12 text-muted leading-relaxed mb-5">{t.listDeleteBody}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSheet(null)}
                className={buttonClass({ variant: "ghost", size: "sm", className: "flex-1" })}
              >
                {t.listCancel}
              </button>
              {/* الحذف يستعمل صيغة `danger` من مصنع الأزرار الواحد (D-017)
                  لا زرّاً أحمر مكتوباً باليد */}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      await deleteList(listId);
                      router.replace("/library?filter=list");
                    } catch (e) {
                      flashError((e as Error).message);
                    }
                  })
                }
                className={buttonClass({ variant: "danger", size: "sm", className: "flex-1" })}
              >
                {t.listDeleteYes}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** صفٌّ في قائمة الأفعال — نفس مقاسات لوح الإجراءات السريعة في المكتبة */
// ShareListSheet انتقل إلى مكوّنٍ مستقل ليُستعمل من صفحة «قوائمي» أيضاً (D-053)

function MenuRow({
  icon,
  label,
  value,
  danger = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full text-start px-5 py-3.5 text-sm font-semibold border-t border-[color:var(--divider)] first-of-type:border-t-0 transition active:bg-surface-2"
    >
      <Icon
        name={icon}
        size={20}
        className={`shrink-0 ${danger ? "text-[color:var(--error)]" : "text-accent"}`}
      />
      <span className={`flex-1 min-w-0 truncate ${danger ? "text-[color:var(--error)]" : ""}`}>
        {label}
      </span>
      {value && <span className="shrink-0 text-12 font-normal text-muted">{value}</span>}
    </button>
  );
}

/** تغيير الاسم — ورقةٌ علوية لأنّ فيها حقلاً يُكتب فيه (D-018) */
function RenameSheet({
  listId,
  name,
  subtitle,
  isPublic,
  t,
  onClose,
  onSaved,
}: {
  listId: string;
  name: string;
  subtitle: string | null;
  isPublic: boolean;
  t: Dict;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [sub, setSub] = useState(subtitle ?? "");
  const [pending, start] = useTransition();

  const dirty = draft.trim() !== name || sub.trim() !== (subtitle ?? "");

  function save() {
    const clean = draft.trim();
    if (!clean) return;
    if (!dirty) return onClose();
    start(async () => {
      try {
        await renameList(listId, clean, isPublic, sub);
        onSaved();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const field =
    "w-full rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition";

  return (
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-rn-title">
      <SheetHeader
        id="list-rn-title"
        title={t.listEditTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />
      <div className="p-5 space-y-3">
        {/* ١٦ بكسل لا أصغر في كل حقل: سفاري iOS يكبّر الصفحة عند التركيز
            على أي حقلٍ أصغر ولا يتراجع عن التكبير (D-033) */}
        <label className="block">
          <span className="block text-12 font-semibold text-muted mb-1.5">{t.listNameLabel}</span>
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className={field}
          />
        </label>

        <label className="block">
          <span className="block text-12 font-semibold text-muted mb-1.5">
            {t.listSubtitleLabel}
          </span>
          {/* سطرٌ واحد لا منطقة نصّ: السقف ١٢٠ حرفاً وجملةٌ واحدة، ومنطقة
              النصّ تدعو إلى فقرة ثم تُقصّ عند العرض */}
          <input
            value={sub}
            maxLength={120}
            placeholder={t.listSubtitlePlaceholder}
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className={field}
          />
          <span className="block text-12 text-muted/70 mt-1 tabular-nums" dir="ltr">
            {sub.length}/120
          </span>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={pending || !draft.trim()}
          className={buttonClass({ size: "sm", full: true })}
        >
          {t.listSave}
        </button>
      </div>
    </Sheet>
  );
}

/* ارتفاع الصفّ ثابتٌ عمداً: حساب موضع الإفلات قسمةٌ على هذا الرقم، وصفوفٌ
   متفاوتة الارتفاع تعني رياضياتٍ تقريبية تُخطئ الهدف بصفٍّ كامل */
/**
 * ملصقٌ في شبكة القائمة.
 *
 * الرقم والتقييم معلومتان مستقلّتان تماماً ولا يجوز أن تُقرآ واحدة: الرقم
 * ترتيبُ مشاهدةٍ أو مرتبة، والتقييم رأيُ صاحب الحساب. ولذلك اختلفا شكلاً
 * قبل أن يختلفا موضعاً — الرقم رقمٌ عارٍ بلون الهوية بلا إطارٍ ولا خلفية،
 * والتقييم قرصٌ أسود صغير بنجمة، وهو فوقه لا بجانبه.
 *
 * الحجاب السفليّ الخفيف على الصورة (لا على الرقم) هو ما يجعل الأصفر مقروءاً
 * فوق ملصقٍ فاتح: #FFD200 على أبيض نسبتُه ١٫٥:١ — أي غير مقروء. هو نفس
 * الحلّ المستعمل في بطاقة الملصق منذ البداية (D-004)، لا شارةً ولا ظلّاً.
 */
function PosterTile({
  item,
  n,
  rating,
  canRemove,
  onRemove,
  quickAdd,
  state,
  t,
}: {
  item: ListItem;
  n: number | null;
  rating: number | null;
  canRemove: boolean;
  onRemove: () => void;
  /** 🆕 D-495 — حالةُ الإضافة ولغةُ القارئ؛ الغيابُ يعني لا زرّ */
  quickAdd?: { added: boolean; locale: Locale };
  /** 🆕 D-542 — حالُ العمل عندك؛ الغيابُ يعني لا خيط */
  state?: TitleState;
  t: Dict;
}) {
  const url = posterUrl(item.poster_path, "w342");
  const href = item.media_type === "movie" ? `/movie/${item.tmdb_id}` : `/show/${item.tmdb_id}`;

  return (
    <div className="relative group">
      <Link href={href} prefetch={false} className="block">
        <div className="relative aspect-[2/3] rounded-poster overflow-hidden bg-surface-2 border border-border">
          {url ? (
            <Image
              src={url}
              alt={item.title ?? ""}
              fill
              sizes="(max-width: 640px) 33vw, 140px"
              className="object-cover transition duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={item.media_type === "movie" ? "film" : "tv"} size={20} />
            </span>
          )}

          {(n !== null || rating !== null) && (
            <>
              <div
                className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)" }}
              />
              <div className="absolute bottom-1.5 start-1.5 flex flex-col items-start gap-1 pointer-events-none">
                {rating !== null && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums leading-none"
                    dir="ltr"
                  >
                    <Icon
                      name="star"
                      size={10}
                      strokeWidth={2.4}
                      className="text-[color:var(--verified)]"
                    />
                    {rating}
                  </span>
                )}
                {n !== null && (
                  /* `key` على القيمة: تغيّرُ الرقم يعيد تركيب العنصر فتعمل
                     قفزةُ `check-pop` — الأرقام تتبدّل بعد الترتيب فتُرى */
                  <span
                    key={n}
                    className="check-pop block text-accent font-extrabold leading-none tabular-nums text-[26px] sm:text-[30px]"
                    dir="ltr"
                  >
                    {n}
                  </span>
                )}
              </div>
            </>
          )}

          {/* ===== 🆕 خيطُ الحالة تحت الملصق (D-542) =====

              **طلبُ أحمد: «خط الأخضر والأزرق — موجود عندي أو لا، وهل
              شاهدته أو لا».** **وهو خيطٌ مبنيٌّ منذ D-229 ومستخرَجٌ
              منذ D-322**، يرسمه كلُّ رفٍّ في المكتبة واكتشف —
              **والذي كان ناقصاً أنّ شبكةَ القائمة لا تعرف ما تعرفه
              المكتبة**: كانت تُمرَّر بولياناً واحداً («عندك؟») لأجل
              زرِّ «+» وحدَه.

              **ولا وصفةَ ثانية**: `StatusThread` حرفاً — **سماويٌّ
              عندك، وأخضرُ انتهيت، وأصفرُ بمقدار ما شاهدت، وأحمرُ
              موقوف** (القاعدة ٣: لونُ نجاحٍ واحد، ولا عائلةَ ألوانٍ
              ثانية). **وطلبُه لونان لأن سؤالَيه اثنان** — **والخيطُ
              يجيبهما ويزيد**، بلا استعلامٍ زائد.

              ⚠️ **وبلا `inset`**: هذا الصندوقُ `overflow-hidden`
              بحوافِّه أصلاً فيقصُّ الخيطَ بنفسه (D-238). ===== */}
          {state && (
            <StatusThread
              saved={state.added}
              watched={state.watched}
              progress={state.progress}
              dropped={state.dropped}
            />
          )}
        </div>
        <p className="mt-1.5 text-12 leading-tight line-clamp-2">
          {item.title ?? `#${item.tmdb_id}`}
        </p>
      </Link>

      {/* 🆕 **خارج الرابط** (D-155/D-347): زرٌّ داخل رابطٍ عطلٌ يمسكه
          `button.closest('a')` — و`QuickAdd` مطلقُ الموضع فيجلس فوق
          الملصق بلا أن يسكن رابطَه. */}
      {quickAdd && (
        <QuickAdd
          tmdbId={item.tmdb_id}
          mediaType={item.media_type}
          title={item.title ?? ""}
          posterPath={item.poster_path}
          added={quickAdd.added}
          locale={quickAdd.locale}
        />
      )}

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.listRemove}
          /* ظاهرٌ دائماً لا عند التمرير: الجوال لا يعرف hover، وإخفاؤه
             خلفه كان سيمحو الإزالة من الجهاز الذي تُستعمل فيه أكثر */
          /* ظاهرٌ دائماً (الجوال لا يعرف hover) لكن خافتٌ عمداً: ستّ بطاقات
             بستّ علاماتٍ صارخة تنافس أرقام الترتيب على أول ما تقع عليه
             العين. الهدف ٣٢ بكسلاً واللمس عليه، والدائرة ٢٠ */
          className="absolute top-1 end-1 grid place-items-center w-8 h-8 text-white/60 transition active:scale-90 hover:text-white"
        >
          <span className="grid place-items-center w-5 h-5 rounded-full bg-black/55 backdrop-blur-sm">
            <Icon name="close" size={11} strokeWidth={2.2} />
          </span>
        </button>
      )}
    </div>
  );
}
