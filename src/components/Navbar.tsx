import { Suspense } from "react";
import Link from "next/link";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SearchBox } from "./SearchBox";
import { NavLinks } from "./NavLinks";
import { NavAvatar } from "./NavAvatar";
import { LogoWordmark } from "./Logo";

export async function Navbar() {
  const { locale, t } = await getT();
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const displayName = profile?.nickname || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[color:var(--background)]/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="shrink-0" aria-label={t.brand}>
          <LogoWordmark size={28} gradientId="nav-logo" className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
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

              {/* تختفي في الرئيسية وحدها — ترويسة الرئيسية تعرضها كبيرة */}
              <Suspense fallback={null}>
                <NavAvatar
                  src={profile?.avatar_url}
                  name={displayName}
                  title={displayName || t.profile}
                  alt={t.avatarAlt}
                  ariaLabel={t.profile}
                />
              </Suspense>

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
