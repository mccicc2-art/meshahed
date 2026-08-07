"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

interface Suggestion {
  kind: "tv" | "movie" | "person";
  id: number;
  title: string;
  year?: string;
  poster: string | null;
  rating?: number | null;
  subtitle?: string;
}

export function SearchBox({ big = false, locale }: { big?: boolean; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // تفريغ القائمة يتم عند الكتابة لا داخل التأثير (تفادي إعادة التصيير المتتالية)
  function changeQ(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setItems([]);
      setOpen(false);
      setLoading(false);
    }
  }

  // اقتراحات تبدأ من ٣ أحرف مع تأخير بسيط لتقليل الطلبات
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setItems(data.results ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        /* أُلغي الطلب أو فشل — تُتجاهل بصمت */
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function go(s: Suggestion) {
    setOpen(false);
    setQ("");
    router.push(
      s.kind === "person"
        ? `/person/${s.id}`
        : `/${s.kind === "tv" ? "show" : "movie"}/${s.id}`,
    );
  }

  function submit() {
    if (!q.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative">
          <input
            value={q}
            onChange={(e) => changeQ(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => items.length && setOpen(true)}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            className={`w-full rounded-xl bg-surface border border-border outline-none focus:border-accent transition ${
              big ? "px-5 py-4 text-lg" : "px-4 py-2 text-sm"
            } pe-10`}
          />
          <span
            className={`absolute top-1/2 -translate-y-1/2 end-3 text-muted ${big ? "text-xl" : ""}`}
          >
            <Icon name={loading ? "hourglass" : "search"} size={18} />
          </span>
        </div>
      </form>

      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-2 w-full max-h-[22rem] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
          {items.map((s, i) => (
            <li key={`${s.kind}-${s.id}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(s)}
                className={`w-full flex items-center gap-3 p-2.5 text-start transition ${
                  active === i ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span className="w-9 shrink-0">
                  {s.poster ? (
                    /* `next/image` لا وسمَ خام: الخام يطلب TMDB مباشرةً
                       من المتصفّح وكان لا يظهر عند المستخدم */
                    <Image
                      src={s.poster}
                      alt=""
                      width={36}
                      height={54}
                      className="w-9 h-[54px] object-cover rounded-md border border-border"
                    />
                  ) : (
                    <span className="w-9 h-[54px] rounded-md bg-surface-2 grid place-items-center text-muted">
                      🎬
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{s.title}</span>
                  <span className="block text-xs text-muted truncate">
                    {s.kind === "person"
                      ? s.subtitle || t.searchPeopleTitle
                      : `${s.kind === "tv" ? t.typeSeries : t.typeMovie}${s.year ? ` · ${s.year}` : ""}${s.rating ? ` · ★ ${s.rating}` : ""}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-border">
            <button
              type="button"
              onClick={submit}
              className="w-full p-2.5 text-sm text-muted hover:text-accent hover:bg-surface-2 transition"
            >
              {t.searchAllResults(q.trim())}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
