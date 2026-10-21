import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAmAdmin } from "@/lib/data";
import { getAdminFeedback, adminFeedbackDone, type AdminFeedbackRow } from "@/lib/feedback";
import { buttonClass } from "@/components/ui/Button";
import { chipClass, chipRow } from "@/components/ui/controls";
import { AdminNotice } from "@/components/admin/AdminNotice";

/**
 * 🆕 **الملاحظات** (D-1499، أحمد ٢١ أكتوبر: «نبي مكان يقدر الشخص يكتب مشكلة او اقتراح ويرفعها بشكل سريع»).
 *
 * ما يكتبه المستخدمون من «أرسل مشكلة أو اقتراح» — الأحدثُ أوّلاً، ومع كلٍّ ما يعيد المشكلة:
 * المنصّةُ والنسخةُ والجهازُ والشاشة. **«تمّت» تُغلق ولا تحذف** (تُقرأ في «تمّت» وتُعاد بزرّ).
 * والقراءةُ والحكمُ بدالّتين يحرسهما `am_admin()` في الجسم (216) — كصفحة «البلاغات».
 * ولا تنبيهَ فوريّ (اختيارُ أحمد «٤ أ»): هذه الصفحةُ وتقريرُ الوكلاء اليوميّ يكفيان.
 */
export const dynamic = "force-dynamic";

const STATES = [
  { key: "open", label: "جديدة" },
  { key: "bug", label: "مشاكل" },
  { key: "idea", label: "اقتراحات" },
  { key: "done", label: "تمّت" },
] as const;
type State = (typeof STATES)[number]["key"];

const PLATFORM_AR: Record<string, string> = { android: "أندرويد", ios: "iOS", web: "الويب" };
const SCREEN_AR: Record<string, string> = { settings: "الإعدادات" };

const riyadh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "—";

async function done(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("state") ?? "open");
  const value = formData.get("done") === "1";
  try {
    await adminFeedbackDone(id, value);
  } catch (e) {
    redirect(`/admin/feedback?state=${back}&err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`/admin/feedback?state=${back}`);
}

function Row({ r, state }: { r: AdminFeedbackRow; state: State }) {
  const who = r.username ? `@${r.username}` : (r.nickname ?? "—");
  const tech = [PLATFORM_AR[r.platform] ?? r.platform, r.device, r.appVersion].filter(Boolean).join(" · ");
  return (
    <section className={`rounded-card border border-border bg-surface p-4 flex gap-4${r.doneAt ? " opacity-70" : ""}`}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-12 text-muted">
          <span
            className={`rounded-full px-2.5 py-0.5 font-bold ${
              r.kind === "bug" ? "bg-[color:var(--error)]/15 text-[color:var(--error)]" : "bg-accent/15 text-accent"
            }`}
          >
            {r.kind === "bug" ? "مشكلة" : "اقتراح"}
          </span>
          {r.author ? (
            <Link href={`/admin/users?q=${r.author}`} className="text-accent hover:underline">
              {who}
            </Link>
          ) : (
            <span>{who}</span>
          )}
          <span>·</span>
          <span>{riyadh(r.createdAt)}</span>
          {r.screen ? (
            <>
              <span>·</span>
              <span>من: {SCREEN_AR[r.screen] ?? r.screen}</span>
            </>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap text-14 leading-relaxed">{r.body}</p>
        <p className="text-12 text-muted" dir="ltr" style={{ textAlign: "end" }}>
          {tech}
        </p>
      </div>
      <form action={done} className="self-center shrink-0">
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="done" value={r.doneAt ? "0" : "1"} />
        <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
          {r.doneAt ? "أعِد فتحها" : "✓ تمّت"}
        </button>
      </form>
    </section>
  );
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const state: State = STATES.some((s) => s.key === sp.state) ? (sp.state as State) : "open";
  const rows = await getAdminFeedback(state);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-22 font-bold">الملاحظات</h1>
          <p className="text-12 text-muted">ما يكتبه المستخدمون من «أرسل مشكلة أو اقتراح» — الأحدثُ أوّلاً</p>
        </div>
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} />

      <nav className={`${chipRow} flex gap-2`} aria-label="تصفية الملاحظات">
        {STATES.map((s) => (
          <Link key={s.key} href={`/admin/feedback?state=${s.key}`} className={chipClass(s.key === state)}>
            {s.key === "open" && state === "open" && rows.length ? `${s.label} · ${rows.length}` : s.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-14 text-muted">{state === "done" ? "لا شيء أُغلق بعد." : "لا شيء ينتظر."}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Row key={r.id} r={r} state={state} />
          ))}
        </div>
      )}
    </div>
  );
}
