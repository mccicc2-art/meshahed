/**
 * أيقونات الواجهة.
 *
 * خط أبيض شفاف بسمك موحّد بدل الإيموجي الملوّن. سبب الاستبدال ليس الذوق
 * وحده: الإيموجي يُرسم بخط النظام، فيختلف شكله ولونه بين أندرويد وآيفون
 * وويندوز — لوحة ألوان التطبيق تنكسر على أجهزة لا نراها. والرسم المتجهي
 * يرث `currentColor` فيتبع الثيم الذي يختاره المستخدم.
 *
 * النار وحدها تبقى إيموجي: 🔥 وسمٌ تفاعليّ يعرفه الناس بلونه.
 */

export type IconName =
  | "bell"
  | "play"
  | "popcorn"
  | "bookmark"
  | "sparkle-star"
  | "calendar"
  | "film"
  | "tv"
  | "star"
  | "chart"
  | "clock"
  | "check"
  | "sparkles"
  | "trending"
  | "pause"
  | "hourglass"
  | "newspaper"
  | "image"
  | "info"
  | "comment"
  | "list"
  | "edit"
  | "share"
  | "settings"
  | "search"
  | "shield"
  | "palette"
  | "grid"
  | "card"
  | "compass"
  | "home"
  | "people";

const PATHS: Record<IconName, React.ReactNode> = {
  bell: (
    <>
      <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z" />
      <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 9.2 15 12l-4.8 2.8V9.2Z" />
    </>
  ),
  popcorn: (
    <>
      <path d="M6.5 9h11l-1 11h-9l-1-11Z" />
      <path d="M6.8 9a2.1 2.1 0 0 1 1.4-3.4A2.3 2.3 0 0 1 12 4.4a2.3 2.3 0 0 1 3.8 1.2A2.1 2.1 0 0 1 17.2 9" />
      <path d="M10 12v5M14 12v5" />
    </>
  ),
  // علامة مرجعية بدل الفُشار في الأحجام الصغيرة: تفاصيل كيس الفُشار
  // تنهار عند ١٦ بكسل فيُقرأ سلّةَ مهملات
  bookmark: <path d="M6.5 4.5h11v15l-5.5-4-5.5 4v-15Z" />,
  // نجمة رباعية — وسم الأنمي: مميّزة عن نجمة التقييم الخماسية فلا تختلطان
  "sparkle-star": (
    <path d="M12 3.5c.6 4.4 4.1 7.9 8.5 8.5-4.4.6-7.9 4.1-8.5 8.5-.6-4.4-4.1-7.9-8.5-8.5 4.4-.6 7.9-4.1 8.5-8.5Z" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M7.6 5v14M16.4 5v14" />
      <path d="M3 9.6h4.6M3 14.4h4.6M16.4 9.6H21M16.4 14.4H21" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="7" width="18" height="12.5" rx="2.5" />
      <path d="M8 3.5 12 7l4-3.5" />
    </>
  ),
  star: (
    <path d="m12 4.2 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4.2Z" />
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V6M17 20v-9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.4 12.2 2.5 2.5 4.7-4.9" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4.5 13.4 9l4.5 1.4-4.5 1.4L12 16.3l-1.4-4.5L6.1 10.4 10.6 9 12 4.5Z" />
      <path d="M18 15.5 18.7 18l2.5.7-2.5.8-.7 2.5-.8-2.5-2.5-.8 2.5-.7.8-2.5Z" />
    </>
  ),
  trending: (
    <>
      <path d="M4 15.5 9.5 10l3.5 3.5L20 7" />
      <path d="M15.5 7H20v4.5" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 9.3v5.4M13.8 9.3v5.4" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M7.5 3.5c0 4 4.5 5.2 4.5 8.5s-4.5 4.5-4.5 8.5" />
      <path d="M16.5 3.5c0 4-4.5 5.2-4.5 8.5s4.5 4.5 4.5 8.5" />
    </>
  ),
  newspaper: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13.5" rx="2.5" />
      <path d="M7 9.5h6M7 13h6M7 16h4M16.5 9.5h1M16.5 13h1" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.8" cy="9.6" r="1.6" />
      <path d="m4.5 17 4.8-4.5 4 3.6 2.7-2.4 4 3.8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 8.1v.6" />
    </>
  ),
  comment: (
    <>
      <path d="M20.5 12c0 4-3.8 7-8.5 7-1 0-2-.14-2.9-.4L4.5 20l1.2-3.4C4.5 15.3 3.5 13.7 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7Z" />
    </>
  ),
  list: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  edit: <path d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5.5 6v6c0 4 2.8 6.8 6.5 8.5 3.7-1.7 6.5-4.5 6.5-8.5V6L12 3.5Z" />
      <path d="m9.3 12.1 1.9 1.9 3.6-3.9" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.6 0-.9-.7-1.4-.7-2.2 0-.8.6-1.4 1.5-1.4h1.7A4.2 4.2 0 0 0 20.5 11c0-4.2-3.8-7.5-8.5-7.5Z" />
      <circle cx="8.2" cy="10.4" r="1.1" />
      <circle cx="12" cy="7.8" r="1.1" />
      <circle cx="15.8" cy="10.2" r="1.1" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.8" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M6.5 14.5h3" />
    </>
  ),
  people: (
    <>
      <circle cx="9.2" cy="8.4" r="3.1" />
      <path d="M3.6 19c0-2.9 2.5-4.8 5.6-4.8s5.6 1.9 5.6 4.8" />
      <path d="M16.2 6.6a2.9 2.9 0 0 1 0 5.5M17.6 19c0-2.2-.9-3.8-2.4-4.7" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5 4.5-1.9Z" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.4 12 3.6l8.5 6.8" />
      <path d="M6 9.6V20h12V9.6" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V3.5" />
      <path d="M8 7.5 12 3.5l4 4" />
      <path d="M5 13v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V13" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3.4a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3.4a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className = "",
  strokeWidth = 1.7,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** لونٌ ثابت لا يتبع `currentColor` — للشريط السفلي ولوحة الأرقام */
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/** عنوان قسم بأيقونة — الشكل الموحّد لكل عناوين التطبيق */
export function SectionTitle({
  icon,
  children,
  className = "",
}: {
  icon: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`flex items-center gap-2 text-base font-bold ${className}`}>
      <Icon name={icon} size={18} className="text-muted" />
      {children}
    </h2>
  );
}
