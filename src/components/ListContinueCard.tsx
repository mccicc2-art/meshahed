"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMovieWatched } from "@/lib/actions";
import { posterUrl, backdropUrl } from "@/lib/media";
import { getDict, num, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { Icon } from "./Icon";

/**
 * **قائمةٌ تُتابَع كما يُتابَع المسلسل** (D-496، طلبُ أحمد: «تظهر في
 * كونتنيو واتشينج مثل المسلسل — تخلص فلم وتنقلب ويعطيك اللي بعده»).
 *
 * ================= لماذا بطاقةٌ ثانيةٌ لا معامِلٌ في `ContinueCard` =================
 *
 * **جسدُ `ContinueCard` كلُّه حلقات**: التأشيرُ يكتب `watched_episodes`
 * بموسمٍ ورقم، والسطرُ الثاني `S2 E15`، وورقةُ التقييم تُفتح عند نهاية
 * موسم. **وهذه تؤشّر فيلماً وتقدّمُها «كم من القائمة»** — **ولو
 * أُقحمت هناك بمعامِلٍ ثالثٍ لصار في الملفّ فرعان لا يلتقيان في سطر**
 * (وهو نقيضُ حجّة `variant` هناك: **ما اشتُرك حرفاً بحرف يُوحَّد، وما
 * لا يشترك يُفصل**).
 *
 * ================= والوجهُ وجهُ «التالي» لا وجهُ القائمة =================
 *
 * الملصقُ ملصقُ العمل الذي يليك، **واسمُ القائمة فوقه سطرٌ خافت**:
 * **السؤالُ الذي تفتح به الرئيسيةَ هو «ماذا أشاهد الآن»**، والقائمةُ
 * سياقُ الجواب لا الجواب.
 *
 * ⚠️ **والتأشيرُ للأفلام وحدَها**: مسلسلٌ في قائمةٍ لا «يُنهى» بضغطة،
 * **فبطاقتُه تفتح صفحتَه ولا تكذب بعلامةِ صحٍّ لا تُتمّ شيئاً** (D-217:
 * لا زرَّ لفعلٍ لا يقع).
 */
export function ListContinueCard({
  listName,
  next,
  watched,
  total,
  variant = "card",
  locale,
}: {
  listName: string;
  /** أوّلُ ما لم يُشاهَد في ترتيب القائمة */
  next: {
    tmdbId: number;
    mediaType: "tv" | "movie";
    title: string | null;
    posterPath: string | null;
    /** 🆕 صورةُ المشهد (D-507) — الغيابُ يسقط إلى الملصق */
    backdropPath?: string | null;
    runtime?: number | null;
  };
  watched: number;
  total: number;
  /**
   * ⚖️ 🆕 **والشكلُ يتبع وضعَ الرئيسية** (D-552، بلاغُ أحمد بلقطة:
   * «إذا غيّرته كومباكت البوستر كبير جدّاً، يحتاج يكون متوازن ويصغر»).
   *
   * 🔴 **والعلّةُ أنّ هذه البطاقةَ لم تكن تعرف الوضعَ أصلاً**:
   * `ContinueCard` تأخذ `variant` منذ نشأتها، **وهذه لا** — **فكان
   * الصفُّ في المختصر يخلط غلافاً بعرض ٧٠٪ من الشاشة بصفوفٍ ارتفاعُها
   * ١٠٦px**، **وهو بعينه كسرُ الصفِّ الذي عالجته D-507 في الاتّجاه
   * الآخر.**
   *
   * **والافتراضُ `card`** فمن لا يمرّره لا يتغيّر عنده شيء (شرطُ
   * ترتيب الالتزامات — D-028).
   */
  variant?: "card" | "row";
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();

  /* ===== 🔴 عطلٌ مبلَّغٌ عنه: الصحُّ يبقى أخضرَ ولا يُضغط ثانيةً =====

     **بلاغُ أحمد: «إذا ضغطت صح يستمرّ أخضر ما يتغيّر، فما أقدر أضغط
     صح مرّة ثانية».** **وسببان اجتمعا:**

     ١) **`done` حالةٌ محلّيّةٌ لا تعرف أنّ البطاقةَ تبدّلت**: الفعلُ
        ينجح ثمّ `router.refresh()` يجلب **الفيلمَ التالي في القائمة**
        — **والبطاقةُ هي هي، والحالةُ باقيةٌ `true`** — **فيظهر
        التالي وعليه صحٌّ أخضرُ معطَّلٌ وهو لم يُشاهَد بعد.**
     ٢) **والزرُّ كان طريقاً واحداً**: `watched: true` دائماً، و
        `disabled={done}` — **فلا رجعةَ ولو أخطأ.**

     **والعلاجُ الأوّل هو وصفةُ `ContinueCard` نفسُها** (تصحيحُ الحالة
     أثناء الرسم عند تبدّل الخاصيّة، لا في `useEffect` — D-434):
     **مفتاحُ العملِ يُحرَس، ومتى تبدّل عاد الصحُّ زجاجيّاً.**
     **والثاني مفتاحٌ ذو اتّجاهين** — وهو ما قرّرته D-538 للمسلسل:
     **فعلٌ واحدٌ باتّجاهيه مفتاحٌ لا تعليمات.** */
  const [seen, setSeen] = useState(next.tmdbId);
  const [done, setDone] = useState(false);
  if (seen !== next.tmdbId) {
    setSeen(next.tmdbId);
    setDone(false);
  }

  const href =
    next.mediaType === "movie" ? `/movie/${next.tmdbId}` : `/show/${next.tmdbId}`;
  /* 🆕 **غلافٌ لا ملصق** (D-507، حكمُ أحمد بلقطة: «الحجم كبير!! اعملها
     غلاف وحجمه يكون مثل المسلسل»): صورةُ المشهد كبطاقة الحلقة سواء —
     **والملصقُ سقوطٌ لمن لا مشهدَ له**، يُقصّ في ٧:٥ ولا يترك فراغاً. */
  const url = next.backdropPath
    ? backdropUrl(next.backdropPath, "w780")
    : posterUrl(next.posterPath, "w342");
  const pct = total > 0 ? Math.round((watched / total) * 100) : 0;

  function mark(e: React.MouseEvent) {
    /* **الزرُّ داخل بطاقةٍ هي رابط** — فلا بدّ من منع الرابط صراحةً
       (D-347: لا زرَّ داخل رابطٍ بلا `preventDefault`) */
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const to = !done;
    tap([10, 20]);
    setDone(to);
    start(async () => {
      try {
        await toggleMovieWatched({
          movieTmdbId: next.tmdbId,
          runtime: next.runtime ?? null,
          watched: to,
        });
        /* **والتجديدُ هنا شرطٌ لا زينة**: البطاقةُ كلُّها تتبدّل —
           الملصقُ والاسمُ والعدّاد — **فالانقلابُ إلى التالي هو الفعل
           نفسُه** (وهو نصُّ الطلب). */
        router.refresh();
      } catch (err) {
        /* **والرجوعُ إلى ما كان لا إلى الصفر** — الاتّجاهُ صار اتّجاهين */
        setDone(!to);
        flashError((err as Error).message);
      }
    });
  }

  /* ⚖️ 🆕 **الهندسةُ هندسةُ بطاقة الحلقة حرفاً بحرف** (D-507، حكمُ
     أحمد: «الحجم كبير!! اعملها غلاف وحجمه يكون مثل المسلسل»): كانت
     ملصقاً ٢:٣ في مقعدِ صفٍّ عريض — **فطالت بطاقتُها ضعفَ جاراتها
     وقُرئ الصفُّ مكسوراً.** الآن ٧:٥ بصورة مشهدٍ وحجابٍ سفليٍّ وشريطِ
     حافّةٍ — **نفسُ أصناف `ContinueCard` البصريّة** (قاعدة ٦: بطاقتان
     في صفٍّ واحدٍ لا تملكان هندستين). */
  /** الصحُّ — رسمٌ واحدٌ للشكلين، والذي يتبدّل موضعُه (وصفةُ `ContinueCard`) */
  const tick = next.mediaType === "movie" && (
    <button
      type="button"
      onClick={mark}
      disabled={pending}
      aria-label={t.markWatchedAria}
      title={t.markWatchedAria}
      className={`absolute z-10 grid place-items-center w-11 h-11 rounded-full border backdrop-blur-md transition active:scale-90 disabled:opacity-70 ${
        variant === "row" ? "top-1/2 -translate-y-1/2 end-3" : "top-2.5 end-2.5"
      } ${
        done
          ? "border-[color:var(--success)] bg-[color:var(--success)] text-black"
          : "border-white/25 bg-black/40 text-white/90 hover:bg-black/55"
      }`}
    >
      <Icon name="check" size={18} strokeWidth={2.4} />
    </button>
  );

  /* ===== 🆕 صفٌّ للوضع المختصر — بهندسة `ContinueCard` حرفاً (D-552) =====

     **الصورةُ ١٤٤ بنسبة ١٦:١٠، والحشوُ `p-2 pe-16`، والعنوانُ ١٥/٦٠٠،
     والثانويُّ ١٢، والخيطُ وحده مع النسبة** — **أرقامٌ منسوخةٌ من
     جارتها عمداً، لأن الصفَّ الواحدَ لا يملك هندستين** (القاعدة ٦).
     **ولو كُتبت هنا أرقامٌ من عندي لافترق الصفّان عند أوّل تعديل.**

     **والذي يختلف سطرُ السياق**: هناك «S2 E4 · باقي ٥»، **وهنا اسمُ
     القائمة والعدّ** — **وهو الفرقُ الذي وُلدت هذه البطاقةُ لأجله.** */
  if (variant === "row") {
    return (
      <div className="relative">
        <Link
          href={href}
          prefetch={false}
          className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-2 pe-16 active:scale-[0.99] transition"
        >
          <span className="relative w-[144px] shrink-0 aspect-[16/10] rounded-xl overflow-hidden bg-surface-2">
            {url ? (
              <Image src={url} alt="" fill sizes="144px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted">
                <Icon name="list" size={20} />
              </span>
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-15 font-semibold leading-tight truncate" dir="auto">
              {next.title ?? "—"}
            </span>
            <span className="block text-12 font-medium text-muted leading-tight truncate mt-1">
              <span className="text-accent">{listName}</span>
              <span className="opacity-50"> · </span>
              <span className="tabular-nums" dir="ltr">
                {num(watched, locale)} / {num(total, locale)}
              </span>
            </span>
            <span className="mt-2 flex items-center gap-2">
              <span className="h-1 flex-1 rounded-full bg-[color:var(--divider)] overflow-hidden">
                <span
                  className="block h-full w-full origin-left rtl:origin-right transition-transform duration-500"
                  style={{
                    transform: `scaleX(${pct / 100})`,
                    background: "var(--gradient-brand-x)",
                  }}
                />
              </span>
              <span className="shrink-0 text-12 font-semibold text-muted tabular-nums" dir="ltr">
                {pct}%
              </span>
            </span>
          </span>
        </Link>
        {/* **شقيقُ الرابط لا ابنُه** — فلا ضغطةٌ على الصحّ تفتح الصفحة (D-347) */}
        {tick}
      </div>
    );
  }

  return (
    <div className="relative">
    <Link
      href={href}
      prefetch={false}
      className="group relative block active:scale-[0.98] transition"
    >
      <div className="relative aspect-[7/5] rounded-poster overflow-hidden bg-surface border border-border">
        {url ? (
          <Image
            src={url}
            alt=""
            fill
            sizes="(max-width: 640px) 70vw, 320px"
            className="object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name="list" size={26} />
          </span>
        )}

        {/* الحجابُ حجابُ بطاقة الحلقة نفسُه — يبقي المشهدَ ويضمن الاسم */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 p-3 pb-3.5">
          {/* اسمُ القائمة سياقٌ لا عنوان — خافتٌ فوق اسم العمل */}
          <span className="flex items-center gap-1 text-[10px] font-semibold text-accent leading-none">
            <Icon name="list" size={11} strokeWidth={2.2} />
            <span className="truncate">{listName}</span>
          </span>
          <p className="mt-1 text-15 font-semibold leading-tight text-white line-clamp-1 drop-shadow pe-10" dir="auto">
            {next.title ?? "—"}
          </p>
          {/* سطرُ المعلومات كبطاقة الحلقة: العدُّ يساراً والنسبةُ طرفاً */}
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className="text-12 font-semibold text-white/75 truncate tabular-nums" dir="ltr">
              {num(watched, locale)} / {num(total, locale)}
            </span>
            <span className="shrink-0 text-12 font-semibold text-white/70 tabular-nums" dir="ltr">
              {pct}%
            </span>
          </div>
        </div>

        {/* شريطُ التقدّم على حافّة البطاقة — كبطاقة الحلقة سواء */}
        <span className="absolute inset-x-0 bottom-0 h-1 bg-[color:var(--divider)]">
          <span
            className="block h-full w-full origin-left rtl:origin-right transition-transform duration-500"
            style={{
              transform: `scaleX(${pct / 100})`,
              background: "var(--gradient-brand-x)",
            }}
          />
        </span>
      </div>
    </Link>
    {/* **الصحُّ شقيقُ الرابط في الشكلين** — نفسُ الحجّة (D-347) */}
    {tick}
    </div>
  );
}
