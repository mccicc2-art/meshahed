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
 * الشعاران انتقلا إلى `RatingMarks` يوم احتاجهما مكوّن عميل (تقييمات
 * الحلقات) — يُعاد تصديرهما هنا فمستورِدو الأمس (RankedRail) لا يتغيّرون،
 * والبيت واحد (قاعدة ٦).
 */

import { ImdbMark, RtMark } from "./RatingMarks";
export { ImdbMark, RtMark } from "./RatingMarks";

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
