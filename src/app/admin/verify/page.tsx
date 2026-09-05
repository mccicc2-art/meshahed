import { notFound, redirect } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { adminVerificationQueue, adminDecideVerification } from "@/lib/actions";
import { buttonClass } from "@/components/ui/Button";

/**
 * 🆕 **طابورُ مراجعة التوثيق** (D-775) — نمطُ `/admin/partners` حرفاً
 * (وهو نمطُ `/admin/links` قبله): صلاحيّةُ `am_admin()` القائمة، وغيرُ
 * الإداريِّ يرى ٤٠٤، **والحارسُ الحقيقيُّ في جسم
 * `admin_decide_verification`** مهما فعلت هذه القشرة (D-011).
 *
 * 🔑 **والبرهانُ يسبق الدعوى في الرسم**: المزوّدون المرتبطون أوّلاً
 * (لقطةٌ محفوظةٌ لحظةَ التقديم فلا تتبدّل تحت يد المراجع)، **ثمّ الروابطُ
 * التي كتبها بيده** — **وترتيبُ العرض هو ما يقول للمراجع أيَّهما يزن.**
 *
 * عربيّةٌ صرفةٌ بلا i18n كأخواتها: صفحةُ مشغّلٍ لا مستخدمين.
 */

async function decide(formData: FormData) {
  "use server";
  try {
    await adminDecideVerification(
      String(formData.get("id") ?? ""),
      String(formData.get("decision") ?? "") as "approved" | "rejected" | "more_info",
      String(formData.get("note") ?? ""),
    );
  } catch (e) {
    redirect(`/admin/verify?err=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
  redirect("/admin/verify?ok=1");
}

const KIND_AR: Record<string, string> = {
  person: "شخصية عامة أو صانع محتوى",
  org: "جهة أو علامة تجارية",
  media: "منصة إعلامية أو جهة فنية",
};

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const rows = await adminVerificationQueue();

  return (
    <div className="space-y-6">
      <h1 className="text-22 font-bold">طلبات التوثيق</h1>

      {sp.err && <p className="text-14 text-[color:var(--error)]">⚠ {sp.err}</p>}
      {sp.ok && <p className="text-14 text-[color:var(--success)]">✓ حُفظ القرار</p>}

      {rows.length === 0 && <p className="text-14 text-muted">لا طلبات معلّقة.</p>}

      {rows.map((r) => (
        <article key={r.id} className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3">
          <header className="flex items-center justify-between gap-3">
            <span className="text-14 font-bold">{KIND_AR[r.kind] ?? r.kind}</span>
            <span className="text-12 text-muted">
              {new Date(r.created_at).toLocaleDateString("ar")}
              {r.status === "more_info" ? " · بانتظار معلومات" : ""}
            </span>
          </header>

          {/* ===== البرهان: ما سُجّل الدخولُ منه فعلاً ===== */}
          <section>
            <h2 className="text-12 font-bold text-muted mb-1">حسابات مرتبطة (مبرهنة)</h2>
            {r.proven.length === 0 ? (
              <p className="text-12 text-[color:var(--error)]">لا حساب مرتبط — دعوى بلا برهان.</p>
            ) : (
              <ul className="space-y-0.5">
                {r.proven.map((p, i) => (
                  <li key={i} className="text-12">
                    <span className="font-semibold capitalize">{p.provider}</span>{" "}
                    <span dir="ltr" className="text-muted">
                      {p.handle ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ===== الدعوى: ما كتبه بيده ===== */}
          {r.links.length > 0 && (
            <section>
              <h2 className="text-12 font-bold text-muted mb-1">روابط ذكرها</h2>
              <ul className="space-y-0.5" dir="ltr">
                {r.links.map((l, i) => (
                  <li key={i} className="text-12 truncate">
                    <a href={l} target="_blank" rel="noreferrer noopener" className="hover:text-accent">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.website && (
            <p className="text-12" dir="ltr">
              <a href={r.website} target="_blank" rel="noreferrer noopener" className="hover:text-accent">
                {r.website}
              </a>
            </p>
          )}
          {r.sources && <p className="text-12 text-muted whitespace-pre-line">{r.sources}</p>}
          <p className="text-14 whitespace-pre-line">{r.reason}</p>

          {/* ===== القرار — والسببُ يُكتب مرّةً ويُقرأ عند المتقدّم ===== */}
          <form action={decide} className="space-y-2 pt-1">
            <input type="hidden" name="id" value={r.id} />
            <input
              name="note"
              placeholder="سبب الرفض أو ما ينقص — يظهر للمتقدّم"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-14 outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-2">
              <button name="decision" value="approved" className={buttonClass({ size: "sm" })}>
                توثيق
              </button>
              <button
                name="decision"
                value="more_info"
                className={buttonClass({ variant: "surface", size: "sm" })}
              >
                طلب معلومات
              </button>
              <button
                name="decision"
                value="rejected"
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                رفض
              </button>
            </div>
          </form>
        </article>
      ))}
    </div>
  );
}
