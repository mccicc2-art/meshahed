"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { ShareButton } from "./ShareButton";

/**
 * كبسولة أدوات الغلاف.
 *
 * كانت تعرض أدواتها الثلاث دائماً فتأخذ ثلث ارتفاع الغلاف وتزاحم الصورة.
 * صارت تُظهر الجرس وحده — وهو الوحيد الذي يحمل خبراً — وتنسدل تحته
 * الإعدادات والمشاركة عند لمسه.
 *
 * الانسدال بـ`grid-rows` من `0fr` إلى `1fr` لا بـ`max-height` المقدَّرة:
 * الارتفاع يُحسب من المحتوى نفسه، فلا رقم سحريّ يكسر الحركة إن أضيفت
 * أداة ثالثة. ومعه تلاشٍ وإزاحة خفيفة حتى لا تظهر الأدوات دفعةً واحدة.
 */
export function HeaderTools({
  alerts,
  locale,
}: {
  alerts: number;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** ٤٨ بكسل ناقص ٨٪ */
  const W = "w-[44.16px]";
  const item = `grid place-items-center ${W} h-12 text-foreground hover:bg-white/[0.06] transition`;

  return (
    <div
      ref={box}
      className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] end-3 rounded-[22px] border border-border overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
    >
      {/* الخلفية طبقةٌ واحدة خلف الجميع لا خلفيةٌ على كل زرّ: القسم
          المنسدل يُرقّى إلى طبقة رسمٍ مستقلّة أثناء الحركة، فيعيد
          `backdrop-blur` أخذ عيّنته داخلها ويظهر خطُّ وصلٍ عند الحدّ. */}
      <span
        className="absolute inset-0 bg-[color:var(--elevated)]/95 backdrop-blur-xl"
        aria-hidden
      />

      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t.headerAlerts}
          title={t.headerAlerts}
          className={`relative ${item}`}
        >
          <Icon name="bell" size={19} />
          {alerts > 0 && (
            <span className="absolute top-2.5 end-2 w-2 h-2 rounded-full bg-accent-2 ring-2 ring-[color:var(--elevated)]" />
          )}
        </button>

        <div
          className={`grid transition-all duration-[280ms] ease-out ${
            open
              ? "grid-rows-[1fr] opacity-100 translate-y-0"
              : "grid-rows-[0fr] opacity-0 -translate-y-1"
          }`}
        >
          <div className="overflow-hidden flex flex-col items-center">
            <span className="w-6 h-px bg-[color:var(--divider)]" aria-hidden />
            <Link
              href="/profile/settings"
              aria-label={t.headerSettings}
              title={t.headerSettings}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className={item}
            >
              <Icon name="settings" size={19} />
            </Link>
            <span className="w-6 h-px bg-[color:var(--divider)]" aria-hidden />
            <span className={`${item} hover:bg-transparent`}>
              <ShareButton locale={locale} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
