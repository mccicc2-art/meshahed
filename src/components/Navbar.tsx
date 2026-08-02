import { Suspense } from "react";
import Link from "next/link";
import { getUser, getProfile } from "@/lib/data";
import { SearchBox } from "./SearchBox";
import { NavLinks } from "./NavLinks";
import { Avatar } from "./Avatar";

export async function Navbar() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const displayName = profile?.nickname || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[color:var(--background)]/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">📺</span>
          <span className="font-bold text-lg tracking-tight hidden sm:inline">مشاهد</span>
        </Link>

        {user && <NavLinks />}

        <div className="flex-1 flex justify-end items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden md:block w-56">
                <Suspense fallback={null}>
                  <SearchBox />
                </Suspense>
              </div>

              {/* الصورة أولاً في DOM لتظهر يمين زر الخروج في الاتجاه العربي */}
              <Link
                href="/profile"
                title={displayName || "الملف الشخصي"}
                aria-label="الملف الشخصي"
                className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-accent transition"
              >
                <Avatar src={profile?.avatar_url} name={displayName} size={36} />
              </Link>

              {/* على الجوال يُخفى زر الخروج تفادياً لتزاحم الشريط — وهو متاح داخل الملف الشخصي */}
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button className="text-sm text-muted hover:text-foreground px-2.5 sm:px-3 py-2 rounded-lg hover:bg-surface transition">
                  خروج
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium bg-accent text-[#1a1200] px-4 py-2 rounded-lg hover:brightness-110"
            >
              دخول
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
