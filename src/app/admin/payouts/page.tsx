import { notFound, redirect } from "next/navigation";
import { getAmAdmin, getAdminPayouts } from "@/lib/data";
import { adminDecidePayout } from "@/lib/actions";
import { buttonClass } from "@/components/ui/Button";

/**
 * 🆕 **طابورُ طلبات التحويل** (D-901) — نمطُ `/admin/partners` حرفاً.
 *
 * ⚠️ **والصفحةُ تقول فراغَها ولا تُخفيه**: المدفوعاتُ لم تُفتح، فلا
 * عمولةَ تُستحقّ ولا طلبَ يُقدَّم (`partner_balance` صفرٌ اليوم).
 * **طابورٌ فارغٌ هنا صحّةٌ لا عطل** — ولو صمتت الصفحةُ لظُنَّ العكس (D-063).
 *
 * 🔑 **والآيبانُ المعروض لقطةُ وقتِ الطلب لا الحاليّ**: شريكٌ بدّل
 * حسابَه بعد الطلب يُصرف له إلى ما وُوفق عليه، **والرايةُ تُنبّه للتغيّر**
 * ولا تغيّر الوجهة.
 */
async function decide(formData: FormData) {
  "use server";
  const d = String(formData.get("decision") ?? "");
  try {
    await adminDecidePayout(
      String(formData.get("id") ?? ""),
      d === "approved" || d === "paid" || d === "rejected" ? d : "rejected",
      String(formData.get("note") ?? ""),
    );
  } catch (e) {
    redirect(`/admin/payouts?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect("/admin/payouts?ok=1");
}

const STATUS_AR: Record<string, string> = {
  pending: "معلّق",
  approved: "موافَق عليه",
  paid: "صُرف",
  rejected: "مرفوض",
};

const ERRORS: Record<string, string> = {
  not_admin: "لا صلاحية.",
  bad_decision: "قرار غير معروف.",
  not_found: "الطلب غير موجود.",
  already_paid: "الطلب صُرف — لا يُنقَض.",
  approve_first: "وافِق أولاً ثم سجّل الصرف.",
  not_pending: "الطلب لم يعد معلّقاً.",
};

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  const sp = await searchParams;
  const rows = await getAdminPayouts();
  const err = sp.err
    ? (Object.entries(ERRORS).find(([k]) => sp.err!.includes(k))?.[1] ?? sp.err)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5" dir="rtl">
      <h1 className="text-22 font-bold">طلبات التحويل</h1>

      {err && <p className="text-14 text-[color:var(--error)]">⚠ {err}</p>}
      {sp.ok && <p className="text-14 text-[color:var(--success)]">✓ حُفظ القرار</p>}

      {rows.length === 0 && (
        <div className="rounded-card border border-border bg-surface p-4 space-y-1.5">
          <p className="text-14 font-bold">لا طلبات — وهذا صحيح.</p>
          <p className="text-13 text-muted leading-relaxed">
            المدفوعات لم تُفتح بعد، فلا عمولة تُستحقّ ولا طلب يُقدَّم. الجدول
            والبوّابات جاهزة، ويبقى مصدر الرصيد وحده — يُوصل يوم تُفتح القناة.
          </p>
        </div>
      )}

      {rows.map((r) => {
        const name = r.nickname || r.username || "شريك";
        return (
          <section key={r.id} className="rounded-card border border-border bg-surface p-4 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-14 font-bold">{name}</p>
                <p className="text-12 text-muted" dir="ltr">
                  {r.username ? `@${r.username} · ` : ""}
                  {r.requestedAt?.slice(0, 10) ?? "—"}
                </p>
              </div>
              <span className="shrink-0 text-16 font-bold tabular-nums" dir="ltr">
                {r.amount.toFixed(2)} {r.currency}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-12 font-bold ${
                  r.status === "pending"
                    ? "bg-accent/15 text-accent"
                    : r.status === "paid"
                      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                      : "bg-surface-2 text-muted"
                }`}
              >
                {STATUS_AR[r.status] ?? r.status}
              </span>
            </div>

            <dl className="text-13 space-y-1">
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">الآيبان (وقت الطلب):</dt>
                <dd className="min-w-0 truncate" dir="ltr">{r.iban ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">البنك:</dt>
                <dd className="min-w-0 truncate">{r.bank || "—"}</dd>
                <dt className="shrink-0 text-muted ms-3">صاحب الحساب:</dt>
                <dd className="min-w-0 truncate">{r.holder || "—"}</dd>
              </div>
              {r.note && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">ملاحظة:</dt>
                  <dd className="min-w-0 leading-relaxed">{r.note}</dd>
                </div>
              )}
            </dl>

            {r.detailsChanged && (
              <p className="text-12 text-[color:var(--error)] leading-relaxed">
                ⚠ الشريك بدّل بياناته البنكية بعد هذا الطلب. الصرف يمضي على
                اللقطة أعلاه — راجِعها قبل الموافقة.
              </p>
            )}

            {r.status !== "paid" && r.status !== "rejected" && (
              <form action={decide} className="flex flex-wrap items-center gap-2 pt-1">
                <input type="hidden" name="id" value={r.id} />
                <input
                  type="text"
                  name="note"
                  maxLength={300}
                  placeholder="ملاحظة (اختياري)"
                  aria-label={`ملاحظة على طلب ${name}`}
                  className="flex-1 min-w-[10rem] rounded-input border border-border bg-surface-2 px-3 py-2 text-14"
                />
                {r.status === "pending" ? (
                  <>
                    <button type="submit" name="decision" value="approved" className={buttonClass({ size: "sm" })}>
                      موافقة
                    </button>
                    <button type="submit" name="decision" value="rejected" className={buttonClass({ variant: "surface", size: "sm" })}>
                      رفض
                    </button>
                  </>
                ) : (
                  <button type="submit" name="decision" value="paid" className={buttonClass({ size: "sm" })}>
                    سجّل الصرف
                  </button>
                )}
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
