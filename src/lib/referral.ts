import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isLoopz } from "@/core/loopz";
import { isPersonaId } from "@/core/personas";
import { cleanInviteCode } from "@/core/storeLinks";
import type { InviterLite, ReferralSource } from "@/core/contracts/referral";

/**
 * ====== 🆕 الدعوةُ من التطبيق — قراءاتُ الخادم وكتابتُه (المهمة ٣٧٠) ======
 *
 * 🔑 **الحكمُ في جسم `claim_referral` لا هنا** (D-011): حسابٌ عمرُه ≤ ٤٨ ساعة · بلا متابعة · نسبةٌ واحدةٌ للعمر · لا يدعو نفسَه
 * — والنسبةُ نفسُها تُكتب بجلسة المدعوّ (`auth.uid()`). ما هنا قراءاتٌ ترسم السؤالَ قبل أن يُسأل، **فلا يرى العضوُ «هل دعاك
 * أحمد؟» ثمّ يُرفض عند الباب**.
 * ⚖️ **عميلُ الخدمة للقراءة عبر الحسابات وحدَها** (صاحبُ الكود · نسبتي · متابعاتي) — `referral_codes` و`partners` لا يقرؤها
 * غيرُ أصحابها بحكم RLS. وغيابُ المفتاح يرجع إلى عميل الجلسة فتسقط القراءةُ صفراً صامتاً، لا خطأً.
 */

const LITE = "id, nickname, username, avatar_url, hide_name, verified_at";

type LiteRow = { id: string; nickname: string | null; username: string | null; avatar_url: string | null; hide_name: boolean | null; verified_at: string | null };

/** الوجهُ العامّ — من أخفى اسمَه لا يُرسَل اسمُه ولا صورتُه ولا معرّفُه (عُرفُ `/me/invites`) */
function lite(r: LiteRow | null | undefined): InviterLite | null {
  if (!r) return null;
  const hidden = !!r.hide_name;
  return {
    name: hidden ? null : r.nickname || r.username,
    username: hidden ? null : r.username,
    avatar_url: hidden ? null : r.avatar_url,
    verified: !hidden && typeof r.verified_at === "string" && r.verified_at.length > 0,
  };
}

export async function inviterById(id: string): Promise<InviterLite | null> {
  try {
    const db = await createServiceClient();
    const { data } = await db.from("public_profiles").select(LITE).eq("id", id).maybeSingle();
    return lite(data as LiteRow | null);
  } catch {
    return null;
  }
}

/**
 * 🆕 المراجعةُ المستقلّة — **من لا يصحّ أن يكون داعياً**: الحسابُ الرسميّ، وشخصيّاتُ Loopz AI (ملفّاتٌ عاديّةٌ بلا `is_system`،
 * فيعيدها بحثُ الأعضاء — ولو اختيرت لمنحتها `qualify_referral` أيّاماً ومكافآت)، والموقوف (`suspended_at`، الهجرة ١٧٣).
 * 🆕 المهمة ٣٩٣ — `campaign`: الحسابُ الرسميُّ يصحّ داعياً **بكوده وحدَه** (رابطُ حملة X، الهجرة ٢٤٧) لأنّ مصدرَه `campaign` لا
 * مكافأةَ فيه. (والاختيارُ بالاسم أُلغي كلُّه في المهمة ٤٢٨ — الكودُ وحدَه يَنسب.)
 */
async function canInvite(db: Awaited<ReturnType<typeof createServiceClient>>, id: string, campaign = false): Promise<boolean> {
  if (isPersonaId(id) || (isLoopz(id) && !campaign)) return false;
  const { data, error } = await db.from("profiles").select("suspended_at").eq("id", id).maybeSingle();
  return !error && !!data && !data.suspended_at;
}

/**
 * صاحبُ الكود ومصدرُه — بترتيب `claim_referral` نفسِه: كودُ صديقٍ أوّلاً، ثمّ كودُ شريك. ومن لا يصحّ داعياً كأنّ كودَه غائب.
 * 🆕 المهمة ٣٩٣ — كودُ الحساب الرسميّ مصدرُه `campaign` (كما تكتبه الدالّةُ في ٢٤٧): بلا «هديّة» في الصفحة ولا في التطبيق،
 * لأنّ الهديّةَ تُرسم لـ`friend` وحدَه — والقارئُ القديمُ في التطبيق يقارن بـ`"friend"` فيرى قيمةً لا يعرفها بلا هديّةٍ أيضاً.
 */
export async function ownerOfCode(raw: unknown): Promise<{ userId: string; source: ReferralSource } | null> {
  const code = cleanInviteCode(raw);
  if (!code) return null;
  try {
    const db = await createServiceClient();
    const friend = await db.from("referral_codes").select("user_id").eq("code", code).maybeSingle();
    let owner: { userId: string; source: ReferralSource } | null = friend.data?.user_id
      ? { userId: String(friend.data.user_id), source: isLoopz(String(friend.data.user_id)) ? "campaign" : "friend" }
      : null;
    if (!owner) {
      const partner = await db.from("partners").select("user_id").eq("code", code).maybeSingle();
      if (partner.data?.user_id) owner = { userId: String(partner.data.user_id), source: "partner" };
    }
    return owner && (await canInvite(db, owner.userId, owner.source === "campaign")) ? owner : null;
  } catch {
    /* صفرٌ صامت */
  }
  return null;
}

/**
 * هل يقبل هذا الحسابُ نسبةً الآن؟ — حرّاسُ `claim_referral` مقروءةً سلفاً. **ليست الحارس**: الدالّةُ تعيد فحصَها عند الكتابة.
 * `createdAt` من جلسة المستخدم نفسِها (`auth.users.created_at`)، لا من جسم الطلب.
 */
export async function referralState(userId: string, createdAt: string | undefined): Promise<{ eligible: boolean; inviterId: string | null }> {
  try {
    const db = await createServiceClient();
    const mine = await db.from("referrals").select("inviter_id").eq("invitee_id", userId).maybeSingle();
    if (mine.data?.inviter_id) return { eligible: false, inviterId: String(mine.data.inviter_id) };
    const born = createdAt ? Date.parse(createdAt) : NaN;
    if (!Number.isFinite(born) || Date.now() - born > 48 * 3600_000) return { eligible: false, inviterId: null };
    const follows = await db.from("follows").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    if (follows.error || (follows.count ?? 0) > 0) return { eligible: false, inviterId: null };
    return { eligible: true, inviterId: null };
  } catch {
    return { eligible: false, inviterId: null };
  }
}

/* 🗑️ المهمة ٤٢٨ — `codeForUsername` (النسبةُ باختيار الاسم) حُذف: قرارُ أحمد ١٨ نوفمبر «اذا خليته يختار الشخص يسير فيه تلاعب».
   الاسمُ ليس دليلَ دعوة — المدعوُّ يختار من شاء فيذهب حقُّ الداعي الحقيقيّ أو عمولةُ شريكٍ إلى غيره. الكودُ وحدَه دليل:
   لا يصل إلّا ممّن أرسل الرابط. */

/**
 * 🆕 البند ٢ (قرارُ أحمد «٢ أ») — **الاحتسابُ يُعاد فحصُه مع نبضة الحضور**: كان لا يُفحص إلّا عند إضافة عملٍ أو إنهاء استيراد،
 * فمن أضاف أعمالَه الخمسة في يومه الأوّل ثمّ نشط ثلاثةَ أيّامٍ بلا إضافةٍ جديدة لا يُحتسب أبداً. الدالّةُ تخرج من أوّل سطرٍ لمن
 * لا نسبةَ معلّقةً له، فالنبضةُ لا تثقل. فشلُها صمت.
 */
export async function requalify(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("qualify_referral");
  } catch {
    /* لا شيء */
  }
}
