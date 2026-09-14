"use server";

import { createClient } from "@/lib/supabase/server";

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
