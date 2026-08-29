import Image from "next/image";

/**
 * **شعارُ Loopz — العلامةُ صارت شكلاً لا حروفاً** (D-256، طلبُ أحمد:
 * «احتاج تحط الأيقونة في كل الصفحات بدل كلمة لوبز اللي في الشاشة فوق»).
 *
 * ================= ولماذا صورةٌ لا حروفٌ مكتوبة =================
 *
 * كان الشعارُ **كلمةَ «Loopz» بخطّ الواجهة** — و`font-extrabold` من خطٍّ
 * عامّ ليست علامةً تجارية، **هي تقليدٌ لها**. والهويّةُ التي سلّمها أحمد
 * تكتبها بحرفٍ مرسوم: **العينان علامةُ اللانهاية `∞`** — وهذا شكلٌ لا
 * يُنتجه أيُّ خطّ. **فالعلامةُ تُرسَل كما رُسمت، لا تُحاكى.**
 *
 * **والملفّان مستخرَجان من صورتَي أحمد نفسِهما** لا مُعادَي الرسم:
 * `loopz-mark.png` (الرمز، من الأيقونة السوداء) و`loopz-wordmark.png`
 * (الكلمة، من ترويسة الحساب). **والسوادُ رُفع بالألفا من الإضاءة نفسِها**
 * فبقيت الحوافُّ ناعمةً ولم تُقصّ درجاً — **وشفافيةٌ بحدٍّ قاطع تُرى
 * مسنّنةً على كل خلفيةٍ غير سوداء.**
 *
 * ⚠️ **وهما أبيضان بالألفا لا ملوّنان**: يقفان على الأسطح الداكنة كما
 * تقول الهويّة.
 *
 * **✅ 🆕 ودَينُ الثيم الفاتح سُدَّ** (D-405، بعد أن رُئي حيّاً — شرطُ
 * D-220): `filter: invert(var(--logo-invert))`، **والمتغيّرُ صفرٌ في كلِّ
 * ثيمٍ داكن وواحدٌ في `daylight` وحدَه** — **فالقرارُ في اللوحة لا في
 * المكوّن**، ولو وُلد ثيمٌ فاتحٌ ثانٍ ورث السلوكَ بسطرٍ في `themes.ts`.
 *
 * ============== 🆕 والزائدةُ الصفراء — تجربةُ Loopz+ (D-773) ==============
 *
 * لوحُ الهويّة يعطي العلامةَ صورتين: **`Loopz` للمجّانيّ و`Loopz+`
 * لصاحب البلس والبارتنر** — زائدةٌ صفراءُ صغيرةٌ تقف أعلى يمينِ الكلمة
 * أو الرمز. **وهي معاملٌ في المكوّن نفسِه لا مكوّنٌ ثانٍ**: نسختان من
 * الشعار في الشيفرة تعنيان يومَ تتبدّل العلامةُ نسختين تتبدّلان.
 *
 * ⚠️ **والأرقامُ مقيسةٌ من ملفَّي PNG أنفسِهما لا مقدَّرة**:
 * `loopz-wordmark.png` ٧٢٠×٢٤٧ وخطُّ القامة فيه من الأعلى إلى y≈١٩٠
 * (**فالقامةُ ٠٫٧٦٩ من الارتفاع**، والباقي نزلةُ حرف `p`)؛
 * `loopz-mark.png` ٥١٢×٥١٢ وحبرُه في الصفوف ١٤٧..٣٦٣ والأعمدة ٣٩..٤٧٠
 * (**فالرمزُ ٠٫٤٢٢ ارتفاعاً و٠٫٨٤٢ عرضاً من المربّع**). **ولولا القياسُ
 * لوقفت الزائدةُ على فراغِ الملفّ لا على حرفٍ مرسوم.**
 *
 * 🔴 **والغلافُ `inline-block` بـ`position: relative`، والزائدةُ
 * `absolute` تفيض خارجَه**: عند الرمز تتجاوز المربّعَ ٧٪ يميناً.
 * **فمن يضع الشعارَ في `overflow-hidden` يقصّها** — ولهذا الغلافُ
 * لا يقصّ، والمساحةُ حولَه من مسؤوليّة موضعِه.
 *
 * ⚠️ **ولا تُقلب مع الثيم**: الأصفرُ هويّةٌ لا مادّةُ الشعار — **فلو
 * ورث `invert` لصار أزرقَ في `daylight`.** والفلترُ على `<Image>`
 * وحدَه لهذا السبب، لا على الغلاف.
 *
 * 🔴 **ولا يُقلب ما يقف على صورة**: العلامةُ فوق غلافِ الملفّ الشخصيّ
 * بيضاءُ في الثيمين لأنها تقف على فنٍّ لا على ورق. **فالمعاملُ `on`
 * يقول أين تقف**: `"surface"` (الافتراض) تتبع الثيم، و`"art"` تبقى
 * بيضاء. **والافتراضُ هو الحالة الغالبة** — الشريطُ وصفحةُ الخطأ.
 */

/** أين تقف العلامة: على سطحِ الثيم (تتبعه) أم على فنٍّ (تبقى بيضاء) */
export type LogoOn = "surface" | "art";

/** لونُ الهويّة — ثابتٌ عبر الثيمات كما في `AccountBadges` (D-773) */
const BRAND = "#FFD400";

/**
 * **الزائدةُ** — شكلٌ مرسومٌ لا حرفُ `+` من خطّ الواجهة.
 *
 * **وسُمكُها ٢٢٪ من ضلعها**: حرفُ `+` من خطٍّ عامٍّ يتبدّل سُمكُه بتبدّل
 * الخطّ — **والعلامةُ لا تُترك لخطّ النظام** (وهو الدرسُ الذي أخرج
 * الكلمةَ نفسَها من `font-extrabold` إلى صورة).
 * ⚠️ **ولا حدَّ حولها**: `stroke` بعرض ٦ في مربّع ١٠٠ كان ينفخ الذراعَ
 * ٦٪ — **فالشكلُ المقيس يخرج أسمنَ ممّا قيس.**
 */
function PlusMark({
  side,
  style,
}: {
  side: number;
  style: React.CSSProperties;
}) {
  const t = 0.22; // سُمكُ الذراع نسبةً إلى الضلع (٢٢٪)
  return (
    <svg
      width={side}
      height={side}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ position: "absolute", ...style }}
    >
      <path
        d={`M ${50 - t * 50} 10 H ${50 + t * 50} V ${50 - t * 50} H 90 V ${50 + t * 50} H ${50 + t * 50} V 90 H ${50 - t * 50} V ${50 + t * 50} H 10 V ${50 - t * 50} H ${50 - t * 50} Z`}
        fill={BRAND}
      />
    </svg>
  );
}

/** الفلترُ نفسُه للرمز وللكلمة — **قاعدةٌ واحدة لا نسختان** (D-145) */
function logoFilter(on: LogoOn) {
  return on === "art" ? undefined : "invert(var(--logo-invert))";
}

/** **الرمزُ وحده** — مربّعٌ يقف في الشريط وفي أيّ موضعٍ ضيّق */
export function Logo({
  size = 32,
  className = "",
  on = "surface",
  plus = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-mark",
}: {
  size?: number;
  className?: string;
  on?: LogoOn;
  /** 🆕 تجربةُ Loopz+ (D-773) — زائدةٌ صفراءُ أعلى يمين الرمز */
  plus?: boolean;
  gradientId?: string;
}) {
  const img = (
    <Image
      src="/loopz-mark.png"
      alt="Loopz"
      width={size}
      height={size}
      priority
      className={`inline-block select-none ${plus ? "" : className}`}
      style={{ width: size, height: size, filter: logoFilter(on) }}
    />
  );
  if (!plus) return img;

  /* **الأرقامُ مشتقّةٌ من قياس الملفّ** (رأسُ الملفّ): الحبرُ يبدأ عند
     ٠٫٢٨٧ من المربّع وينتهي يميناً عند ٠٫٩١٨، وارتفاعُه ٠٫٤٢٢.
     **والزائدةُ ٣٠٪ من ارتفاع الرمز، بفجوةِ ٧٪ يميناً وترتفع ٨٪ فوق
     رأسه** — كما في اللوح. */
  const ICON_TOP = 0.287,
    ICON_RIGHT = 0.918,
    ICON_H = 0.422;
  const side = size * ICON_H * 0.3;
  return (
    <span
      className={`relative inline-block align-middle select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="false"
    >
      {img}
      <PlusMark
        side={side}
        style={{
          left: size * (ICON_RIGHT + ICON_H * 0.07),
          top: size * (ICON_TOP - ICON_H * 0.08) - side,
        }}
      />
    </span>
  );
}

/**
 * **الكلمةُ المرسومة** — للترويسات والأسطح التي تتّسع لها.
 *
 * **ونسبتُها ٢٫٩١:١** (من الأصل المستخرَج): العرضُ يُشتقّ من الارتفاع
 * فلا تُمطّ العلامةُ ولا تُضغط — **وعلامةٌ ممطوطةٌ أسوأ من لا علامة.**
 */
export function LogoWordmark({
  size = 28,
  className = "",
  on = "surface",
  plus = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showName = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-wordmark",
}: {
  size?: number;
  className?: string;
  on?: LogoOn;
  /** 🆕 تجربةُ Loopz+ (D-773) — زائدةٌ صفراءُ بعد الكلمة */
  plus?: boolean;
  showName?: boolean;
  gradientId?: string;
}) {
  const h = Math.round(size * 0.72);
  const w = Math.round(h * 2.91);
  const img = (
    <Image
      src="/loopz-wordmark.png"
      alt="Loopz"
      width={w}
      height={h}
      priority
      className={`inline-block select-none ${plus ? "" : className}`}
      style={{ width: w, height: h, filter: logoFilter(on) }}
    />
  );
  if (!plus) return img;

  /* **القامةُ ٠٫٧٦٩ من ارتفاع الصورة** (الباقي نزلةُ `p`)، **والزائدةُ
     ٢٧٪ من القامة، بفجوةِ ٨٪ بعد الكلمة، ورأسُها ٦٪ فوق خطّ القامة.** */
  const CAP = h * 0.769;
  const side = CAP * 0.27;
  return (
    <span
      className={`relative inline-block align-middle select-none ${className}`}
      style={{ width: w + CAP * 0.08 + side, height: h }}
    >
      {img}
      <PlusMark
        side={side}
        style={{ left: w + CAP * 0.08, top: -CAP * 0.06 }}
      />
    </span>
  );
}
