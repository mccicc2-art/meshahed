"use client";

import { useState } from "react";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { dirOf, alignOf } from "@/lib/dir";

/**
 * 🆕 **متنُ المراجعة في الخطّ — جزيرةُ عميلٍ صغيرة** (D-307).
 *
 * **لماذا مكوّنٌ لا سطران في `ActivityFeed`:** الخطُّ مكوّنُ خادمٍ عمداً
 * (أربعون صفّاً تُرسم مرّةً)، **وزرُّ «النص الأصلي» حالةُ ضغطةٍ** — فتسكن
 * الحالةُ أصغرَ جزيرةٍ تكفيها لا الخطَّ كلَّه (D-152/D-246).
 *
 * **و`dir` على الرابط لا على الفقرة** (D-282، منقولٌ حرفاً من الأصل):
 * الفقرةُ `line-clamp` وهي `-webkit-box`، وصندوقُ WebKit يحلّ
 * `text-align: start` حلّاً آخر — فالاتّجاهُ فوق الصندوق المقصوص.
 */
export function FeedReviewText({
  href,
  review,
  translated,
  locale,
}: {
  href: string;
  review: string;
  /** غيابُها = «لا ترجمةَ لازمة» — فلا زرَّ يُرسم (D-217) */
  translated?: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [showOriginal, setShowOriginal] = useState(false);
  const shown = translated && !showOriginal ? translated : review;

  return (
    <>
      <Link
        href={href}
        prefetch={false}
        dir={dirOf(shown)}
        className={`block mt-2 ${alignOf(shown)}`}
      >
        <p className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3">{shown}</p>
      </Link>
      {translated && (
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="mt-1 text-[11px] font-bold text-muted hover:text-accent transition"
        >
          {showOriginal ? t.showTranslation : t.showOriginalText}
        </button>
      )}
    </>
  );
}
