import { notFound, redirect } from "next/navigation";
import { getAmAdmin, getAdminUsers } from "@/lib/data";
import { adminSuspendUser, adminUnsuspendUser } from "@/lib/actions";
import { Avatar } from "@/components/Avatar";
import { buttonClass } from "@/components/ui/Button";

/**
 * 🆕 **إدارةُ المستخدمين** (D-901) — نمطُ `/admin/partners` حرفاً:
 * صفحةٌ عربيّةٌ ثابتةٌ بصلاحيّة `am_admin()`، وغيرُ الإداريِّ يرى 404،
 * **والحارسُ الحقيقيُّ في جسم `admin_suspend_user`** (D-011).
 *
 * ⚠️ **والسببُ حقلٌ إلزاميّ**: تمنعه القاعدةُ لا الواجهةُ وحدَها —
 * لأنه يُكتب في `admin_audit` **ويُعرض للموقوف حين يحاول الدخول**.
 * **«أوقفتُ حسابك» بلا سببٍ بلاغٌ لا قرار.**
 */
async function suspend(formData: FormData) {
  "use server";
  const q = String(formData.get("q") ?? "");
  const back = `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  try {
    await adminSuspendUser(
      String(formData.get("user") ?? ""),
      String(formData.get("reason") ?? ""),
    );
  } catch (e) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=suspended`);
}

async function unsuspend(formData: FormData) {
  "use server";
  const q = String(formData.get("q") ?? "");
  const back = `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  try {
    await adminUnsuspendUser(String(formData.get("user") ?? ""));
  } catch (e) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=restored`);
}

/** رسائلُ القاعدة الثابتة تُترجَم هنا — «حاول مجدداً» تكذب (D-855). */
const ERRORS: Record<string, string> = {
  not_admin: "لا صلاحية.",
  cannot_suspend_self: "لا توقف حسابك بنفسك.",
  cannot_suspend_admin: "لا يُوقَف حسابُ مديرٍ من هنا.",
  reason_required: "السبب مطلوب.",
  already_suspended: "الحساب موقوف أصلاً.",
  not_suspended: "الحساب ليس موقوفاً.",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const rows = await getAdminUsers(q);
  const err = sp.err
    ? (Object.entries(ERRORS).find(([k]) => sp.err!.includes(k))?.[1] ?? sp.err)
    : null;

  return (
    <div className="space-y-5">
      <h1 className="text-22 font-bold">المستخدمون</h1>

      <form className="flex gap-2" action="/admin/users">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="اسم المستخدم أو الاسم أو المعرّف"
          aria-label="بحث عن مستخدم"
          className="flex-1 rounded-input border border-border bg-surface px-3 py-2 text-14"
        />
        <button type="submit" className={buttonClass({ size: "sm" })}>بحث</button>
      </form>

      {err && <p className="text-14 text-[color:var(--error)]">⚠ {err}</p>}
      {sp.ok === "suspended" && <p className="text-14 text-[color:var(--success)]">✓ أُوقف الحساب</p>}
      {sp.ok === "restored" && <p className="text-14 text-[color:var(--success)]">✓ فُكّ الإيقاف</p>}

      {rows.length === 0 && <p className="text-14 text-muted">لا نتائج.</p>}

      {rows.map((u) => {
        const name = u.nickname || u.username || "مستخدم";
        const suspended = Boolean(u.suspendedAt);
        return (
          <section
            key={u.id}
            className={`rounded-card border bg-surface p-4 space-y-2.5 ${
              suspended ? "border-[color:var(--error)]/50" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar src={u.avatarUrl} name={name} size={40} alt="" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-14 font-bold">{name}</p>
                <p className="text-12 text-muted truncate" dir="ltr">
                  {u.username ? `@${u.username}` : u.id.slice(0, 8)}
                  {u.emailMasked ? ` · ${u.emailMasked}` : ""}
                </p>
              </div>
              {suspended ? (
                <span className="shrink-0 rounded-full bg-[color:var(--error)]/15 px-2.5 py-1 text-12 font-bold text-[color:var(--error)]">
                  موقوف
                </span>
              ) : u.isAdmin ? (
                <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-12 font-bold text-accent">
                  مدير
                </span>
              ) : null}
            </div>

            <dl className="text-13 text-muted space-y-1">
              <div className="flex gap-2">
                <dt className="shrink-0">انضمّ:</dt>
                <dd dir="ltr">{u.createdAt?.slice(0, 10) ?? "—"}</dd>
                <dt className="shrink-0 ms-3">آخر دخول:</dt>
                <dd dir="ltr">{u.lastSignInAt?.slice(0, 10) ?? "—"}</dd>
                <dt className="shrink-0 ms-3">الخطة:</dt>
                <dd>{u.plan ?? "free"}</dd>
              </div>
              {suspended && (
                <div className="flex gap-2">
                  <dt className="shrink-0">سبب الإيقاف:</dt>
                  <dd className="min-w-0 leading-relaxed text-[color:var(--error)]">
                    {u.suspendedReason || "—"}
                  </dd>
                </div>
              )}
            </dl>

            {u.isAdmin ? null : suspended ? (
              <form action={unsuspend} className="pt-1">
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="q" value={q} />
                <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                  فكّ الإيقاف
                </button>
              </form>
            ) : (
              <form action={suspend} className="flex items-center gap-2 pt-1">
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="q" value={q} />
                <input
                  type="text"
                  name="reason"
                  required
                  maxLength={300}
                  placeholder="سبب الإيقاف (إلزامي)"
                  aria-label={`سبب إيقاف ${name}`}
                  className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-14"
                />
                <button type="submit" className={buttonClass({ size: "sm" })}>
                  إيقاف
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
