import { externalRatings, imdbIdByName } from "@/lib/omdb";
import { imdbOverride } from "@/lib/imdbOverrides";
import { altTitles, tvImdbId } from "@/lib/tmdb";

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
          ? "border-foreground/70 text-foreground px-2 py-[3px] text-12"
          : "border-border text-muted px-1.5 py-1 text-12"
      }`}
    >
      {rated}
    </span>
  );
}

export async function HeroRatings({
  imdbId,
  tvId,
  name,
  year,
  movieId,
  ageLabel,
  compact = false,
  tvImdbIdPromise,
}: {
  /** معرّف IMDb إن كان بيدنا (الفيلم يحمله في تفاصيله) */
  imdbId?: string | null;
  /** مسلسل؟ يُحلّ معرّفه من /external_ids هنا — خارج مسار الترويسة الحرج */
  tvId?: number;
  /**
   * 🔴 🆕 **الجسرُ الثاني حين يسقط الأوّل** (D-414): اسمُ العمل وسنتُه
   * **يُبحث بهما في OMDb إن لم تعرف TMDB معرّفَ IMDb** — وهي حالُ كثيرٍ
   * من الأعمال العربيّة. **اختياريّان**: من لا يمرّرهما يبقى على
   * السلوك القديم حرفاً (D-152).
   */
  name?: string | null;
  year?: number | null;
  /**
   * 🔴 🆕 **الجسرُ الثالث — صيغُ الاسم كلُّها** (D-430، دَينُ D-414).
   * **معرّفُ الفيلم في TMDB** ليُسأل `/alternative_titles` حين يسقط
   * الجسران. **اختياريٌّ**: من لا يمرّره يبقى على جسرين حرفاً (D-152).
   * **والمسلسلُ لا يحتاجه**: `tvId` هو معرّفُه أصلاً.
   */
  movieId?: number;
  /** اسمُ «التصنيف العمري» بلغة القارئ — لقارئ الشاشة وحدَه (D-177) */
  ageLabel?: string;
  /**
   * 🆕 **وعدُ معرّف IMDb من الصفحة** (D-889، `LOOPZ-AUD-0074`): `tvImdbId`
   * هنا خلف `Suspense` فلا ينطلق إلا بعد موجة الصفحة، ثمّ OMDb بعده —
   * مستويان متسلسلان (التقييمُ يصل عند 1.1–1.4 s بارداً). الصفحةُ تُطلق
   * `tvImdbId` مع موجتها وتمرّر الوعدَ. **الخريطةُ المكتوبةُ بيدٍ
   * (`imdbOverride`، D-431) و`imdbId` الممرَّرُ يبقيان أوّلاً** — الوعدُ
   * يحلّ محلَّ النداء الداخليّ فقط حيث كان يقع. **اختياريّ** (D-152).
   */
  tvImdbIdPromise?: Promise<string | null>;
  /**
   * 🆕 **شكلٌ ثانٍ لا مكوّنٌ ثانٍ** (D-286، سيرةُ `variant` في D-224/D-281):
   * فوق الغلاف يقف السطرُ **على صورةٍ داكنة** وبمقاسٍ أصغر — **ونسخُ
   * الملفّ لأجل لونين وحجمين هو العطلُ نفسُه** (D-002).
   */
  compact?: boolean;
}) {
  const kind = tvId ? ("series" as const) : ("movie" as const);
  const altId = tvId ?? movieId;
  /* 🔴 🆕 **والخريطةُ المكتوبةُ بيدٍ تُسأل أوّلاً** (D-431): **سطرٌ نعرفه
     أوثقُ من ثلاث رحلاتِ شبكةٍ وأرخصُ منها** — **فما نعرفه لا يُدفع ثمنُ
     البحث عنه**، **وسقوطُها يعني «لا أعرفه» فتمشي الجسورُ الثلاثة**
     (D-063). */
  const pinned = altId ? imdbOverride(kind === "series" ? "tv" : "movie", altId) : null;
  const first =
    pinned ?? imdbId ?? (tvId ? await (tvImdbIdPromise ?? tvImdbId(tvId)) : null);
  /* **ولا يُبحث بالاسم إلا بعد أن يسقط المعرّف** (D-414) — نداءٌ لا يقع
     لأكثر الأعمال، **وردُّه مخبّأٌ يوماً كردِّ التقييم نفسِه.** */
  const second = first ?? (name && year ? await imdbIdByName(name, year, kind) : null);
  /* 🔴 🆕 **والجسرُ الثالثُ صيغُ الاسم** (D-430، دَينُ D-414 المعلَن):
     **الاسمُ المنقولُ عن العربيّة لا صيغةَ واحدةَ له** — TMDB تكتب
     `Fi El` وIMDb تكتب `Fi Al` — **وحرفٌ يمنع المطابقة.** **وTMDB تحمل
     الصيغَ كلَّها ولم نكن نسألها.**
     ⚠️ **ولا يقع إلّا بعد سقوط الجسرين** (D-152)، **ويتوقّف عند أوّل
     صيغةٍ تطابق** فلا يستنفد السقفَ بلا داعٍ. */
  let iid = second;
  if (!iid && altId && year) {
    for (const alt of await altTitles(kind === "series" ? "tv" : "movie", altId)) {
      /* **والاسمُ الذي جرّبناه لا يُجرَّب ثانيةً** */
      if (name && alt.toLowerCase() === name.trim().toLowerCase()) continue;
      const hit = await imdbIdByName(alt, year, kind);
      if (hit) {
        iid = hit;
        break;
      }
    }
  }
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
  /* 🆕 **وصار سطرَه في الصفحتين لا في الغلاف وحدَه** (D-417، طلبُ أحمد
     على لقطةٍ محوَّطة: «TV-MA تكون في سطر لوحدها»). **وهذا ما كتبه
     D-297 بنفسِه**: «وفي الغلاف وحدَه… **وحين تُطلب، السطرُ هو هو**» —
     **فطُلب، وسقط شرطُ `compact`** ولم يتغيّر شيءٌ آخر. */
  const stacked = !!ext.rated && (!!ext.imdb || !!ext.rt);

  const marks = (
    <div
      className={
        compact
          ? "flex items-center gap-2.5 mt-1 text-12 text-foreground/90"
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
