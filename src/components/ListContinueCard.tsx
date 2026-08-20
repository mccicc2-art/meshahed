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
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

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
    if (done || pending) return;
    tap([10, 20]);
    setDone(true);
    start(async () => {
      try {
        await toggleMovieWatched({
          movieTmdbId: next.tmdbId,
          runtime: next.runtime ?? null,
          watched: true,
        });
        /* **والتجديدُ هنا شرطٌ لا زينة**: البطاقةُ كلُّها تتبدّل —
           الملصقُ والاسمُ والعدّاد — **فالانقلابُ إلى التالي هو الفعل
           نفسُه** (وهو نصُّ الطلب). */
        router.refresh();
      } catch (err) {
        setDone(false);
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
  return (
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

        {/* علامةُ «شاهدته» — للأفلام وحدَها، انظر أعلاه.
            والمقاسُ ٤٤px كدائرة بطاقة الحلقة (D-507) — كانت ٣٦ فتفترق
            الدائرتان في الصفّ الواحد. */}
        {next.mediaType === "movie" && (
          <button
            type="button"
            onClick={mark}
            disabled={done || pending}
            aria-label={t.markWatchedAria}
            title={t.markWatchedAria}
            className={`absolute top-2.5 end-2.5 z-10 grid place-items-center w-11 h-11 rounded-full border backdrop-blur-md transition active:scale-90 disabled:opacity-70 ${
              done
                ? "border-[color:var(--success)] bg-[color:var(--success)] text-black"
                : "border-white/25 bg-black/40 text-white/90 hover:bg-black/55"
            }`}
          >
            <Icon name="check" size={18} strokeWidth={2.4} />
          </button>
        )}

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
  );
}
