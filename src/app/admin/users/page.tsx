import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAmAdmin, getAdminUsers } from "@/lib/data";
import { adminSuspendUser, adminUnsuspendUser } from "@/lib/actions";
import { getAdminUserContent, USER_ITEM_AR } from "@/lib/admin";
import { adminGrantPlus, adminSetAdmin } from "@/lib/adminUsers";
import { Avatar } from "@/components/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { settingsCardRows } from "@/components/settings/SettingsGroup";
import { fieldClass, pillClass } from "@/components/admin/style";

/**
 * 🆕 **إدارةُ المستخدمين** (D-901) — نمطُ `/admin/partners` حرفاً:
 * صفحةٌ عربيّةٌ ثابتةٌ بصلاحيّة `am_admin()`، وغيرُ الإداريِّ يرى 404،
 * **والحارسُ الحقيقيُّ في جسم `admin_suspend_user`** (D-011).
 *
 * ⚠️ **والسببُ حقلٌ إلزاميّ**: تمنعه القاعدةُ لا الواجهةُ وحدَها —
 * لأنه يُكتب في `admin_audit` **ويُعرض للموقوف حين يحاول الدخول**.
 * **«أوقفتُ حسابك» بلا سببٍ بلاغٌ لا قرار.**
 */
/**
 * ٦٠١ — **العودةُ إلى الحساب المفتوح نفسِه**: الأفعالُ صارت داخل الصفِّ المفتوح (`u`)، وعودةٌ بالبحث وحده تطوي الصفَّ
 * بعد كلِّ فعلٍ أو خطأ — فيُعاد فتحُه ويُكتب السببُ من جديد.
 */
function backOf(formData: FormData): string {
  const q = String(formData.get("q") ?? "");
  const u = String(formData.get("u") ?? "");
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(u ? { u } : {}) }).toString();
  return `/admin/users${qs ? `?${qs}` : ""}`;
}

async function suspend(formData: FormData) {
  "use server";
  const back = backOf(formData);
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
  const back = backOf(formData);
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
  const back = backOf(formData);
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

/**
 * 🆕 المهمّة ٤٠١ — **«امنح Loopz+»** (أحمد ١٨ نوفمبر: «١أ نفذ شكل الاشعار المقترح»): يومٌ أخيرٌ وسببٌ إلزاميّ كحقلَي الإدارة
 * والإيقاف (شكلٌ واحدٌ لأفعالٍ متشابهة)، والحارسُ في `admin_grant_plus` (الهجرة ٢٤٨). بعدها إشعارُ «هدية من Loopz».
 * والردُّ يقول هل وصل الإشعار: عضوٌ بلا جهازٍ مسجّل لا يبلغه شيء (حالُ عضوَي ١٧ نوفمبر) فيُراسَل من حساب Loopz.
 */
async function grantPlus(formData: FormData) {
  "use server";
  const back = backOf(formData);
  const sep = back.includes("?") ? "&" : "?";
  let res: { plusUntil: string | null; devices: number };
  try {
    res = await adminGrantPlus(
      String(formData.get("user") ?? ""),
      String(formData.get("day") ?? ""),
      String(formData.get("reason") ?? ""),
    );
  } catch (e) {
    redirect(`${back}${sep}err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${back}${sep}ok=plus&day=${encodeURIComponent(String(formData.get("day") ?? ""))}&dev=${res.devices}`);
}

/** بعد ثلاثين يوماً بتوقيت الرياض (`YYYY-MM-DD`) — القيمةُ الأولى لخانة «حتى».
    ٦٠١ — كانت «آخرَ يومٍ في الشهر»: منحةٌ تُعطى يومَ ٢٩ تنتهي بعد يوم، والمديرُ لا ينتبه للتاريخ المملوء سلفاً */
function grantDefaultDay(): string {
  return new Date(Date.now() + 3 * 3_600_000 + 30 * 86_400_000).toISOString().slice(0, 10);
}

/* ٦٠١ — الخطّةُ بالعربيّة: «free» بالإنجليزيّة وسط سطرٍ عربيّ كان يُقرأ قيمةً خامّاً من القاعدة */
const PLAN_AR: Record<string, string> = { free: "مجاني", plus: "Plus", gold: "Gold", partner: "شريك" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; u?: string; err?: string; ok?: string; day?: string; dev?: string }>;
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
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" className={buttonClass({ size: "sm", className: "shrink-0" })}>بحث</button>
      </form>

      <AdminNotice
        err={sp.err}
        ok={sp.ok}
        okText={
          sp.ok === "plus"
            ? `مُنح Loopz+ حتى نهاية ${sp.day ?? "—"} — ${Number(sp.dev) > 0 ? "أُرسل إشعارُ الهدية" : "لا جهاز مسجّل له للإشعارات، فلم يصله إشعار"}`
            : undefined
        }
      />

      {rows.length === 0 && <p className="text-14 text-muted">لا نتائج.</p>}

      {/* ٦٠١ — **صفٌّ مختصرٌ لكلِّ حساب، والأفعالُ لمن فُتح وحدَه** (مراجعةُ ٢٧ نوفمبر): كانت ثلاثةُ نماذجَ حسّاسة
          (اجعله مديراً · امنح Plus · إيقاف) مفتوحةً تحت كلِّ صفٍّ من الخمسةِ والعشرين — نحو ٧٥ نموذجاً وعشرُ شاشات،
          والخطأُ باللمس على بُعد إصبع. «إدارة» تفتح الحسابَ الواحد (بابُ «اعرض ما كتبه» نفسُه في الرابط `u`). */}

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
                <span className={pillClass("bad")}>موقوف</span>
              ) : u.isAdmin || u.isSystem ? (
                /* 🆕 D-963 — **والشارةُ تقرأ الحارسَ لا نصفَه**: `am_admin()`
                   = `is_admin` **أو** `is_system`، **وحسابُ النظام كان يُقرأ
                   مستخدماً عاديّاً وهو يملك اللوحةَ كاملة** — وهو أوّلُ صفٍّ
                   في هذه الصفحة (`created_at` فارغةٌ تتصدّر التنازليَّ). */
                <span className={pillClass(u.isSystem ? "bad" : "warn")}>
                  {u.isSystem ? (u.isAdmin ? "نظام · مدير" : "حساب نظام") : "مدير"}
                </span>
              ) : null}
            </div>

            <dl className="text-13 text-muted space-y-1">
              {/* ٦٠١ — التاريخُ لا ينكسر عند الشرطة («٢٠٢٦-» في سطر و«١١-٢٧» في آخر) */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="whitespace-nowrap">انضمّ: <span dir="ltr">{u.createdAt?.slice(0, 10) ?? "—"}</span></span>
                <span className="whitespace-nowrap">آخر دخول: <span dir="ltr">{u.lastSignInAt?.slice(0, 10) ?? "—"}</span></span>
                <span className="whitespace-nowrap">الخطة: {PLAN_AR[u.plan ?? "free"] ?? u.plan}</span>
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
                {open === u.id ? "أغلق" : "إدارة"}
              </Link>
            </div>

            {open === u.id ? (
            <div className="space-y-2.5 border-t border-border pt-2.5">

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
                <input type="hidden" name="u" value={u.id} />
              <input type="hidden" name="on" value={u.isAdmin ? "0" : "1"} />
              <input
                type="text"
                name="reason"
                required
                minLength={3}
                maxLength={300}
                placeholder={u.isAdmin ? "سبب سحب الإدارة (إلزامي)" : "سبب منح الإدارة (إلزامي)"}
                aria-label={`${u.isAdmin ? "سبب سحب صلاحية الإدارة عن" : "سبب منح صلاحية الإدارة لـ"} ${name}`}
                className={`${fieldClass} flex-1`}
              />
              <button type="submit" className={`shrink-0 ${buttonClass({ variant: "surface", size: "sm" })}`}>
                {u.isAdmin ? "اسحب صلاحية الإدارة" : "اجعله مديراً"}
              </button>
            </form>
            )}

            {/* 🆕 المهمّة ٤٠١ — «امنح Loopz+»: لا لحساب نظام ولا لموقوف (الحارسُ نفسُه في القاعدة) */}
            {u.isSystem || suspended ? null : (
              <form action={grantPlus} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="u" value={u.id} />
                <label className="flex shrink-0 items-center gap-1.5 text-13 text-muted">
                  حتى نهاية
                  <input
                    type="date"
                    name="day"
                    required
                    defaultValue={grantDefaultDay()}
                    aria-label={`آخر يوم في منحة Loopz+ لـ ${name}`}
                    className={`${fieldClass} px-2 py-1.5`}
                    dir="ltr"
                  />
                </label>
                <input
                  type="text"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={300}
                  placeholder="سبب المنحة (إلزامي)"
                  aria-label={`سبب منح Loopz+ لـ ${name}`}
                  className={`${fieldClass} flex-1`}
                />
                <button type="submit" className={`shrink-0 ${buttonClass({ variant: "surface", size: "sm" })}`}>
                  امنح Loopz+
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
                          <span className={pillClass("mute")}>{USER_ITEM_AR[it.kind]}</span>
                          <p className="min-w-0 flex-1 truncate text-13 font-bold">{it.title}</p>
                          {it.hidden && (
                            <span className={pillClass("bad")}>مخفيّ</span>
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
                <input type="hidden" name="u" value={u.id} />
                <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                  فكّ الإيقاف
                </button>
              </form>
            ) : (
              <form action={suspend} className="flex items-center gap-2 pt-1">
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="u" value={u.id} />
                <input
                  type="text"
                  name="reason"
                  required
                  maxLength={300}
                  placeholder="سبب الإيقاف (إلزامي)"
                  aria-label={`سبب إيقاف ${name}`}
                  className={`${fieldClass} flex-1`}
                />
                {/* ٦٠١ — لونُ الخطر كرفض التوثيق: كان الإيقافُ بالأصفر الأساسيّ، أبرزَ زرٍّ في الصفحة */}
                <button type="submit" className={`shrink-0 ${buttonClass({ variant: "danger", size: "sm" })}`}>
                  إيقاف
                </button>
              </form>
            )}
            </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
