import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { getDict, type Locale } from "@/lib/i18n";
import { levelName, type LevelInfo } from "@/lib/level";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { ShareButton } from "./ShareButton";

/**
 * ترويسة الحساب.
 *
 * الغلاف يمتدّ إلى حواف الشاشة والصورة تجلس على حافته السفلى مع الاسم
 * والمعرّف بجانبها — كتلة هوية واحدة تُقرأ بنظرة، لا صورة في الوسط واسم
 * تحتها وأزرار متفرّقة.
 *
 * الأزرار الثلاثة فوق الغلاف لا تحته: الجرس يفتح ما ينتظرك، والمشاركة
 * تولّد بطاقتك صورةً، والترس يفتح الإعدادات. وُضعت على الغلاف لأنها
 * أدوات لا محتوى — فلا تسرق سطراً من الصفحة.
 *
 * وشريط المستوى تحتها مباشرةً: يقيس ما شاهدته لا ما أضفته، فالرقم يتحرّك
 * حين تشاهد فعلاً.
 */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  coverUrl,
  level,
  alerts,
  locale,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  level: LevelInfo;
  /** عدد ما ينتظرك — نقطة على الجرس لا رقم، فالرقم في شريط الأعداد أصلاً */
  alerts: number;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <section>
      <div className="relative h-44 sm:h-56 -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
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

        {/* تدرّج أسفل الغلاف: الاسم أبيض فوق صورة مجهولة، فبلا هذا التدرّج
            قد يقع فوق سماء بيضاء ويختفي */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" />

        {/* الشعار في زاوية الغلاف العليا: الترويسة أول ما تُرى في التطبيق،
            فهي مكان العلامة لا مكان إشعارٍ عابر */}
        <span className="absolute top-3 start-3 grid place-items-center w-10 h-10 rounded-full bg-black/35 backdrop-blur border border-white/20">
          <Logo size={24} gradientId="header-mark" />
        </span>

        <div className="absolute top-3 end-3 flex items-center rounded-full bg-black/35 backdrop-blur border border-white/20 px-0.5">
          <ShareButton locale={locale} />
          <span className="w-px h-5 bg-white/20" />
          <Link
            href="/profile/settings"
            aria-label={t.headerSettings}
            title={t.headerSettings}
            className="w-9 h-9 grid place-items-center text-white/90 hover:text-white transition"
          >
            <Icon name="settings" size={17} />
          </Link>
        </div>

        {/* الجرس في الزاوية السفلى المقابلة: الصورة والاسم يشغلان الجهة
            الأخرى، فلا يزاحمهما — ونقطة وردية حين ينتظرك شيء */}
        <Link
          href="/library?filter=watching"
          aria-label={t.headerAlerts}
          title={t.headerAlerts}
          className="absolute bottom-3 end-3 w-10 h-10 grid place-items-center rounded-full bg-black/35 backdrop-blur border border-white/20 text-white/90 hover:bg-black/55 transition"
        >
          <Icon name="bell" size={17} />
          {alerts > 0 && (
            <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-accent-2 ring-2 ring-black/40" />
          )}
        </Link>

        {/* كتلة الهوية على حافة الغلاف السفلى.
            زرّ التعديل تحت الاسم لا بجانبه: بجانبه كان يقتطع من عرض الاسم
            فيُبتر اسمٌ متوسّط الطول بثلاث نقاط. */}
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 pe-16 flex items-end gap-3">
          <Link href="/profile/edit" className="shrink-0">
            <Avatar
              src={avatarUrl}
              name={displayName}
              size={68}
              alt={t.avatarAlt}
              className="ring-4 ring-black/35"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-white truncate drop-shadow">
              {displayName}
            </h1>
            {username && (
              <p className="text-xs sm:text-sm text-white/70 truncate leading-tight">
                <span dir="ltr">@{username}</span>
              </p>
            )}
            <Link
              href="/profile/edit"
              className="inline-block mt-1.5 px-3 py-1 rounded-full border border-white/35 bg-black/25 backdrop-blur text-white text-[11px] font-semibold hover:bg-black/45 transition"
            >
              {t.editProfile}
            </Link>
          </div>
        </div>
      </div>

      {/* ===== شريط المستوى ===== */}
      <div className="mt-2.5 rounded-2xl border border-border bg-surface px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <p className="text-sm font-bold truncate">
            {t.levelLabel(level.level)} ·{" "}
            <span className="text-accent">{levelName(level.level, t)}</span>
          </p>
          <span className="text-[11px] text-muted shrink-0 tabular-nums">
            <span dir="ltr">{level.percent}%</span>
          </span>
        </div>

        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${level.percent}%`,
              background: "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
            }}
          />
        </div>

        <p className="text-[11px] text-muted mt-1.5">
          {level.isMax ? t.levelMax : t.levelNext(level.remaining)}
        </p>
      </div>
    </section>
  );
}
