"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { FilterIconButton } from "./ui/FilterIconButton";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";
import { chipClass } from "./ui/controls";
/* تبويب القوائم له بابُه هنا لا في ورقة اكتشف — رمزٌ واحد لكل تبويب (D-179) */
import { TabsPrefs } from "./TabsPrefs";
import { num, type Locale } from "@/lib/i18n";
import type { TabPref } from "@/lib/tabPrefs";

/**
 * فلاتر تبويب القوائم (طلب أحمد: «زر فلتر مثل الموجود في الأفلام»).
 *
 * محوران فقط — العالم والمصدر — منسدلان أصليان في ورقةٍ سفلية (شكل
 * D-076 نفسه)، والحالة في الرابط (`?fr=` و`?lsrc=`) كتبويبات اكتشف
 * كلها. ما اختير يعود رقاقةً قابلة للإزالة تحت الزر — الزرّ الذي يخفي
 * فلتراً بلا أثرٍ ظاهر يكذب (شكل D-030 المعدَّل).
 * هذا غير رقائق المصدر التي حذفها D-084: تلك كانت صفاً دائماً يشغل
 * السطر؛ هذه خلف زرٍّ ولا تظهر إلا مختارةً — بنية تبويب الأفلام حرفياً.
 */

/* **`friends` لم يبقَ خياراً معروضاً (D-195، مواصفةُ أحمد):** صفُّ «من
   أتابعهم» حُذف من تبويب القوائم — **وخيارُ فلترٍ بلا صفٍّ يُرشِّحه يُفرغ
   الشاشة بصمت**، وهو أسوأ من غياب الخيار.

   ⚠️ **ويبقى في النوع، ولا يُحذف منه:** الرابطُ المحفوظ `?lsrc=friends`
   يجب أن يُقرأ ويُهدى إلى «الكل» لا أن يسقط، **والنشرُ هنا يقع مجلّداً
   مجلّداً وكلُّ رفعةٍ تُبنى وحدها** (`19_Tools_And_Access.md`) — فتضييقُ
   النوع في رفعة `components` كان يكسر البناءَ قبل أن تصل رفعةُ `app`.
   **ونفسُ السبب يجعل `labels.friends` اختياريّةً.** */
export type ListsSource = "all" | "curated" | "friends" | "community";

export type ListsFiltersProps = {
  fr: string | null;
  lsrc: ListsSource;
  franchises: { slug: string; label: string }[];
  labels: ListsFiltersLabels;
};

type ListsFiltersLabels = {
  button: string;
  title: string;
  world: string;
  source: string;
  all: string;
  curated: string;
  /** لم تُعرض بعد D-195 — تبقى اختياريّةً لأجل الرابط المحفوظ */
  friends?: string;
  community: string;
  apply: string;
  close: string;
};

export function ListsFilters({
  fr,
  lsrc,
  franchises,
  labels,
  variant = "full",
  tabsPrefs,
  locale,
}: ListsFiltersProps & {
  /** 🆕 لغةُ القارئ — **لرقم العدّاد وحدَه** (D-452). **اختياريّةٌ لأن
      صيغة `chips` لا زرَّ فيها**، ولأن الدفعات تُرفع مجلّداً مجلّداً
      (D-028): الصفحةُ التي تمرّرها تُبنى بعد هذا المجلَّد. */
  locale?: Locale;
  /** button: الزرّ وورقته في سطر التبويبات (طلب أحمد: مكان زرّ الأفلام
      نفسه) · chips: المختار وحده فوق الصفوف · full: الاثنان معاً */
  variant?: "full" | "button" | "chips";
  /**
   * قسمُ تفضيلات التبويبات — **لأن تبويب القوائم له بابُه هنا لا هناك.**
   *
   * زرُّ هذا التبويب ليس `FilterIconButton` الذي يفتح ورقة اكتشف، بل هذه
   * الورقة. فلو سكن القسمُ في تلك وحدها لبقي تبويبُ القوائم بلا طريقٍ
   * إلى ترتيب تبويباته — **رمزٌ واحد لكل تبويب، وخلفه كلُّ ما يخصّه.**
   * والمنطق واحدٌ في الورقتين (`TabsPrefs`)، فلا نسخةَ ثانية (D-145).
   */
  tabsPrefs?: {
    locale: Locale;
    prefs: TabPref[];
    labels: Record<string, string>;
    title: string;
  };
}) {

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftFr, setDraftFr] = useState(fr ?? "");
  const [draftSrc, setDraftSrc] = useState<ListsSource>(lsrc);

  const count = (fr ? 1 : 0) + (lsrc !== "all" ? 1 : 0);

  function push(nextFr: string, nextSrc: ListsSource) {
    const p = new URLSearchParams({ tab: "lists" });
    if (nextFr) p.set("fr", nextFr);
    if (nextSrc !== "all") p.set("lsrc", nextSrc);
    router.replace(`/news?${p.toString()}`, { scroll: false });
  }

  const srcLabel: Record<ListsSource, string> = {
    all: labels.all,
    curated: labels.curated,
    /* رقاقةُ الرابط المحفوظ تُسمّى «الكل» — لا فراغاً بلا اسم */
    friends: labels.all,
    community: labels.community,
  };

  /* **نفس زرّ اكتشف والمكتبة والمجتمع (D-177، طلب أحمد):** كان هنا زرٌّ
     بكلمةٍ وعدّاد — «الاختلاف في التصميم في كل موقع لازم ما يتكرّر، هذي
     هوية ولازم تكون موحّدة».
     🆕 ⚖️ **والعدّادُ عاد بلا الكلمة** (D-452، امتدادُ D-447 إلى الأسطح
     الأربعة): **`count` كان محسوباً هنا منذ اليوم الأوّل ويُلقى** —
     `active={count > 0}` تعرف الرقمَ ثم تنساه. **وهويّةٌ موحَّدة تعني
     أن يقول الزرُّ الشيءَ نفسَه في الأربعة**، لا أن يصمت في ثلاثةٍ
     ويتكلّم في واحد. */
  const filterButton = (
    <FilterIconButton
      onClick={() => {
        setDraftFr(fr ?? "");
        setDraftSrc(lsrc);
        setOpen(true);
      }}
      label={labels.button}
      active={count > 0}
      count={count > 0 && locale ? num(count, locale) : null}
      expanded={open}
    />
  );

  {/* المختار يظهر ويُزال من مكانه — كصفّ رقائق تبويب الأفلام */}
  const chips = count > 0 && (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      {fr && (
        <button
          type="button"
          className={chipClass(true, "sm")}
          onClick={() => push("", lsrc)}
        >
          <span className="inline-flex items-center gap-1">
            {franchises.find((f) => f.slug === fr)?.label ?? fr}
            <Icon name="close" size={12} />
          </span>
        </button>
      )}
      {lsrc !== "all" && (
        <button
          type="button"
          className={chipClass(true, "sm")}
          onClick={() => push(fr ?? "", "all")}
        >
          <span className="inline-flex items-center gap-1">
            {srcLabel[lsrc]}
            <Icon name="close" size={12} />
          </span>
        </button>
      )}
    </div>
  );

  if (variant === "chips") return chips || null;

  /* بلا `createPortal` هنا (D-166): `Sheet` نفسها تُرسم في `document.body`
     منذ D-159، فبوّابةٌ حول بوّابة. وهذا اللفّ من ٨ أغسطس كان **علاج
     العَرَض عند المستدعي** قبل أن يُعرف السبب — بقي بعد أن عولج السبب. */
  const sheet = open ? (
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={labels.close}
        labelledBy="lists-filters-title"
      >
        <SheetHeader
          id="lists-filters-title"
          title={labels.title}
          closeLabel={labels.close}
          onClose={() => setOpen(false)}
        />
        {/* حشوٌ جانبيّ كان ناقصاً: لوح الورقة بلا `px` (الترويسة وحدها
            تحمله)، فكانت المنسدلتان تلتصقان بإطار الورقة — ظهر بوضوح حين
            نزل قسمُ التبويبات تحتهما بحشوه الصحيح */}
        <div className="grid grid-cols-2 gap-3 px-5 py-2">
          <SelectField
            label={labels.world}
            value={draftFr}
            onChange={setDraftFr}
            options={[{ value: "", label: labels.all }, ...franchises.map((f) => ({ value: f.slug, label: f.label }))]}
          />
          <SelectField
            label={labels.source}
            value={draftSrc}
            onChange={(v) => setDraftSrc(v as ListsSource)}
            options={[
              { value: "all", label: labels.all },
              { value: "curated", label: labels.curated },
              { value: "community", label: labels.community },
            ]}
          />
        </div>
        <div className="px-5 pt-2 pb-1">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              push(draftFr, draftSrc);
              setOpen(false);
            }}
          >
            {labels.apply}
          </Button>
        </div>
        {tabsPrefs && (
          <div className="mt-3 pt-2 border-t border-[color:var(--divider)]">
            <TabsPrefs
              locale={tabsPrefs.locale}
              surface="discover"
              prefs={tabsPrefs.prefs}
              labels={tabsPrefs.labels}
              title={tabsPrefs.title}
            />
          </div>
        )}
      </Sheet>
  ) : null;

  if (variant === "button") {
    return (
      <>
        {filterButton}
        {sheet}
      </>
    );
  }

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 flex-wrap">{filterButton}</div>
      {chips}
      {sheet}
    </div>
  );
}

/* نفس تشريح منسدل ورقة فلاتر الأفلام (D-076): عنوان فوق select أصلي
   بخط ١٦ بكسل (D-033) — مساعدٌ محلي لا عائلة تحكم ثالثة */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-muted mb-1">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-surface px-3 py-2.5 pe-8 text-[16px] font-semibold"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={16}
          className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
      </span>
    </label>
  );
}
