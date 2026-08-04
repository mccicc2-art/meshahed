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
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#CA9A04" />
        </linearGradient>
      </defs>
      <g fill="url(#verified-gold)">
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="5.2" />
        <rect
          x="4.2"
          y="4.2"
          width="15.6"
          height="15.6"
          rx="5.2"
          transform="rotate(45 12 12)"
        />
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
 * ثم بطاقة الأرقام: أربع خانات، لكلٍّ أيقونتها ولونها فوق رقمها. اللون
 * يسبق القراءة — تُعرف خانة الأفلام من ورديّتها قبل أن تُقرأ كلمتها. ثم
 * سطر المراجعات والتقييمات ملتصقاً بها — رقمان يكمّلان أرقام البطاقة
 * فمكانهما تحتها لا بعد المستوى — ثم المستوى آخراً.
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
  comments,
  ratings,
  likes,
  show,
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
  comments: number;
  ratings: number;
  /** إعجابات تلقّتها مراجعاته */
  likes: number;
  /** ماذا يظهر — من تفضيلات التخصيص */
  show: { level: boolean; stats: boolean; followers: boolean; social: boolean };
  verified?: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <section>
      {/* ===== الغلاف ===== */}
      <div className="relative h-[15.75rem] sm:h-[20.25rem] -mx-4 -mt-[calc(1.5rem+env(safe-area-inset-top))] sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            quality={90}
            sizes="(max-width: 640px) 100vw, 1152px"
            /* `object-cover` يملأ العرض بلا تشويه، و`35%` رأسياً يرفع
               الإطار فيظهر أعلى الصورة — السماء والغيم — بدل أن يقتصّه
               التوسيط في غلافٍ عريض. و٣٠٪ بعد تقصير الغلاف تُبقي القدر
               نفسه من السماء في ارتفاعٍ أقلّ. */
            className="object-cover object-[50%_30%]"
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
        {/* حجابٌ متدرّج لا لونٌ مصمت: ١٠٪ في الأعلى فتبقى السماء مضيئة،
            و٤٠٪ في الأسفل حيث يقف النصّ. ثم تلاشٍ إلى لون الصفحة يذوّب
            الحافّة بدل أن يقطعها. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[color:var(--background)]" />

        <span className="absolute top-[calc(1rem+env(safe-area-inset-top))] start-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          <Logo size={30} gradientId="header-mark" />
        </span>

        {/* أدوات الغلاف كبسولةٌ واحدة تنسدل: الجرس ظاهر دائماً — وهو
            الوحيد الذي يحمل خبراً — والباقي تحته عند اللمس */}
        <HeaderTools alerts={alerts} locale={locale} />
      </div>

      {/* ===== كتلة الهوية ===== */}
      <div className="flex items-end gap-3 pe-16 -mt-[5.25rem] sm:-mt-[5.75rem] relative z-10">
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
              size={74}
              alt={t.avatarAlt}
              className="ring-[3px] ring-[color:var(--background)]"
            />
          </span>
        </Link>

        <div className="min-w-0 flex-1 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              {displayName}
            </h1>
            {verified && <VerifiedMark size={17} title={t.verifiedTitle} />}
          </div>

          {username && (
            <p className="text-[13px] text-white/55 truncate leading-tight mt-0.5 drop-shadow">
              <span dir="ltr">@{username}</span>
            </p>
          )}

          {(show.followers || show.social) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/75 leading-tight mt-1 drop-shadow">
              {show.followers && (
                <Link
                  href="/people"
                  className="shrink-0 hover:text-white transition"
                >
                  <span className="font-bold text-white tabular-nums">
                    {followers}
                  </span>{" "}
                  {t.followersLabel}
                </Link>
              )}
              {show.followers && show.social && (
                <span className="opacity-40 shrink-0">•</span>
              )}

              {/* التعليقات والتقييمات والإعجابات: أيقونة ورقم بلا كلمة —
                  الأيقونة تكفي لتعريفها فتدخل السطر دون أن تزحمه */}
              {show.social && (
                <>
                  <Link
                    href="/ratings?with=comments"
                    title={t.panelComments}
                    aria-label={`${comments} ${t.panelComments}`}
                    className="shrink-0 flex items-center gap-1 hover:text-white transition"
                  >
                    <Icon name="comment" size={14} />
                    <span className="font-bold text-white tabular-nums">
                      {comments}
                    </span>
                  </Link>
                  <Link
                    href="/ratings"
                    title={t.panelRatings}
                    aria-label={`${ratings} ${t.panelRatings}`}
                    className="shrink-0 flex items-center gap-1 hover:text-white transition"
                  >
                    <Icon name="star" size={14} />
                    <span className="font-bold text-white tabular-nums">
                      {ratings}
                    </span>
                  </Link>
                  <span
                    title={t.likesLabel}
                    aria-label={`${likes} ${t.likesLabel}`}
                    className="shrink-0 flex items-center gap-1"
                  >
                    <Icon name="heart" size={14} />
                    <span className="font-bold text-white tabular-nums">
                      {likes}
                    </span>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== بطاقة الأرقام =====
          الأيقونة إلى جانب الرقم لا فوقه — بمحاذاة كتلة الرقم والكلمة
          معاً. والفواصل خطوطٌ محشورة لا حدودَ خانة: تبتعد عن إطار
          البطاقة فلا تلمس الحافّة. */}
      {show.stats && (
        <div className="relative z-10 mt-5 rounded-[22px] border border-border/70 bg-[color:var(--surface)]/85 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="grid grid-cols-4">
            {stats.map((s, i) => {
              const cell = (
                <>
                  <Icon
                    name={s.icon}
                    size={22}
                    strokeWidth={1.8}
                    style={s.color ? { color: s.color } : undefined}
                    className={`shrink-0 ${s.color ? "" : "text-muted"}`}
                  />
                  <span className="min-w-0 text-start">
                    <span className="block text-[17px] font-bold leading-none tabular-nums">
                      {s.value}
                    </span>
                    <span className="block text-[11px] text-muted mt-1 leading-[1.25] min-h-[2.5em]">
                      {s.label}
                    </span>
                  </span>
                </>
              );
              const rule = i < stats.length - 1 && (
                <span
                  className="absolute inset-y-4 end-0 w-px bg-white/10"
                  aria-hidden
                />
              );
              const box =
                "relative flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-2 py-4";
              return s.href ? (
                <Link
                  key={s.key}
                  href={s.href}
                  className={`${box} hover:bg-white/5 transition`}
                >
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
      )}
      {/* ===== المستوى =====
          `z-10` ليس زينة: الغلاف عنصرٌ `relative`، والعناصر الموضوعة
          تُرسم فوق ما بعدها من عناصر التدفّق العادي — فكان سطر المستوى
          يختفي تحت حافّة الصورة على الشاشة العريضة. */}
      {show.level && (
        <div className="relative z-10 mt-5 px-0.5">
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
                  background:
                    "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
                }}
              />
            </div>
            <span className="text-[12px] text-muted shrink-0 tabular-nums">
              <span dir="ltr">{level.percent}%</span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
