/**
 * ====== 🆕 عقودُ الدعوة في التطبيق (المهمة ٣٧٠ — قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ») ======
 *
 * 🔴 **العلّة**: النسبةُ (`claim_referral`) كانت تقع في ردهة دخول الويب وحدَها (`/auth/callback` يقرأ كوكي `loopz_ref`)،
 * والتطبيقُ يدخل بثلاثة طرقٍ لا تمرّ بها (Google الأصليّ · Apple · Google بالمتصفّح الراجع إلى عنوان التطبيق) — فلم تُنسب
 * دعوةُ عضوٍ سجّل من التطبيق قطّ. هذه الأبوابُ تحمل الكودَ إلى الخادم من التطبيق نفسِه.
 */

/** الداعي كما يُعرض على المدعوّ — وجهٌ عامٌّ لا أكثر (من أخفى اسمَه: بلا اسمٍ ولا صورة) */
export type InviterLite = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  verified: boolean;
};

/** `GET /api/v1/referral/{code}` — عامٌّ: من صاحبُ هذا الكود؟ `inviter: null` = كودٌ لا يُعرف */
export type ReferralPreviewPayload = {
  inviter: InviterLite | null;
  /** صديقٌ (هديّةُ المدعوّ ١٤ يوماً عند الاحتساب) أو شريك (بلا هديّة) */
  source: "friend" | "partner" | null;
};

/**
 * `GET /api/v1/me/referral` — هل يقبل حسابي نسبةً الآن؟ الحرّاسُ حرّاسُ `claim_referral` نفسُها مقروءةً سلفاً: حسابٌ عمرُه
 * دون ٤٨ ساعة · بلا نسبةٍ سابقة · بلا متابعةٍ واحدة. `inviter`: من نُسبتُ إليه إن وُجد.
 */
export type MyReferralPayload = {
  eligible: boolean;
  inviter: InviterLite | null;
};

/** `POST /api/v1/me/referral` — كودٌ (رابطُ الدعوة) أو معرّفُ عضوٍ (البحثُ بالاسم)، أحدُهما */
export type ClaimReferralBody = { code?: string; username?: string };
export type ClaimReferralPayload = {
  claimed: boolean;
  inviter: InviterLite | null;
  /** مصدرُ الكود الذي نُسب إليه: صديقٌ (هديّةُ ١٤ يوماً عند الاحتساب) أو شريك (بلا هديّة) */
  source: "friend" | "partner" | null;
  /**
   * 🆕 المراجعةُ المستقلّة — **لماذا لم تُنسب** حين `claimed: false`: رفضٌ دائمٌ لا يُقال له «حاول مجدداً».
   * `ineligible` حسابي لا يقبل نسبةً (قديم · تابع · نُسب) · `unknown` لا داعيَ بهذا الكود أو الاسم (أو لا يصحّ داعياً) ·
   * `self` الكودُ كودي · `refused` رفضت الدالّةُ لحارسٍ تغيّر بين الفحص والكتابة.
   */
  reason?: "ineligible" | "unknown" | "self" | "refused";
};

/** `GET /api/v1/me/referral/people?q=` — من يمكن أن يكون دعاني: بحثُ الأعضاء نفسُه بلا الحساب الرسميّ وبلا نفسي */
export type ReferralPerson = InviterLite & { username: string };
export type ReferralPeoplePayload = { people: ReferralPerson[] };
