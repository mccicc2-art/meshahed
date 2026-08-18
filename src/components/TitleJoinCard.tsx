"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";

/**
 * **بطاقةُ «انضمّ إلى الحديث» — رأسُ تبويب المجتمع** (D-398، طلبُ أحمد
 * بصورة: «اجمع الأخبار والنقاش والآراء في مكان واحد»).
 *
 * ================= لماذا فعلان لا صندوقٌ مفتوح =================
 *
 * **كان مؤلّفُ الرأي (`RatingBox`) يفتتح تبويبَ «التعليقات» مبسوطاً**:
 * عنوانٌ ونجومٌ وحقلُ كتابةٍ بثلاثة أسطر وزرّان — **نصفُ الشاشة الأولى
 * لفعلٍ يقوم به واحدٌ من كلِّ عشرين زائراً**، ومن جاء ليقرأ ما قاله الناس
 * يمرّ عليه أوّلاً. **وصفحةُ العمل صفحةُ قراءةٍ قبل أن تكون صفحةَ كتابة.**
 *
 * **فصار الفعلان سطراً واحداً**: «اكتب رأيك» يفتح المؤلّفَ في مكانه —
 * **ولا يُخرجك إلى صفحةٍ أخرى** (D-167) — و«ابدأ نقاشاً» بابُ الغرفة.
 * **والقائمةُ تبدأ من الشاشة الأولى.**
 *
 * **والتقييمُ في صدر البطاقة لا في قسمٍ خاصّ**: «★ ٨٫٢ من ١٤٣» جملةٌ
 * واحدة، **وكان عنواناً وسطراً وعدّاداً في ثلاث كتل** (D-222).
 *
 * ⚠️ **والمؤلّفُ يُرسم على الخادم ويصل طفلاً**: هذا المكوّن لا يعرف عنه
 * شيئاً ولا يستورده — **فحالةُ الفتح عميلٌ خفيف، والكتابةُ تبقى حيث
 * كانت** (لا نسخةَ ثانية من `RatingBox`، قاعدة ٦).
 */
export function TitleJoinCard({
  talkHref,
  avg,
  count,
  locale,
  composer,
}: {
  talkHref: string;
  /** متوسّطُ تقييم المجتمع — **يُقرأ ولا يُرسم إن لم يقيّمه أحد** */
  avg: number;
  count: number;
  locale: Locale;
  /** مؤلّفُ الرأي — يُرسم على الخادم ويُفتح هنا */
  composer: ReactNode;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const rounded = Math.round(avg * 10) / 10;

  return (
    <div className="bg-surface border border-border rounded-2xl p-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-[15px]">{t.communityJoin}</h3>
        {count > 0 && (
          <p className="text-[13px] text-muted tabular-nums">
            <span className="font-bold text-accent">
              ★ <span dir="ltr">{rounded.toFixed(1)}</span>
            </span>{" "}
            <span aria-hidden>·</span> {t.communityCount(count)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            tap(10);
            setOpen((v) => !v);
          }}
          className={buttonClass({ size: "sm" })}
        >
          <Icon name="star" size={15} className="shrink-0" />
          {t.communityWriteReview}
        </button>
        <Link href={talkHref} className={buttonClass({ variant: "surface", size: "sm" })}>
          <Icon name="comment" size={15} className="shrink-0 text-accent" />
          {t.communityStartTalk}
        </Link>
      </div>

      {/* **المؤلّفُ يُخفى بـ`hidden` لا يُحذف**: ما كُتب فيه قبل الطيّ
          يبقى، **ونفسُ حجّة `DetailTabs`** — الحالةُ لا تُفقد بالإخفاء. */}
      <div hidden={!open} className="mt-3">
        {composer}
      </div>
    </div>
  );
}
