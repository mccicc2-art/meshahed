import Link from "next/link";
import { getT } from "@/lib/locale";
import { Icon } from "@/components/Icon";

export default async function NotFound() {
  const { t } = await getT();

  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="grid place-items-center mb-4 text-muted" aria-hidden>
        <Icon name="search" size={44} />
      </div>
      <h1 className="text-xl font-bold">{t.notFoundTitle}</h1>
      <p className="text-sm text-muted leading-relaxed mt-2">{t.notFoundBody}</p>

      <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-accent text-[color:var(--on-accent)] font-semibold text-sm hover:brightness-110 transition"
        >
          {t.errorHome}
        </Link>
        <Link
          href="/search"
          className="px-5 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          {t.navSearch}
        </Link>
      </div>
    </div>
  );
}
