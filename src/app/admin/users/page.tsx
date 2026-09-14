import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAmAdmin, getAdminUsers } from "@/lib/data";
import { adminSuspendUser, adminUnsuspendUser } from "@/lib/actions";
import { getAdminUserContent, USER_ITEM_AR } from "@/lib/admin";
import { adminSetAdmin } from "@/lib/adminUsers";
import { Avatar } from "@/components/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { settingsCardRows } from "@/components/settings/SettingsGroup";

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

/**
 * 🆕 D-928 — **منحُ الإدارة وسحبُها من الواجهة**: كان `is_admin` يُبدَّل
 * بـSQL خام وحدَه، **فمالكُ المنتج لا يستطيع أن يعيّن مديراً ولا أن يعزله.**
 *
 * 🔴 🆕 **وبسببٍ إلزاميٍّ منذ D-962**: كان **الإيقافُ يفرض سبباً والمنحُ
 * ضغطةً واحدةً عاريةً بجانب زرِّ عرضِ المحتوى** — **وأوسعُ فعلٍ في اللوحة
 * أثراً كان أرخصَها ضغطة.** والحقلُ نظيرُ حقلِ الإيقاف حرفاً: **شكلٌ واحدٌ
 * لفعلين متشابهين لا شكلان** (القاعدة ٦)، **والقاعدةُ ترفض الفارغَ
 * (`reason_required`) لا الشاشةُ وحدَها** (D-011).
 */
async function setAdmin(formData: FormData) {
  "use server";
  const q = String(formData.get("q") ?? "");
  const back = `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  try {
    await adminSetAdmin(
      String(formData.get("user") ?? ""),
      formData.get("on") === "1",
      String(formData.get("reason") ?? ""),
    );
  } catch (e) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=admin`);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; u?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const open = (sp.u ?? "").trim();
  const rows = await getAdminUsers(q);
  /* **لا يُجلب محتوًى إلا لمن فُتحت نافذتُه**: جلبُه لكلِّ نتيجةٍ ثمنٌ
     يُدفع في كلِّ فتحةٍ لأجل صفٍّ واحدٍ يُقرأ. */
  const items = open ? await getAdminUserContent(open, 40) : [];

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

      <AdminNotice err={sp.err} ok={sp.ok} />

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
              ) : u.isAdmin || u.isSystem ? (
                /* 🆕 D-963 — **والشارةُ تقرأ الحارسَ لا نصفَه**: `am_admin()`
                   = `is_admin` **أو** `is_system`، **وحسابُ النظام كان يُقرأ
                   مستخدماً عاديّاً وهو يملك اللوحةَ كاملة** — وهو أوّلُ صفٍّ
                   في هذه الصفحة (`created_at` فارغةٌ تتصدّر التنازليَّ). */
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-12 font-bold ${
                    u.isSystem ? "bg-[color:var(--error)]/15 text-[color:var(--error)]" : "bg-accent/15 text-accent"
                  }`}
                >
                  {u.isSystem ? (u.isAdmin ? "نظام · مدير" : "حساب نظام") : "مدير"}
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

            <div className="flex flex-wrap items-center gap-2 pt-1 text-12">
              <Link
                href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(open === u.id ? {} : { u: u.id }) }).toString()}`}
                className={buttonClass({ variant: "surface", size: "sm" })}
              >
                {open === u.id ? "أغلق المحتوى" : "اعرض ما كتبه"}
              </Link>
            </div>

            {/* 🆕 D-963 — **ولا زرَّ منحٍ على حسابِ نظام**: صلاحيتُه من
                `is_system` لا من `is_admin`، **فالزرُّ يبدّل عموداً لا يغيّر
                شيئاً** — **وزرٌّ يقرّر ما لا يملك تنفيذَه كذبٌ في الواجهة**
                (حجّةُ D-927 نفسُها في بلاغ الحساب). */}
            {u.isSystem ? (
              <p className="text-12 text-muted leading-relaxed">
                حسابُ نظام: يفتح اللوحةَ بـ<code dir="ltr">is_system</code> لا بشارة الإدارة —
                ولا يُمنح ولا يُسحب ولا يُوقَف من هنا.
              </p>
            ) : (
            <form action={setAdmin} className="flex items-center gap-2">
              <input type="hidden" name="user" value={u.id} />
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="on" value={u.isAdmin ? "0" : "1"} />
              <input
                type="text"
                name="reason"
                required
                minLength={3}
                maxLength={300}
                placeholder={u.isAdmin ? "سبب سحب الإدارة (إلزامي)" : "سبب منح الإدارة (إلزامي)"}
                aria-label={`${u.isAdmin ? "سبب سحب صلاحية الإدارة عن" : "سبب منح صلاحية الإدارة لـ"} ${name}`}
                className="min-w-0 flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-14"
              />
              <button type="submit" className={`shrink-0 ${buttonClass({ variant: "surface", size: "sm" })}`}>
                {u.isAdmin ? "اسحب صلاحية الإدارة" : "اجعله مديراً"}
              </button>
            </form>
            )}

            {open === u.id && (
              <div className="space-y-2 pt-1">
                {items.length === 0 ? (
                  <p className="text-13 text-muted">لا محتوى مكتوباً لهذا الحساب.</p>
                ) : (
                  <div className={settingsCardRows}>
                    {items.map((it, i) => (
                      <div key={`${it.kind}-${i}`} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-12 font-bold text-muted">
                            {USER_ITEM_AR[it.kind]}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-13 font-bold">{it.title}</p>
                          {it.hidden && (
                            <span className="shrink-0 rounded-full bg-[color:var(--error)]/15 px-2 py-0.5 text-12 font-bold text-[color:var(--error)]">
                              مخفيّ
                            </span>
                          )}
                          <span className="shrink-0 text-12 text-muted" dir="ltr">
                            {it.at?.slice(0, 10) ?? "—"}
                          </span>
                        </div>
                        {it.body ? (
                          <p className="mt-0.5 line-clamp-2 text-12 leading-relaxed text-muted">{it.body}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-12 text-muted">
                  آخرُ {items.length} عنصراً · <b>والمخفيُّ يُحكم فيه من </b>
                  <Link href="/admin/reports" className="text-accent hover:underline">البلاغات</Link>.
                </p>
              </div>
            )}

            {u.isAdmin || u.isSystem ? null : suspended ? (
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
                  className="min-w-0 flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-14"
                />
                <button type="submit" className={`shrink-0 ${buttonClass({ size: "sm" })}`}>
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
