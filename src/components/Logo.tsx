/**
 * شعار Loopz.
 *
 * الفكرة في الهوية: حلقة لا نهائية (Loop) اندمجت مع مثلّث التشغيل (Play) —
 * الاستمرارية والمشاهدة في علامة واحدة. المسار متجهي لا صورة، فيبقى حادّاً
 * على أي كثافة شاشة ويأخذ ألوانه من متغيّرات الثيم لا من قيم مكتوبة.
 *
 * `gradientId` فريد لكل نسخة: تعريفات SVG المتكرّرة بنفس المعرّف في صفحة
 * واحدة تجعل المتصفّح يطبّق أوّلها على الجميع.
 */
export function Logo({
  size = 32,
  className = "",
  gradientId = "loopz-mark",
}: {
  size?: number;
  className?: string;
  gradientId?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Loopz"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="42" x2="44" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-1)" />
          <stop offset="0.55" stopColor="var(--brand-2)" />
          <stop offset="1" stopColor="var(--brand-3)" />
        </linearGradient>
      </defs>

      {/* المثلّث: الضلع الأيسر من الحلقة يُغلق على رأسٍ يشير للأمام */}
      <path
        d="M9 12.5c0-2.1 2.3-3.4 4.1-2.3l17.6 10.6c1.5.9 1.6 3 .2 4L13.3 37.6C11.5 38.9 9 37.6 9 35.4V12.5Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* العروة: تلتفّ من رأس المثلّث وتعود، فتكتمل إشارة اللانهاية */}
      <path
        d="M27.5 24c3-4.6 5.4-7.4 8.6-7.4 4.1 0 7 3.3 7 7.4s-2.9 7.4-7 7.4c-3.2 0-5.6-2.8-8.6-7.4Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** الشعار مع الاسم — للشريط العلوي وشاشة الدخول */
export function LogoWordmark({
  size = 28,
  className = "",
  showName = true,
  gradientId = "loopz-wordmark",
}: {
  size?: number;
  className?: string;
  showName?: boolean;
  gradientId?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Logo size={size} gradientId={gradientId} />
      {showName && (
        <span
          className="font-extrabold tracking-tight leading-none"
          style={{ fontSize: size * 0.72 }}
          dir="ltr"
        >
          Loopz
        </span>
      )}
    </span>
  );
}
