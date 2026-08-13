"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { coalescedRefresh } from "@/lib/refresh";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { RatingBox } from "./RatingBox";

/**
 * **زرُّ «اكتب رأيك» في غرفة الكلام** (D-216).
 *
 * **بلاغُ أحمد بنصّه:** «ما يظهر لي صندوق الردّ، لا يظهر ردود الناس —
 * وصندوق الردّ زرّ أضغطه وبعدها أقدر أردّ».
 *
 * **والتشخيصُ أدقُّ من الشكوى:** الردودُ تعمل منذ D-193 — زرُّ «ردّ» تحت
 * كل رأيٍ يفتح صندوقاً، والردودُ تُرسم مُزاحةً بخطٍّ جانبيّ. **الذي كان
 * يُخفيها ليس عطلاً بل الصندوقُ الكبير فوقها**: `RatingBox` مفتوحاً
 * بنجومه العشر ومساحةِ نصّه **يأخذ نحوَ أربعين بالمئة من شاشة الجوال قبل
 * أن تُقرأ كلمةٌ واحدة من الحوار**. **ومن فتح غرفةَ كلامٍ جاء ليقرأ
 * أوّلاً.**
 *
 * **فالعلاجُ عكسُ الترتيب لا إضافةُ ميزة:** زرٌّ من سطرٍ واحد، والحوارُ
 * تحته مباشرةً، **والكتابةُ ورقةٌ تُفتح بقصد.**
 *
 * ================= وما تغيّر في D-217 =================
 *
 * **طلبُ أحمد:** «علامة اكتب ردّ حطّها في الهيدر أيقونة… بحيث يبان لي على
 * طول إني مقيّمه وكاتب ردّ وشاهدته أو في الواتش لِست، وإذا احتجت أكتب ردّ
 * أضغط على كلمة رِفيو».
 *
 * **فصار الزرُّ شارةً في الترويسة لا شريطاً عبر الصفحة** — والحوارُ يبدأ
 * فوراً تحتها. **وهي تقول حالتَك قبل أن تُضغط**: نجمتُك إن قيّمت، وكلمةُ
 * «عدّل» إن كتبت.
 *
 * ⚠️ **وقاعدةٌ تُسنّ هنا لأن الخلط فيها فخّ:** **المُطَوَّق يُضغط، والعاري
 * يُقرأ.** هذه الشارةُ وحدَها لها إطار — وشاراتُ «شاهدته» و«في مكتبتك»
 * بجانبها **نصٌّ ورمزٌ بلا إطار**، **فلا يظنّها أحدٌ أزراراً فيضغطها ولا
 * يحدث شيء.** ولو صرن أزراراً لصارت **عائلةَ أفعالٍ ثانية** تنافس شريطَ
 * صفحة العمل (ق٣).
 *
 * **ولماذا ورقةٌ لا تمدُّدٌ في المكان** (اختيارُ أحمد): لوحةُ المفاتيح
 * تأكل نصفَ الشاشة، وصندوقٌ يتمدّد في وسط الصفحة يدفع الحوارَ تحتها
 * فيكتب المرءُ وهو لا يرى ما يردّ عليه. **والورقة `top`** — وهي في
 * نظامنا شكلٌ واحد لكل المنبثقات (D-177)، **وسقفُها أقصرُ عمداً لأنها
 * لِما يُكتب فيه.**
 *
 * **والصندوقُ داخلها هو `RatingBox` نفسُه بلا نسخة** — لا عائلةَ تقييمٍ
 * ثانية (D-139)، وهو نفسُ ما تفعله ورقةُ «قيّمه الآن» (D-158).
 */
export function TalkCompose({
  tmdbId,
  mediaType,
  title,
  posterPath,
  locale,
  initialRating,
  initialReview,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  locale: Locale;
  initialRating: number | null;
  initialReview: string | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  /* **الزرُّ يقول أيَّ فعلٍ ينتظره**: من كتب رأيه من قبل يُعدّله لا يكتبه
     ثانيةً — والقاعدةُ مفتاحُها `(user, tmdb, media)` فالحفظُ استبدال */
  const has = initialRating != null || !!initialReview?.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tap(6);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 backdrop-blur-md px-3 py-1.5 text-white active:scale-95 transition hover:border-accent"
      >
        <Icon name={has ? "edit" : "comment"} size={13} className="shrink-0 text-accent" />
        <span className="text-[12px] font-bold">{has ? t.talkEditCta : t.talkWriteCta}</span>
        {/* **نجمتُك إن كانت** — من فتح الغرفة يرى رأيه السابق بلا فتحِ
            الورقة، **فالشارةُ تخبر لا تسأل فقط** */}
        {initialRating != null && (
          <span className="shrink-0 text-[12px] font-bold text-accent tabular-nums">
            ★ <span dir="ltr">{initialRating}</span>
          </span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={t.closeLabel}
        variant="top"
        labelledBy="talk-write-title"
      >
        <div className="p-3.5 sm:p-4">
          <p id="talk-write-title" className="font-bold text-[15px] mb-2.5 px-1 truncate">
            {t.talkWriteTitle}
          </p>
          <RatingBox
            tmdbId={tmdbId}
            mediaType={mediaType}
            title={title}
            posterPath={posterPath}
            locale={locale}
            initialRating={initialRating}
            initialReview={initialReview}
            variant="review"
            /* الحفظُ يُغلق الورقة ويُنعش الصفحة: **الرأيُ الجديد رأسُ خيطٍ
               في الحوار تحته**، فبقاؤه خارج القائمة يجعل الكتابةَ تبدو
               ضائعة */
            onSaved={() => {
              setOpen(false);
              coalescedRefresh(router);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
