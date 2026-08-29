import {
  isPlus,
  isPartner,
  isFounder,
  isVerified,
  type PlanBearer,
} from "@/lib/plan";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * ===================== نظامُ الهويّة والحالة (D-773) =====================
 *
 * **ثلاثُ علاماتٍ لا أكثر، ومصنعٌ واحدٌ لها جميعاً** — من لوحَي الهويّة
 * اللذين سلّمهما أحمد: `PLUS` و`PARTNER` قرصان، و`VERIFIED` ختمٌ.
 *
 * ⚖️ **والقرصان قرصٌ واحدٌ بكلمتين، لا شكلان.**
 * **الكلمةُ هي الفرق، لا اللون ولا الحدُّ ولا التدرّج** — وهذه قاعدةُ
 * النظام حرفاً («مصنعُ زرٍّ واحد… ولونُ نجاحٍ واحد؛ ونسخةٌ ثانيةٌ من
 * أيٍّ منها عطل»). **ولو أُعطي البارتنر لوناً ثانياً لصار في التطبيق
 * لونا حالةٍ يتنافسان على العين**، والفرقُ بينهما لا يُقرأ أصلاً من
 * لونٍ بل من كلمةٍ مكتوبة.
 *
 * ⚖️ **والبارتنر يحلّ محلَّ البلس ولا يجتمعان** (نصُّ أحمد): كلُّ
 * بارتنرٍ صاحبُ بلس، **فقرصان متجاوران يقولان الشيءَ مرّتين**
 * — والأعلى يبتلع الأدنى.
 *
 * ⚖️ **والمؤسِّسُ لا يصير علامةً رابعة**: يحمل قرصَ `PLUS` نفسَه
 * ونصُّه في `title` وحدَه. **صفةٌ نادرةٌ لا تستحقّ شكلاً ثالثاً في سطرٍ
 * لا يحتمل كلمةً رابعة** (D-258/D-621).
 *
 * 🔴 **والتوثيقُ يتبع أيّاً منهما أو يقف وحدَه**: بحكم أحمد التوثيق
 * **لا يُباع ولا يأتي تلقائيّاً مع Plus**، **والبارتنر يقدّم طلباً
 * مستقلّاً** — **فمجّانيٌّ موثَّقٌ حالةٌ صحيحة**، ورسمُها يجب أن يكون
 * ممكناً بلا قرص.
 *
 * 🔴 **والأصفرُ هنا ثابتٌ لا `--accent`.**
 * الثيماتُ تبدّل الأصفرَ إلى وردّيٍّ وأزرقَ وبنفسجيّ — **وعلامةٌ تتلوّن
 * بذوقِ الناظر ليست هويّة، هي زينة.** فالتوثيقُ يبقى `#FFD400` في
 * الثيمات الثمانية كما في اللوح، **ويبقى أسودَ فوقه** فيحفظ التباينَ
 * على كلِّ خلفيّة. (والافتراضيُّ `amber` أصلاً `#FFD400` — فالثباتُ
 * لا يُرى إلّا حيث كان الانحرافُ سيقع.)
 *
 * ⚠️ **والمقاسُ يُشتقّ من `size` وحدَه**: ١٦ ارتفاعاً في اللوح، والعرضُ
 * نسبةٌ منه — **فلا رقمَ مكتوبٌ مرّتين، ولا علامةٌ تُمطّ.**
 */

/** لونُ الهويّة — ثابتٌ عبر الثيمات الثمانية (وهو `accent` الافتراضيّ) */
const BRAND = "#FFD400";
const ON_BRAND = "#050505";

/**
 * **القرص** — مصنعٌ واحد، والكلمةُ معاملُه.
 *
 * **ونسبتا اللوح**: `PLUS` ٣٨×١٦ و`PARTNER` ٦٢×١٦. **والعرضُ لا يُثبَّت
 * بل يُترك للكلمة** مع حشوٍ مشتقٍّ من الارتفاع — فالنسبتان تقعان
 * وحدَهما، **وترجمةٌ أطولُ لا تقصّ حرفاً.**
 */
function Pill({
  word,
  size,
  label,
}: {
  word: string;
  size: number;
  label: string;
}) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center font-extrabold leading-none select-none"
      style={{
        height: size,
        borderRadius: size / 2,
        paddingInline: size * 0.34,
        background: BRAND,
        color: ON_BRAND,
        fontSize: size * 0.5625,
        letterSpacing: "0.04em",
        /* **الكلمةُ لاتينيّةٌ في اللوحين** ولا تُترجم — علامةٌ لا نصّ.
         **والاتّجاهُ يُثبَّت** فلا تنقلبُ داخل صفحةٍ عربيّة. */
        direction: "ltr",
      }}
      title={label}
      aria-label={label}
      role="img"
    >
      {word}
    </span>
  );
}

/** قرصُ الخطّة — `PARTNER` أو `PLUS` أو لا شيء */
export function PlanPill({
  profile,
  locale,
  size = 16,
  className = "",
}: {
  profile: PlanBearer | null | undefined;
  locale: Locale;
  size?: number;
  className?: string;
}) {
  const t = getDict(locale);
  /* **البارتنر أوّلاً**: `isPartner` تشترط `isPlus` أصلاً، **فالترتيبُ
     هو ما يمنع اجتماعَهما** لا شرطٌ إضافيّ. */
  if (isPartner(profile))
    return (
      <span className={className}>
        <Pill word="PARTNER" size={size} label={t.partnerBadge} />
      </span>
    );
  if (isPlus(profile))
    return (
      <span className={className}>
        <Pill
          word="PLUS"
          size={size}
          label={isFounder(profile) ? t.founderBadge : t.plusBadge}
        />
      </span>
    );
  return null;
}

/**
 * **ختمُ التوثيق** — عشرُ أسنانٍ وصحٌّ أسود، كما في اللوح.
 *
 * **والمسارُ محسوبٌ لا مرسومٌ بالعين**: عشرُ نقاطٍ على دائرةٍ نصفُ
 * قطرها ٩٫٢ في مربّع ٢٤، **وبين كلِّ نقطتين قوسٌ نصفُ قطره ٣٫٦٨**
 * — **أكبرُ من نصف الوتر فينتفخ خارجاً.** فالأسنانُ عشرٌ بالضبط
 * ومتساويةٌ حتماً، ولا يتغيّر عددُها لو صغُر المقاس.
 * ⚠️ **وأقواسٌ لا رؤوسٌ حادّة**: أوّلُ رسمٍ كان عشرين رأساً متناوبةَ
 * نصفِ القطر — **فخرج نجمةً لا صدفة**، **ورُئي مرسوماً قبل أن يُشحن**
 * (شرطُ D-220).
 *
 * ⚠️ **ولا `title` على `<svg>` وحدَه**: القارئُ الصوتيُّ يقرأ الغلافَ،
 * والفأرةُ تحتاج العنوانَ على العنصر الذي تقف عليه.
 */
export function VerifiedBadge({
  locale,
  size = 16,
  className = "",
}: {
  locale: Locale;
  size?: number;
  className?: string;
}) {
  const t = getDict(locale);
  return (
    <span
      className={`shrink-0 inline-grid place-items-center ${className}`}
      title={t.verifiedBadgeTip}
      aria-label={t.verifiedBadge}
      role="img"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M 12.00 2.80 A 3.68 3.68 0 0 1 17.41 4.56 A 3.68 3.68 0 0 1 20.75 9.16 A 3.68 3.68 0 0 1 20.75 14.84 A 3.68 3.68 0 0 1 17.41 19.44 A 3.68 3.68 0 0 1 12.00 21.20 A 3.68 3.68 0 0 1 6.59 19.44 A 3.68 3.68 0 0 1 3.25 14.84 A 3.68 3.68 0 0 1 3.25 9.16 A 3.68 3.68 0 0 1 6.59 4.56 A 3.68 3.68 0 0 1 12.00 2.80 Z"
          fill={BRAND}
        />
        <path
          d="M 7.9 12.2 L 10.8 15.1 L 16.2 9.3"
          fill="none"
          stroke={ON_BRAND}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * **الصفُّ الكامل** — وهو ما تستدعيه الأسطح، لا القطعتان مفردتين.
 *
 * **والترتيبُ من اللوح حرفاً**: الاسم ← ٤ ← القرص ← ٤ ← الختم.
 * **والفجوةُ تُشتقّ من المقاس** (٤ عند ١٦) فتبقى النسبةُ ثابتةً في
 * الترويسة الكبيرة كما في سطر التعليق.
 *
 * ⚠️ **ويعيد `null` إذا لم يكن ثمّ شيء** — **فلا فجوةٌ فارغةٌ تُزحزح
 * الاسمَ** في مئات الأسطر التي لا علامةَ فيها.
 */
export function AccountBadges({
  profile,
  locale,
  size = 16,
  className = "",
}: {
  profile: PlanBearer | null | undefined;
  locale: Locale;
  size?: number;
  className?: string;
}) {
  const pill = isPlus(profile);
  const verified = isVerified(profile);
  if (!pill && !verified) return null;

  return (
    <span
      className={`shrink-0 inline-flex items-center ${className}`}
      style={{ gap: size * 0.25, marginInlineStart: size * 0.25 }}
    >
      <PlanPill profile={profile} locale={locale} size={size} />
      {verified ? <VerifiedBadge locale={locale} size={size} /> : null}
    </span>
  );
}
