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
  coverPos = null,
  avatarPos = null,
  level,
  stats,
  followers,
  comments,
  ratings,
  show,
  verified = false,
  locale,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  /** التموضع الرأسي (٠–١٠٠) الذي اختاره المستخدم بالسحب في الإعدادات —
      غيابه يُبقي القيم القديمة (٣٠٪ للغلاف، الوسط للصورة) كما كانت */
  coverPos?: number | null;
  avatarPos?: number | null;
  level: LevelInfo;
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
      {/* ===== الغلاف =====
          الارتفاع ثابتٌ هنا عمداً — وهو ما يحجز المساحة قبل وصول الصورة
          فلا يقفز التخطيط عند تحميلها؛ لا حاجة لنسبة أبعادٍ فوقه. */}
      <div className="relative h-[14.2rem] sm:h-[18.2rem] -mx-4 -mt-[calc(1.5rem+env(safe-area-inset-top))] sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            quality={90}
            /* لطخةٌ داكنة تملأ الإطار حتى تصل الصورة: الغلاف صورةٌ يرفعها
               المستخدم فلا LQIP مبنيٌّ لها مسبقاً، وبكسلٌ واحد محايد أرخص
               بديلٍ عن فراغٍ شفّاف يومض ثم يمتلئ. لونه بين السطحين في
               الثيمين، والحجاب المتدرّج فوقه يبتلع الفرق. */
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQVlIDAADXAGyeIPIkAAAAAElFTkSuQmCC"
            sizes="(max-width: 640px) 100vw, 1152px"
            /* `object-cover` يملأ العرض بلا تشويه. والنسبة الرأسية صارت
               بيد صاحب الصورة — يضبطها سحباً من الإعدادات — و٣٠٪ عند
               الغياب هي القيمة التي كانت مكتوبةً هنا فلا يتغيّر أحد. */
            className="object-cover"
            style={{ objectPosition: `50% ${coverPos ?? 30}%` }}
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

        {/* أداة الغلاف الوحيدة: الإعدادات */}
        <HeaderTools locale={locale} />
      </div>

      {/* ===== كتلة الهوية ===== */}
      <div className="flex items-end gap-3 pe-16 -mt-[5.25rem] sm:-mt-[5.75rem] relative z-10">
        {/* حلقة متدرّجة حول الصورة: تفصلها عن الغلاف وتعطيها ثقل المرجع */}
        <Link href="/profile/settings?s=profile" className="shrink-0">
          <span
            className="block rounded-full p-[3px]"
            style={{
              background:
                "var(--gradient-brand)",
            }}
          >
            <Avatar
              src={avatarUrl}
              name={displayName}
              size={74}
              alt={t.avatarAlt}
              posY={avatarPos}
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

          {/* لا سطرَ @معرّف تحت الاسم: الاسم الظاهر يكفي هنا، والمعرّفُ
              تقنيّةُ روابطَ لا هويةُ عرضٍ — مكانُه صفحات المجتمع حيث يفرّق
              بين متشابهَي الاسم. كان يكرّر الاسم نفسه بصيغةٍ ثانية ويزاحم
              سطرَ الأرقام. قرارُ المالك. (الخاصية باقية في التوقيع
              فلا يتكسّر مستدعٍ، والعرضُ وحده سقط.) */}

          {(show.followers || show.social) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/75 leading-tight mt-1 drop-shadow">
              {show.followers && (
                <Link
                  href="/people"
                  title={t.followersLabel}
                  aria-label={`${followers} ${t.followersLabel}`}
                  className="shrink-0 flex items-center gap-1.5 hover:text-white transition"
                >
                  <Icon name="people-filled" size={16} />
                  <span className="font-bold text-white tabular-nums">
                    {followers}
                  </span>
                </Link>
              )}
              {show.followers && show.social && (
                <span className="opacity-40 shrink-0">•</span>
              )}

              {/* التعليقات والتقييمات: أيقونة ورقم بلا كلمة — الأيقونة
                  تكفي لتعريفها فتدخل السطر دون أن تزحمه. حُذف الإعجاب من
                  الشريط بطلب المالك */}
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== صفّ الأرقام =====
          بلا إطارٍ ولا بطاقة: الأيقونة يسار الرقم في سطرٍ واحد وتحتهما
          الكلمة، والفواصل الرأسية الرفيعة وحدها تفصل الخانات. */}
      {show.stats && (
        <div className="relative z-10 mt-5">
          <div
            className={`grid ${
              stats.length === 2
                ? "grid-cols-2"
                : stats.length === 3
                  ? "grid-cols-3"
                  : "grid-cols-4"
            }`}
          >
            {stats.map((s, i) => {
              const cell = (
                <>
                  <span className="flex items-center gap-2">
                    <Icon
                      name={s.icon}
                      size={20}
                      style={s.color ? { color: s.color } : undefined}
                      className={`shrink-0 ${s.color ? "" : "text-muted"}`}
                    />
                    <span className="text-[17px] font-bold leading-none tabular-nums">
                      {s.value}
                    </span>
                  </span>
                  <span className="block text-[11px] text-muted mt-1.5 leading-[1.25]">
                    {s.label}
                  </span>
                </>
              );
              const rule = i < stats.length - 1 && (
                <span
                  className="absolute inset-y-1 end-0 w-px bg-white/10"
                  aria-hidden
                />
              );
              const box =
                "relative flex flex-col items-center justify-center px-1 py-2.5";
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
                    "var(--gradient-brand-x)",
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
