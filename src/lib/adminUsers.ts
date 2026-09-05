"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 **منحُ صلاحية الإدارة وسحبُها** (D-928، تقييمُ ٥ سبتمبر: «`is_admin`
 * يُبدَّل بـSQL خام فقط — ومالكُ المنتج لا يستطيع أن يعيّن مديراً بنفسه»).
 *
 * ⚠️ **ولا يغيّر المرءُ صلاحيةَ نفسِه** (`cannot_change_self` في جسم الدالّة):
 * **مديرٌ يسحب صلاحيتَه بضغطةٍ يقفل البابَ على نفسِه ولا أحدَ يفتحه** — ولا
 * زرَّ استرجاعٍ في منتجٍ حارسُه في القاعدة.
 */
export async function adminSetAdmin(userId: string, on: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_admin", { p_user: userId, p_on: on });
  if (error) throw new Error(error.message);
}
