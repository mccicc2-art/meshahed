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
import { RailsPrefs } from "./RailsPrefs";
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
 * 🔴 **والورقة كانت تُغلق نفسها عند أوّل حرفٍ يُكتب في البحث — وكان
 * عطلاً**: الإغلاقُ ينزع الحقلَ من الصفحة، **فالحرفُ الأوّل كان آخرَ حرفٍ
 * يصل البحثَ.** **صارت تُغلق عند Enter** («بحث» على مفتاح الجوّال) —
 * **والنيّةُ نفسُها**: تكتب فتُصفّى الشبكةُ خلفها حرفاً بحرف، ثم تنكشف
 * حين تقول «تمّ». (والبحث محليٌّ فوريّ، فلا انتظار.)
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
  hiddenRails = [],
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
  /** **المخفيُّ كلُّه بمفاتيح `tab:key`** (D-826/D-874) — يُمرَّر كاملاً لأن الفعلَ يستبدل القائمةَ كلَّها */
  hiddenRails?: string[];
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
                className="block text-12 font-bold text-muted mb-2"
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
                  onChange={(e) => onQ(e.target.value)}
                  /* 🔴 🆕 **والإغلاقُ عند «تمّ» لا عند أوّل حرف** — **إصلاحُ
                     عطلٍ حقيقيّ**: كان `if (e.target.value.length === 1)
                     onClose()`، **والورقةُ حين تُغلق يُنزَع الحقلُ من
                     الصفحة** — **فالحرفُ الأوّل كان آخرَ حرفٍ يصل البحثَ**،
                     وبقيّةُ ما تكتبه تذهب إلى صفحةٍ لا تسمع. **حقلُ بحثٍ
                     يقبل حرفاً واحداً ليس بطيئاً، هو معطَّل.**

                     **والنيّةُ الأصليّةُ باقيةٌ ولم تُنقض**: «الفلترةُ فوريّةٌ
                     محلّيّة فإبقاءُ الورقة يحجب ما تصفّيه للتوّ» — **والذي
                     تبدّل متى تُغلق**: تكتب فتُصفّى الشبكةُ خلفها حرفاً
                     بحرف، **وEnter يقول «تمّ» فتنكشف**. **و`type="search"`
                     يجعل مفتاحَ الجوّال يقرأ «بحث» أصلاً**، فالإيماءةُ
                     معروفةٌ لا مخترَعة.

                     ⚠️ **وصفُّ رقائق «ما اخترتَه» يكمل العلاج** (المرحلة ٨):
                     **ما كتبتَه يبقى مكتوباً في الرأس بعد أن تُغلق الورقة**،
                     فلا يُنسى فلترٌ قائم. */
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onClose();
                    }
                  }}
                  placeholder={t.searchLibrary}
                  className="w-full min-h-11 bg-surface-2 border border-border rounded-control ps-9 pe-3 py-2.5 text-base placeholder:text-muted outline-none focus:border-accent transition"
                />
              </div>
            </div>

            <div>
              <span className="block text-12 font-bold text-muted mb-2">
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
                      "flex-1 basis-0 min-w-0 px-2 py-2.5 text-14",
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
          <span className="block text-12 font-bold text-muted mb-2">
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
          {/* 🆕 **وصفوفُ الصفحة تحت تبويباتها** (D-874، امتدادُ D-826 بحكم
              أحمد: «نعم، للاثنين») — **نفسُ المكوّن ونفسُ الكوكي**، والنطاقُ
              `library:`. **ولا يُرسم للزائر**: الورقةُ كلُّها للمسجَّل. */}
          <RailsPrefs
            locale={locale}
            tab="library"
            hidden={hiddenRails}
            title={locale === "en" ? "This page's rows" : "صفوف هذه الصفحة"}
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
