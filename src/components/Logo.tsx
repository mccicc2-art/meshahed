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
 * 🔴 **ولا يُقلب ما يقف على صورة**: العلامةُ فوق غلافِ الملفّ الشخصيّ
 * بيضاءُ في الثيمين لأنها تقف على فنٍّ لا على ورق. **فالمعاملُ `on`
 * يقول أين تقف**: `"surface"` (الافتراض) تتبع الثيم، و`"art"` تبقى
 * بيضاء. **والافتراضُ هو الحالة الغالبة** — الشريطُ وصفحةُ الخطأ.
 */

/** أين تقف العلامة: على سطحِ الثيم (تتبعه) أم على فنٍّ (تبقى بيضاء) */
export type LogoOn = "surface" | "art";

/** الفلترُ نفسُه للرمز وللكلمة — **قاعدةٌ واحدة لا نسختان** (D-145) */
function logoFilter(on: LogoOn) {
  return on === "art" ? undefined : "invert(var(--logo-invert))";
}

/** **الرمزُ وحده** — مربّعٌ يقف في الشريط وفي أيّ موضعٍ ضيّق */
export function Logo({
  size = 32,
  className = "",
  on = "surface",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-mark",
}: {
  size?: number;
  className?: string;
  on?: LogoOn;
  gradientId?: string;
}) {
  return (
    <Image
      src="/loopz-mark.png"
      alt="Loopz"
      width={size}
      height={size}
      priority
      className={`inline-block select-none ${className}`}
      style={{ width: size, height: size, filter: logoFilter(on) }}
    />
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showName = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-wordmark",
}: {
  size?: number;
  className?: string;
  on?: LogoOn;
  showName?: boolean;
  gradientId?: string;
}) {
  const h = Math.round(size * 0.72);
  const w = Math.round(h * 2.91);
  return (
    <Image
      src="/loopz-wordmark.png"
      alt="Loopz"
      width={w}
      height={h}
      priority
      className={`inline-block select-none ${className}`}
      style={{ width: w, height: h, filter: logoFilter(on) }}
    />
  );
}
