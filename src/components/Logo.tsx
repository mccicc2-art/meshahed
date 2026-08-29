import Image from "next/image";

/**
 * ==================== شعارُ Loopz و Loopz+ (D-256، D-773ب) ====================
 *
 * **العلامةُ صورةٌ مُرسَلة لا حروفٌ تُحاكى** (D-256، طلبُ أحمد: «احتاج تحط
 * الأيقونة في كل الصفحات بدل كلمة لوبز اللي في الشاشة فوق»): كان الشعارُ
 * كلمةَ «Loopz» بخطّ الواجهة — **و`font-extrabold` من خطٍّ عامّ ليست علامةً
 * تجارية، هي تقليدٌ لها.** والهويّةُ تكتبها بحرفٍ مرسوم: **العينان علامةُ
 * اللانهاية `∞`** وهذا شكلٌ لا يُنتجه أيُّ خطّ.
 *
 * 🔴 **والملفّان يُعادُ استعمالُهما حرفاً ولا يُعاد رسمُهما** (شرطُ اللوح:
 * «لا تغيّر أي path أو أبعاد أو سماكة في الشعار الأصلي» · وشرطُ القبول ٨).
 * `loopz-mark.png` (الرمز) و`loopz-wordmark.png` (الكلمة)، مستخرَجان من
 * صورتَي أحمد نفسِهما، **والسوادُ رُفع بالألفا من الإضاءة نفسِها** فبقيت
 * الحوافُّ ناعمةً — **وشفافيةٌ بحدٍّ قاطع تُرى مسنّنةً على كلّ خلفيّةٍ غير
 * سوداء.**
 *
 * ============================ الأرضيّةُ تحكم اللون ============================
 *
 * **من اللوح، أربعُ أرضيّاتٍ لا اثنتان:**
 * | الأرضيّة | الشعار | الزائدة |
 * |---|---|---|
 * | `dark` | `#FFFFFF` | `#FFD400` |
 * | `light` | `#050505` | `#FFD400` |
 * | `photo` | `#FFFFFF` | `#FFD400` |
 * | `yellow` | `#050505` | `#FFFFFF` |
 *
 * 🔑 **و`dark`/`light` لا تُكتبان في المستدعي بل تُقرآن من الثيم**:
 * `filter: invert(var(--logo-invert))` **والمتغيّرُ صفرٌ في كلِّ ثيمٍ داكنٍ
 * وواحدٌ في `daylight` وحدَه** — **فالقرارُ في اللوحة لا في المكوّن**، ولو
 * وُلد ثيمٌ فاتحٌ ثانٍ ورث السلوكَ بسطرٍ في `themes.ts`. ولهذا الأرضيّةُ
 * الافتراضيّةُ `theme`: **هي `dark` أو `light` بحسب ما يختاره القارئ**،
 * **ولا يُجبَر مستدعٍ على معرفة ثيمِ من ينظر.**
 * ⚠️ **و`photo` ليست `dark`**: العلامةُ فوق غلافِ الملفّ بيضاءُ في الثيمين
 * **لأنّها تقف على فنٍّ لا على ورق** — **ولو ورثت الثيمَ لانقلبت سوداءَ فوق
 * صورةٍ داكنة.**
 * ⚠️ **والزائدةُ لا تُقلب مع الثيم أبداً**: الفلترُ على `<Image>` وحدَه لا
 * على الغلاف — **ولو ورثته لصارت زرقاءَ في `daylight`.**
 *
 * ======================= أرقامُ الزائدة — مقيسةٌ لا مقدَّرة =======================
 *
 * **الكلمة**: `loopz-wordmark.png` ٧٢٠×٢٤٧، وخطُّ القامة من الأعلى إلى
 * y≈١٩٠ — **فالقامةُ `H` = ٠٫٧٦٩ من ارتفاع الصورة**، والباقي نزلةُ `p`.
 * ثمّ من اللوح: **الزائدةُ ٢٧٪ من `H`، وفراغُ ٨٪ بعد حرف `z`، ورأسُها
 * يرتفع ٦٪ فوق أعلى الشعار.**
 * **الرمز**: `loopz-mark.png` ٥١٢×٥١٢ وحبرُه في الصفوف ١٤٧..٣٦٣ والأعمدة
 * ٣٩..٤٧٠ — **فالحلقاتُ `H` = ٠٫٤٢٢ من المربّع**، وحافّتُها اليمنى ٠٫٩١٨
 * وأعلاها ٠٫٢٨٧. ثمّ من اللوح: **٣٠٪ من `H`، وفراغُ ٧٪، وترتفع ٨٪ فوق
 * أعلى الحلقات، أعلى اليمين.**
 * 🔴 **ولولا قياسُ الملفّين لوقفت الزائدةُ على حشوِ الصورة لا على حبرِها**
 * — فالمربّعُ ٥١٢ والحلقاتُ فيه ٤٣٧×٢٢١ بحشوٍ مقصودٍ ليصلح صورةَ حساب.
 *
 * 🔴 **والغلافُ `overflow: visible` مع حجزِ عرضِ الزائدة** (نصُّ اللوح):
 * زائدةُ الرمز تتجاوز المربّعَ ~٧٪ يميناً — **فمن يضع الشعارَ في
 * `overflow-hidden` يقصّها**، ولهذا الغلافُ يعلن عرضَه شاملاً إيّاها.
 */

/** أين يقف الشعار — والافتراضُ يتبع ثيمَ القارئ */
export type LogoBackground = "theme" | "dark" | "light" | "photo" | "yellow";
export type LogoVariant = "wordmark" | "mark";
export type LogoTier = "standard" | "plus";

/** 🕰️ الاسمُ القديم للأرضيّة — يُقرأ ولا يُكتب بعد اليوم */
export type LogoOn = "surface" | "art";

const BRAND = "#FFD400";

/** فلترُ الصورة: ما يتبع الثيم يُقلب بالمتغيّر، وما عداه يُثبَّت */
function logoFilter(bg: LogoBackground): string | undefined {
  if (bg === "theme") return "invert(var(--logo-invert))";
  if (bg === "light" || bg === "yellow") return "invert(1)";
  return undefined; // dark · photo — الصورةُ بيضاءُ بالألفا أصلاً
}

/** لونُ الزائدة: أبيضُ فوق الأصفر وحدَه (وإلّا اختفت فيه)، وأصفرُ فيما عداه */
function plusColor(bg: LogoBackground): string {
  return bg === "yellow" ? "#FFFFFF" : BRAND;
}

/**
 * **الزائدةُ** — **شكلٌ من اللوح حرفاً**: مستطيلان في مربّع ١٠٠ بسمكِ ٢٤.
 * **ولا حرفُ `+` من الخطّ**: سمكُه يتبدّل بتبدّل الخطّ بين الأجهزة
 * (وهو الدرسُ الذي أخرج الكلمةَ نفسَها من `font-extrabold` إلى صورة).
 * **ولا حدَّ ولا تدرّجَ ولا ظلّ** (منهيٌّ عنها في اللوح).
 */
function PlusMark({
  side,
  color,
  style,
}: {
  side: number;
  color: string;
  style: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={side}
      height={side}
      aria-hidden="true"
      style={{ position: "absolute", ...style }}
    >
      <rect x="38" y="0" width="24" height="100" fill={color} />
      <rect x="0" y="38" width="100" height="24" fill={color} />
    </svg>
  );
}

/* ─────────────────── نِسبُ الملفّين، مقيسةً مرّةً واحدة ─────────────────── */
/** الكلمة: القامةُ من ارتفاع الصورة، ونسبةُ العرض إلى الارتفاع */
const WORD_CAP = 0.769;
const WORD_RATIO = 2.91;
/** الرمز: ارتفاعُ الحلقات وحافّتاها داخل المربّع */
const MARK_H = 0.422;
const MARK_RIGHT = 0.918;
const MARK_TOP = 0.287;

/**
 * **المكوّنُ المركزيّ** — بابٌ واحدٌ للشعار في التطبيق كلِّه.
 * `tier="plus"` لكلِّ من `isPlus || isPartner` (نصُّ اللوح).
 */
export function LoopzLogo({
  variant = "mark",
  tier = "standard",
  background = "theme",
  size = 32,
  className = "",
  priority = true,
}: {
  variant?: LogoVariant;
  tier?: LogoTier;
  background?: LogoBackground;
  /** الرمز: ضلعُ المربّع. الكلمة: الارتفاعُ المتاح (الصورةُ ٠٫٧٢ منه) */
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const mark = variant === "mark";
  const h = mark ? size : Math.round(size * 0.72);
  const w = mark ? size : Math.round(h * WORD_RATIO);
  const plus = tier === "plus";

  const img = (
    <Image
      src={mark ? "/loopz-mark.png" : "/loopz-wordmark.png"}
      alt="Loopz"
      width={w}
      height={h}
      priority={priority}
      className={`inline-block select-none ${plus ? "" : className}`}
      style={{ width: w, height: h, filter: logoFilter(background) }}
    />
  );
  if (!plus) return img;

  /* **الأساسُ `H` يختلف بين الشكلين**: قامةُ الكلمة، وارتفاعُ الحلقات. */
  const H = mark ? size * MARK_H : h * WORD_CAP;
  const side = H * (mark ? 0.3 : 0.27);
  const gap = H * (mark ? 0.07 : 0.08);
  const rise = H * (mark ? 0.08 : 0.06);

  /* **الزائدةُ بعد الحافّة اليمنى للحبر لا للصندوق**: الرمزُ محشوّ. */
  const left = mark ? size * MARK_RIGHT + gap : w + gap;
  /* **وأعلاها يرتفع فوق أعلى الحبر**: أعلى الحلقات، أو خطُّ القامة (صفر). */
  const top = (mark ? size * MARK_TOP : 0) - rise;

  return (
    <span
      className={`relative inline-block align-middle select-none ${className}`}
      /* **العرضُ يحجز الزائدةَ** فلا تُقصّ ولا تركب على جارها */
      style={{ width: left + side, height: h, overflow: "visible" }}
    >
      {img}
      <PlusMark
        side={side}
        color={plusColor(background)}
        style={{ left, top }}
      />
    </span>
  );
}

/* ══════════════ الوجهان القديمان — أغلفةٌ فوق المركزيّ لا نسخٌ منه ══════════════
   **نسختان من الشعار في الشيفرة تعنيان يومَ تتبدّل العلامةُ نسختين
   تتبدّلان** — فهذان يمرّران ولا يرسمان. */

/** **الرمزُ وحده** — الشريطُ وأيُّ موضعٍ ضيّق */
export function Logo({
  size = 32,
  className = "",
  on,
  background,
  plus = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-mark",
}: {
  size?: number;
  className?: string;
  on?: LogoOn;
  background?: LogoBackground;
  plus?: boolean;
  gradientId?: string;
}) {
  return (
    <LoopzLogo
      variant="mark"
      size={size}
      className={className}
      background={background ?? (on === "art" ? "photo" : "theme")}
      tier={plus ? "plus" : "standard"}
    />
  );
}

/** **الكلمةُ المرسومة** — الترويسات التي تتّسع لها */
export function LogoWordmark({
  size = 28,
  className = "",
  on,
  background,
  plus = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showName = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-wordmark",
}: {
  size?: number;
  className?: string;
  on?: LogoOn;
  background?: LogoBackground;
  plus?: boolean;
  showName?: boolean;
  gradientId?: string;
}) {
  return (
    <LoopzLogo
      variant="wordmark"
      size={size}
      className={className}
      background={background ?? (on === "art" ? "photo" : "theme")}
      tier={plus ? "plus" : "standard"}
    />
  );
}
