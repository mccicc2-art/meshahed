import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { getDict, type Locale } from "@/lib/i18n";
import { levelName, type LevelInfo } from "@/lib/level";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";
import { ShareButton } from "./ShareButton";

export interface HeaderStat {
  key: string;
  icon: IconName;
  value: string;
  label: string;
  href?: string;
}

/**
 * ختم التوثيق.
 *
 * مربّعان مستديران أحدهما مائل ٤٥ درجة — فيخرج ختمٌ ثمانيّ الأطراف كخاتم
 * الشمع، وهو شكل شارات التوثيق المعروفة. رُسم بمربّعين لا بمسار محفوظ:
 * الشكل نفسه بلا نسخ. والتدرّج ذهبيّ ثابت لا يتبع الثيم — الشارة علامة
 * لا عنصر واجهة، فلونها واحد على كل الخلفيات.
 */
function VerifiedMark({ size = 17, title }: { size?: number; title: string }) {
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
 * الغلاف صورة ممتدّة إلى حواف الشاشة، وأدواته أزرارٌ دائرية تطفو عليه —
 * لا شريط ولا صندوق يزاحم الصورة. والصورة الشخصية تنزل تحت حافة الغلاف
 * لا فوقها: كانت تتقاطع مع كتلة الاسم وشريط الأرقام، فصار الإطار يقطع
 * الإطار. الآن الغلاف يغلق على نفسه، ثم صفّ الهوية، ثم بطاقة الأرقام —
 * ثلاث كتل متتابعة بلا تداخل.
 *
 * الأرقام ستّ خانات في بطاقة واحدة بدل شريط منفصل: الخانة رقمٌ وكلمة
 * وأيقونة، والفواصل الرفيعة تفصل بينها بلا حدود ثقيلة. والمستوى سطرٌ في
 * أسفل البطاقة نفسها لا بطاقة ثانية.
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
  verified?: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <section>
      {/* ===== الغلاف ===== */}
      <div className="relative h-52 sm:h-64 -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-[color:var(--background)]" />

        <span className="absolute top-4 start-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          <Logo size={28} gradientId="header-mark" />
        </span>

        <div className="absolute top-3 end-3 flex items-center gap-2">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/15">
            <ShareButton locale={locale} />
          </span>
          <Link
            href="/profile/settings"
            aria-label={t.headerSettings}
            title={t.headerSettings}
            className="grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/15 text-white/90 hover:bg-black/60 transition"
          >
            <Icon name="settings" size={17} />
          </Link>
        </div>

        <Link
          href="/library?filter=watching"
          aria-label={t.headerAlerts}
          title={t.headerAlerts}
          className="absolute bottom-4 end-4 grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/15 text-white/90 hover:bg-black/60 transition"
        >
          <Icon name="bell" size={17} />
          {alerts > 0 && (
            <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-accent-2 ring-2 ring-black/50" />
          )}
        </Link>
      </div>

      {/* ===== صفّ الهوية ===== */}
      <div className="flex items-end gap-3 -mt-9 relative z-10">
        <Link href="/profile/edit" className="shrink-0">
          <Avatar
            src={avatarUrl}
            name={displayName}
            size={80}
            alt={t.avatarAlt}
            className="ring-4 ring-[color:var(--background)]"
          />
        </Link>

        <div className="min-w-0 flex-1 pb-6">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">{displayName}</h1>
            {verified && <VerifiedMark title={t.verifiedTitle} />}
          </div>

          {/* سطر المُعرّف: المعرّف والمتابعون والمتابَعون في سطر واحد —
              الرقم بلون النصّ والكلمة باهتة، فتُقرأ الأرقام أولاً */}
          <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-muted leading-tight mt-0.5 min-w-0">
            {username && (
              <span className="truncate min-w-0">
                <span dir="ltr">@{username}</span>
              </span>
            )}
            {username && <span className="opacity-40 shrink-0">·</span>}
            <Link href="/people" className="shrink-0 hover:text-foreground transition">
              <span className="font-bold text-foreground tabular-nums">{followers}</span>{" "}
              {t.followersLabel}
            </Link>
            <span className="opacity-40 shrink-0">·</span>
            <Link href="/people" className="shrink-0 hover:text-foreground transition">
              <span className="font-bold text-foreground tabular-nums">{following}</span>{" "}
              {t.followingLabel}
            </Link>
          </div>
        </div>

        <Link
          href="/profile/edit"
          aria-label={t.editProfile}
          title={t.editProfile}
          className="shrink-0 mb-1 grid place-items-center w-9 h-9 rounded-full border border-border bg-surface text-muted hover:text-foreground hover:border-accent/50 transition"
        >
          <Icon name="edit" size={15} />
        </Link>
      </div>

      {/* ===== بطاقة الأرقام =====
          تُسحب لأعلى فتنزلق تحت الصورة الشخصية: الصورة تطفو على زاويتها
          فتربط الكتلتين بدل أن تقفا منفصلتين بفراغ بينهما. والخانة صفٌّ
          أفقيّ — أيقونة ثم رقم وتحته كلمته — فارتفاع الصفّ ٤٤ بكسلاً لا ٧٠. */}
      <div className="-mt-3 rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-3 pt-1">
          {stats.map((s, i) => {
            const cell = (
              <>
                <Icon name={s.icon} size={18} className="text-muted shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-none tabular-nums">
                    {s.value}
                  </span>
                  <span className="block text-[10px] text-muted mt-1 truncate">{s.label}</span>
                </span>
              </>
            );
            const edges = `${i % 3 !== 2 ? "border-e border-border/70" : ""} ${
              i < 3 ? "border-b border-border/70" : ""
            }`;
            const box = "flex items-center gap-2.5 px-3 py-3";
            return s.href ? (
              <Link key={s.key} href={s.href} className={`${box} ${edges} hover:bg-surface-2 transition`}>
                {cell}
              </Link>
            ) : (
              <div key={s.key} className={`${box} ${edges}`}>
                {cell}
              </div>
            );
          })}
        </div>

      </div>

      {/* المستوى سطرٌ عارٍ تحت البطاقة: البطاقة نفسها ستّ خانات لا سابع
          لها، كما في المرجع */}
      <div className="flex items-center gap-2 mt-2 px-1">
        <p className="text-[11px] font-bold truncate shrink-0">
          {t.levelLabel(level.level)} ·{" "}
          <span className="text-accent">{levelName(level.level, t)}</span>
        </p>
        <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${level.percent}%`,
              background: "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
            }}
          />
        </div>
        <span className="text-[10px] text-muted shrink-0 tabular-nums">
          <span dir="ltr">{level.percent}%</span>
        </span>
      </div>
    </section>
  );
}
