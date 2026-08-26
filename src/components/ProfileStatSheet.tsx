"use client";

import { useState } from "react";
import { Sheet } from "./ui/Sheet";
import { sheetScroll } from "./ui/controls";
import { tap } from "@/lib/haptics";

/**
 * **خانةُ بطاقة الأرقام تفتح كلَّ ما تعدّه** (D-644، بلاغُ أحمد:
 * «إذا ضغط على كارد الأفلام أو المسلسلات تظهر كل أفلامه أو مسلسلاته»).
 *
 * 🔴 **ولماذا ورقةٌ لا تبويب — تصحيحُ خطأٍ مني** (نقضُ نصفِ D-643):
 * **بنيتُ الوجهةَ تبويبين في شريطِ الملفّ، وهو لم يطلب شريطاً جديداً**
 * («ليش غيّرت التبويب؟ رجّعها مثل ما كانت»). **وطلبُ بابٍ ليس إذناً
 * بإعادة ترتيب ما حوله** — **والزيادةُ على الطلب نقضٌ له لا خدمةٌ فيه.**
 * **فالورقةُ تفتح فوق الصفحة وتُغلق، والشريطُ لا يُمسّ.**
 *
 * ⚠️ **ولا مكوّنَ عرضٍ جديد**: `Sheet` الواحدةُ (D-018)، والشبكةُ تُمرَّر
 * **مرسومةً من الخادم** (`content`) — **فملصقاتُها تبقى مكوّناتِ خادمٍ
 * ولا تعبر الحدَّ إلى العميل** (درسُ `PosterCard` في D-238).
 *
 * ⚠️ **والزرُّ يلبس ما يُمرَّر إليه** (`children`): البطاقةُ ترسم خانتَها
 * كما هي، **وهذا يعطيها الفعلَ لا الشكل** — **فلا وصفةَ زرٍّ ثانية.**
 */
export function ProfileStatSheet({
  title,
  closeLabel,
  className = "",
  children,
  content,
}: {
  title: string;
  closeLabel: string;
  className?: string;
  /** وجهُ الخانة كما ترسمه البطاقة */
  children: React.ReactNode;
  /** الشبكةُ الكاملة، مرسومةً على الخادم */
  content: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          tap(6);
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={closeLabel}
        variant="bottom"
        labelledBy="profile-stat-sheet-title"
      >
        <p
          id="profile-stat-sheet-title"
          className="text-center font-bold text-15 pt-5 pb-3"
        >
          {title}
        </p>
        <div className={`${sheetScroll} px-4 pb-6`}>{content}</div>
      </Sheet>
    </>
  );
}
