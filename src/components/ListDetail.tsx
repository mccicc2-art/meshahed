"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteList,
  renameList,
  reorderList,
  setListKind,
  setListPlaylist,
  toggleInList,
  saveList,
  followListTitles,
} from "@/lib/actions";
import { backdropUrl, posterUrl } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { getDict, num, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import type { ListItem, ListKind } from "@/lib/data";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { DetailTabs } from "./DetailTabs";
import { buttonClass } from "./ui/Button";
import { QuickAdd } from "./QuickAdd";
import { sheetScroll } from "./ui/controls";
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

const keyOf = (i: ListItem) => `${i.media_type}-${i.tmdb_id}`;
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
  listId,
  name,
  subtitle,
  isPublic,
  kind,
  items,
  ratings,
  isOwner,
  owner,
  locale,
  initialSaved,
  cover,
  reviews,
  reviewsSlot,
  inLibrary,
  initialPlaylist,
}: {
  listId: string;
  name: string;
  subtitle: string | null;
  isPublic: boolean;
  kind: ListKind;
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
  owner?: { nickname: string | null; username: string | null; avatar: string | null } | null;
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
   * 🆕 **ما في مكتبتك من هذه القائمة** (D-495) — `"tv-123"` → `true`.
   * **يُحسب في الصفحة مرّةً للقائمة كلِّها ويُسلسَل** (D-205): **ولو
   * سأل كلُّ ملصقٍ عن نفسه لصارت القائمةُ خمسةَ عشرَ استعلاماً.**
   * **والغيابُ يعني زائراً بلا حساب** — فلا زرَّ إضافةٍ أصلاً.
   */
  inLibrary?: Record<string, boolean>;
  /** 🆕 رايةُ قائمة التشغيل (D-505) — الغيابُ يعني هجرةً لم تُشغَّل فلا صفّ */
  initialPlaylist?: boolean | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  /* حفظ القائمة مرجعاً حيّاً — متفائلٌ مع تراجُع (D-007) */
  const [saved, setSaved] = useState(initialSaved ?? false);
  const canSave = !isOwner && initialSaved !== undefined && initialSaved !== null;
  /* 🆕 رايةُ قائمة التشغيل (D-505) — متفائلةٌ مع تراجُع كالحفظ سواء */
  const [playlist, setPlaylist] = useState(!!initialPlaylist);

  function togglePlaylist() {
    const next = !playlist;
    tap(next ? [12, 30] : 8);
    setPlaylist(next);
    setListPlaylist(listId, next)
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
  const [addingAll, setAddingAll] = useState(false);
  const visible = useMemo(() => {
    const seen = new Set(items.map(keyOf));
    const live = [...items, ...added.filter((a) => !seen.has(keyOf(a)))].filter(
      (i) => !removed.has(keyOf(i)),
    );
    if (!order) return live;
    const rank = new Map(order.map((k, i) => [k, i]));
    return [...live].sort((a, b) => (rank.get(keyOf(a)) ?? 1e9) - (rank.get(keyOf(b)) ?? 1e9));
  }, [items, added, removed, order]);

  /**
   * ⚖️ 🆕 **«ابدأ المشاهدة» — وهي «أضف الكل» وقد أُتمّت** (D-538، تصميمُ
   * أحمد: «يضيف القائمة بالترتيب إلى متابعة المشاهدة كقائمة تشغيل،
   * ويبدأ من أول عنوان»).
   *
   * **ولماذا حلّت محلَّها ولم تُضَف بجانبها:** الفعلُ هو الفعلُ نفسُه
   * (‏`followListTitles` — تتبع أعمالَ القائمة كلَّها وتحفظها فتدخل
   * «تابِع المشاهدة»)، **والذي يزيد خطوةٌ أخيرة: يفتح أوّلَ عنوان.**
   * **وزرّان يفعلان الشيءَ نفسَه إلا خطوةً بابان لفعلٍ واحد** (القاعدة
   * ٦) — **ومن أراد الإضافةَ بلا فتحٍ يرجع بزرِّ الرجوع.**
   *
   * ⚠️ **والفتحُ بعد نجاح الإضافة لا قبله** (D-158): من غادر الصفحةَ
   * ثمّ فشلت الكتابةُ لا يرى الخطأ أصلاً. **والانتقالُ يقع حتى لو كانت
   * كلُّها عنده أصلاً** (`n = 0`) — **الطلبُ «ابدأ»، والبدءُ لا يشترط
   * أن يُضاف شيء.**
   */
  function startWatching() {
    if (addingAll) return;
    const first = visible[0];
    tap(10);
    setAddingAll(true);
    followListTitles(listId)
      .then((n) => {
        if (n > 0) {
          setSaved(true);
          toast(t.listAddAllDone(n), { tone: "success" });
        }
        if (first) {
          router.push(`/${first.media_type === "tv" ? "show" : "movie"}/${first.tmdb_id}`);
        } else {
          router.refresh();
        }
      })
      .catch((e) => flashError((e as Error).message))
      .finally(() => setAddingAll(false));
  }


  const numbered = NUMBERED.includes(kind);
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

      {/* الترويسة: الاسم يملأ السطر وزرّ الخيارات وحده على الطرف — كان
          القلم يزاحم الاسم على شاشةٍ ضيّقة فيقصّه بلا داعٍ */}
      <div className="flex items-start gap-3 mb-1.5">
        <h1 className="flex-1 min-w-0 text-22 leading-tight font-bold break-words">{name}</h1>
        {/* «أضِفها إلى قوائمي» مكانَ نقاط المالك: مرجعٌ حيٌّ إلى قائمة
            صاحبها — تعديلاتُه تنعكس عندك لأنها القائمة نفسها (D-068) */}
        {canSave && (
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-14 font-semibold transition active:scale-95 ${
              saved
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-accent bg-accent text-[color:var(--on-accent)] hover:brightness-110"
            }`}
          >
            {/* 🆕 **القلبُ هو الحفظ — لا فعلَ ثانٍ** (D-324، قرارُ أحمد بعد
                عرضِ البديل): `list_saves` هو حرفيّاً «تعجبني وأريدها»،
                **وقلبٌ ثانٍ بجانبه رمزان لمعنًى واحد** — وهو ما تمنعه
                D-294 («رمزٌ واحدٌ لفعلٍ واحد»). **فتبدّل الرمزُ ولم يُبنَ
                جدولٌ ولا عدّادٌ ثانٍ**، والممتلئُ يقول «عندك» كما في كلِّ
                سطحٍ آخر (وصفةُ `LikeButton` حرفاً). */}
            <Icon
              name={saved ? "heart-filled" : "heart"}
              size={14}
              strokeWidth={2.2}
              className={saved ? "fill-current" : undefined}
            />
            {saved ? t.listSavedBtn : t.listSaveBtn}
          </button>
        )}
        {/* «أضِف أعمالاً» قبل النقاط لا داخلها: إضافةُ عملٍ هي الفعل الأوّل
            في قائمةٍ تملكها، ودفنُه في قائمةٍ يفتحها زرٌّ آخر هو بالضبط
            العطل الذي بلّغ عنه أحمد (D-167). */}
        {/* ⚖️ 🆕 **وسقط دبّوسُ لوبز مع رفِّه** (D-386، طلبُ أحمد: «احذف
            Picked by Loopz»): **زرٌّ يضع القائمةَ في صفٍّ لم يعد يُرسم
            وعدٌ بلا مكان** — **وزرٌّ لا أثرَ له أسوأُ من غيابه** (D-346
            حرفاً). **وحُجّةُ D-349 لم تسقط** (القرارُ يُتَّخذ حيث يُقرأ
            الشيء) — **سقط الصفُّ الذي كان الزرُّ يكتب إليه.**
            ⚠️ **والجدولُ ودالّتاه باقيةٌ في القاعدة** بلا قارئ — **دَينٌ
            معلَنٌ في `05` يُحذف في دفعته** (D-214). */}
        {isOwner && addButton}
        {isOwner && (
          /* هدف لمسٍ ٤٤×٤٤ كاملاً وإن بدت الدائرة ٣٦: أصغر من ذلك يُخطئه
             الإبهام — وهو المقاس الذي توصي به آبل ولا نجادل فيه */
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
        {/* 🔴 🆕 **وللزائر زرُّ مشاركة** (D-426، بلاغُ أحمد: «ما فيه زر
            مشاركة للسته إذا فتحت اللستة»).
            **والقائمةُ التي تُفتح للناس هي أوّلُ ما يُشارَك** — **وبابُ
            المشاركة كان محبوساً في قائمة النقاط، والنقاطُ للمالك وحدَه**
            (السطرُ فوقَه)، **فمن فتح قائمةَ غيره لم يجد للرابط بابا.**
            ⚠️ **ولا ورقةَ ثانيةً**: `ShareListSheet` نفسُها بمقاسها
            (D-002/قاعدة ٣) — **وفعلُ «اجعلها معلنة» داخلَها لا يُرسم
            لمعلنةٍ أصلاً**، **وغيرُ المالك لا يبلغ إلّا معلنة.** */}
        {!isOwner && isPublic && (
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
      </div>

      {/* الوصف امتدادٌ للاسم لا منافسٌ له: نصف وزنه ولونٌ خافت وسطران على
          الأكثر ثم قصّ. وحين لا وصف لا يبقى فراغه — لا هامش ولا عنصر أصلاً */}
      {subtitle && (
        <p className="mt-2 text-14 font-normal leading-snug text-muted line-clamp-2 max-w-[46ch]">
          {subtitle}
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
      {!isOwner && ((owner && (owner.nickname || owner.username)) || !!inLibrary) && (
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
              {owner.username ? (
                <Link
                  href={`/u/${owner.username}`}
                  className="text-12 text-muted hover:text-foreground transition min-w-0 truncate"
                >
                  {owner.nickname || `@${owner.username}`}
                </Link>
              ) : (
                <span className="text-12 text-muted min-w-0 truncate">{owner.nickname}</span>
              )}
            </>
          )}

          {inLibrary && (
            /* ⚖️ 🆕 **زرٌّ ممتلئٌ محلَّ الرقاقة المفرَّغة** (D-538): **هو
               الفعلُ الذي جاء القارئُ لأجله** في قائمةٍ بترتيبِ مشاهدة —
               **والمفرَّغُ يُقرأ خياراً ثانوياً** (D-217). **وms-auto لا
               `justify-between`**: الصفُّ قد يخلو من اسم. */
            <button
              type="button"
              onClick={startWatching}
              disabled={addingAll}
              aria-label={t.listStartWatchingAria}
              title={t.listStartWatchingAria}
              className={buttonClass({
                size: "sm",
                className: "ms-auto shrink-0 disabled:opacity-60",
              })}
            >
              <Icon name="play" size={15} strokeWidth={2} />
              {t.listStartWatching}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-3.5 mb-5">
        <span className="text-xs text-muted">{t.listCount(visible.length)}</span>
        {numbered && (
          <span className="text-12 px-2 py-0.5 rounded-full border border-accent/40 text-accent">
            {kind === "ranked" ? t.listTypeRanked : t.listTypeWatch}
          </span>
        )}
        {/* 🆕 **رقمُ التقييم في الرأس** (D-332→D-333). كان مرساةً تقفز
            إلى القاع، **وصار القسمُ تبويباً على بُعد نظرة** (طلبُ أحمد:
            «شي يشبه صفحة العمل») — فبقي الرقمُ هنا هويّةً كما IMDb في
            ترويسة الفيلم، **وسقط الرابطُ لأن البابَ صار تحته مباشرة**.
            **ورقمٌ صفرٌ لا يُطبع** (D-219): تبويبُ التقييمات نفسُه هو
            الدعوة. */}
        {reviews && reviews.count > 0 && (
          <span className="text-12 px-2 py-0.5 rounded-full border border-border inline-flex items-center gap-1 tabular-nums">
            <Icon name="star" size={11} className="text-accent" />
            {reviews.avg !== null && <span dir="ltr">{num(reviews.avg, locale)}</span>}
            <span className="text-muted">{t.listReviewCount(num(reviews.count, locale))}</span>
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
          <span className="text-12 px-2 py-0.5 rounded-full border border-border text-muted">
            {t.listOwnerOther}
          </span>
        )}
      </div>

      {/* 🆕 **تبويبان كصفحة العمل** (D-333، طلبُ أحمد بنصّه: «لا أبغاها
          شي يشبه صفحة العمل — تبويب قائمة الأفلام وتبويب التعليقات»).
          **والوصفةُ `DetailTabs` حرفاً لا نسخةٌ منها** (D-145): نفسُ
          الشريط الملتصق ونفسُ الأسهم ونفسُ الرسم المسبق المخفيّ بـCSS —
          فتعليقٌ نصفُ مكتوبٍ في تبويبه لا يضيع بالتبديل.
          ⚠️ **وبلا قسمِ تقييماتٍ لا تبويبات أصلاً** (قائمةٌ خاصّة أو
          زائر): شريطُ تبويبٍ واحدٍ سؤالٌ بلا خيار (D-181). */}
      {(() => {
        const itemsPanel =
          visible.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="text-sm text-muted text-center">{t.listItemsEmpty}</p>
              {/* والبابُ في حالة الفراغ أيضاً: هنا يقف من لا يملك شيئاً
                  يفعله غيرَ الإضافة — فالنصّ وحده كان يتركه واقفاً */}
              {isOwner && addButton}
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(102px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(136px,1fr))]">
              {visible.map((it, i) => (
                <PosterTile
                  key={keyOf(it)}
                  item={it}
                  n={numbered ? i + 1 : null}
                  rating={ratings[keyOf(it)] ?? null}
                  canRemove={isOwner}
                  onRemove={() => remove(it)}
                  /* **زرُّ «+» على الملصق** (D-495): `undefined` تعني
                     «لا زرّ» — للزائر بلا حساب، **ولصاحب القائمة**
                     الذي تسكن زاويتُه علامةُ الإزالة (زرّان في زاويةٍ
                     واحدة يجعلان الملصقَ لوحةَ أزرار — D-205). */
                  quickAdd={
                    inLibrary && !isOwner
                      ? { added: !!inLibrary[keyOf(it)], locale }
                      : undefined
                  }
                  t={t}
                />
              ))}
            </div>
          );
        return reviewsSlot ? (
          <DetailTabs
            tabs={[
              { key: "items", label: t.searchModeTitles, icon: "grid", content: itemsPanel },
              { key: "reviews", label: t.listReviewsTitle, icon: "star", content: reviewsSlot },
            ]}
          />
        ) : (
          itemsPanel
        );
      })()}

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
          {/* «أعد الترتيب» لا يظهر على قائمةٍ عادية: صفٌّ يفتح وضعاً بلا أثرٍ
              مرئيّ هو وعدٌ كاذب — ومن أراده غيّر النوع أوّلاً */}
          {numbered && visible.length > 1 && (
            <MenuRow icon="grip" label={t.listReorder} onClick={() => setSheet("reorder")} />
          )}
          {/* 🆕 **قائمةُ التشغيل** (D-505): تُعرض في «تابِع المشاهدة»
              وكلُّ صحٍّ على فيلمٍ يقلبها إلى الذي بعده. **الصفُّ يظهر
              فقط حين وصلت الرايةُ من الخادم** — غيابُها يعني هجرةً لم
              تُشغَّل، **وصفٌّ يَعِد بما لا تحفظه القاعدة وعدٌ كاذب**
              (D-217/D-462). والفعلُ يقلب فوراً ويغلق الورقةَ بلا
              تأكيدٍ ثانٍ — راية، لا عمليّة. */}
          {initialPlaylist !== undefined && initialPlaylist !== null && visible.length > 0 && (
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
const ROW = 68;

/**
 * ورقة إعادة الترتيب.
 *
 * السحب بأحداث المؤشّر لا بـ HTML5 drag-and-drop: الأخير لا يعمل باللمس على
 * الجوال أصلاً، وهو الجهاز الذي تُستعمل فيه هذه الميزة. وبلا مكتبة سحبٍ
 * خارجية: صفٌّ رأسيّ متساوي الارتفاع رياضياتُه سطرٌ واحد، والمكتبة كانت
 * ستضيف وزناً للحزمة مقابل ما لا نحتاجه (D-036).
 *
 * الصفوف بينهما تنزاح بانتقالٍ ناعم بينما يتبع المسحوبُ الإصبع بلا انتقال —
 * وهذا وحده ما يصنع إحساس iOS: الصفوف تُفسح الطريق قبل أن تُفلت.
 */
function ReorderSheet({
  items,
  t,
  onClose,
  onDone,
}: {
  items: ListItem[];
  t: Dict;
  onClose: () => void;
  onDone: (keys: string[]) => void;
}) {
  const [order, setOrder] = useState<ListItem[]>(items);
  const [from, setFrom] = useState<number | null>(null);
  const [dy, setDy] = useState(0);
  const startY = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const auto = useRef<number | null>(null);
  const edge = useRef(0);

  const to =
    from === null ? null : Math.max(0, Math.min(order.length - 1, from + Math.round(dy / ROW)));

  /* تمريرٌ ذاتيّ عند الحافّة: بدونه لا يمكن نقل عملٍ من آخر قائمةٍ طويلة
     إلى أوّلها إلا بعشر سحباتٍ متتالية */
  useEffect(() => {
    if (from === null) return;
    const step = () => {
      const el = body.current;
      if (el && edge.current) {
        const before = el.scrollTop;
        el.scrollTop += edge.current;
        // ما تحرّك فعلاً يُضاف إلى الإزاحة حتى لا يقفز الصفّ المسحوب
        startY.current -= el.scrollTop - before;
        if (el.scrollTop !== before) setDy((d) => d + (el.scrollTop - before));
      }
      auto.current = requestAnimationFrame(step);
    };
    auto.current = requestAnimationFrame(step);
    return () => {
      if (auto.current) cancelAnimationFrame(auto.current);
      auto.current = null;
    };
  }, [from]);

  function down(e: React.PointerEvent, i: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    edge.current = 0;
    setFrom(i);
    setDy(0);
    tap(10);
  }

  function move(e: React.PointerEvent) {
    if (from === null) return;
    setDy(e.clientY - startY.current);
    const el = body.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = e.clientY - r.top;
    const bottom = r.bottom - e.clientY;
    edge.current = top < 56 ? -8 : bottom < 56 ? 8 : 0;
  }

  function up() {
    if (from !== null && to !== null && to !== from) {
      setOrder((prev) => {
        const next = [...prev];
        const [x] = next.splice(from, 1);
        next.splice(to, 0, x);
        return next;
      });
      tap(8);
    }
    edge.current = 0;
    setFrom(null);
    setDy(0);
  }

  /** كم ينزاح الصفّ i بينما يُسحب صفٌّ آخر */
  function shift(i: number) {
    if (from === null || to === null) return 0;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -ROW;
    if (from > to && i >= to && i < from) return ROW;
    return 0;
  }

  /** بديلُ السحب للوحة المفاتيح — السهمان يحرّكان الصفّ المركَّز عليه */
  function nudge(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [x] = next.splice(i, 1);
      next.splice(j, 0, x);
      return next;
    });
  }

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-ro-title">
      <SheetHeader
        id="list-ro-title"
        title={t.listReorder}
        closeLabel={t.closeLabel}
        onClose={onClose}
        action={
          <button
            type="button"
            onClick={() => onDone(order.map(keyOf))}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            {t.listDone}
          </button>
        }
      >
        <p className="text-12 text-muted mt-0.5">{t.listReorderHint}</p>
      </SheetHeader>

      {/* `min-h-0` ليست زينة: ابنُ الفليكس لا ينكمش تحت ارتفاع محتواه بلا
          هذه، فقائمةٌ من ثلاثين عملاً كانت تتجاوز سقف الورقة (85vh) وتُقصّ
          بلا إمكانية تمرير — أي لا يمكن الوصول إلى آخرها أصلاً */}
      <div ref={body} className={`${sheetScroll} px-2 py-2`}>
        <ul className="relative" style={{ height: order.length * ROW }}>
          {order.map((it, i) => {
            const dragging = from === i;
            const url = posterUrl(it.poster_path, "w185");
            return (
              <li
                key={keyOf(it)}
                className={`absolute inset-x-0 flex items-center gap-3 px-2 rounded-card ${
                  dragging
                    ? "z-10 bg-surface-2 shadow-2xl scale-[1.02]"
                    : "transition-transform duration-200 ease-out"
                }`}
                style={{
                  top: i * ROW,
                  height: ROW - 8,
                  transform: `translateY(${shift(i)}px)`,
                }}
              >
                <span className="relative w-9 h-[54px] shrink-0 rounded-md overflow-hidden bg-surface border border-border">
                  {url ? (
                    <Image src={url} alt="" fill sizes="36px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name={it.media_type === "movie" ? "film" : "tv"} size={14} />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-14 font-semibold leading-tight line-clamp-2">
                    {it.title ?? `#${it.tmdb_id}`}
                  </span>
                  <span className="block text-12 text-muted tabular-nums mt-0.5" dir="ltr">
                    {i + 1}
                  </span>
                </span>

                {/* المقبض وحده يمسك السحب: لو أمسكه الصفّ كلّه لتنازع مع
                    تمرير الورقة، و`touch-none` تمنع المتصفّح من ابتلاع
                    الحركة تمريراً قبل أن تصلنا */}
                <button
                  type="button"
                  aria-label={`${it.title ?? ""} — ${t.listPositionOf(i + 1, order.length)}`}
                  onPointerDown={(e) => down(e, i)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      nudge(i, -1);
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      nudge(i, 1);
                    }
                  }}
                  className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-muted touch-none select-none transition active:text-accent active:bg-surface-2"
                >
                  <Icon name="grip" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

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
  t,
}: {
  item: ListItem;
  n: number | null;
  rating: number | null;
  canRemove: boolean;
  onRemove: () => void;
  /** 🆕 D-495 — حالةُ الإضافة ولغةُ القارئ؛ الغيابُ يعني لا زرّ */
  quickAdd?: { added: boolean; locale: Locale };
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
