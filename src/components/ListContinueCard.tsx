"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMovieWatched } from "@/lib/actions";
import { posterUrl } from "@/lib/media";
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
  const url = posterUrl(next.posterPath, "w342");
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

  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative block overflow-hidden rounded-card border border-border bg-surface"
    >
      <div className="relative aspect-[2/3]">
        {url ? (
          <Image
            src={url}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, 220px"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name="list" size={24} />
          </span>
        )}

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92), transparent)" }}
        />

        {/* علامةُ «شاهدته» — للأفلام وحدَها، انظر أعلاه */}
        {next.mediaType === "movie" && (
          <button
            type="button"
            onClick={mark}
            disabled={done || pending}
            aria-label={t.markWatchedAria}
            title={t.markWatchedAria}
            className={`absolute top-2 end-2 z-10 grid place-items-center w-9 h-9 rounded-full border backdrop-blur-md transition active:scale-90 disabled:opacity-70 ${
              done
                ? "border-[color:var(--success)] bg-[color:var(--success)] text-black"
                : "border-white/25 bg-black/50 text-white hover:border-accent"
            }`}
          >
            <Icon name="check" size={16} strokeWidth={2.4} />
          </button>
        )}

        <span className="absolute inset-x-0 bottom-0 p-2.5">
          {/* اسمُ القائمة سياقٌ لا عنوان — خافتٌ فوق اسم العمل */}
          <span className="flex items-center gap-1 text-[10px] font-semibold text-accent leading-none">
            <Icon name="list" size={11} strokeWidth={2.2} />
            <span className="truncate">{listName}</span>
          </span>
          <span className="mt-1 block text-12 font-bold text-white leading-tight truncate" dir="auto">
            {next.title ?? "—"}
          </span>
          <span className="mt-1 block text-[10px] text-white/70 tabular-nums leading-none" dir="ltr">
            {num(watched, locale)} / {num(total, locale)}
          </span>
          <span className="mt-1.5 block h-1 rounded-full bg-white/20 overflow-hidden">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </span>
        </span>
      </div>
    </Link>
  );
}
