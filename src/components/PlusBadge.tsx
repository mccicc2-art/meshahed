import { Icon } from "@/components/Icon";
import { isPlus, isFounder, type PlanBearer } from "@/lib/plan";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * شارةُ Loopz+ بجانب الاسم (D-633، بحكم أحمد: «شارة جنب الاسم»).
 *
 * **مكوّنٌ واحدٌ لكلِّ سطحٍ يحمل اسماً** — الرئيسيّةُ والملفُّ والخطُّ
 * وقوائمُ الناس: **شارةٌ ثانيةٌ بشكلٍ ثانٍ في سطحٍ آخرَ عطلٌ لا تنويع**
 * (قاعدةُ النظام: نسخةٌ ثانيةٌ من عنصرٍ واحدٍ خطأ).
 *
 * ⚖️ **والمؤسِّسُ يسبق البلس في العرض**: كلُّ مؤسِّسٍ صاحبُ بلس، **فرمزان
 * متجاوران يقولان الشيءَ مرّتين** — والأندرُ أصدقُ بصاحبه.
 * **ورمزٌ بلا كلمةٍ في السطر** (D-258/D-621): المعنى في `title`
 * و`aria-label`، والسطرُ لا يحتمل كلمةً رابعة.
 */
export function PlusBadge({
  profile,
  locale,
  size = 14,
  className = "",
}: {
  profile: PlanBearer | null | undefined;
  locale: Locale;
  size?: number;
  className?: string;
}) {
  if (!isPlus(profile)) return null;
  const t = getDict(locale);
  const founder = isFounder(profile);
  const label = founder ? t.founderBadge : t.plusBadge;

  return (
    <span
      className={`shrink-0 inline-grid place-items-center text-accent ${className}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon name={founder ? "sparkle-star" : "sparkles"} size={size} />
    </span>
  );
}
