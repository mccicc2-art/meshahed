"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/core/ratelimit";
import { getUser } from "@/lib/data";

/**
 * 🆕 **أفعالُ قائمة دعوة Play** (D-909) — ثلاثُ قشورٍ تنقل الطلب،
 * **والحكمُ كلُّه في القاعدة**: `am_admin()` في جسم كلِّ دالّة (D-011)،
 * **وشكلُ البريد يُرفض هناك لا هنا** فلا يدخل القائمةَ سطرٌ ميّتٌ عبر
 * نداءٍ مباشر يتخطّى الواجهة.
 *
 * ⚖️ **ولمَ ملفٌّ جديدٌ لا سطرٌ في `actions.ts`؟** لأنّ `actions.ts`
 * **٢٨٢ كيلوبايت في ملفٍّ واحد** — وهو بنفسه عيبٌ يستحقّ الشقَّ لا
 * الإطعامَ: كلُّ فعلٍ يُضاف إليه يزيد ما يُعاد قراءتُه وتحميلُه ومراجعتُه
 * لأجل ثلاثة أسطر. **فهذا الملفُّ أوّلُ شقٍّ بحدٍّ واضح**: أفعالُ الإدارة
 * لسطحٍ إداريٍّ واحد. ⚠️ **ولا نسخةَ ثانية**: من أراد فعلاً إداريّاً
 * جديداً يكتبه هنا، لا هنا وهناك.
 *
 * 🔑 **وحدُّ المعدّل بنفس أرقام `admin` القائمة** (٣٠/دقيقة) — والحارسُ
 * الحقيقيُّ الصلاحيّةُ لا العدّاد.
 */
async function adminClient() {
  const user = await getUser();
  if (!user) throw new Error("auth required");
  if (!allow(`admin:${user.id}`, 30, 60_000)) throw new Error("rate limited");
  return createClient();
}

export async function adminTesterAdd(email: string, note?: string) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("admin_tester_add", {
    p_email: String(email ?? "").slice(0, 254),
    p_note: String(note ?? "").slice(0, 120) || null,
  });
  if (error) throw new Error(error.message.slice(0, 160));
  revalidatePath("/admin/testers");
}

export async function adminTesterRemove(email: string) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("admin_tester_remove", {
    p_email: String(email ?? "").slice(0, 254),
  });
  if (error) throw new Error(error.message.slice(0, 160));
  revalidatePath("/admin/testers");
}

export async function adminTesterInvited(email: string, on: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("admin_tester_invited", {
    p_email: String(email ?? "").slice(0, 254),
    p_on: on === true,
  });
  if (error) throw new Error(error.message.slice(0, 160));
  revalidatePath("/admin/testers");
}
