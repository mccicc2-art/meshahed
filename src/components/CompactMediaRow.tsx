import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { Icon, type IconName } from "./Icon";

/**
 * صفُّ العرض المضغوط — **الوحدةُ الوحيدة للوضع المختصر** (D-434).
 *
 * **صفٌّ واحدٌ لثلاثة أقسام** («للمشاهدة» و«القادم» وما يأتي بعدها):
 * الفارقُ بينها **صدرُ الصفّ** — ملصقٌ صغير أو رقاقةُ تاريخ — **وسائرُه
 * واحد**. **وصفٌّ لكلِّ قسم كان سيفترق عند أوّل تعديل** (قاعدة ٦)،
 * ولهذا الصدرُ خانةٌ تُملأ لا مكوّنٌ يُنسخ.
 *
 * **والاسمُ مرّةً واحدة** (طلبُ أحمد: «لا تكرر اسم العمل فوق البوستر
 * وتحته») — **فالملصقُ هنا صورةٌ عارية بلا حجابٍ ولا نصّ**، والاسمُ
 * بجانبه في سطره.
 *
 * ⚠️ **و`dir="auto"` على الاسم والسطر الثاني**: مكتبةُ أحمد فيها العربيُّ
 * والإنجليزيّ في الصفحة الواحدة، **وعنوانٌ إنجليزيٌّ في سياقٍ عربيٍّ
 * تُقلب علاماتُه** (النقطة تسبق الجملة) إن لم يُترك للمتصفّح أن يستنتج.
 */
export function CompactMediaRow({
  href,
  title,
  subtitle,
  posterPath,
  chip,
  progress,
  fallbackIcon = "film",
}: {
  href: string;
  title: string;
  /** السطرُ الثاني — النوعُ والعددُ أو الموعد. يغيب فلا يُحجَز له مكان */
  subtitle?: string | null;
  /** صدرُ الصفّ: ملصقٌ صغير */
  posterPath?: string | null;
  /** أو رقاقةُ تاريخ («غداً» · «١ يونيو») — لأقسام المواعيد */
  chip?: string | null;
  /** ٠–١٠٠ — خيطٌ رفيع تحت السطرين، ويغيب عند الصفر */
  progress?: number;
  fallbackIcon?: IconName;
}) {
  const url = posterUrl(posterPath ?? null, "w185");

  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2 ps-2 pe-2.5 transition hover:border-accent/40 active:scale-[0.99]"
    >
      {chip != null ? (
        <span className="grid place-items-center shrink-0 w-14 h-14 rounded-xl border border-border bg-surface-2 px-1">
          <span
            className="text-[11px] font-extrabold uppercase leading-tight text-center text-accent"
            dir="auto"
          >
            {chip}
          </span>
        </span>
      ) : (
        <span className="relative shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-surface-2">
          {url ? (
            <Image src={url} alt="" fill sizes="40px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={fallbackIcon} size={16} />
            </span>
          )}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className="block text-[15px] font-bold leading-tight truncate"
          dir="auto"
        >
          {title}
        </span>
        {subtitle && (
          <span
            className="block text-[12px] text-muted leading-tight truncate mt-1"
            dir="auto"
          >
            {subtitle}
          </span>
        )}
        {typeof progress === "number" && progress > 0 && (
          <span className="mt-2 block h-1 rounded-full bg-[color:var(--divider)] overflow-hidden">
            <span
              className="block h-full w-full origin-left rtl:origin-right"
              style={{
                transform: `scaleX(${Math.min(100, Math.max(0, progress)) / 100})`,
                background: "var(--gradient-brand-x)",
              }}
            />
          </span>
        )}
      </span>

      {/* السهمُ يقول «هنا باب» — **ولا أيقونةَ جديدة**: `chevron-down`
          مُدارةٌ تتبع اتجاه الصفحة، فلا يشير في العربيّة إلى الخارج */}
      <Icon
        name="chevron-down"
        size={18}
        className="shrink-0 text-muted -rotate-90 rtl:rotate-90"
      />
    </Link>
  );
}
