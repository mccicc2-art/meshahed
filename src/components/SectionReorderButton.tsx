"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfileSectionOrder } from "@/lib/actions";
import type { SortableSection } from "@/lib/profilePrefs";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { Icon } from "./Icon";
import { ReorderSheet, listItemKey, type ReorderItem } from "./ReorderSheet";

/**
 * 🆕 **مقبضُ ترتيبٍ لقسمٍ من أقسام الملفّ** (D-581، طلبُ أحمد بلقطةٍ
 * على مقبض «Shows»: «هذي العلامة حطّها في كل شي في المفضّلة —
 * المسلسلات والليست وكل شي أقدر أرتّبه»).
 *
 * **أخو `FavoritesRail` لا نسخةٌ منه**: ذاك يرتّب قائمةَ المفضّلة
 * الحقيقيّة (`reorderList` على `sort_order` — D-567)، **وهذا يرتّب
 * عرضَ قسمٍ مصدرُه ليس قائمةً** (متابعاتٌ · فنّانون · قوائمُك المعلنة)
 * **فيكتب في `profile_prefs.sectionOrder`** — كاتبان مختلفان لورقةٍ
 * واحدة (`ReorderSheet`)، **والشكلُ واحدٌ بالبكسل**: نفسُ المقبض ونفسُ
 * الورقة، فالقارئُ يتعلّم الإيماءةَ مرّةً.
 *
 * **زرٌّ يُرسم عند المنادي لا مكوّنُ صفٍّ كامل** — لأن أقسامَ الصفحة
 * ترسم صفوفَها بثلاثة أشكال (`PosterRail` · `PublicListsRail`)،
 * **والزرُّ يجلس في خانة `action` القائمة في كلٍّ منها.**
 */
export function SectionReorderButton({
  section,
  items,
  locale,
}: {
  section: SortableSection;
  /** صفوفُ القسم بترتيبها المعروض الآن */
  items: ReorderItem[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  /* **صفٌّ بعملٍ واحدٍ لا يُرتَّب** — والمنادي أصلاً لا يرسم الزرَّ
     لغير صاحب الصفحة (D-217: لا بابَ لا يفعل) */
  if (items.length < 2) return null;

  function save(newKeys: string[]) {
    setOpen(false);
    start(async () => {
      try {
        await saveProfileSectionOrder(section, newKeys);
        router.refresh();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tap(6);
          setOpen(true);
        }}
        disabled={pending}
        aria-label={t.listReorder}
        title={t.listReorder}
        className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent active:scale-90 transition disabled:opacity-60"
      >
        <Icon name="grip" size={18} />
      </button>

      {open && (
        <ReorderSheet items={items} t={t} onClose={() => setOpen(false)} onDone={save} />
      )}
    </>
  );
}

/* ⚖️ **ومفاتيحُ الأقسام غادرت هذا الملفّ إلى `@/lib/profilePrefs`**
   (D-669): **هذا ملفُّ `"use client"`، وصفحةُ الملفّ خادميّة** — **وقيمةٌ
   خالصةٌ تُستورَد من وحدةِ عميلٍ إلى مكوّنٍ خادميّ تصل مرجعَ عميلٍ لا
   كائناً**، فكانت `sectionKeyOf.artist` ترمي `TypeError` وقتَ التشغيل.
   **دالّةٌ خالصةٌ لا تسكن ملفَّ مكوّن.** */

export type { ReorderItem };
export { listItemKey };
