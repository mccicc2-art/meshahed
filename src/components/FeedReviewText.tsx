"use client";

import { useState } from "react";
import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { dirOf, alignOf } from "@/core/dir";
import { SpoilerText } from "./SpoilerText";

/**
 * 🆕 **متنُ المراجعة في الخطّ — جزيرةُ عميلٍ صغيرة** (D-307).
 *
 * **لماذا مكوّنٌ لا سطران في `ActivityFeed`:** الخطُّ مكوّنُ خادمٍ عمداً
 * (أربعون صفّاً تُرسم مرّةً)، **وزرُّ «النص الأصلي» حالةُ ضغطةٍ** — فتسكن
 * الحالةُ أصغرَ جزيرةٍ تكفيها لا الخطَّ كلَّه (D-152/D-246).
 *
 * **و`dir` على الرابط لا على الفقرة** (D-282، منقولٌ حرفاً من الأصل):
 * كانت الفقرةُ `line-clamp` وهي `-webkit-box`، وصندوقُ WebKit يحلّ
 * `text-align: start` حلّاً آخر — فرُفع الاتّجاهُ فوق الصندوق.
 * **والقصُّ سقط في D-429 والاتّجاهُ بقي مكانَه**: موضعٌ يعمل في
 * الحالتين، **ونقلُه اليومَ تغييرٌ بلا سبب** (D-288).
 *
 * 🔴 🆕 **والمتنُ يُعرض كما رتّبه صاحبُه وكاملاً** (D-429، نصُّ أحمد:
 * «هذا المنشور خلّيه يظهر في الاكتيفتي مثل ما هو مرتّبه و كامل — **أي
 * منشور لازم يظهر مثل ما صاحبه مرتّبه**»).
 *
 * **وكان هذا الملفُّ وحدَه هو الشاذّ**: `ReplyItem` يرسم المشاركةَ
 * بـ`whitespace-pre-line` بلا قصّ · و`SpoilerText` كذلك — **وهي
 * الفرعُ الثاني في هذه الدالّة نفسِها** — **فالمراجعةُ المحجوبةُ كانت
 * تُقرأ مرتَّبةً كاملةً والمكشوفةُ تُسطَّح وتُقصّ.** **وسطحان لمعنًى
 * واحدٍ في مكوّنٍ واحد هو العطلُ بعينه** (القاعدة ٦/D-002).
 *
 * ⚠️ **والثمنُ معلَن**: مراجعةٌ طويلةٌ تأخذ شاشتَها في الخطّ. **والسقفُ
 * ٢٬٠٠٠ حرفٍ من قيدِ القاعدة لا من رجائنا** — **ومن كتب فقراتٍ أراد
 * أن تُقرأ فقرات.**
 */
export function FeedReviewText({
  href,
  review,
  translated,
  locale,
  hasSpoiler = false,
}: {
  href: string;
  review: string;
  /** غيابُها = «لا ترجمةَ لازمة» — فلا زرَّ يُرسم (D-217) */
  translated?: string | null;
  locale: Locale;
  /**
   * 🆕 **إعلانُ كاتبه** (D-315) — الحاجبُ بدل الرابط المقصوص: **زرُّ
   * الكشف داخل رابطٍ عطلُ D-155**، ومن كشف هنا قرأ في مكانه.
   * **ولا ترجمةَ لمحجوب** — الصفحةُ لا تجمعها أصلاً (D-307).
   */
  hasSpoiler?: boolean;
}) {
  const t = getDict(locale);
  const [showOriginal, setShowOriginal] = useState(false);
  const shown = translated && !showOriginal ? translated : review;

  if (hasSpoiler) {
    return <SpoilerText text={review} locale={locale} />;
  }

  return (
    <>
      <Link
        href={href}
        prefetch={false}
        dir={dirOf(shown)}
        className={`block mt-2 ${alignOf(shown)}`}
      >
        <p className="fs-content text-14 leading-relaxed text-foreground/85 whitespace-pre-line">{shown}</p>
      </Link>
      {translated && (
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="mt-1 text-12 font-bold text-muted hover:text-accent transition"
        >
          {showOriginal ? t.showTranslation : t.showOriginalText}
        </button>
      )}
    </>
  );
}
