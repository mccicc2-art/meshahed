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

/**
 * 🆕 **والتصنيفُ العمريُّ يركب هذا السطرَ نفسَه** (D-286، طلبُ أحمد:
 * «التصنيف العمري حطها في كل صفحات المسلسلات والأفلام»).
 *
 * **ولا نداءَ جديداً له:** OMDb تُرسل `Rated` في الردّ الذي ننادِيه هنا
 * أصلاً — **كان يصلنا فنرميه**، وهي سيرةُ `votes` بحرفها (D-132).
 *
 * **وشكلُه إطارٌ لا لون:** التصنيفُ **ليس حالةً** (D-003)، **وهو أيضاً
 * ليس رقماً يُقارَن** بالتقييمين بجانبه — فيُفصل عنهما بحدٍّ رفيعٍ يقول
 * «هذا صنفٌ آخر من المعلومة».
 * ⚠️ **و`dir="ltr"` عليه**: «PG-13» تنقلب شرطتُها في سطرٍ عربيّ (D-015).
 */
function AgeMark({ rated, label, compact }: { rated: string; label: string; compact?: boolean }) {
  return (
    <span
      dir="ltr"
      aria-label={`${label}: ${rated}`}
      className={`inline-block rounded-md border font-bold uppercase tracking-wide leading-none ${
        compact
          /* 🆕 **و`foreground` لا `white` في نسخة الغلاف** (D-318): هذه
             الأسطرُ تقف على قاعٍ يذوب في `from-background` — أرضيّةٌ
             تتبع الثيم، **والأبيضُ الصلبُ كان يموت عليها في النهاريّ.**
             في الثيمات الداكنة `foreground` أبيضُ عمليّاً فلا يتغيّر شيء. */
          ? "border-foreground/70 text-foreground px-2 py-[3px] text-[11px]"
          : "border-border text-muted px-1.5 py-1 text-[11px]"
      }`}
    >
      {rated}
    </span>
  );
}

export async function HeroRatings({
  imdbId,
  tvId,
  ageLabel,
  compact = false,
}: {
  /** معرّف IMDb إن كان بيدنا (الفيلم يحمله في تفاصيله) */
  imdbId?: string | null;
  /** مسلسل؟ يُحلّ معرّفه من /external_ids هنا — خارج مسار الترويسة الحرج */
  tvId?: number;
  /** اسمُ «التصنيف العمري» بلغة القارئ — لقارئ الشاشة وحدَه (D-177) */
  ageLabel?: string;
  /**
   * 🆕 **شكلٌ ثانٍ لا مكوّنٌ ثانٍ** (D-286، سيرةُ `variant` في D-224/D-281):
   * فوق الغلاف يقف السطرُ **على صورةٍ داكنة** وبمقاسٍ أصغر — **ونسخُ
   * الملفّ لأجل لونين وحجمين هو العطلُ نفسُه** (D-002).
   */
  compact?: boolean;
}) {
  const iid = imdbId ?? (tvId ? await tvImdbId(tvId) : null);
  const ext = await externalRatings(iid);
  /* `externalRatings` صارت تُميّز «لا تقييم» عن «لم نصل» (D-172)، فتعود
     بكائنٍ فارغ بدل `null`. والترويسة لا ترسم صفّاً فارغاً.
     ⚠️ **والتصنيفُ يدخل الشرط** (D-286): عملٌ بلا تقييمٍ وله تصنيفٌ
     عمريٌّ يستحقّ سطرَه — **وشرطٌ لم يُوسَّع مع ما يعرضه يُخفي الجديد
     صامتاً.** */
  if (!ext || (!ext.imdb && !ext.rt && !ext.rated)) return null;

  /**
   * 🆕 **والتصنيفُ نزل سطراً تحت التقييمات** (D-297، طلبُ أحمد: «يكون تحت
   * IMDb وليس يمينه»).
   *
   * **والحجّةُ التي كانت تضعه بجانبهما ما زالت صحيحةً وقد اكتملت:**
   * قيل في D-286 إنه **صنفٌ آخر من المعلومة** فيُفصل بحدٍّ رفيع —
   * **والحدُّ يفصل صنفاً عن صنف، والسطرُ يفصلهما فصلاً لا يُخطئه أحد.**
   * **ورقمان يُقارَنان في سطر، وحقيقةٌ لا تُقارَن في سطرها.**
   *
   * ⚠️ **وفي الغلاف وحدَه** (`compact`): صفحةُ العمل لم يشتكِ منها أحد،
   * **وما لم يُطلب لا يُغيَّر** (D-288). **وحين تُطلب، السطرُ هو هو.**
   */
  const stacked = compact && !!ext.rated && (!!ext.imdb || !!ext.rt);

  const marks = (
    <div
      className={
        compact
          ? "flex items-center gap-2.5 mt-1 text-[12px] text-foreground/90"
          : "flex items-center gap-4 mt-2 text-sm"
      }
    >
      {ext.imdb && (
        <span className="inline-flex items-center gap-1.5" aria-label={`IMDb ${ext.imdb}`}>
          <ImdbMark className={compact ? "text-[9px]" : "text-[10px]"} />
          <span dir="ltr" className="font-bold tabular-nums">
            {ext.imdb}
          </span>
        </span>
      )}
      {ext.rt && (
        <span className="inline-flex items-center gap-1.5" aria-label={`Rotten Tomatoes ${ext.rt}`}>
          <RtMark size={compact ? 13 : 15} />
          <span dir="ltr" className="font-bold tabular-nums">
            {ext.rt}
          </span>
        </span>
      )}
      {ext.rated && !stacked && (
        <AgeMark rated={ext.rated} label={ageLabel ?? "Age rating"} compact={compact} />
      )}
    </div>
  );

  if (!stacked) return marks;
  return (
    <>
      {marks}
      {/* **سطرُه وحدَه، ومقاسُه أكبرُ قليلاً**: صار وحيدَ سطرِه **فلا
          يزاحمه شيء**، **وحجمٌ يُقرأ من بعيدٍ هو ما يجعل الشارةَ شارة.** */}
      <div className="mt-1">
        <AgeMark rated={ext.rated!} label={ageLabel ?? "Age rating"} compact={compact} />
      </div>
    </>
  );
}

/** هيكل الانتظار — نفس ارتفاع السطر حتى لا يقفز التخطيط عند الحلّ */
export function HeroRatingsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "mt-1 h-4 w-28 rounded-md bg-foreground/15 animate-pulse"
          : "mt-2 h-5 w-32 rounded-md bg-surface-2 animate-pulse"
      }
    />
  );
}
