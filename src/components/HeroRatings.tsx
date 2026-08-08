import { externalRatings } from "@/lib/omdb";
import { tvImdbId } from "@/lib/tmdb";

/**
 * سطر التقييمات في ترويسة العمل — IMDb وطماطم فقط، بشعاراتهما.
 *
 * قرارا أحمد (٨ أغسطس): «التقييم دايم يكون تحت» — سطرٌ مستقلّ تحت بيانات
 * السنة والمدّة لا حشوٌ بينها، و«لوقو IMDb ولوقو طماطم، لا تكتب اسمهم
 * كتابة». والقرار الثالث أُكمل به نقض D-027: «التقييم فقط من IMDb أو
 * طماطم» — نجمة TMDB حُذفت نهائياً (كانت تعرض 9.3 لعملٍ تقييمه الحقيقي
 * 7.8، ورقمٌ منفوخ أسوأ من لا رقم).
 *
 * مكوّن خادمٍ خلف Suspense: رحلة OMDb (مخبّأة يوماً) لا تؤخّر رسم
 * الترويسة، والهيكل البديل شريحة نبضٍ بنفس الارتفاع فلا قفزة تخطيط
 * (D-046). لا بيانات أو لا مفتاح؟ لا سطر — غيابٌ صادق لا رقمٌ من مصدر
 * آخر.
 *
 * الشعاران هنا في بيتٍ واحد ويستوردهما RankedRail — نسخة ثانية = خطأ
 * (قاعدة ٦). ألوانهما ألوان العلامتين لا ألوان الثيم، كشعارات المنصّات
 * في WatchChip.
 */

/** شعار IMDb: المستطيل الأصفر بحروفٍ سوداء — هو الشعار نفسه مرسوماً
    بالأنماط لا صورةً تُحمَّل؛ حجمه يتبع حجم خطّ الأب (em) */
export function ImdbMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-[0.27em] bg-[#F5C518] px-[0.32em] py-[0.18em] font-black leading-none tracking-tight text-black select-none ${className}`}
    >
      IMDb
    </span>
  );
}

/** شعار الطماطم: الثمرة الحمراء بورقتها — رسمٌ متجهيّ مبسّط يُقرأ في ١٤px */
export function RtMark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path
        fill="#FA320A"
        d="M12 7.2c5.1 0 8.9 3.2 8.9 7.9 0 4.8-3.9 8-8.9 8s-8.9-3.2-8.9-8c0-4.7 3.8-7.9 8.9-7.9Z"
      />
      <path
        fill="#00912D"
        d="M12 1.2c.9 1.1 2.3 1.6 3.7 1.3-.7 1.2-1.9 2-3.2 2.1 1 .4 2 .5 3 .2-.8 1.1-2.1 1.8-3.5 1.7-1.4.1-2.7-.6-3.5-1.7 1 .3 2 .2 3-.2-1.3-.1-2.5-.9-3.2-2.1 1.4.3 2.8-.2 3.7-1.3Z"
      />
    </svg>
  );
}

export async function HeroRatings({
  imdbId,
  tvId,
}: {
  /** معرّف IMDb إن كان بيدنا (الفيلم يحمله في تفاصيله) */
  imdbId?: string | null;
  /** مسلسل؟ يُحلّ معرّفه من /external_ids هنا — خارج مسار الترويسة الحرج */
  tvId?: number;
}) {
  const iid = imdbId ?? (tvId ? await tvImdbId(tvId) : null);
  const ext = await externalRatings(iid);
  if (!ext) return null;

  return (
    <div className="flex items-center gap-4 mt-2 text-sm">
      {ext.imdb && (
        <span className="inline-flex items-center gap-1.5" aria-label={`IMDb ${ext.imdb}`}>
          <ImdbMark className="text-[10px]" />
          <span dir="ltr" className="font-bold tabular-nums">
            {ext.imdb}
          </span>
        </span>
      )}
      {ext.rt && (
        <span className="inline-flex items-center gap-1.5" aria-label={`Rotten Tomatoes ${ext.rt}`}>
          <RtMark size={15} />
          <span dir="ltr" className="font-bold tabular-nums">
            {ext.rt}
          </span>
        </span>
      )}
    </div>
  );
}

/** هيكل الانتظار — نفس ارتفاع السطر حتى لا يقفز التخطيط عند الحلّ */
export function HeroRatingsSkeleton() {
  return <div className="mt-2 h-5 w-32 rounded-md bg-surface-2 animate-pulse" />;
}
