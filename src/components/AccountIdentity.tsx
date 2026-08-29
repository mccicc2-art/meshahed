import {
  isPlus as isPlusOf,
  isPartner as isPartnerOf,
  isVerified as isVerifiedOf,
  isFounder,
  type PlanBearer,
} from "@/lib/plan";
import type { Dict } from "@/lib/i18n";

/**
 * 🆕 **أصغرُ ما تحتاجه الشارةُ من القاموس** (D-773ب).
 *
 * **ولمَ ليس `Dict` كاملاً؟** لأنّ نصفَ مستدعيها مكوّناتُ عميل، **وبعضُها
 * لا يستورد القاموسَ أصلاً بل يستقبل حقيبةَ ملصقاتٍ صغيرةً من الخادم**
 * (عُرفُ `FollowCountButton`/`ProfilePeeks`) — **وجرُّ ألفٍ ومئةِ مفتاحٍ
 * إلى حزمة المتصفّح لأجل ثلاث كلماتٍ ثمنٌ لا يُدفع.**
 * 🔑 **و`Dict` يحقّق هذا الشكلَ بنيويّاً** — فمن يملك القاموسَ يمرّره
 * كما هو بلا التقاطِ حقول، **ومن لا يملكه يبني الثلاثةَ ويمضي.**
 */
export type BadgeLabels = Pick<
  Dict,
  | "plusBadge"
  | "partnerBadge"
  | "founderBadge"
  | "verifiedBadge"
  | "verifiedBadgeTip"
>;

/**
 * 🔴 **ولا يُمرَّر `Dict` كاملاً إلى مكوّن عميل — ولو حقّق الشكل** (D-773ج).
 *
 * **هذا السطرُ ثمنُ عطلٍ في الإنتاج، لا احتياط.** `Dict` يحمل **١٩٦
 * دالّةَ صياغة** (`notifFollow(who)`، `seasonToggleAria(n)`…)،
 * **والدوالُّ لا تُسلسَل عبر حدِّ الخادم/العميل** — **فمرّرتُه في حقيبة
 * ملصقاتِ `FollowCountButton` (وهو `"use client"`) فتوقّف قطاعُ الصفحة
 * الرئيسيّة عن الحلّ ولم يُرفع الهيكلُ العظميّ أبداً.**
 * ⚠️ **ولم يمسكه `tsc` ولا `next build`**: التحقّقُ بنيويٌّ فالشكلُ
 * مُحقَّق، **والانكسارُ وقتَ تشغيلٍ لا وقتَ ترجمة** — **وهو بالضبط ما
 * لا تراه البوّابات، ويراه أوّلُ فتحٍ للصفحة.**
 *
 * 🔑 **فالالتقاطُ يصير هنا مرّةً واحدة**: خمسُ سلاسلَ نصّيّةٍ لا أكثر،
 * **ومن التقطها بيده في كلِّ مستدعٍ نسي واحدةً أو أعاد الخطأ نفسَه.**
 */
export function badgeLabelsOf(t: Dict): BadgeLabels {
  return {
    plusBadge: t.plusBadge,
    partnerBadge: t.partnerBadge,
    founderBadge: t.founderBadge,
    verifiedBadge: t.verifiedBadge,
    verifiedBadgeTip: t.verifiedBadgeTip,
  };
}

/**
 * ============ نظامُ هويّة الحسابات — المكوّنُ المركزيُّ (D-773ب) ============
 *
 * **لوحا أحمد هما المرجعُ الملزم**، ونصُّه: «أي تعارض بين التنفيذ الحالي
 * وهذه المواصفات يُحسم لصالح هذه المواصفات». **فما هنا منقولٌ بالأرقام
 * لا مُعادُ تفسيرِه** — والقرصان **محدَّدا العرض** (٣٨ و٦٢) لا يتمدّدان
 * بالكلمة، **والمقاسُ ثابتٌ في كلّ سطح** (شرطُ القبول ٧: «التصميم لا
 * يتغيّر بين البروفايل والتعليقات وبطاقات المستخدمين») — **فلا معاملَ
 * `size` هنا أصلاً**، وغيابُه هو ما يمنع الانحراف.
 *
 * 🔴 **وهذا نقضٌ لتنفيذ الصباح** (D-773أ): كانت الأقراصَ **ممتلئةً
 * بالأصفر بنصٍّ أسود، وبعرضٍ يتبع الكلمة، ومقاسٍ يتبع السطح**؛ واللوحُ
 * يقول العكسَ في الثلاثة: **خلفيّةٌ سوداء، وحدٌّ أصفرُ بسمك ١، ونصٌّ
 * أصفر** — **وقرصٌ مملوءٌ يصرخ حيث أراد اللوحُ أن يهمس.**
 * وكذلك الختمُ كان أقواساً محسوبةً من عندي، **واللوحُ يعطي مسارَه
 * بالضبط** — فالمحسوبُ سقط والمعطى بقي حرفاً.
 *
 * 🔴 **وعقدُ الاستدعاء صار له شرطٌ واحد** (D-776): **المقاسُ يُورَث**،
 * **فضع مقاسَ خطِّ الاسم على الصفِّ الحاوي لا على عنصر الاسم وحدَه** —
 * وإلّا ورثت الشارةُ مقاسَ الصفحة (١٦) بجانب اسمٍ مقاسُه ٢٢ فتصغر.
 * **وهذا هو ثمنُ جعلها نسبيّةً، ويُدفع مرّةً في كلِّ سطحٍ لا كلَّ مرّة.**
 *
 * ⚖️ **والألوانُ ثابتةٌ لا `--accent`**: الثيماتُ تبدّل الأصفرَ إلى
 * وردّيٍّ وأزرقَ وبنفسجيّ — **وعلامةٌ تتلوّن بذوق الناظر ليست هويّة.**
 */

/** لونا الهويّة — من اللوح، ولا يتبعان الثيم */
const BRAND = "#FFD400";
const INK = "#050505";

/**
 * **ارتفاعُ الشارة نسبةً إلى خطِّ الاسم** (D-776).
 * ٠٫٨٢ تجعلها **أصغرَ من الاسم قليلاً** كما طلب — **وأكبرَ من قامة
 * الحرف (~٠٫٧) بقليل** فلا تبدو ضامرة. **ورقمٌ واحدٌ يحكم القرصَ
 * والختمَ معاً** فلا يفترقان.
 */
const PILL_EM = 0.82;

/**
 * **قرصُ الطبقة** — مصنعٌ واحد، والفرقُ بين الحالتين **عرضٌ وكلمةٌ
 * وتباعدُ حروف** لا شكلٌ ثانٍ (نصُّ اللوح: «نفس تصميم PLUS تمامًا»).
 */
function Pill({
  word,
  width,
  tracking,
  label,
}: {
  word: "PLUS" | "PARTNER";
  width: number;
  tracking: number;
  label: string;
}) {
  return (
    <span
      role="img"
      title={label}
      aria-label={label}
      style={{
        /* 🆕 **والمقاساتُ صارت نسبةً من خطِّ الاسم لا أرقاماً ثابتة**
           (D-776، بلاغُ أحمد: «حجم الأيقونة المفروض يكون أصغر من الاسم
           قليل، وليس مثله أو أكبر منه»).
           🔴 **وكان الثابتُ يكسر شرطَه في السطح الأكثر ظهوراً**: قرصٌ
           ارتفاعُه ١٦ بجانب اسمٍ خطُّه ١٥ في ترويسة الرئيسيّة —
           **فالشارةُ أطولُ من الاسم الذي تتبعه.** وفي الملفّ (٢٢) كانت
           صغيرةً بحقّ، **فالرقمُ الواحدُ كان يخطئ في الطرفين.**
           🔑 **والنسبةُ ٠٫٨٢em تحفظ ما طلبه في كلّ مقاس**: ١٢٫٣px عند
           اسمٍ ١٥، و١٨px عند ٢٢ — **أصغرُ من الاسم دائماً وبالنسبة
           نفسِها.** ⚠️ **ونِسَبُ اللوح محفوظةٌ حرفاً**: العرضُ إلى
           الارتفاع ٣٨:١٦ و٦٢:١٦، ونصفُ القطر ٥:١٦، والخطُّ ٩:١٦ —
           **الشكلُ هو هو، والذي تغيّر وحدةُ قياسه.** */
        width: `${(width / 16) * PILL_EM}em`,
        height: `${PILL_EM}em`,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        background: INK,
        border: `1px solid ${BRAND}`,
        borderRadius: `${(5 / 16) * PILL_EM}em`,
        color: BRAND,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        lineHeight: 1,
        textTransform: "uppercase",
        /* 🔴 **ولا `fontSize` على هذا العنصر — والسببُ فخٌّ وقعتُ فيه**:
           `em` في `font-size` تقيس بخطِّ الأبِ، **و`em` في كلِّ طولٍ آخر
           على العنصر نفسِه تقيس بخطِّ العنصرِ بعد تصغيره** — **فصار
           القرصُ ٦px حيث أردتُه ١٨.** (مقيسٌ قبل الشحن، لا مستنتَج.)
           🔑 **فالخطُّ ينزل إلى الابن**، ويبقى صندوقُ القرص منسوباً إلى
           خطِّ الاسم كما قُصد. */
        /* **الكلمةُ لاتينيّةٌ ولا تُترجم** — علامةٌ لا نصّ، **واتّجاهُها
           يُثبَّت** فلا تنقلب داخل صفحةٍ عربيّة (وهذا كلُّ ما زدتُه على
           CSS اللوح، لأنّ اللوحَ لم يُكتب لصفحةٍ RTL).
           ⚠️ **ولم أصحّح إزاحةَ `letter-spacing`**: المسافةُ تُلحق بالحرف
           الأخير أيضاً فتُزاح الكلمةُ ~٠٫٦px يساراً — **وتصحيحُها حشوةٌ
           لا يذكرها اللوح**، ونصُّ أحمد: «لا تُعِد تفسير التصميم». */
        direction: "ltr",
      }}
    >
      {/* 🆕 **والكلمةُ في غلافٍ خاصٍّ بها** (D-773ج، بلاغُه بلقطة): التوسيطُ
          يقع على قامة الحرف لا على صندوق السطر — **والقاعدةُ في
          `globals.css` لأنّها تحتاج `@supports`** ولا تُكتب في نمطٍ
          مضمَّن. */}
      <span
        className="lz-pill-word"
        style={{
          fontSize: `${(9 / 16) * PILL_EM}em`,
          letterSpacing: `${tracking / 9}em`,
        }}
      >
        {word}
      </span>
    </span>
  );
}

/** `PARTNER` أو `PLUS` أو لا شيء — **ولا يجتمعان أبداً** */
export function PlanPill({
  tier,
  t,
  founder = false,
}: {
  tier: "plus" | "partner" | null;
  t: BadgeLabels;
  founder?: boolean;
}) {
  if (tier === "partner")
    return (
      <Pill word="PARTNER" width={62} tracking={1.1} label={t.partnerBadge} />
    );
  if (tier === "plus")
    return (
      <Pill
        word="PLUS"
        width={38}
        tracking={1.3}
        label={founder ? t.founderBadge : t.plusBadge}
      />
    );
  return null;
}

/**
 * **ختمُ التوثيق** — **مسارُ اللوح حرفاً**: وردةٌ دائريّةٌ بعشرة تموّجاتٍ
 * ناعمةٍ (منحنيات `Q` لا رؤوسٌ حادّة) وصحٌّ أسودُ عريض.
 * **ولا أيقونةَ جاهزةٍ ولا أزرقَ ولا أخضر** (نصُّ اللوح).
 */
export function VerifiedBadge({ t }: { t: BadgeLabels }) {
  return (
    <span
      role="img"
      title={t.verifiedBadgeTip}
      aria-label={t.verifiedBadge}
      style={{
        width: 16,
        height: 16,
        flex: "0 0 16px",
        display: "inline-grid",
        placeItems: "center",
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill={BRAND}
          d="M 10.555 2.054 Q 12.000 1.000 13.445 2.054 Q 14.889 3.108 16.677 3.104 Q 18.466 3.101 19.015 4.803 Q 19.564 6.504 21.013 7.553 Q 22.462 8.601 21.906 10.300 Q 21.350 12.000 21.906 13.700 Q 22.462 15.399 21.013 16.447 Q 19.564 17.496 19.015 19.197 Q 18.466 20.899 16.677 20.896 Q 14.889 20.892 13.445 21.946 Q 12.000 23.000 10.555 21.946 Q 9.111 20.892 7.323 20.896 Q 5.534 20.899 4.985 19.197 Q 4.436 17.496 2.987 16.447 Q 1.538 15.399 2.094 13.700 Q 2.650 12.000 2.094 10.300 Q 1.538 8.601 2.987 7.553 Q 4.436 6.504 4.985 4.803 Q 5.534 3.101 7.323 3.104 Q 9.111 3.108 10.555 2.054 Z"
        />
        <path
          d="M7 12.2L10.4 15.6L17.4 8.6"
          fill="none"
          stroke={INK}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * **حالةُ الحساب** كما يقرّرها اللوح — **قاعدةٌ واحدةٌ يقرأها الجميع**
 * (D-145): `const tier = isPartner ? "partner" : isPlus ? "plus" : null`.
 *
 * 🔑 **وهذا السطرُ وحدَه هو ما يمنع اجتماعَ القرصين**، لا شرطٌ مكرّرٌ في
 * كلِّ صفحة. **ويومَ تنتهي الشراكةُ ويبقى البلس، يهبط `tier` إلى `plus`
 * بلا سطرٍ يتغيّر** — لأنّ `isPartner` تشترط `isPlus` أصلاً في `plan.ts`.
 */
export interface IdentityState {
  tier: "plus" | "partner" | null;
  verified: boolean;
  founder: boolean;
  /** شعارُ Loopz+ داخل التطبيق — للبلس والبارتنر معاً (نصُّ اللوح) */
  brandPlus: boolean;
}

export function identityOf(p: PlanBearer | null | undefined): IdentityState {
  const partner = isPartnerOf(p);
  const plus = isPlusOf(p);
  const tier = partner ? "partner" : plus ? "plus" : null;
  return {
    tier,
    verified: isVerifiedOf(p),
    founder: isFounder(p),
    brandPlus: partner || plus,
  };
}

/**
 * **الشاراتُ وحدَها** — لسطحٍ يرسم اسمَه بنفسه (ترويسةٌ فيها `h1`
 * وزرُّ متابعةٍ إلى جانبه). **والفجوةُ ٤px من اللوح**، والشاراتُ
 * `flex-shrink: 0` **فلا تُقصّ مع الاسم**.
 * ⚠️ **ويعيد `null` إذا لم يكن ثمّ شيء** — **فلا فجوةٌ فارغةٌ تُزحزح
 * الاسمَ** في مئات الأسطر التي لا علامةَ فيها.
 */
export function AccountBadges({
  profile,
  t,
  className = "",
}: {
  profile: PlanBearer | null | undefined;
  t: BadgeLabels;
  className?: string;
}) {
  const { tier, verified, founder } = identityOf(profile);
  if (!tier && !verified) return null;
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: 4, flex: "0 0 auto" }}
    >
      <PlanPill tier={tier} t={t} founder={founder} />
      {verified ? <VerifiedBadge t={t} /> : null}
    </span>
  );
}

/**
 * **الاسمُ وشاراتُه** — **المكوّنُ الذي تستدعيه الأسطحُ كلُّها** (شرطُ
 * القبول ٩: «لا تنفّذ الشارات منفصلة داخل كل صفحة»).
 *
 * **والاسمُ يُقصّ بـ`ellipsis` قبل أن تختفي الشارات** (نصُّ اللوح):
 * `min-w-0 truncate` على الاسم وحدَه، **والشاراتُ خارجَ القصّ** —
 * **وشارةٌ تختفي بطول اسمٍ ليست شارة.**
 *
 * ⚠️ **ولا رفعَ ولا خفضَ يدويّ**: `align-items: center` هو كلُّ
 * المحاذاة، **ولا `margin` مختلفٌ بين الصفحات** — الفجوةُ ٤px هنا مرّةً
 * واحدة.
 */
export function AccountIdentity({
  name,
  profile,
  isPlus,
  isPartner,
  isVerified,
  t,
  as: Tag = "span",
  className = "",
  nameClassName = "",
}: {
  name: React.ReactNode;
  /** الشكلُ المفضَّل: صفُّ الملفّ، **والحكمُ يُشتقّ منه** (D-145) */
  profile?: PlanBearer | null;
  /** أو الحالاتُ صريحةً حين لا يكون الصفُّ في اليد */
  isPlus?: boolean;
  isPartner?: boolean;
  isVerified?: boolean;
  t: BadgeLabels;
  /** عنصرُ الغلاف — `h1` في ترويسة الملفّ، و`span` في سطرِ تعليق */
  as?: "span" | "p" | "h1" | "h2" | "div";
  className?: string;
  nameClassName?: string;
}) {
  const derived = profile !== undefined ? identityOf(profile) : null;
  const partner = derived ? derived.tier === "partner" : !!isPartner;
  const plus = derived ? derived.tier !== null : !!isPlus || !!isPartner;
  const verified = derived ? derived.verified : !!isVerified;
  const founder = derived ? derived.founder : false;
  const tier: "plus" | "partner" | null = partner
    ? "partner"
    : plus
      ? "plus"
      : null;

  return (
    <Tag
      className={`flex items-center min-w-0 ${className}`}
      style={{ gap: 4 }}
    >
      <span className={`min-w-0 truncate ${nameClassName}`}>{name}</span>
      <PlanPill tier={tier} t={t} founder={founder} />
      {verified ? <VerifiedBadge t={t} /> : null}
    </Tag>
  );
}
