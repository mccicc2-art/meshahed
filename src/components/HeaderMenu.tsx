"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * قائمة الترس في الترويسة.
 *
 * كان الترس يقفز مباشرةً إلى صفحة الإعدادات، فما وراءه — التعديل
 * والإحصاءات والسجلّ والقوائم والخروج — لا يُعرف إلا بعد الوصول. صار
 * الترس يفتح قائمةً تعرض الوجهات كلها، فالاختيار يسبق الانتقال.
 *
 * القائمة تُرسم في جسم الصفحة لا داخل الترويسة: الغلاف صندوقٌ يقصّ ما
 * تجاوز حدّه (`overflow-hidden`) فكانت القائمة تُبتر عند حافّته. فصارت
 * تُنقل إلى `body` وتُثبَّت بإحداثيات الزرّ نفسه، فتنسدل كاملةً فوق
 * الصفحة. وتُغلق بالنقر خارجها وبمفتاح الهروب وعند تمرير الصفحة.
 */
export function HeaderMenu({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; end: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    setPos({
      top: r.bottom + 8,
      end: rtl ? r.left : window.innerWidth - r.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();

    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panel.current?.contains(target) || btn.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const close = () => setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, place]);

  const links: { href: string; icon: IconName; label: string }[] = [
    { href: "/profile/edit", icon: "edit", label: t.editProfile },
    { href: "/profile/settings", icon: "settings", label: t.settingsTitle },
    { href: "/stats", icon: "chart", label: t.statsTitle },
    { href: "/diary", icon: "clock", label: t.diaryTitle },
    { href: "/lists", icon: "list", label: t.listsTitle },
  ];

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.headerSettings}
        title={t.headerSettings}
        className="grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/15 text-white/90 hover:bg-black/60 transition"
      >
        <Icon name="settings" size={17} />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            style={{ top: pos.top, insetInlineEnd: pos.end }}
            className="fixed z-[100] w-60 rounded-2xl border border-white/10 bg-[color:var(--surface)]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.55)] overflow-hidden"
          >
            <div className="py-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-[13px] hover:bg-white/5 transition"
                >
                  <Icon name={l.icon} size={16} className="text-muted shrink-0" />
                  <span className="truncate">{l.label}</span>
                </Link>
              ))}
            </div>

            <div className="border-t border-white/10 px-3.5 py-3">
              <p className="text-[10px] text-muted mb-2">{t.languageSection}</p>
              <LanguageSwitch locale={locale} compact />
            </div>

            <form action="/auth/signout" method="post" className="border-t border-white/10">
              <button
                type="submit"
                role="menuitem"
                className="w-full text-start px-3.5 py-2.5 text-[13px] text-muted hover:text-red-300 hover:bg-white/5 transition"
              >
                {t.signOutAccount}
              </button>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
