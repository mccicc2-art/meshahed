"use client";

import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { chipClass } from "./ui/controls";

export type ListsSource = "all" | "curated" | "friends" | "community";

/**
 * فلتر مصدر القوائم — رقائق فوق ديسكفري القوائم (D-082، طلب المالك).
 *
 * رقائق لا منسدلة: أربعة خياراتٍ تُقرأ بلمحة (D-016)، والحالة في الرابط
 * (`?tab=lists&src=`) كسائر فلاتر اكتشف — قابلة للمشاركة، والخادم يرسم
 * القسم المختار بلا وميض. `replace` لا `push` — نفس حجّة الفلاتر.
 * اختيار المصدر يمسح البحث: بحثٌ قديم فوق مصدرٍ جديد يعرض نتيجةً لا
 * تخصّ ما اختير.
 */
export function ListsSourceChips({ locale, src }: { locale: Locale; src: ListsSource }) {
  const t = getDict(locale);
  const router = useRouter();

  const chips: { id: ListsSource; label: string }[] = [
    { id: "all", label: t.browseAll },
    { id: "curated", label: t.listsCurated },
    { id: "friends", label: t.listsFriendsRail },
    { id: "community", label: t.publicListsRail },
  ];

  function go(next: ListsSource) {
    tap(8);
    const p = new URLSearchParams({ tab: "lists" });
    if (next !== "all") p.set("src", next);
    router.replace(`/news?${p.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label={t.listsSrcGroup}
      className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={src === c.id}
          onClick={() => go(c.id)}
          className={`${chipClass(src === c.id, "sm")} shrink-0`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
