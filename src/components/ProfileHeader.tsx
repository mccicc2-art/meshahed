import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { getDict, type Locale } from "@/lib/i18n";
import { levelName, type LevelInfo } from "@/lib/level";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";
import { HeaderTools } from "./HeaderTools";

export interface HeaderStat {
  key: string;
  icon: IconName;
  value: string;
  label: string;
  href?: string;
  /** لون الأيقونة — ثابت لا يتبع الثيم، فالخانة تُعرف بلونها قبل كلمتها */
  color?: string;
}

/**
 * ختم التوثيق.
 *
 * مربّعان مستديران أحدهما مائل ٤٥ درجة — فيخرج ختمٌ ثمانيّ الأطراف كخاتم
 * الشمع، وهو شكل شارات التوثيق المعروفة. رُسم بمربّعين لا بمسار محفوظ:
 * الشكل نفسه بلا نسخ. والتدرّج ذهبيّ ثابت لا يتبع الثيم — الشارة علامة
 * لا عنصر واجهة، فلونها واحد على كل الخلفيات.
 */
function VerifiedMark({ size = 18, title }: { size?: number; title: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className="shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="verified-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBE38A" />
          <stop offset="45%" stopColor="#E3AE2B" />
          <stop offset="100%" stopColor="#A9750F" />
        </linearGradient>
      </defs>
      <g fill="url(#verified-gold)">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="5.2" />
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="5.2" transform="rotate(45 12 12)" />
      </g>
      <path
        d="m8.4 12.3 2.5 2.5 4.7-5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * ترويسة الحساب.
 *
 * الغلاف صورة ممتدّة إلى حواف الشاشة، وأدواته كبسولةٌ واحدة تطفو على
 * زاويته العليا — الإشعارات ثم الإعدادات ثم المشاركة، الأكثر استعمالاً
 * أعلى. وكتلة الهوية ترتفع على الثلث الأسفل من الصورة فتُقرأ معها طبقةً
 * واحدة، لا شريطاً يبدأ بعد انتهائها.
 *
 * ثم المستوى سطراً عريضاً، ثم بطاقة الأرقام: أربع خانات، لكلٍّ أيقونتها
 * ولونها فوق رقمها. اللون يسبق القراءة — تُعرف خانة الأفلام من ورديّتها
 * قبل أن تُقرأ كلمتها.
 */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  coverUrl,
  level,
  alerts,
  stats,
  followers,
  following,
  comments,
  ratings,
  verified = false,
  locale,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  level: LevelInfo;
  /** عدد ما ينتظرك — نقطة على الجرس لا رقم */
  alerts: number;
  stats: HeaderStat[];
  followers: number;
  following: number;
  comments: number;
  ratings: number;
  verified?: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <section>
      {/* ===== الغلاف ===== */}
      <div className="relative h-56 sm:h-72 -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 1152px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(120deg, var(--glow-a), transparent 55%), linear-gradient(300deg, var(--glow-b), transparent 55%), var(--surface-2)",
            }}
          />
        )}

        {/* تدرّج سفليّ يذوّب الصورة في خلفية الصفحة بدل حافّة حادّة */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[color:var(--background)]" />

        <span className="absolute top-4 start-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          <Logo size={30} gradientId="header-mark" />
        </span>

        {/* أدوات الغلاف كبسولةٌ واحدة تنسدل: الجرس ظاهر دائماً — وهو
            الوحيد الذي يحمل خبراً — والباقي تحته عند اللمس */}
        <HeaderTools alerts={alerts} locale={locale} />
      </div>

      {/* ===== كتلة الهوية ===== */}
      <div className="flex items-end gap-3.5 pe-16 -mt-[6.5rem] sm:-mt-[7rem] relative z-10">
        {/* حلقة متدرّجة حول الصورة: تفصلها عن الغلاف وتعطيها ثقل المرجع */}
        <Link href="/profile/settings?s=profile" className="shrink-0">
          <span
            className="block rounded-full p-[3px]"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-3), var(--accent-2) 55%, var(--accent))",
            }}
          >
            <Avatar
              src={avatarUrl}
              name={displayName}
              size={90}
              alt={t.avatarAlt}
              className="ring-[3px] ring-[color:var(--background)]"
            />
          </span>
        </Link>

        <div className="min-w-0 flex-1 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              {displayName}
            </h1>
            {verified && <VerifiedMark title={t.verifiedTitle} />}
          </div>

          {username && (
            <p className="text-[13px] text-white/55 truncate leading-tight mt-0.5 drop-shadow">
              <span dir="ltr">@{username}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-white/75 leading-tight mt-1 drop-shadow">
            <Link href="/people" className="shrink-0 hover:text-white transition">
              <span className="font-bold text-white tabular-nums">{followers}</span>{" "}
              {t.followersLabel}
            </Link>
            <span className="opacity-40 shrink-0">•</span>
            <Link href="/people" className="shrink-0 hover:text-white transition">
              <span className="font-bold text-white tabular-nums">{following}</span>{" "}
              {t.followingLabel}
            </Link>
          </div>

          {/* التعليقات والتقييمات كبسولةٌ محدودة: رقمان صغيران لا يستحقّان
              كلمتين، والإطار يفصلهما عن سطر المتابعات فوقهما */}
          <div className="inline-flex items-center rounded-full border border-white/20 bg-black/30 backdrop-blur mt-2">
            <Link
              href="/ratings?with=comments"
              title={t.panelComments}
              aria-label={`${comments} ${t.panelComments}`}
              className="flex items-center gap-1.5 ps-3.5 pe-3 py-1.5 text-[13px] text-white/85 hover:text-white transition"
            >
              <Icon name="comment" size={15} />
              <span className="font-bold tabular-nums">{comments}</span>
            </Link>
            <span className="w-px h-4 bg-white/20" aria-hidden />
            <Link
              href="/ratings"
              title={t.panelRatings}
              aria-label={`${ratings} ${t.panelRatings}`}
              className="flex items-center gap-1.5 ps-3 pe-3.5 py-1.5 text-[13px] text-white/85 hover:text-white transition"
            >
              <Icon name="star" size={15} />
              <span className="font-bold tabular-nums">{ratings}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ===== المستوى =====
          `z-10` ليس زينة: الغلاف عنصرٌ `relative`، والعناصر الموضوعة
          تُرسم فوق ما بعدها من عناصر التدفّق العادي — فكان سطر المستوى
          يختفي تحت حافّة الصورة على الشاشة العريضة. */}
      <div className="relative z-10 mt-4 px-0.5">
        <p className="text-[13px] font-bold">
          {t.levelLabel(level.level)} ·{" "}
          <span className="text-accent">{levelName(level.level, t)}</span>
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex-1 h-[5px] rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${level.percent}%`,
                background: "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
              }}
            />
          </div>
          <span className="text-[12px] text-muted shrink-0 tabular-nums">
            <span dir="ltr">{level.percent}%</span>
          </span>
        </div>
      </div>

      {/* ===== بطاقة الأرقام =====
          الأيقونة فوق الرقم وتحته كلمته، والخانة موسّطة — كتلة تُقرأ من
          أعلى لأسفل. والفواصل خطوطٌ محشورة لا حدودَ خانة: تبتعد عن إطار
          البطاقة فلا تلمس الحافّة. */}
      <div className="relative z-10 mt-4 rounded-2xl border border-white/10 bg-[color:var(--surface)]/60 backdrop-blur-xl overflow-hidden">
        <div className="grid grid-cols-4">
          {stats.map((s, i) => {
            const cell = (
              <>
                <Icon
                  name={s.icon}
                  size={24}
                  strokeWidth={1.8}
                  style={s.color ? { color: s.color } : undefined}
                  className={s.color ? "" : "text-muted"}
                />
                <span className="block text-[19px] font-bold leading-none tabular-nums mt-2">
                  {s.value}
                </span>
                <span className="block text-[11px] text-muted mt-1.5 leading-[1.25] min-h-[2.5em] px-0.5">
                  {s.label}
                </span>
              </>
            );
            const rule = i < stats.length - 1 && (
              <span className="absolute inset-y-4 end-0 w-px bg-white/10" aria-hidden />
            );
            const box = "relative flex flex-col items-center justify-start text-center px-1 py-4";
            return s.href ? (
              <Link key={s.key} href={s.href} className={`${box} hover:bg-white/5 transition`}>
                {rule}
                {cell}
              </Link>
            ) : (
              <div key={s.key} className={box}>
                {rule}
                {cell}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
