"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";

/**
 * **بطاقةُ «انضمّ إلى الحديث» — رأسُ تبويب المجتمع** (D-398، وأُعيد
 * تصميمُها في D-407 على لقطة أحمد).
 *
 * ================= لماذا فعلان لا صندوقٌ مفتوح =================
 *
 * **كان مؤلّفُ الرأي (`RatingBox`) يفتتح التبويبَ مبسوطاً**: عنوانٌ
 * ونجومٌ وحقلُ كتابةٍ وزرّان — **نصفُ الشاشة الأولى لفعلٍ يقوم به واحدٌ
 * من كلِّ عشرين زائراً**، ومن جاء ليقرأ يمرّ عليه أوّلاً. **وصفحةُ
 * العمل صفحةُ قراءةٍ قبل أن تكون صفحةَ كتابة.**
 *
 * ================= وشكلُها بعد D-407 =================
 *
 * **رمزٌ مطوَّقٌ ثم العنوان، ثم خطٌّ، ثم فعلان يقتسمان العرض** بفاصلٍ
 * رأسيّ. **والقسمةُ بالنصف مقصودة**: الفعلان **ندّان لا رئيسٌ وتابع** —
 * رأيٌ في العمل، وحديثٌ عنه — **فزرٌّ ممتلئٌ وآخرُ مفرَّغ كان يرتّبهما
 * ترتيباً لا نملك دليلَه.**
 *
 * 🔴 **وهي البابُ الوحيد إلى النقاش** (D-407، نصُّ أحمد: «النقاشات مو
 * لازم تكون هنا في الكوميونتي، يكفي الصندوق اللي فوق اللي يوصل لها»):
 * **صفوفُ النقاش خرجت من الخطّ** — **والخطُّ صار آراءَ الناس ونشراتِنا
 * وحدَها.**
 *
 * ⚠️ **والمؤلّفُ يُرسم على الخادم ويصل طفلاً**: هذا المكوّن لا يستورده —
 * **فحالةُ الفتح عميلٌ خفيف، ولا نسخةَ ثانية من `RatingBox`** (قاعدة ٦).
 */
export function TitleJoinCard({
  talkHref,
  locale,
  composer,
}: {
  talkHref: string;
  locale: Locale;
  /** مؤلّفُ الرأي — يُرسم على الخادم ويُفتح هنا */
  composer: ReactNode;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  const action =
    "flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-bold " +
    "text-foreground hover:text-accent active:scale-[0.98] transition";

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <span
          aria-hidden
          className="shrink-0 size-9 rounded-full border border-[color:var(--divider)] grid place-items-center text-accent"
        >
          <Icon name="comment" size={17} />
        </span>
        <h3 className="min-w-0 font-bold text-[15px]">{t.communityJoin}</h3>
      </div>

      <div className="h-px bg-[color:var(--divider)] mx-4" />

      <div className="flex items-stretch">
        <button type="button" aria-expanded={open} onClick={() => { tap(10); setOpen((v) => !v); }} className={action}>
          <Icon name="star" size={15} className="shrink-0 text-accent" />
          <span className="truncate">{t.communityWriteReview}</span>
        </button>
        {/* **فاصلٌ رأسيٌّ مقصوصٌ من طرفيه** — نفسُ وصفةِ فاصل المقسّم */}
        <span aria-hidden className="my-2 w-px bg-[color:var(--divider)]" />
        <Link href={talkHref} className={action}>
          <Icon name="comment" size={15} className="shrink-0 text-accent" />
          <span className="truncate">{t.communityStartTalk}</span>
        </Link>
      </div>

      {/* **المؤلّفُ يُخفى بـ`hidden` لا يُحذف**: ما كُتب فيه قبل الطيّ
          يبقى — نفسُ حجّة `DetailTabs`. */}
      <div hidden={!open} className="px-3.5 pb-3.5 pt-1">
        {composer}
      </div>
    </div>
  );
}
