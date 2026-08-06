/**
 * شعار Loopz — الكلمة نفسها.
 *
 * الهوية الرسمية أسقطت رمز الحلقة/التشغيل: العلامة هي كلمة «Loopz»
 * بخطٍّ ثقيل، بيضاء على الأسطح الداكنة — قرارُ المالك مع كتيّب العلامة
 * (أصفر #FFD200 وأسود #0D0D0D). النصّ يرث لونه من السياق (`currentColor`
 * عبر لون النصّ)، فيبقى أبيض في الثيمات الداكنة كما تقول الهوية، ولا
 * يختفي على خلفية الثيم الفاتح — ومن أراده أبيض قسراً فوق صورةٍ يمرّر
 * `text-white` كما تفعل ترويسة الغلاف.
 *
 * `gradientId` بقي في التوقيع بلا عمل: مواضع الاستدعاء تمرّره من أيام
 * الرمز المتدرّج، وكسرُها كلها لإسقاط خاصيةٍ صامتة لا يستحق.
 */
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
    <span
      dir="ltr"
      role="img"
      aria-label="Loopz"
      className={`inline-block font-extrabold tracking-tight leading-none select-none ${className}`}
      style={{ fontSize: Math.round(size * 0.82) }}
    >
      Loopz
    </span>
  );
}

/** الشعار للشريط العلوي وشاشة الدخول — الكلمة نفسها، الاسم هو العلامة */
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
  return <Logo size={size} className={className} />;
}
