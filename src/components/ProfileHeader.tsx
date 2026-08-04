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
      <div className="flex items-end gap-3 -mt-9 relative">
        <Link href="/profile/edit" className="shrink-0">
          <Avatar
            src={avatarUrl}
            name={displayName}
            size={80}
            alt={t.avatarAlt}
            className="ring-4 ring-[color:var(--background)]"
          />
        </Link>

        <div className="min-w-0 flex-1 pb-1">
          <h1 className="text-lg sm:text-2xl font-bold truncate">{displayName}</h1>
          {username && (
            <p className="text-xs sm:text-sm text-muted truncate leading-tight">
              <span dir="ltr">@{username}</span>
            </p>
          )}
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

      {/* ===== بطاقة الأرقام ===== */}
      <div className="mt-4 rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-3">
          {stats.map((s, i) => {
            const cell = (
              <>
                <span className="grid place-items-center text-muted mb-1.5">
                  <Icon name={s.icon} size={17} />
                </span>
                <span className="block text-base font-extrabold leading-none tabular-nums">
                  {s.value}
                </span>
                <span className="block text-[11px] text-muted mt-1 truncate">{s.label}</span>
              </>
            );
            // خطوط فاصلة رفيعة بدل حدود لكل خانة: الشبكة تبقى كتلةً واحدة
            const edges = `${i % 3 !== 2 ? "border-e border-border" : ""} ${
              i < 3 ? "border-b border-border" : ""
            }`;
            return s.href ? (
              <Link
                key={s.key}
                href={s.href}
                className={`py-3 px-1 text-center hover:bg-surface-2 transition ${edges}`}
              >
                {cell}
              </Link>
            ) : (
              <div key={s.key} className={`py-3 px-1 text-center ${edges}`}>
                {cell}
              </div>
            );
          })}
        </div>

        {/* المستوى سطرٌ في ذيل البطاقة */}
        <div className="border-t border-border px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <p className="text-[12px] font-bold truncate">
              {t.levelLabel(level.level)} ·{" "}
              <span className="text-accent">{levelName(level.level, t)}</span>
            </p>
            <span className="text-[11px] text-muted shrink-0 tabular-nums">
              <span dir="ltr">{level.percent}%</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${level.percent}%`,
                background: "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
