import { Suspense } from "react";
import Link from "next/link";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SearchBox } from "./SearchBox";
import { NavLinks } from "./NavLinks";
import { Avatar } from "./Avatar";

export async function Navbar() {
  const { locale, t } = await getT();
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const displayName = profile?.nickname || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[color:var(--background)]/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">📺</span>
          <span className="font-bold text-lg tracking-tight hidden sm:inline">{t.brand}</span>
        </Link>

        {user && <NavLinks locale={locale} />}

        <div className="flex-1 flex justify-end items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden md:block w-56">
                <Suspense fallback={null}>
                  <SearchBox locale={locale} />
                </Suspense>
              </div>

              {/* الصورة أولاً في DOM لتظهر يمين زر الخروج في الاتجاه العربي */}
              <Link
                href="/profile/edit"
                title={displayName || t.profile}
                aria-label={t.profile}
                className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-accent transition"
              >
                <Avatar
                  src={profile?.avatar_url}
                  name={displayName}
                  size={36}
                  alt={t.avatarAlt}
                />
              </Link>

              {/* زر الخروج صار داخل إعدادات الحساب فقط */}
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium bg-accent text-[color:var(--on-accent)] px-4 py-2 rounded-lg hover:brightness-110"
            >
              {t.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
