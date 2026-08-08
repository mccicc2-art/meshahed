"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";
import { chipClass } from "./ui/controls";
import { tap } from "@/lib/haptics";

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

export type ListsSource = "all" | "curated" | "friends" | "community";

export function ListsFilters({
  fr,
  lsrc,
  franchises,
  labels,
}: {
  fr: string | null;
  lsrc: ListsSource;
  franchises: { slug: string; label: string }[];
  labels: {
    button: string;
    title: string;
    world: string;
    source: string;
    all: string;
    curated: string;
    friends: string;
    community: string;
    apply: string;
    close: string;
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
    friends: labels.friends,
    community: labels.community,
  };

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            tap(8);
            setDraftFr(fr ?? "");
            setDraftSrc(lsrc);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
            count > 0
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          <Icon name="sliders" size={16} strokeWidth={1.9} />
          <span>{labels.button}</span>
          {count > 0 && (
            <span
              className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
              dir="ltr"
            >
              {count}
            </span>
          )}
        </button>

        {/* ما اختير يظهر ويُزال من مكانه */}
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
        <div className="grid grid-cols-2 gap-3 py-2">
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
              { value: "friends", label: labels.friends },
              { value: "community", label: labels.community },
            ]}
          />
        </div>
        <div className="pt-2 pb-1">
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
      </Sheet>
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
