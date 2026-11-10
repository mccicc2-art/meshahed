import "server-only";
import { createClient } from "@/lib/supabase/server";

/*
 * 🆕 المهمة ٣٧٠ — قارئُ دفتر العمولات خارجَ `referral.ts`: هو بجلسة الشريك نفسِه (`my_partner_earnings` لصاحبها وحدَه)، فلا يسكن
 * ملفّاً مسيَّجاً لعميل الخدمة (المراجعةُ المستقلّة: «اتّسع سطحُ السياج بلا داعٍ»). يقرؤه وجها اللوحة: صفحةُ الويب و`/me/partner`.
 */

/** 🆕 هجرة ٢٣٨ — دفترُ عمولات الشريك (`my_partner_earnings`، لصاحبه وحده). قبل الهجرة أو لغير الشريك: `null` فتبقى أصفاراً */
export type PartnerEarnings = {
  available: number;
  on_hold: number;
  total: number;
  subscribed: number;
  recent: { kind: "earned" | "reversed"; amount: number; created_at: string }[];
};
export async function getMyPartnerEarnings(): Promise<PartnerEarnings | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_partner_earnings");
    if (error || !data) return null;
    const d = data as Partial<PartnerEarnings>;
    return {
      available: Number(d.available ?? 0),
      on_hold: Number(d.on_hold ?? 0),
      total: Number(d.total ?? 0),
      subscribed: Number(d.subscribed ?? 0),
      recent: Array.isArray(d.recent)
        ? d.recent.map((r) => ({ kind: r.kind === "reversed" ? "reversed" : "earned", amount: Number(r.amount ?? 0), created_at: String(r.created_at) }))
        : [],
    };
  } catch {
    return null;
  }
}
