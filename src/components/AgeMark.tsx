"use client";

import { useState } from "react";
import { Sheet, SheetHeader } from "./ui/Sheet";
import type { AgeBadge, AgeInfo } from "@/core/ageRating";

/**
 * ====== شارةُ التصنيف العمريّ وورقةُ تعريفه (T494) ======
 *
 * أحمد ٢١ نوفمبر: «خلها بالأحرف مثل الرسمي و إذا ضغط عليها الشخص يطلع التعريف و شرح لها» — ثمّ «نفذ» على الصور.
 * - **الشارة**: الرمزُ الرسميُّ (R · TV-MA · PG-13…) بلون درجته (`core/ageRating`)، زرٌّ يفتح الورقة. `dir="ltr"`: «PG-13»
 *   تنقلب شرطتُها في سطرٍ عربيّ (D-015).
 * - **الورقة**: الورقةُ الواحدة (`ui/Sheet`) بترويستها — العنوانُ المعنى بكلمة، وتحته الشارةُ ومصدرُها؛ ثمّ الشرحُ؛ ثمّ «السُّلَّم»:
 *   رموزُ عائلته من الأطفال إلى الكبار، رمزُه مضاءٌ بحلقة والباقي باهت. التطبيقُ يرسم الشيءَ نفسَه من الوصفة نفسِها (`ageInfo`).
 * - المكوّنُ عميلٌ صغير، و`HeroRatings` يبقى مكوّنَ خادم: يحسب الشارةَ والتعريفَ ويمرّرهما كائنين.
 */
function Badge({ b, size }: { b: AgeBadge; size: "row" | "rowCompact" | "head" | "ladder" }) {
  const cls =
    size === "head"
      ? "px-2 py-1 text-13 rounded-md"
      : size === "ladder"
        ? "px-1.5 py-1 text-11 rounded-md"
        : size === "rowCompact"
          ? "px-2 py-[4px] text-12 rounded-md"
          : "px-1.5 py-1 text-12 rounded-md";
  return (
    <span dir="ltr" className={`inline-block font-bold tabular-nums leading-none whitespace-nowrap ${cls}`} style={{ backgroundColor: b.bg, color: b.fg }}>
      {b.text}
    </span>
  );
}

export function AgeMark({
  badge,
  info,
  label,
  closeLabel,
  compact,
}: {
  badge: AgeBadge;
  info: AgeInfo;
  /** اسمُ الإتاحة: «التصنيف العمري: TV-MA، للكبار» (`ageA11y`) */
  label: string;
  closeLabel: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={label} aria-haspopup="dialog" onClick={(e) => {
          /* قد يقع السطرُ داخل رابط (بطاقةُ منشور) — الضغطُ يفتح التعريف لا الصفحة */
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }} className="inline-flex align-middle rounded-md active:scale-95 transition">
        <Badge b={badge} size={compact ? "rowCompact" : "row"} />
      </button>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} closeLabel={closeLabel} labelledBy="age-title">
          <SheetHeader id="age-title" title={info.name} closeLabel={closeLabel} onClose={() => setOpen(false)} divider={false}>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge b={badge} size="head" />
              <span className="text-12 text-muted">{info.source}</span>
            </div>
          </SheetHeader>
          <div className="px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5">
            <p className="text-14 leading-relaxed">{info.desc}</p>
            <div>
              <div className="text-12 font-semibold text-muted mb-2.5">{info.ladderLabel}</div>
              <div className="flex flex-wrap gap-1.5">
                {info.ladder.map((x) => (
                  <span key={x.text} className={x.on ? "rounded-md outline outline-2 outline-offset-2 outline-foreground" : "opacity-35"}>
                    <Badge b={x} size="ladder" />
                  </span>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-11 text-muted">
                <span>{info.young}</span>
                <span>{info.old}</span>
              </div>
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
