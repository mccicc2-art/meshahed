"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyPlusGift } from "@/lib/push";

/**
 * 🆕 **منحُ صلاحية الإدارة وسحبُها** (D-928، تقييمُ ٥ سبتمبر: «`is_admin`
 * يُبدَّل بـSQL خام فقط — ومالكُ المنتج لا يستطيع أن يعيّن مديراً بنفسه»).
 *
 * ⚠️ **ولا يغيّر المرءُ صلاحيةَ نفسِه** (`cannot_change_self` في جسم الدالّة):
 * **مديرٌ يسحب صلاحيتَه بضغطةٍ يقفل البابَ على نفسِه ولا أحدَ يفتحه** — ولا
 * زرَّ استرجاعٍ في منتجٍ حارسُه في القاعدة.
 *
 * 🔴 🆕 **والسببُ إلزاميٌّ منذ الهجرة ١٨٩** (D-962، مراجعةُ ١٤ سبتمبر):
 * **الإيقافُ كان يفرض سبباً والمنحُ ضغطةً واحدة** — **والأوسعُ أثراً يجب أن
 * يكون الأغلى ثمناً**: مديرٌ جديدٌ يفكّ إيقافَ نفسِه ويكشف البُرد ويمسح
 * البلاغات. **والحارسُ في جسم الدالّة لا هنا** (D-011): حقلٌ تمنعه الشاشةُ
 * وحدَها حقلٌ يُتجاوَز بنداءٍ مباشر.
 */
export async function adminSetAdmin(userId: string, on: boolean, reason: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_admin", {
    p_user: userId,
    p_on: on,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

/**
 * 🆕 المهمّة ٤٠١ — **«امنح Loopz+» حتى نهاية يومٍ يختاره المدير** (أحمد ١٨ نوفمبر: «١أ نفذ شكل الاشعار المقترح»). كانت المنحةُ
 * سطرَ SQL خاماً لا يعرف به الممنوح؛ الآن صفٌّ يدويٌّ بحارس القاعدة (`admin_grant_plus`، الهجرة ٢٤٨: مديرٌ وسببٌ وسجلّ)، ثمّ
 * إشعارُ «هدية من Loopz» يفتح صفحةَ Loopz+.
 *
 * `lastDay` = آخرُ يومٍ في المنحة (`YYYY-MM-DD`) — تنتهي عند منتصف ليلته بتوقيت الرياض، كما انتهت منحةُ ١٧ نوفمبر.
 * يعيد نهايةَ Plus بعد المنح وعددَ أجهزة العضو: صفرٌ = مُنح ولم يصله إشعار (لا جهازَ مسجّلاً)، فيعرف المديرُ أن يراسله.
 */
export async function adminGrantPlus(userId: string, lastDay: string, reason: string): Promise<{ plusUntil: string | null; devices: number }> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastDay.trim());
  if (!m) throw new Error("bad_day");
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  const until = `${next.toISOString().slice(0, 10)}T00:00:00+03:00`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_grant_plus", { p_user: userId, p_until: until, p_reason: reason });
  if (error) throw new Error(error.message);
  const devices = await notifyPlusGift({ to: userId, until: new Date(until).toISOString() });
  return { plusUntil: (data as string | null) ?? null, devices };
}
