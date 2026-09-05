"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 **قرارُ البلاغ** (D-927) — «أبقِ» يُظهر، و«احذف» يُخفي، **وكلاهما يمسح
 * بلاغاتِ الهدف.**
 *
 * 🔑 **ولماذا يمسحُ «أبقِ» البلاغاتِ أيضاً؟** لأنّ الإخفاءَ يقع عند عشرة،
 * **فإرجاعٌ يترك العشرةَ مكانَها يُنقَض بالبلاغ الحادي عشرَ بعد ثانية** —
 * وقرارٌ يُنقض ليس قراراً. **والتاريخُ لا يضيع**: العددُ والأسبابُ تُكتب في
 * `admin_audit` قبل المسح (مُثبَتٌ على `loopz-preview`: `cleared = 1`).
 *
 * **والحكمُ في القاعدة** (D-011): `am_admin()` في جسم الدالّة لا هنا.
 */
export async function adminReportDecide(
  kind: string,
  ref: unknown,
  decision: "keep" | "remove",
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_report_decide", {
    p_kind: kind,
    p_ref: ref,
    p_decision: decision,
  });
  if (error) throw new Error(error.message);
}
