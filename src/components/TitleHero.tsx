import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import { BackButton } from "./BackButton";
import { Icon } from "./Icon";

/**
 * **ترويسةُ العمل — غلافٌ واحد لكل صفحات الكلام** (D-244، طلبُ أحمد على
 * صفحة التعليق: «أحتاج الغلاف تبع الفلم فوق»).
 *
 * ================= لماذا خرجت من صفحة `/talk` =================
 *
 * وُلدت داخلها (D-216/D-217) وكانت وحيدةَ القارئ. **ثم طلبها أحمد فوق
 * صفحة التعليق** — وقارئٌ ثانٍ هو لحظةُ الاستخراج عندنا (نفسُ سيرة
 * `Composer` و`Dropdown` و`newsLine`): **تُنسخ فتفترق النسختان في الحشو
 * والتدرّج بعد أسبوع، وتُستخرج فتبقى غلافاً واحداً في السطحين.**
 * والنسخةُ المحلّية حُذفت في الدفعة نفسِها.
 *
 * ================= الهندسة (كما ضُبطت في D-217) =================
 *
 * `25svh` بحدَّين (`min-h`/`max-h`) — **والنسبةُ وحدها بلا حدّين تكسر
 * أحدَ الطرفين دائماً**. و`-mt-6 -mx-4` تُلغي حشوَ التخطيط بالضبط لا
 * بالتقدير. والزرّان زجاجيّان بقطر لمسٍ ٤٤، **في `start`/`end` لا
 * يسار/يمين** فينقلبان وحدَهما في العربية.
 *
 * **وطرفُ النهاية وسيطٌ (`end`) لا زرٌّ مبنيّ هنا**: صفحةُ الغرفة تضع
 * سهماً إلى صفحة العمل، وصفحةُ التعليق تضع باباً إلى الغرفة — **الموضعُ
 * ثابتٌ والفعلُ لصاحب الصفحة.**
 */
export function TitleHero({
  backdrop,
  poster,
  title,
  href,
  mediaType,
  avg,
  count,
  ratingLabel,
  locale,
  end,
}: {
  /** روابطُ صورٍ كاملة — المستدعي يملك قرارَ «فنّي أم رسميّ» (D-131) */
  backdrop: string | null;
  poster: string | null;
  title: string;
  /** الملصقُ والاسمُ رابطٌ واحد إلى هذا المسار */
  href: string;
  mediaType: "tv" | "movie";
  /** متوسّطُ الجماعة — **ومقامُه معه** (D-216): «٩٫٥» من اثنين ليست من ألف */
  avg?: number;
  count?: number;
  ratingLabel?: string;
  locale: Locale;
  /** الزرُّ العائم في طرف النهاية — انظر أعلاه */
  end?: React.ReactNode;
}) {
  return (
    <header className="relative -mt-6 -mx-4 h-[25svh] min-h-[190px] max-h-[300px] overflow-hidden bg-surface-2">
      {backdrop && (
        <Image src={backdrop} alt="" fill sizes="100vw" priority className="object-cover" />
      )}
      {/* تدرّجان: واحدٌ يُلبس الصورةَ سواداً كي يُقرأ الاسمُ فوقها مهما
          كان لونها، وآخرُ من الأعلى كي يُقرأ الزرّان */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

      <div className="absolute inset-x-0 top-0 px-3 pt-3 flex items-center justify-between">
        <BackButton locale={locale} />
        {end}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-3 flex items-end gap-3">
        {/* الملصقُ والاسمُ رابطٌ واحد — هدفُ لمسٍ واسع، ولا زرَّ داخل زرّ */}
        <Link
          href={href}
          className="flex items-end gap-3 min-w-0 flex-1 active:opacity-80 transition"
        >
          <div className="relative w-[58px] h-[87px] shrink-0 rounded-xl overflow-hidden bg-surface-2 border border-white/15 shadow-xl">
            {poster ? (
              <Image src={poster} alt="" fill sizes="58px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted">
                <Icon name={mediaType === "tv" ? "tv" : "film"} size={18} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-[18px] leading-tight line-clamp-2 text-white drop-shadow">
              {title}
            </h1>
            {typeof avg === "number" && typeof count === "number" && count > 0 && (
              <p
                className="mt-0.5 text-[12px] font-bold text-accent tabular-nums"
                title={ratingLabel}
              >
                ★ <span dir="ltr">{avg}</span>
                <span className="font-normal text-white/70"> ({count})</span>
              </p>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
