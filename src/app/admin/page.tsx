import { notFound } from "next/navigation";
import Link from "next/link";
import { getAmAdmin } from "@/lib/data";
import { getAdminOverview, getAdminTestersSummary, getGitHubHead, LIVE_SHA, LIMITS, PROVIDERS } from "@/lib/admin";
import { settingsCard, settingsCardRows } from "@/components/settings/SettingsGroup";
import { PLATFORM_AR, type Platform } from "@/core/platform";

/**
 * 🆕 **نظرةُ الإدارة العامّة** (D-901، حكمُ أحمد: «تحتاج تطويراً أكثر» بعد
 * «لا نحتاج مكانين للمتابعة والإدارة»).
 *
 * الفهرسُ كان أربعةَ روابط. **والمتابعةُ التي كانت في لوحةٍ خارجيّة أُغلقت
 * تسكن هنا**: ما يهدّد الاستقرار أوّلاً، ثمّ المستخدمون، ثمّ الطاقة، ثمّ
 * الأخطاءُ الحيّة، ثمّ الجهاتُ وخططُها. **نداءٌ واحدٌ للقاعدة** (`admin_overview`)
 * ورحلةٌ واحدة إلى GitHub مُخزَّنةٌ دقيقة.
 *
 * **ما لا يُقرأ يُقال بلا صفرٍ يكذب** (D-063/D-219): أوقاتُ الدخول من «آخر
 * دخولٍ» لا من سجلٍّ كامل — لأنّ سجلَّ تدقيق Supabase فارغٌ هنا (مقيس).
 * عربيّةٌ ثابتةٌ كأخواتها: صفحةُ مشغّلٍ لا مستخدمين.
 */
export const dynamic = "force-dynamic";

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
const bytes = (n: number) => {
  const u = ["B", "KB", "MB", "GB"]; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
};
const pct = (used: number, total: number) => Math.min(100, (used / total) * 100);
const tone = (p: number) => (p >= 85 ? "var(--error)" : p >= 60 ? "var(--accent)" : "var(--success)");
const riyadh = (iso: string) =>
  new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" });

const PAGES = [
  { href: "/admin/users",    title: "المستخدمون",     key: "suspended" as const,            hint: "بحث · إيقافٌ وفكّ" },
  { href: "/admin/testers",  title: "المختبِرون",     key: null,                            hint: "قائمةُ دعوة Play ومن دخل" },
  { href: "/admin/partners", title: "طلبات الشركاء",  key: "partners_pending" as const,     hint: "قبولٌ ورفض" },
  { href: "/admin/verify",   title: "طلبات التوثيق",  key: "verification_pending" as const, hint: "طابورُ التوثيق" },
  { href: "/admin/payouts",  title: "طلبات التحويل",  key: "payouts_pending" as const,      hint: "فارغٌ حتى تُفتح المدفوعات" },
  { href: "/admin/links",    title: "روابط المنصّات", key: null,                            hint: "عملٌ ↔ منصّةٌ في بلد" },
];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-12 text-muted">{label}</p>
      <p className="mt-0.5 text-20 font-bold tabular-nums" dir="ltr">{value}</p>
      {sub && <p className="text-12 text-muted">{sub}</p>}
    </div>
  );
}

function Meter({ label, used, total, note }: { label: string; used: number; total: number; note?: string }) {
  const p = pct(used, total);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-12">
        <span>{label}</span>
        <span className="tabular-nums text-muted" dir="ltr">
          {bytes(used)} / {bytes(total)} · <b style={{ color: tone(p) }}>{p.toFixed(1)}%</b>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${Math.max(p, 0.5)}%`, background: tone(p) }} />
      </div>
      {note && <p className="mt-1 text-12 text-muted">{note}</p>}
    </div>
  );
}

function Bars({ rows, height = 96 }: { rows: { k: string; n: number }[]; height?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const peak = rows.reduce((a, b) => (b.n > a.n ? b : a), rows[0] ?? { k: "", n: 0 });
  return (
    <div dir="ltr" className="flex items-end gap-[3px]" style={{ height }}>
      {rows.map((r) => (
        <div key={r.k} className="flex-1 rounded-t-[3px]" title={`${r.k}: ${r.n}`}
             style={{ height: `${Math.max((r.n / max) * (height - 8), r.n > 0 ? 3 : 1)}px`,
                      background: r.n === peak.n && r.n > 0 ? "var(--accent)" : "var(--divider)" }} />
      ))}
    </div>
  );
}

export default async function AdminIndexPage() {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  const [o, ts, head] = await Promise.all([
    getAdminOverview(),
    getAdminTestersSummary(),
    getGitHubHead(),
  ]);
  if (!o) notFound();

  /* ——— ما يهدّد الاستقرار: كلُّ سطرٍ هنا شيءٌ يستحقّ فعلاً اليوم ——— */
  const alerts: { tone: "bad" | "warn"; text: string; href?: string }[] = [];
  const liveShort = LIVE_SHA?.slice(0, 7) ?? null;
  const headShort = head?.sha.slice(0, 7) ?? null;
  const shaMatch = liveShort && headShort ? liveShort === headShort : null;
  if (shaMatch === false)
    alerts.push({ tone: "bad", text: `الإنتاج (${liveShort}) متأخّرٌ عن رأس main (${headShort}) — آخرُ التزامٍ بلا وسم [deploy]؟ ادفع التزاماً موسوماً أو رقِّ من Vercel.` });
  const dbP = pct(o.db.db_bytes, LIMITS.supabaseDbBytes);
  if (dbP >= 60) alerts.push({ tone: dbP >= 85 ? "bad" : "warn", text: `قاعدة البيانات ${dbP.toFixed(0)}% من سقف الخطة المجانية — التجاوزُ يوقف الخدمة.` });
  const stP = pct(o.db.storage_bytes, LIMITS.supabaseStorageBytes);
  if (stP >= 60) alerts.push({ tone: stP >= 85 ? "bad" : "warn", text: `المخزن ${stP.toFixed(0)}% من السقف.` });
  if (o.health.open_policies !== LIMITS.expectedOpenPolicies)
    alerts.push({ tone: "bad", text: `السياسات المفتوحة = ${o.health.open_policies} والمتوقّع ${LIMITS.expectedOpenPolicies}: ${o.health.open_policy_tables.join(" · ")}` });
  const activeCron = o.health.cron.filter((c) => c.active).length;
  if (activeCron !== LIMITS.expectedActiveCron)
    alerts.push({ tone: "warn", text: `وظائف cron الفعّالة = ${activeCron} والمتوقّع ${LIMITS.expectedActiveCron}.` });
  if (o.errors.count_24h > 0)
    alerts.push({ tone: o.errors.count_24h >= 50 ? "bad" : "warn", text: `${fmt(o.errors.count_24h)} خطأً في الخادم خلال ٢٤ ساعة (${fmt(o.errors.count_7d)} في ٧ أيام) — التفصيل أدناه.` });
  if (o.queues.verification_pending > 0)
    alerts.push({ tone: "warn", text: `${o.queues.verification_pending} طلبُ توثيقٍ ينتظر قرارك.`, href: "/admin/verify" });
  if (o.queues.partners_pending > 0)
    alerts.push({ tone: "warn", text: `${o.queues.partners_pending} طلبُ شراكةٍ ينتظر قرارك.`, href: "/admin/partners" });
  if (o.queues.payouts_pending > 0)
    alerts.push({ tone: "warn", text: `${o.queues.payouts_pending} طلبُ تحويلٍ ينتظر قرارك.`, href: "/admin/payouts" });

  const worst = alerts.some((a) => a.tone === "bad") ? "bad" : alerts.length ? "warn" : "ok";
  const ring = worst === "bad" ? "border-[color:var(--error)]/50" : worst === "warn" ? "border-accent/50" : "border-[color:var(--success)]/40";
  const u = o.users;
  const retention = u.total ? Math.round(((u.total - u.never_returned) / u.total) * 100) : 0;
  const peakHour = o.logins_hourly.reduce((a, b) => (b.n > a.n ? b : a), { h: 0, n: 0 });
  const langTotal = o.visit_langs.reduce((s, l) => s + l.hits, 0) || 1;
  const queueCount = (k: (typeof PAGES)[number]["key"]) => (k ? (k === "suspended" ? o.suspended : o.queues[k]) : 0);
  /* 🆕 D-909 — **والدفاعُ لأنّ الكودَ قد يسبق الهجرة**: `admin_testers_summary`
     غائبةً تُقرأ `null` فأصفاراً، **لا شاشةً بيضاء** — والفهرسُ يبقى قائماً
     كما كان قبلها. */
  const tst = ts?.testers ?? { total: 0, with_account: 0, signed_in: 0, active_7d: 0 };
  const plats = ts?.platforms ?? [];
  const platTotal = plats.reduce((sum, p) => sum + p.users, 0) || 1;
  const androidUsers = plats.find((p) => p.platform === "android")?.users ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-22 font-bold">لوحة الإدارة</h1>
          <p className="text-12 text-muted">كلُّ رقمٍ مقروءٌ الآن من مصدره · {riyadh(o.generated_at)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-12 font-bold ${worst === "bad" ? "bg-[color:var(--error)]/15 text-[color:var(--error)]" : worst === "warn" ? "bg-accent/15 text-accent" : "bg-[color:var(--success)]/15 text-[color:var(--success)]"}`}>
          {worst === "ok" ? "كل شيء مستقرّ" : `${alerts.length} تنبيه`}
        </span>
      </header>

      {/* ——— ١) ما يهدّد الاستقرار ——— */}
      <section className={`${settingsCard} border ${ring} p-4`}>
        <h2 className="text-15 font-bold">ما يهدّد الاستقرار الآن</h2>
        {alerts.length === 0 ? (
          <p className="mt-1 text-14 text-[color:var(--success)]">لا شيء. الإنتاج على رأس main، والحصص بعيدة عن السقف، ولا أخطاء ولا طوابير.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-14 leading-6">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: a.tone === "bad" ? "var(--error)" : "var(--accent)" }} />
                {a.href ? <Link href={a.href} className="text-accent hover:underline">{a.text}</Link> : <span>{a.text}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-12 text-muted">
          <span dir="ltr">live {liveShort ?? "dev"}</span>
          <span dir="ltr">main {headShort ?? "—"}</span>
          {head && <span className="truncate max-w-[24rem]" dir="auto">{head.message}</span>}
        </div>
      </section>

      {/* ——— ٢) الصفحات + الطوابير ——— */}
      <div className="grid gap-2 sm:grid-cols-2">
        {PAGES.map((p) => {
          const n = queueCount(p.key);
          return (
            <Link key={p.href} href={p.href} className={`${settingsCard} flex items-center justify-between gap-3 p-4 hover:border-accent transition-colors`}>
              <div className="min-w-0">
                <p className="text-15 font-bold">{p.title}</p>
                <p className="text-12 text-muted">{p.hint}</p>
              </div>
              {n > 0 && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-12 font-bold ${p.key === "suspended" ? "bg-[color:var(--error)]/15 text-[color:var(--error)]" : "bg-accent/15 text-accent"}`}>
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ——— ٢·٥) الاختبار المغلق — D-909 ——— */}
      <section className={`${settingsCard} p-4 space-y-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-15 font-bold">
            الاختبار المغلق <span className="text-12 font-normal text-muted">— Play يعرف من دُعي، وهذه تعرف من دخل</span>
          </h2>
          <Link href="/admin/testers" className="text-12 text-accent underline">الصفحة الكاملة</Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="في قائمة الدعوة" value={fmt(tst.total)} sub="المطلوب ١٢" />
          <Stat label="لهم حساب" value={fmt(tst.with_account)} />
          <Stat label="دخلوا فعلاً" value={fmt(tst.signed_in)} />
          <Stat label="نشِطون ٧ أيام" value={fmt(tst.active_7d)} />
        </div>
        {plats.length > 0 ? (
          <div>
            <p className="mb-1.5 text-12 text-muted">
              منصّاتُ المستخدمين — ٣٠ يوماً · <b className="text-accent tabular-nums" dir="ltr">{fmt(androidUsers)}</b> على أندرويد
            </p>
            <div className="space-y-1.5">
              {plats.map((pf) => (
                <div key={pf.platform} className="flex items-center gap-2 text-12">
                  <span className="w-14 shrink-0">{PLATFORM_AR[pf.platform as Platform] ?? pf.platform}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(pf.users / platTotal) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-end tabular-nums text-muted" dir="ltr">
                    {fmt(pf.users)}{pf.app_users > 0 ? ` · ${fmt(pf.app_users)} تطبيق` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-12 text-muted leading-relaxed">
            لا منصّاتٍ بعد — ⚠️ <b>الماضي لا يُستردّ</b>: وسمُ ٤٥ جلسةً من ٥٥ في
            <code dir="ltr"> auth.sessions </code> هو <code dir="ltr">node</code> لأنّ خادمنا هو من يجدّد
            الرمز. العدُّ يبدأ من أوّل نبضةِ حضورٍ بعد الهجرة ١٨١.
          </p>
        )}
      </section>

      {/* ——— ٣) المستخدمون ——— */}
      <section className={`${settingsCard} p-4 space-y-3`}>
        <h2 className="text-15 font-bold">المستخدمون</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="الإجمالي" value={fmt(u.total)} />
          <Stat label="نشِط ٢٤ ساعة" value={fmt(u.active_24h)} />
          <Stat label="نشِط ٧ أيام" value={fmt(u.active_7d)} />
          <Stat label="نشِط ٣٠ يوماً" value={fmt(u.active_30d)} />
          <Stat label="جديد ٢٤ ساعة" value={fmt(u.new_24h)} />
          <Stat label="جديد ٧ أيام" value={fmt(u.new_7d)} />
          <Stat label="جديد ٣٠ يوماً" value={fmt(u.new_30d)} />
          <Stat label="عادوا بعد أوّل دخول" value={`${retention}%`} sub={`${fmt(u.never_returned)} لم يعودوا`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-12 text-muted">حسابات جديدة — ٣٠ يوماً</p>
            <Bars rows={o.signups_daily.map((d) => ({ k: d.d, n: d.n }))} height={72} />
          </div>
          <div>
            <p className="mb-1.5 text-12 text-muted">
              أوقات الدخول — بتوقيت الرياض · الذروة <b className="text-accent tabular-nums" dir="ltr">{String(peakHour.h).padStart(2, "0")}:00</b>
            </p>
            <Bars rows={o.logins_hourly.map((h) => ({ k: `${String(h.h).padStart(2, "0")}:00`, n: h.n }))} height={72} />
            <p className="mt-1 text-12 text-muted">من «آخر دخول» لكلِّ مستخدم — سجلُّ تدقيق Supabase لا يحتفظ بالدخولات هنا (مقيس: صفر في ٣٠ يوماً).</p>
          </div>
        </div>
        {o.visit_langs.length > 0 && (
          <div>
            <p className="mb-1.5 text-12 text-muted">لغةُ الزوّار — ٣٠ يوماً (أقربُ ما نملكه عن «من أين»؛ لا بلدَ يُخزّن)</p>
            <div className="space-y-1.5">
              {o.visit_langs.map((l) => (
                <div key={l.lang} className="flex items-center gap-2 text-12">
                  <span className="w-10 shrink-0" dir="ltr">{l.lang}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(l.hits / langTotal) * 100}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-end tabular-nums text-muted" dir="ltr">{fmt(l.hits)} · {Math.round((l.hits / langTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ——— ٤) الطاقة ——— */}
      <section className={`${settingsCard} p-4 space-y-3`}>
        <h2 className="text-15 font-bold">الطاقة والحصص <span className="text-12 font-normal text-muted">— Supabase Free: التجاوزُ يوقف، لا يفوتر</span></h2>
        <Meter label="قاعدة البيانات" used={o.db.db_bytes} total={LIMITS.supabaseDbBytes} />
        <Meter label={`المخزن (${fmt(o.db.storage_objects)} ملفّاً)`} used={o.db.storage_bytes} total={LIMITS.supabaseStorageBytes} />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 text-center">
          {([["متابَعات", o.content.follows], ["تقييمات", o.content.ratings], ["قوائم", o.content.lists], ["منشورات", o.content.posts], ["رسائل", o.content.messages], ["مجتمعات", o.content.communities]] as const).map(([l, n]) => (
            <div key={l} className="rounded-xl bg-surface-2 py-2">
              <p className="text-16 font-bold tabular-nums" dir="ltr">{fmt(n)}</p>
              <p className="text-12 text-muted">{l}</p>
            </div>
          ))}
        </div>
        <details>
          <summary className="cursor-pointer text-12 text-muted">أكبر ثمانية جداول</summary>
          <table className="mt-2 w-full text-12">
            <tbody>
              {o.db.tables.map((t) => (
                <tr key={t.name} className="border-t border-[color:var(--divider)]">
                  <td className="py-1 font-mono" dir="ltr">{t.name}</td>
                  <td className="py-1 text-end tabular-nums text-muted" dir="ltr">{fmt(t.rows)} صفّ</td>
                  <td className="py-1 text-end tabular-nums" dir="ltr">{bytes(t.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* ——— ٥) الأخطاء الحيّة ——— */}
      <section className={`${settingsCard} p-4 space-y-2`}>
        <h2 className="text-15 font-bold">
          أخطاء الخادم <span className="text-12 font-normal text-muted">— من `runtime_errors` (١٤٨)، بلا هويّةٍ ولا IP</span>
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="آخر ٢٤ ساعة" value={fmt(o.errors.count_24h)} />
          <Stat label="آخر ٧ أيام" value={fmt(o.errors.count_7d)} />
        </div>
        {o.errors.top.length === 0 ? (
          <p className="text-14 text-[color:var(--success)]">لا أخطاء في ٧ أيام.</p>
        ) : (
          <div className={settingsCardRows}>
            {o.errors.top.map((e, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-12" dir="ltr">{e.route}</code>
                  <span className="shrink-0 rounded-full bg-[color:var(--error)]/15 px-2 py-0.5 text-12 font-bold tabular-nums text-[color:var(--error)]" dir="ltr">×{fmt(e.n)}</span>
                </div>
                <p className="mt-0.5 truncate text-12 text-muted" dir="auto">{e.kind} · {e.sample}</p>
                <p className="text-12 text-muted">آخر مرّة: {riyadh(e.last_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ——— ٦) الصحّة ——— */}
      <section className={`${settingsCard} p-4 space-y-2 text-14`}>
        <h2 className="text-15 font-bold">فحوصُ الصحّة</h2>
        <p>السياسات المفتوحة: <b className="tabular-nums" dir="ltr">{o.health.open_policies}</b> / {LIMITS.expectedOpenPolicies} <span className="text-12 text-muted">({o.health.open_policy_tables.join(" · ")})</span></p>
        <p>وظائف cron: {o.health.cron.map((c) => <code key={c.job} className="me-2 text-12" dir="ltr">{c.job} {c.active ? "✓" : "✕"} {c.schedule}</code>)}</p>
      </section>

      {/* ——— ٧) الجهات والخطط ——— */}
      <section className="space-y-2">
        <h2 className="px-1 text-15 font-bold">الجهات المرتبطة — الخطط والمخاطر</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <div key={p.name} className={`${settingsCard} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-14 font-bold">{p.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-12 font-bold ${p.paid ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : "bg-surface-2 text-muted"}`}>{p.plan}</span>
              </div>
              <p className="mt-1 text-12 text-muted">{p.what}</p>
              <p className="mt-1.5 text-12"><b className="text-accent">الخطر: </b><span className="text-muted">{p.risk}</span></p>
              <a href={p.dashboard} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-12 text-accent hover:underline">افتح اللوحة ↗</a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
