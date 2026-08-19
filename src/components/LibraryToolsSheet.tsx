"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { Sheet, SheetHeader, SheetTabs } from "./ui/Sheet";
import { segmentedItem, segmentedTrackFull, sheetScroll } from "./ui/controls";
import { buttonClass } from "./ui/Button";
import { Icon } from "./Icon";
import { NewListForm } from "./NewListForm";
/* القسم الرابع في هذه الورقة — نفسُ المكوّن في اكتشف والمجتمع (D-179) */
import { TabsPrefs } from "./TabsPrefs";
import type { TabPref } from "@/lib/tabPrefs";

export type LibrarySort = "smart" | "title" | "progress" | "added";

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
 * 🆕 **وتبويبان لا تمريرةٌ واحدة** (D-397، بلاغُ أحمد: «رتّبه بشكل
 * أفضل وافصل التاب مثل الكومينتي والديسكفري»): **أربعةُ أقسامٍ في
 * تمريرةٍ واحدة تُقصّ آخرَها عند حافّة الشاشة** — في لقطته كان «Artists»
 * نصفَ سطر. **والقسمةُ قسمةُ أختيها حرفاً**: «أدوات» ما تفعله الآن
 * (بحثٌ وترتيبٌ وإنشاءُ قائمة) · «عرض» ما يبقى بعد أن تُغلق الورقة
 * (ترتيبُ التبويبات وإظهارُها). **وثلاثُ أوراقٍ بإيقاعٍ واحد** (القاعدة ٦).
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
  tabPrefs,
  tabLabels,
}: {
  locale: Locale;
  onClose: () => void;
  sort: LibrarySort;
  onSort: (s: LibrarySort) => void;
  q: string;
  onQ: (v: string) => void;
  showFilters: boolean;
  /** القسم الرابع: ترتيبُ تبويبات المكتبة وإظهارها (D-179) */
  tabPrefs: TabPref[];
  tabLabels: Record<string, string>;
}) {
  const t = getDict(locale);
  /* **وتفتح على «أدوات» دائماً** — وهي التي جئتَ لأجلها؛ **و«عرض»
     إعدادٌ يُضبط مرّةً ويُنسى** (نصُّ `CommunityTools` حرفاً). */
  const [tab, setTab] = useState<"do" | "see">("do");

  /* 🆕 **أربعةٌ لا ثلاثة** (D-350): «الأحدث» رابعاً — **والمقسّمُ يحتمل
     الرابع** لأن `flex-1 basis-0` يقسّم العرضَ بالتساوي و`truncate` يمنع
     الأطولَ من توسيع خانته (نصُّ D-076 نفسُه)، **والكلماتُ قصيرةٌ عمداً.** */
  const sorts: { id: LibrarySort; label: string }[] = [
    { id: "smart", label: t.sortSmart },
    { id: "added", label: t.sortAdded },
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
      <SheetTabs
        prefix="lib-tools"
        label={t.libraryToolsTitle}
        tab={tab}
        onTab={setTab}
        doLabel={t.communityToolsTabDo}
        seeLabel={t.communityToolsTabSee}
      />

      <div className={`${sheetScroll} px-4 pb-5 space-y-5`}>
        {tab === "do" && (
        <div
          role="tabpanel"
          id="lib-tools-panel-do"
          aria-labelledby="lib-tools-tab-do"
          className="space-y-5"
        >
        {showFilters && (
          <>
            <div>
              <label
                htmlFor="lib-q"
                className="block text-[12px] font-bold text-muted mb-2"
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
              <span className="block text-[12px] font-bold text-muted mb-2">
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
                      "flex-1 basis-0 min-w-0 px-2 py-2.5 text-[14px]",
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
          <span className="block text-[12px] font-bold text-muted mb-2">
            {t.listNewGroup}
          </span>
          <NewListForm locale={locale} onCreated={onClose} />
        </div>
        </div>
        )}

        {/* **«عرض»: ما يبقى بعد أن تُغلق الورقة** — نفسُ `TabsPrefs`
            التي في اكتشف والمجتمع (D-179). و`-mx-4` يردّ حشو الجسم:
            صفوفُ القسم تحمل حشوها بنفسها فتصطفّ في الأوراق الثلاث عند
            البكسل نفسِه. */}
        {tab === "see" && (
        <div
          role="tabpanel"
          id="lib-tools-panel-see"
          aria-labelledby="lib-tools-tab-see"
          className="-mx-4"
        >
          <TabsPrefs
            locale={locale}
            surface="library"
            prefs={tabPrefs}
            labels={tabLabels}
            title={t.tabsPrefsGroup}
          />
        </div>
        )}
      </div>

      {/* 🆕 **«مسح الكل» — نفسُ وصفة ورقة اكتشف بالبكسل** (D-457، توحيدُ
          المرحلة ٨). **ومحوراه هما اللذان يَعُدّهما الزرُّ فوقها**
          (D-452): بحثٌ وترتيب — **فما يقوله العدّادُ هو ما يمسحه الزرّ**،
          ولا رقمٌ يشير إلى ما لا يُمسح.
          **ويغيب حين لا شيءَ يُمسح** (D-044)، **وفي «أدوات» وحدَها**:
          تبويبُ «عرض» ترتيبُ تبويباتٍ لا فلاتر (D-325). */}
      {showFilters && tab === "do" && (q.trim().length > 0 || sort !== "smart") && (
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-t border-[color:var(--divider)] bg-[color:var(--elevated)]">
          <button
            type="button"
            onClick={() => {
              tap(6);
              onQ("");
              onSort("smart");
            }}
            className={buttonClass({ variant: "ghost", size: "md" })}
          >
            {t.browseClearAll}
          </button>
        </div>
      )}
    </Sheet>
  );
}
