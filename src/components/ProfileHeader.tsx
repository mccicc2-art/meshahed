import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { getDict, num, type Locale } from "@/lib/i18n";

/**
 * ترويسة الصفحة الرئيسية.
 *
 * هذه أول ما تراه العين، وهي المكان الوحيد الذي يضع فيه المستخدم صورته
 * وغلافه — فهي التي تجعل الصفحة صفحته لا صفحة تطبيق. لذلك: غلاف يملأ
 * العرض، وصورة كبيرة تتداخل مع حافته السفلى بحلقة من لون الخلفية تفصلها
 * عنه، والاسم بجانبها لا تحتها حتى لا تطول الترويسة على الجوال.
 *
 * التكرار مع صورة الشريط العلوي يُحلّ من جهة الشريط: يخفيها في الرئيسية
 * وحدها (انظر NavAvatar). فلا وجهان في شاشة واحدة، ولا تفقد بقية الصفحات
 * مدخلها إلى الملف الشخصي.
 */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  coverUrl,
  followers,
  following,
  locale,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  followers: number;
  following: number;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <section>
      {/* الغلاف يلامس حافتي الشاشة وأسفل الشريط العلوي على الجوال، فيبدو
          امتداداً للواجهة لا بطاقةً طافية فوق شريط فارغ */}
      <div className="relative h-32 sm:h-44 -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-2xl overflow-hidden sm:border border-border">
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
            className="w-full h-full"
            style={{
              background:
                "linear-gradient(120deg, var(--glow-a), transparent 55%), linear-gradient(300deg, var(--glow-b), transparent 55%), var(--surface-2)",
            }}
          />
        )}

        {/* تدرّج أسفل الغلاف: يذيبه في الخلفية فلا يقطع الصفحة خطٌّ حاد */}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-transparent to-transparent" />

        <Link
          href="/profile/edit"
          aria-label={t.editHeaderAria}
          className="absolute top-3 end-3 text-xs bg-black/45 backdrop-blur border border-white/15 text-white/90 rounded-full px-3 py-1.5 hover:bg-black/65 transition"
        >
          ✎
        </Link>
      </div>

      {/* الهامش الجانبي على سطح المكتب يُدخل الصورة داخل حدّ الغلاف
          بدل أن تعلّق على حافته المستديرة */}
      <div className="flex items-end gap-3 -mt-9 sm:-mt-12 relative px-0.5 sm:px-5">
        <Link href="/profile/edit" className="shrink-0 rounded-full">
          <Avatar
            src={avatarUrl}
            name={displayName}
            size={76}
            alt={t.avatarAlt}
            className="ring-4 ring-[color:var(--background)] sm:!w-[104px] sm:!h-[104px]"
          />
        </Link>

        <div className="min-w-0 flex-1 pb-1">
          <h1 className="text-lg sm:text-2xl font-bold truncate leading-tight">{displayName}</h1>
          {username && (
            // inline-block لا block: مع dir="ltr" كان العنصر يمتدّ بعرض السطر
            // كاملاً فيهرب المعرّف إلى الحافة اليسرى بعيداً عن الاسم
            <Link
              href={`/u/${username}`}
              dir="ltr"
              className="inline-block max-w-full text-xs sm:text-sm text-muted hover:text-accent transition truncate"
            >
              @{username}
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-sm px-0.5 sm:px-5">
        <span>
          <b>{num(followers, locale)}</b>{" "}
          <span className="text-muted">{t.followersLabel}</span>
        </span>
        <span>
          <b>{num(following, locale)}</b>{" "}
          <span className="text-muted">{t.followingLabel}</span>
        </span>
        {username && (
          <Link
            href={`/u/${username}`}
            className="text-accent hover:brightness-110 transition"
          >
            {t.publicProfileLink} ›
          </Link>
        )}
      </div>

      {/* دعوة تظهر مرة واحدة لمن لم يضع غلافاً — الميزة موجودة لكن لا شيء يدلّ عليها */}
      {!coverUrl && (
        <Link
          href="/profile/edit"
          className="block mt-3 sm:mx-5 text-center text-xs text-muted hover:text-accent border border-dashed border-border rounded-xl py-2.5 transition"
        >
          🖼 {t.addCoverCta}
        </Link>
      )}
    </section>
  );
}
