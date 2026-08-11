"use client";

import { getDict, type Locale } from "@/lib/i18n";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { segmentedItem, segmentedTrackFull, sheetScroll } from "./ui/controls";
import { Icon } from "./Icon";
import { NewListForm } from "./NewListForm";

export type LibrarySort = "smart" | "title" | "progress";

/**
 * أدوات المكتبة خلف رمزٍ واحد (D-177، طلب أحمد).
 *
 * **الطلب بنصّه:** «في المكتبة هذا الرمز يفتح فلاتر الـsort وإنشاء قائمة
 * ليست، بحيث أستغني عن ظهورها وأستفيد من المساحات وتنسيق الشكل».
 *
 * **ما اختفى من الشاشة:** صفٌّ كامل تحت التبويبات كان يحمل صندوق البحث
 * وثلاث رقائق ترتيب، **وصفُّ إنشاء القائمة** داخل تبويب القوائم. الاثنان
 * كانا يأكلان أوّل ما تراه العين قبل أن يظهر ملصقٌ واحد — **والمكتبة
 * سؤالُها «ماذا عندي؟» وجوابُه بالأغلفة** (D-006).
 *
 * **وثلاثتها في ورقةٍ واحدة لا ثلاثة أبواب:** الترتيب والبحث وإنشاء
 * القائمة كلُّها «تحكّمٌ في اللوح لا محتواه» — وهو نفسُ ما كان يقوله
 * تعليقُ الصفّ المحذوف عن نفسه.
 *
 * **و`variant="top"` لا `bottom`:** فيها حقلا كتابة، ولوحةُ المفاتيح تأكل
 * نصفَ الشاشة السفليّ (D-018).
 *
 * **والورقة تُغلق نفسها عند أوّل حرفٍ يُكتب في البحث** — وهذا هو الفرق
 * بين ورقةٍ نافعة وورقةٍ تحجب ما تبحث عنه: تكتب فتُغلق فترى النتائج
 * تتصفّى تحتك. (والبحث محليٌّ فوريّ، فلا انتظار.)
 */
export function LibraryToolsSheet({
  locale,
  onClose,
  /** الترتيب الحاليّ — يغيب في تبويبَي الفنانين والقوائم فلا يُرسم قسمُه */
  sort,
  onSort,
  q,
  onQ,
  /** هل لهذا التبويب ترتيبٌ وبحث؟ (الأعمال نعم، الفنانون والقوائم لا) */
  showFilters,
}: {
  locale: Locale;
  onClose: () => void;
  sort: LibrarySort;
  onSort: (s: LibrarySort) => void;
  q: string;
  onQ: (v: string) => void;
  showFilters: boolean;
}) {
  const t = getDict(locale);

  const sorts: { id: LibrarySort; label: string }[] = [
    { id: "smart", label: t.sortSmart },
    { id: "title", label: t.sortTitle },
    { id: "progress", label: t.sortProgress },
  ];

  return (
    <Sheet
      open
      variant="top"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="lib-tools-title"
    >
      <SheetHeader
        id="lib-tools-title"
        title={t.libraryToolsTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />
      <div className={`${sheetScroll} px-4 pb-5 space-y-5`}>
        {showFilters && (
          <>
            <div>
              <label
                htmlFor="lib-q"
                className="block text-[13px] font-bold text-muted mb-2"
              >
                {t.librarySearchGroup}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 grid place-items-center text-muted pointer-events-none">
                  <Icon name="search" size={16} />
                </span>
                <input
                  id="lib-q"
                  type="search"
                  value={q}
                  onChange={(e) => {
                    onQ(e.target.value);
                    /* أوّلُ حرفٍ يُغلق الورقة: الفلترة فورية ومحلّية،
                       فإبقاءُ الورقة مفتوحةً يحجب ما تصفّيه للتوّ */
                    if (e.target.value.length === 1) onClose();
                  }}
                  placeholder={t.searchLibrary}
                  className="w-full min-h-11 bg-surface-2 border border-border rounded-control ps-9 pe-3 py-2.5 text-base placeholder:text-muted outline-none focus:border-accent transition"
                />
              </div>
            </div>

            <div>
              <span className="block text-[13px] font-bold text-muted mb-2">
                {t.librarySortGroup}
              </span>
              {/* ثلاثة خياراتٍ ظاهرة = مقسّم لا قائمة منسدلة (D-076) */}
              <div className={segmentedTrackFull} role="group" aria-label={t.librarySortGroup}>
                {sorts.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={sort === id}
                    onClick={() => {
                      onSort(id);
                      onClose();
                    }}
                    className={segmentedItem(
                      sort === id,
                      "flex-1 basis-0 min-w-0 px-2 py-2.5 text-[13px]",
                      false,
                    )}
                  >
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <span className="block text-[13px] font-bold text-muted mb-2">
            {t.listNewGroup}
          </span>
          <NewListForm locale={locale} onCreated={onClose} />
        </div>
      </div>
    </Sheet>
  );
}
