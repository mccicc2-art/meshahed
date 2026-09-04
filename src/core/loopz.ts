import type { PersonLite } from "@/core/people";

/**
 * **هويّةُ حساب Loopz النظاميّ** (D-252، هجرة ٧٧) — ثابتٌ واحد لكل قارئ.
 *
 * المعرّفُ محجوزٌ في `auth.users` **ويُقرأ «loopz» بالنظر**، ولا يبدأ
 * بأصفارٍ عمداً — الصفرُ رايةُ «لا هويّة» في `search_people` ومعرّفٌ
 * يشبه رايةً يُخلط بها يوماً.
 *
 * **ولماذا ثابتٌ في الشيفرة والصفُّ في القاعدة؟** لأن الواجهة تحتاج
 * الجوابَ قبل النداء: «هل هذا الصفُّ صفُّ Loopz؟» يُسأل في كل صفِّ خطٍّ
 * يُرسم، **ونداءُ قاعدةٍ لسؤالٍ جوابُه ثابتٌ منذ الهجرة هدرٌ** (D-164).
 * والقاعدةُ تحمل الحارسَ الحقيقيّ (`is_system`) لمن يقرؤها من SQL.
 */
export const LOOPZ_ID = "100b2000-0000-4000-8000-000000000001";
export const LOOPZ_USERNAME = "loopz";

export function isLoopz(id: string | null | undefined): boolean {
  return id === LOOPZ_ID;
}

/** الشخصُ الجاهز لتمريره حيث تُنتظر `PersonLite` — الختمُ هو الصورة (D-039) */
export const LOOPZ_PERSON: PersonLite = {
  id: LOOPZ_ID,
  nickname: "Loopz",
  username: LOOPZ_USERNAME,
  avatar_url: "/loopz-mark.png",
  hide_name: false,
};
