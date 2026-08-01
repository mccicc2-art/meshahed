import Link from "next/link";
import { getUser } from "@/lib/data";
import { SearchBox } from "./SearchBox";

export async function Navbar() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[color:var(--background)]/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">📺</span>
          <span className="font-bold text-lg tracking-tight">مشاهد</span>
        </Link>

        {user && (
          <nav className="hidden sm:flex items-center gap-1 text-sm text-muted">
            <Link href="/" className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-surface">
              الرئيسية
            </Link>
            <Link href="/library" className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-surface">
              مكتبتي
            </Link>
            <Link href="/stats" className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-surface">
              الإحصائيات
            </Link>
          </nav>
        )}

        <div className="flex-1 flex justify-end items-center gap-3">
          {user ? (
            <>
              <div className="hidden md:block w-56">
                <SearchBox />
              </div>
              <form action="/auth/signout" method="post">
                <button className="text-sm text-muted hover:text-foreground px-3 py-2 rounded-lg hover:bg-surface">
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
