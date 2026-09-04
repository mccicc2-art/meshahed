"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderList } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { Icon } from "./Icon";
import { PosterRail } from "./PosterRail";
import { ReorderSheet, listItemKey, type ReorderItem } from "./ReorderSheet";

/**
 * 🆕 **صفُّ مفضّلةٍ يُرتَّب من عنوانه** (D-567، طلبُ أحمد: «أحتاج أضغط
 * على فِلم أو مسلسل أو أنمي ويفتح قائمتهم وأرتّبهم — مثلاً أحطّ بريكنغ
 * باد الأوّل»).
 *
 * ================= القرار، وما رُفض =================
 *
 * **واقترح أحمد بديلاً**: ثلاثُ قوائمَ حقيقيّة (مفضّلة أفلام · مسلسلات ·
 * أنمي). **ورُفض بعد أن قِيس ثمنُه**: **المفضّلةُ قائمةٌ واحدةٌ في
 * `user_lists` بعلامة `kind='favorites'`** (D-130) — **وقلبٌ واحدٌ
 * يكتبها.** **وثلاثُ قوائمَ تعني أن القلبَ يجب أن يختار**، **وعلَمُ
 * الأنمي `null` في سبعةَ عشرَ من عشرين متابعةٍ عنده** — **فأنمي يقلبه
 * اليوم يذهب إلى قائمة المسلسلات خطأً**، ويحتاج نقلاً يدويّاً بعد
 * التصنيف. **وميزةٌ تخطئ في أوّل استعمالٍ أسوأُ من غيابها** (D-217).
 * **واختار أحمد هذا الباب.**
 *
 * ⚠️ **والترتيبُ محفوظٌ أصلاً**: `sort_order` على `user_list_items`
 * (D-043)، **و`profile_favorites` تفرز به**، **والصفوفُ الثلاثةُ
 * تقرؤه** — **فلم يكن ينقص إلا بابٌ يُفتح منه.**
 *
 * ================= الدمج =================
 *
 * **الورقةُ ترتّب نوعاً واحداً، والقائمةُ واحدةٌ للأنواع الثلاثة** —
 * **فالترتيبُ الجديد يُدمج في مواضع النوع نفسِه ولا يمسّ جيرانه**:
 * كلُّ خانةٍ كان يشغلها عملٌ من هذا النوع تُملأ بالتالي من ترتيبه
 * الجديد، **وما ليس منه يبقى في خانته بالضبط.** **فمن رتّب مسلسلاته
 * لا يُبعثر أفلامَه.**
 */
export function FavoritesRail({
  title,
  listId,
  fullKeys,
  items,
  locale,
  children,
}: {
  title: string;
  /** معرّفُ قائمة المفضّلة — **غيابُه يعني «لا ترتيب»**: صفحةُ زائرٍ */
  listId: string | null;
  /** مفاتيحُ المفضّلة كلِّها بترتيبها الحاليّ — **وعاءُ الدمج** */
  fullKeys: string[];
  /** صفوفُ هذا النوع وحدَها، بترتيبها الحاليّ */
  items: ReorderItem[];
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  /* **زرٌّ لا يُرسم لمن لا يملك القائمة** — **وعنوانٌ يُضغط ولا يفعل
     شيئاً وعدٌ كاذب** (D-217). **وصفٌّ بعملٍ واحدٍ لا يُرتَّب** فلا
     بابَ له. */
  const canSort = !!listId && items.length > 1;

  function save(newKeys: string[]) {
    if (!listId) return;
    const mine = new Set(items.map(listItemKey));
    let i = 0;
    /* **الدمج**: خاناتُ هذا النوع تُملأ بترتيبه الجديد، وما سواه يثبت */
    const merged = fullKeys.map((k) => (mine.has(k) ? (newKeys[i++] ?? k) : k));
    setOpen(false);
    start(async () => {
      try {
        await reorderList(listId, merged);
        router.refresh();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <>
      <PosterRail
        title={title}
        /* **العنوانُ زرٌّ حين تكون الوجهةُ فتحَ ورقةٍ لا صفحة** — عقدُ
           `PosterRail` نفسُه منذ D-422. */
        onTitle={canSort ? () => { tap(6); setOpen(true); } : undefined}
        action={
          canSort ? (
            <button
              type="button"
              onClick={() => { tap(6); setOpen(true); }}
              disabled={pending}
              aria-label={t.listReorder}
              title={t.listReorder}
              className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent active:scale-90 transition disabled:opacity-60"
            >
              <Icon name="grip" size={18} />
            </button>
          ) : undefined
        }
      >
        {children}
      </PosterRail>

      {open && (
        <ReorderSheet
          items={items}
          t={t}
          onClose={() => setOpen(false)}
          onDone={save}
        />
      )}
    </>
  );
}
