import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAmAdmin } from "@/lib/data";
import {
  adminPersonaPause,
  adminPersonaReviewUpdate,
  getAdminPersonaReviews,
  getAdminPersonaSettings,
  type AdminPersonaReview,
} from "@/lib/personaAdmin";
import { PERSONAS } from "@/core/personas";
import { buttonClass } from "@/components/ui/Button";
import { chipClass, chipRow } from "@/components/ui/controls";
import { AdminNotice } from "@/components/admin/AdminNotice";

export const dynamic = "force-dynamic";

/**
 * 🆕 D-1563 — **شخصيات لوبز AI في الإدارة**: إيقافُ النشر واستئنافُه، والطابورُ كلُّه — ما ينتظر وقتَه وما ظهر وما أُخفي —
 * بنصّيه، يُعدَّل ويُخفى ويُعاد (طلبُ أحمد: «إدارة الشخصيات ومراجعاتها باللغتين وأوقات النشر وإيقافه»).
 *
 * 🔑 **الإيقافُ يحجب ما بعد لحظته** (حكمُ القاعدة، `persona_review_visible`): ما ظهر يبقى، وما جدولُه بعده لا يظهر حتى
 * يُستأنف — ولا شيء يُحذف. **والحذفُ ليس هنا عمداً**: «إخفاء» يُرجَع عنه، والحذفُ لا.
 */

const STATES = [
  { key: "all", label: "الكل" },
  { key: "waiting", label: "تنتظر وقتها" },
  { key: "live", label: "ظاهرة" },
  { key: "hidden", label: "مخفيّة" },
] as const;
type State = (typeof STATES)[number]["key"];

const OK_TEXT: Record<string, string> = { paused: "أُوقف النشر", resumed: "استُؤنف النشر", saved: "حُفظ" };

const NAME_AR = new Map<string, string>(PERSONAS.map((p) => [p.slug, p.name.ar]));

const riyadh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "—";

async function pause(formData: FormData) {
  "use server";
  const value = formData.get("paused") === "1";
  try {
    await adminPersonaPause(value);
  } catch (e) {
    redirect(`/admin/personas?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`/admin/personas?ok=${value ? "paused" : "resumed"}`);
}

async function save(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("state") ?? "all");
  const status = formData.get("status");
  try {
    await adminPersonaReviewUpdate(id, {
      status: status === "hidden" || status === "live" ? status : undefined,
      body_ar: formData.has("body_ar") ? String(formData.get("body_ar")) : undefined,
      body_en: formData.has("body_en") ? String(formData.get("body_en")) : undefined,
    });
  } catch (e) {
    redirect(`/admin/personas?state=${back}&err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`/admin/personas?state=${back}&ok=saved`);
}

function stateOf(r: AdminPersonaReview): Exclude<State, "all"> {
  return r.status === "hidden" ? "hidden" : r.visible ? "live" : "waiting";
}

const field =
  "w-full rounded-xl bg-surface-2 border border-border px-3 py-2 text-14 leading-relaxed outline-none focus:border-accent transition";

function Row({ r, state }: { r: AdminPersonaReview; state: State }) {
  const st = stateOf(r);
  const href = `/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`;
  return (
    <section className={`rounded-card border border-border bg-surface p-4 space-y-3${st === "hidden" ? " opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-12 text-muted">
        <span className="rounded-full px-2.5 py-0.5 font-bold bg-accent/15 text-accent">{NAME_AR.get(r.slug) ?? r.slug}</span>
        <Link href={href} className="text-accent hover:underline">
          {r.title ?? `${r.media_type === "tv" ? "مسلسل" : "فيلم"} ${r.tmdb_id}`}
        </Link>
        {r.scope_ar ? <span>· {r.scope_ar}</span> : null}
        <span>·</span>
        <span>{st === "waiting" ? `تظهر ${riyadh(r.publish_at)}` : `ظهرت ${riyadh(r.publish_at)}`}</span>
        <span>·</span>
        <span>كُتبت {riyadh(r.created_at)}</span>
        {r.likes ? <span>· ♥ {r.likes}</span> : null}
        {r.has_spoiler ? <span className="text-[color:var(--error)]">· فيها حرق</span> : null}
      </div>
      <form action={save} className="space-y-2">
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="state" value={state} />
        <label className="block space-y-1">
          <span className="text-12 text-muted">العربية</span>
          <textarea name="body_ar" defaultValue={r.body_ar} rows={4} dir="rtl" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-12 text-muted">English</span>
          <textarea name="body_en" defaultValue={r.body_en} rows={4} dir="ltr" className={field} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
            حفظ النص
          </button>
          <button
            type="submit"
            name="status"
            value={r.status === "hidden" ? "live" : "hidden"}
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            {r.status === "hidden" ? "أظهرها" : "أخفِها"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const state: State = STATES.some((s) => s.key === sp.state) ? (sp.state as State) : "all";
  const [settings, all] = await Promise.all([
    getAdminPersonaSettings().catch(() => null),
    getAdminPersonaReviews().catch(() => [] as AdminPersonaReview[]),
  ]);
  const rows = state === "all" ? all : all.filter((r) => stateOf(r) === state);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-22 font-bold">شخصيات لوبز</h1>
          <p className="text-12 text-muted">
            {settings
              ? `${settings.live} ظاهرة · ${settings.waiting} تنتظر وقتها · ${settings.hidden} مخفيّة · ${settings.per_hour_min}–${settings.per_hour_max} في الساعة`
              : "لم تُشغَّل الهجرة ٢٢٥ بعد"}
          </p>
        </div>
        {settings ? (
          <form action={pause}>
            <input type="hidden" name="paused" value={settings.paused ? "0" : "1"} />
            <button type="submit" className={buttonClass({ variant: settings.paused ? "primary" : "surface", size: "sm" })}>
              {settings.paused ? `استئناف النشر (موقوف منذ ${riyadh(settings.paused_at)})` : "إيقاف النشر"}
            </button>
          </form>
        ) : null}
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} okText={sp.ok ? OK_TEXT[sp.ok] : undefined} />

      <nav className={`${chipRow} flex gap-2`} aria-label="تصفية المراجعات">
        {STATES.map((s) => (
          <Link key={s.key} href={`/admin/personas?state=${s.key}`} className={chipClass(s.key === state)}>
            {s.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-14 text-muted">لا مراجعات هنا.</p>
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
