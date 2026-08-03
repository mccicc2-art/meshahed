import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/Avatar";
import { getDict, num, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * ترويسة الرئيسية — الصورة في وسط الغلاف.
 *
 * الصورة في الوسط لا في الطرف: العين تبدأ من منتصف الشاشة فتقرأ الاسم
 * والأرقام في مسار واحد نازل، بدل أن تقفز من طرف لطرف. والاسم والمتابعون
 * سطران متلاصقان أسفلها، فلا يصير للترويسة ثلاثة أسطر منفصلة كما كانت.
 *
 * الغلاف ٩٦ بكسل والكتلة كلها نحو ٢٠٠ — أي ربع شاشة الجوال، وهو سقفٌ
 * مقصود: هذه صفحة تعرض الأعمال لا صاحب الحساب.
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
      <div className="relative h-24 sm:h-36 -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-transparent to-transparent" />

        <Link
          href="/profile/edit"
          aria-label={t.editHeaderAria}
          className="absolute top-2.5 end-2.5 w-8 h-8 grid place-items-center bg-black/40 backdrop-blur border border-white/15 text-white/90 rounded-full hover:bg-black/60 transition"
        >
          <Icon name="edit" size={15} />
        </Link>
      </div>

      {/* الصورة تتوسّط الغلاف وتتداخل مع حافته السفلى */}
      <div className="flex flex-col items-center -mt-8 relative">
        <Link href="/profile/edit">
          <Avatar
            src={avatarUrl}
            name={displayName}
            size={62}
            alt={t.avatarAlt}
            className="ring-4 ring-[color:var(--background)]"
          />
        </Link>

        <h1 className="text-[15px] sm:text-lg font-bold mt-1 text-center truncate max-w-full px-4">
          {displayName}
        </h1>

        {/* المعرّف والمتابعون في سطر واحد — كانت ثلاثة أسطر منفصلة */}
        <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap justify-center px-4">
          {username && (
            <Link href={`/u/${username}`} dir="ltr" className="hover:text-accent transition">
              @{username}
            </Link>
          )}
          {username && <span aria-hidden>·</span>}
          <span>
            <b className="text-foreground">{num(followers, locale)}</b> {t.followersLabel}
          </span>
          <span aria-hidden>·</span>
          <span>
            <b className="text-foreground">{num(following, locale)}</b> {t.followingLabel}
          </span>
        </p>
      </div>
    </section>
  );
}
