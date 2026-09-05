import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAmAdmin } from "@/lib/data";
import { REPORT_KIND_AR, getAdminReports, type AdminReportRow } from "@/lib/admin";
import { adminReportDecide } from "@/lib/adminReports";
import { buttonClass } from "@/components/ui/Button";
import { settingsCard } from "@/components/settings/SettingsGroup";

/**
 * 🆕 **البلاغات** (D-927، تقييمُ ٥ سبتمبر: «الإخفاءُ الوحيدُ في المنتج
 * أوتوماتيكيٌّ وغيرُ مرئيٍّ ولا رجعةَ له»).
 *
 * 🔴 **ما كان**: سبعةُ جداولِ بلاغاتٍ تمتلئ، و`hide_reported_review` تُخفي
 * التقييمَ عند **عشرة بلاغات** — **بلا شاشةٍ تعرضها، وبلا إخطارِ صاحبِها،
 * وبلا زرِّ إرجاع.** **عشرةُ حساباتٍ متواطئةٍ تُخفي أيَّ مراجعةٍ ولا يعلم أحد.**
 *
 * 🔑 **وتُبنى وهي فارغةٌ عمداً**: صفرُ بلاغاتٍ اليوم — **ويومَ يقع أوّلُ بلاغٍ
 * لا يجوز أن يكون بناءُ الشاشة هو ردَّ الفعل.**
 *
 * ⚖️ **وبلاغُ الحساب يُعرض بلا زرَّي حكم**: عقوبتُه الإيقافُ وبابُه
 * `/admin/users` — **وزرٌّ يقرّر ما لا يملك تنفيذَه كذبٌ في الواجهة.**
 * وله «أغلق الصفَّ» وحدَه.
 */
export const dynamic = "force-dynamic";

const riyadh = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" })
    : "—";

/** حدُّ الإخفاء التلقائيّ في `hide_reported_review` — يُقال رقماً لا شعوراً. */
const AUTO_HIDE = 10;

async function decide(formData: FormData) {
  "use server";
  const kind = String(formData.get("kind") ?? "");
  const decision = String(formData.get("decision") ?? "") as "keep" | "remove";
  let ref: unknown = {};
  try {
    ref = JSON.parse(String(formData.get("ref") ?? "{}"));
  } catch {
    redirect("/admin/reports?err=bad_ref");
  }
  try {
    await adminReportDecide(kind, ref, decision);
  } catch (e) {
    redirect(`/admin/reports?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`/admin/reports?ok=${decision}`);
}

function Row({ r }: { r: AdminReportRow }) {
  const tone = r.hidden
    ? "bg-[color:var(--error)]/15 text-[color:var(--error)]"
    : r.reports >= AUTO_HIDE
      ? "bg-accent/15 text-accent"
      : "bg-surface-2 text-muted";
  const refJson = JSON.stringify(r.ref);
  return (
    <section className="rounded-card border border-border bg-surface p-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-12 font-bold text-muted">
          {REPORT_KIND_AR[r.kind] ?? r.kind}
        </span>
        <p className="min-w-0 flex-1 truncate text-14 font-bold">{r.subject || "—"}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-12 font-bold ${tone}`}>
          {r.hidden ? "مخفيّ" : `${r.reports} بلاغ`}
        </span>
      </div>

      {r.body ? (
        <p className="whitespace-pre-wrap text-13 leading-relaxed text-muted line-clamp-4">{r.body}</p>
      ) : null}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-12 text-muted">
        <div className="flex gap-1.5">
          <dt>الكاتب:</dt>
          <dd>
            {r.author ? (
              <Link href={`/admin/users?q=${r.author}`} className="text-accent hover:underline">
                {r.authorName ?? "—"}
              </Link>
            ) : (
              (r.authorName ?? "—")
            )}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>البلاغات:</dt>
          <dd className="tabular-nums" dir="ltr">{r.reports}</dd>
        </div>
        {r.reasons ? (
          <div className="flex gap-1.5">
            <dt>الأسباب:</dt>
            <dd>{r.reasons}</dd>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <dt>آخر بلاغ:</dt>
          <dd>{riyadh(r.lastAt)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        {r.kind === "user" ? (
          <>
            <Link href={`/admin/users?q=${r.author ?? ""}`} className={buttonClass({ size: "sm" })}>
              افتح الحساب في المستخدمين
            </Link>
            <form action={decide}>
              <input type="hidden" name="kind" value={r.kind} />
              <input type="hidden" name="ref" value={refJson} />
              <input type="hidden" name="decision" value="keep" />
              <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                أغلق الصفّ
              </button>
            </form>
          </>
        ) : (
          <>
            <form action={decide}>
              <input type="hidden" name="kind" value={r.kind} />
              <input type="hidden" name="ref" value={refJson} />
              <input type="hidden" name="decision" value="keep" />
              <button type="submit" className={buttonClass({ size: "sm" })}>
                {r.hidden ? "أرجِعه للظهور" : "سليم — أبقِه"}
              </button>
            </form>
            <form action={decide}>
              <input type="hidden" name="kind" value={r.kind} />
              <input type="hidden" name="ref" value={refJson} />
              <input type="hidden" name="decision" value="remove" />
              <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
                مخالف — أخفِه
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const rows = await getAdminReports(100);

  const hidden = rows.filter((r) => r.hidden);
  const pending = rows.filter((r) => !r.hidden && r.reports > 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-22 font-bold">البلاغات</h1>
          <p className="text-12 text-muted">سبعةُ مجارٍ في صفٍّ واحد · والمخفيُّ معها</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-12 font-bold ${
            rows.length === 0
              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "bg-accent/15 text-accent"
          }`}
        >
          {rows.length === 0 ? "لا شيء ينتظر" : `${pending.length} بلاغ · ${hidden.length} مخفيّ`}
        </span>
      </header>

      {sp.err && <p className="text-14 text-[color:var(--error)]">⚠ {sp.err}</p>}
      {sp.ok === "keep" && <p className="text-14 text-[color:var(--success)]">✓ أُبقي المحتوى وأُغلق الصفّ</p>}
      {sp.ok === "remove" && <p className="text-14 text-[color:var(--success)]">✓ أُخفي المحتوى وأُغلق الصفّ</p>}

      <section className={`${settingsCard} p-4 text-12 text-muted leading-relaxed`}>
        <p>
          <b className="text-foreground">الإخفاءُ يقع تلقائيّاً عند {AUTO_HIDE} بلاغات</b> على
          المراجعات ومراجعات القوائم — <b>بلا قرارِ إنسانٍ وبلا إخطارِ صاحبِها</b>. هذه الصفحةُ
          هي البابُ الوحيدُ لرؤيته وإرجاعه.
        </p>
        <p className="mt-1.5">
          <b className="text-foreground">وكلا القرارين يمسح بلاغاتِ الهدف</b>: إرجاعٌ يترك
          البلاغاتِ مكانَها يُنقَض بالبلاغ التالي بعد ثانية. والعددُ والأسبابُ تُكتب في{" "}
          <Link href="/admin" className="text-accent hover:underline">سجلِّ الإدارة</Link> قبل المسح.
        </p>
        <p className="mt-1.5">
          وبلاغُ الحساب لا زرَّ حكمٍ له هنا — عقوبتُه الإيقافُ وبابُه{" "}
          <Link href="/admin/users" className="text-accent hover:underline">المستخدمون</Link>.
        </p>
      </section>

      {rows.length === 0 ? (
        <p className="text-14 text-muted">
          لا بلاغاتٍ ولا محتوى مخفيّ. <b>الصفحةُ مبنيّةٌ وهي فارغةٌ عمداً</b> — يومَ يقع أوّلُ
          بلاغٍ لا يكون بناءُ الشاشة هو ردَّ الفعل.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="px-1 text-15 font-bold">ينتظر قرارك</h2>
              {pending.map((r) => <Row key={`${r.kind}-${JSON.stringify(r.ref)}`} r={r} />)}
            </div>
          )}
          {hidden.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="px-1 text-15 font-bold">
                مخفيٌّ الآن <span className="text-12 font-normal text-muted">— بقرارِ آلةٍ لا بقرارك</span>
              </h2>
              {hidden.map((r) => <Row key={`${r.kind}-${JSON.stringify(r.ref)}`} r={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
