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
 * تقول الهويّة. **وفي الثيم الفاتح (`daylight`) يحتاجان قلباً** —
 * **دَينٌ يُعلَن ولا يُخفى** (بندٌ في `05`): `invert` سطرٌ واحد، **لكنه
 * لا يُشحن قبل أن يُرى الثيمُ الفاتح حيّاً** (D-220).
 */

/** **الرمزُ وحده** — مربّعٌ يقف في الشريط وفي أيّ موضعٍ ضيّق */
export function Logo({
  size = 32,
  className = "",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-mark",
}: {
  size?: number;
  className?: string;
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
      style={{ width: size, height: size }}
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showName = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gradientId = "loopz-wordmark",
}: {
  size?: number;
  className?: string;
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
      style={{ width: w, height: h }}
    />
  );
}
