/**
 * ============ منطقةُ القارئ الزمنيّة — بيتٌ واحد (D-806) ============
 *
 * 🔴 **العلّةُ التي وُلد منها**: كلُّ حسابٍ زمنيٍّ في `periodStats` كان
 * `getUTCHours()` و`getUTCDay()` و`iso.slice(0,10)` — **أي بتوقيت
 * غرينتش.** **فقارئٌ في UTC+3 يُقال له «وقت الذروة ٨–١٠ صباحاً» وذروتُه
 * ١١ص–١م**، **وخانةُ «آخر الليل» في خريطة عاداته ليست ليلَه**، **و«أكثف
 * يوم» قد يكون يومَ أمسِ عنده.** **ورقمٌ يُعرض خطأً أسوأُ من رقمٍ يغيب**
 * (D-063).
 *
 * 🔑 **والحيلةُ إزاحةٌ واحدةٌ لا إعادةُ كتابةِ الحساب كلِّه**: تُزاح كلُّ
 * اللحظات إلى **فضاء ساعة الحائط** (اللحظةُ + الإزاحة، تُقرأ بـ`getUTC*`)
 * — **فيبقى كلُّ حسابٍ قائمٍ كما هو وتصير قراءتُه محلّيّة.**
 * **والفروقُ لا تتأثّر بإزاحةٍ ثابتة** (فجوةُ الجلسة ٣٠ دقيقةً تبقى ٣٠)،
 * **ووسمُ D-798 يُقرأ من نصِّ التاريخ لا من `Date`** فلا يزيغ.
 *
 * ⚠️ **والثمنُ يُقال**: **إزاحةٌ واحدةٌ للمدّة كلِّها**، **فمدّةٌ تعبر
 * تحويلَ التوقيت الصيفيّ تخطئ ساعةً في شطرها.** **والخليجُ بلا توقيتٍ
 * صيفيّ فالخطأُ صفرٌ عند جمهور Loopz اليوم**، **وساعةٌ في نصف عامٍ عند
 * غيره خيرٌ من ثلاثٍ في العام كلِّه.** **والدقّةُ التامّة تحتاج قراءةَ
 * أجزاءِ كلِّ صفٍّ على حدة** — أربعةٌ وعشرون ألفَ نداءِ `Intl` للمدّة
 * الواحدة، **وهي كلفةٌ تُدفع يومَ يُقاس أنّ الساعةَ تهمّ.**
 */

/** غرينتش — قيمةُ من لا منطقةَ له، وهي سلوكُ ما قبل هذه الجولة */
export const UTC = "UTC";

/**
 * **اسمُ منطقةٍ مقبولٌ أو `UTC`** — والحَكَمُ `Intl` نفسُها لا قائمةٌ
 * مكتوبةٌ بيدٍ تتقادم: **ما تقبله المنصّةُ مقبول، وما ترفضه يسقط.**
 */
export function asTimeZone(raw: string | null | undefined): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v || v.length > 64) return UTC;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return UTC;
  }
}

/**
 * **إزاحةُ المنطقة بالدقائق عند لحظةٍ بعينها** — موجبةٌ شرقَ غرينتش.
 *
 * **والطريقةُ قياسيّة**: تُنسَّق اللحظةُ بأجزائها في المنطقة، **ثمّ
 * تُقرأ تلك الأجزاءُ كأنّها غرينتش** — والفرقُ هو الإزاحة.
 */
export function zoneOffsetMinutes(tz: string, at: Date = new Date()): number {
  if (tz === UTC) return 0;
  try {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const p: Record<string, string> = {};
    for (const part of f.formatToParts(at)) p[part.type] = part.value;
    const asUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/** الإزاحةُ بالملّي — الشكلُ الذي يستهلكه المحرّك */
export function zoneShiftMs(tz: string, at: Date = new Date()): number {
  return zoneOffsetMinutes(tz, at) * 60_000;
}
