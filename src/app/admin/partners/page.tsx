import { notFound, redirect } from "next/navigation";
import { getAmAdmin, getAdminPartnerApplications } from "@/lib/data";
import { adminDecidePartner } from "@/lib/actions";
import { displayNameOf } from "@/lib/people";
import { Avatar } from "@/components/Avatar";
import { buttonClass } from "@/components/ui/Button";

/**
 * 🆕 **لوحةُ طلبات الشركاء** (D-770) — نمطُ `/admin/links` حرفاً (D-608):
 * صفحةٌ واحدةٌ بصلاحيّة `am_admin()` القائمة، غيرُ الإداريِّ يرى 404،
 * **والحارسُ الحقيقيُّ في جسم `admin_decide_partner`** — يرمي
 * `forbidden` لغير الإداريّ مهما فعلت هذه القشرة (D-011).
 *
 * المعلّقةُ أوّلاً (ترتيبُ الدالّة نفسِها)، والموافقةُ تولّد كودَ
 * `/p/<CODE>` في القاعدة وتُدخل الشريكَ — فلا خطوةَ يدٍ ثانية تُنسى.
 * عربيّةٌ صرفةٌ بلا i18n كأختها: صفحةُ مشغّلٍ لا مستخدمين.
 */

async function decide(formData: FormData) {
  "use server";
  try {
    await adminDecidePartner(
      String(formData.get("user") ?? ""),
      formData.get("approve") === "1",
    );
  } catch (e) {
    redirect(`/admin/partners?err=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
  redirect("/admin/partners?ok=1");
}

const STATUS_AR: Record<string, string> = {
  pending: "معلّق",
  approved: "موافَق عليه",
  rejected: "مرفوض",
};

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const apps = await getAdminPartnerApplications();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-22 font-bold">طلبات Loopz Partners</h1>

      {sp.err && <p className="text-14 text-[color:var(--error)]">⚠ {sp.err}</p>}
      {sp.ok && <p className="text-14 text-[color:var(--success)]">✓ حُفظ القرار</p>}

      {apps.length === 0 && (
        <p className="text-14 text-muted">لا طلبات بعد.</p>
      )}

      {apps.map((a) => {
        const name = displayNameOf(a.person, "مستخدم");
        return (
          <section
            key={a.userId}
            className="rounded-card border border-border bg-surface p-4 space-y-2.5"
          >
            <div className="flex items-center gap-3">
              <Avatar src={a.person?.avatar_url ?? null} name={name} size={40} alt="" />
              <div className="min-w-0 flex-1">
                <p className="text-14 font-bold truncate">{name}</p>
                <p className="text-12 text-muted" dir="ltr">
                  {a.person?.username ? `@${a.person.username} · ` : ""}
                  {a.createdAt.slice(0, 10)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-12 font-bold ${
                  a.status === "pending"
                    ? "bg-accent/15 text-accent"
                    : a.status === "approved"
                      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                      : "bg-surface-2 text-muted"
                }`}
              >
                {STATUS_AR[a.status] ?? a.status}
              </span>
            </div>

            <dl className="text-14 space-y-1.5">
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">القناة:</dt>
                <dd className="min-w-0 truncate" dir="ltr">
                  <a
                    href={a.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-accent"
                  >
                    {a.channelUrl}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">المحتوى:</dt>
                <dd className="min-w-0">{a.contentType || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">المنصات:</dt>
                <dd className="min-w-0">{a.platforms || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">المتابعون:</dt>
                <dd className="min-w-0">{a.followersRange || "—"}</dd>
                <dt className="shrink-0 text-muted ms-3">الدولة واللغة:</dt>
                <dd className="min-w-0">
                  {[a.country, a.contentLanguage].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
              {a.reason && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">السبب:</dt>
                  <dd className="min-w-0 leading-relaxed">{a.reason}</dd>
                </div>
              )}
            </dl>

            {a.status === "pending" && (
              <div className="flex items-center gap-2 pt-1">
                <form action={decide}>
                  <input type="hidden" name="user" value={a.userId} />
                  <input type="hidden" name="approve" value="1" />
                  <button type="submit" className={buttonClass({ size: "sm" })}>
                    موافقة
                  </button>
                </form>
                <form action={decide}>
                  <input type="hidden" name="user" value={a.userId} />
                  <input type="hidden" name="approve" value="0" />
                  <button
                    type="submit"
                    className={buttonClass({ variant: "surface", size: "sm" })}
                  >
                    رفض
                  </button>
                </form>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
