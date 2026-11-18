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

/**
 * مصدرُ الكود: صديقٌ (هديّةُ المدعوّ ١٤ يوماً عند الاحتساب) · شريكٌ (بلا هديّة) · 🆕 حملةٌ (المهمة ٣٩٣، الهجرة ٢٤٧: كودُ الحساب
 * الرسميّ في رابط حملة X — يُعَدّ ولا يُكافأ أحد)
 */
export type ReferralSource = "friend" | "partner" | "campaign";

/** `GET /api/v1/referral/{code}` — عامٌّ: من صاحبُ هذا الكود؟ `inviter: null` = كودٌ لا يُعرف */
export type ReferralPreviewPayload = {
  inviter: InviterLite | null;
  source: ReferralSource | null;
};

/**
 * `GET /api/v1/me/referral` — هل يقبل حسابي نسبةً الآن؟ الحرّاسُ حرّاسُ `claim_referral` نفسُها مقروءةً سلفاً: حسابٌ عمرُه
 * دون ٤٨ ساعة · بلا نسبةٍ سابقة · بلا متابعةٍ واحدة. `inviter`: من نُسبتُ إليه إن وُجد.
 */
export type MyReferralPayload = {
  eligible: boolean;
  inviter: InviterLite | null;
};

/**
 * `POST /api/v1/me/referral` — الكودُ وحدَه: من زرّ «افتح Loopz»، أو ملصوقاً من الحافظة، أو مكتوباً.
 * 🗑️ المهمة ٤٢٨ — `username` (النسبةُ باختيار الاسم) أُلغي: الاسمُ ليس دليلَ دعوة (قرارُ أحمد ١٨ نوفمبر).
 */
export type ClaimReferralBody = { code: string };
export type ClaimReferralPayload = {
  claimed: boolean;
  inviter: InviterLite | null;
  /** مصدرُ الكود الذي نُسب إليه (`ReferralSource`) */
  source: ReferralSource | null;
  /**
   * 🆕 المراجعةُ المستقلّة — **لماذا لم تُنسب** حين `claimed: false`: رفضٌ دائمٌ لا يُقال له «حاول مجدداً».
   * `ineligible` حسابي لا يقبل نسبةً (قديم · تابع · نُسب) · `unknown` لا داعيَ بهذا الكود (أو لا يصحّ داعياً) ·
   * `self` الكودُ كودي · `refused` رفضت الدالّةُ لحارسٍ تغيّر بين الفحص والكتابة.
   */
  reason?: "ineligible" | "unknown" | "self" | "refused";
};

/* 🗑️ المهمة ٤٢٨ — `GET /api/v1/me/referral/people` (البحثُ بالاسم) حُذف مع النسبة بالاسم. */
