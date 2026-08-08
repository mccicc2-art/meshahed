"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * حقل البحث في تبويب «القوائم» — اكتشف.
 *
 * بحثُ خادمٍ عبر الرابط لا ترشيحٌ محليّ: القوائم العامة كلّها ليست
 * محمَّلةً أصلاً (بخلاف بحث الرسائل)، فالحقل يكتب `?tab=lists&q=` والخادم
 * يبحث بـ`ilike` ويرسم. والحالة في الرابط تعني نتيجةً قابلةً للمشاركة
 * وللرجوع — نفس عقيدة فلاتر اكتشف كلّها.
 *
 * مهلة ٤٠٠م.ث قبل الكتابة في الرابط: كل تغييرٍ يعيد الرسم على الخادم
 * ويضرب القاعدة، ومن يكتب «مارفل» لا يريد خمس جولاتٍ لخمسة أحرف.
 * و`replace` لا `push` — نفس حجّة الفلاتر: زرّ الرجوع يخرج من التصفّح
 * لا يمشي حرفاً حرفاً.
 */
export function ListsSearchField({ locale, initial }: { locale: Locale; initial: string }) {
  const t = getDict(locale);
  const router = useRouter();
  const [q, setQ] = useState(initial);

  /* أوّل ركوبٍ لا يكتب في الرابط: القيمة جاءت منه أصلاً، وكتابتها تعيده
     كما هو وتضيف تجديداً بلا سبب */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h = setTimeout(() => {
      const p = new URLSearchParams({ tab: "lists" });
      const v = q.trim();
      if (v) p.set("q", v);
      router.replace(`/news?${p.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(h);
  }, [q, router]);

  return (
    /* نفس هيكل حقل بحث الرسائل حرفياً — أيقونة start وزرّ مسح end؛ لا
       عائلة تحكّمٍ جديدة */
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted">
        <Icon name="search" size={16} />
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.listsSearchPlaceholder}
        aria-label={t.listsSearchPlaceholder}
        type="search"
        className="w-full rounded-full bg-surface-2 border border-border ps-9 pe-9 py-2 text-base outline-none focus:border-accent transition"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label={t.closeLabel}
          className="absolute inset-y-0 end-2 my-auto grid place-items-center w-7 h-7 rounded-full text-muted hover:text-foreground hover:bg-surface transition"
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}
