import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { getDict, num, type Locale } from "@/lib/i18n";

/**
 * ترويسة الرئيسية — مضغوطة.
 *
 * كانت غلافاً ثم صفّ صورة ثم صفّ متابعين ثم دعوة غلاف: أربع طبقات فوق
 * بعضها تلتهم نصف الشاشة قبل أن يظهر عملٌ واحد. الآن طبقة واحدة: كل شيء
 * داخل الغلاف نفسه — الصورة والاسم والمعرّف والمتابعون فوق تعتيم سفلي.
 * الارتفاع ١٢٨ بكسل على الجوال، ومع شريط الأعداد الملتصق به يبقى المجموع
 * نحو ربع الشاشة كما ينبغي لصفحة غرضها عرض الأعمال لا عرض صاحبها.
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
    <section className="relative h-32 sm:h-44 -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
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

      {/* تعتيم من الأسفل فقط: يبقي أعلى الغلاف ظاهراً ويضمن قراءة الاسم */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      <Link
        href="/profile/edit"
        aria-label={t.editHeaderAria}
        className="absolute top-3 end-3 w-8 h-8 grid place-items-center text-sm bg-black/40 backdrop-blur border border-white/15 text-white/90 rounded-full hover:bg-black/60 transition"
      >
        ✎
      </Link>

      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5 flex items-end gap-3">
        <Link href="/profile/edit" className="shrink-0">
          <Avatar
            src={avatarUrl}
            name={displayName}
            size={52}
            alt={t.avatarAlt}
            className="ring-2 ring-white/25 sm:!w-16 sm:!h-16"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-bold text-white truncate leading-tight drop-shadow">
            {displayName}
          </h1>
          <p className="text-[11px] sm:text-xs text-white/70 truncate">
            {username && <span dir="ltr">@{username}</span>}
            {username && <span className="mx-1.5">·</span>}
            <b className="text-white/90">{num(followers, locale)}</b> {t.followersLabel}
            <span className="mx-1.5">·</span>
            <b className="text-white/90">{num(following, locale)}</b> {t.followingLabel}
          </p>
        </div>

        {username && (
          <Link
            href={`/u/${username}`}
            className="hidden sm:inline-block shrink-0 text-[11px] font-semibold text-white/90 bg-white/15 backdrop-blur border border-white/20 rounded-full px-3 py-1.5 hover:bg-white/25 transition"
          >
            {t.publicProfileLink}
          </Link>
        )}
      </div>
    </section>
  );
}
