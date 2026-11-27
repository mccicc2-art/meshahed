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
import { fieldClass, pillClass } from "@/components/admin/style";

export const dynamic = "force-dynamic";

/**
 * 🆕 D-1563 — **شخصيات لوبز AI في الإدارة**: إيقافُ النشر واستئنافُه، والطابورُ كلُّه — ما ينتظر وقتَه وما ظهر وما أُخفي —
 * بنصّيه، يُعدَّل ويُخفى ويُعاد (طلبُ أحمد: «إدارة الشخصيات ومراجعاتها باللغتين وأوقات النشر وإيقافه»).
 *
 * 🔑 **الإيقافُ يحجب ما بعد لحظته** (حكمُ القاعدة، `persona_review_visible`): ما ظهر يبقى، وما جدولُه بعده لا يظهر حتى
 * يُستأنف — ولا شيء يُحذف. **والحذفُ ليس هنا عمداً**: «إخفاء» يُرجَع عنه، والحذفُ لا.
 */

/* ٦٠١ — **تُفتح على «تنتظر وقتها»** (مراجعةُ ٢٧ نوفمبر): «الكل» كان يرسم ٢٠٠ مراجعةٍ مفتوحةً للتحرير — نحو ٢٥ شاشةَ
   جوال — وما يستحقّ نظرةً قبل النشر هو ما لم يظهر بعد. */
const STATES = [
  { key: "waiting", label: "تنتظر وقتها" },
  { key: "live", label: "ظاهرة" },
  { key: "hidden", label: "مخفيّة" },
  { key: "all", label: "الكل" },
] as const;
/* دفعةٌ تُقرأ على الجوال، و«اعرض المزيد» يزيدها — لا صفحاتٌ مرقّمة لطابورٍ يُقرأ من أعلاه */
const PAGE = 30;
type State = (typeof STATES)[number]["key"];

const OK_TEXT: Record<string, string> = { paused: "أُوقف النشر", resumed: "استُؤنف النشر", saved: "حُفظ" };

const NAME_AR = new Map<string, string>(PERSONAS.map((p) => [p.slug, p.name.ar]));

const riyadh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "—";

async function pause(formData: FormData) {
  "use server";
  const value = formData.get("paused") === "1";
  /* ٦٠١ — العودةُ إلى التبويب نفسِه لا إلى الافتراضيّ */
  const back = String(formData.get("state") ?? "waiting");
  try {
    await adminPersonaPause(value);
  } catch (e) {
    redirect(`/admin/personas?state=${back}&err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`/admin/personas?state=${back}&ok=${value ? "paused" : "resumed"}`);
}

async function save(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("state") ?? "waiting");
  /* ٦٠١ — ومعه عددُ المعروض: صفٌّ عُدّل بعد الثلاثين الأولى لا يختفي بعد الحفظ */
  const n = Number(formData.get("n")) || 0;
  const tail = n > 0 ? `&n=${n}` : "";
  const status = formData.get("status");
  try {
    await adminPersonaReviewUpdate(id, {
      status: status === "hidden" || status === "live" ? status : undefined,
      body_ar: formData.has("body_ar") ? String(formData.get("body_ar")) : undefined,
      body_en: formData.has("body_en") ? String(formData.get("body_en")) : undefined,
      /* 🆕 D-1565 — الدرجةُ عددٌ صحيحٌ ١–١٠ كدرجة العضو؛ والقاعدةُ ترفض ما سواه */
      rating: formData.has("rating") && String(formData.get("rating")).trim() ? Number(formData.get("rating")) : undefined,
    });
  } catch (e) {
    redirect(`/admin/personas?state=${back}${tail}&err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`/admin/personas?state=${back}${tail}&ok=saved`);
}

function stateOf(r: AdminPersonaReview): Exclude<State, "all"> {
  return r.status === "hidden" ? "hidden" : r.visible ? "live" : "waiting";
}

const field = `${fieldClass} w-full leading-relaxed outline-none focus:border-accent transition`;

/* ٦٠١ — **سطرٌ مطويٌّ يُفتح للتحرير**: الملخّصُ (الشخصيّة · العمل · الموعد · أوّلُ النصّ) يكفي للفرز، والتحريرُ عند اللمس */
function Row({ r, state, shown }: { r: AdminPersonaReview; state: State; shown: number }) {
  const st = stateOf(r);
  const href = `/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`;
  return (
    <details className={`rounded-card border border-border bg-surface p-4 [&[open]>summary]:mb-3${st === "hidden" ? " opacity-70" : ""}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-12 text-muted">
        <span className={pillClass("warn")}>{NAME_AR.get(r.slug) ?? r.slug}</span>
        <Link href={href} className="text-accent hover:underline">
          {r.title ?? `${r.media_type === "tv" ? "مسلسل" : "فيلم"} ${r.tmdb_id}`}
        </Link>
        {r.scope_ar ? <span>· {r.scope_ar}</span> : null}
        <span>·</span>
        <span>{st === "waiting" ? `تظهر ${riyadh(r.publish_at)}` : `ظهرت ${riyadh(r.publish_at)}`}</span>
        <span>·</span>
        <span>كُتبت {riyadh(r.created_at)}</span>
        {r.rating != null ? <span className="text-accent font-bold tabular-nums">· ★ {r.rating}</span> : null}
        {r.likes ? <span>· ♥ {r.likes}</span> : null}
        {r.has_spoiler ? <span className="text-error">· فيها حرق</span> : null}
      </div>
      <p className="line-clamp-2 text-14 leading-relaxed" dir="rtl">{r.body_ar}</p>
      </summary>
      <form action={save} className="space-y-2">
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="n" value={shown} />
        <label className="block space-y-1">
          <span className="text-12 text-muted">العربية</span>
          <textarea name="body_ar" defaultValue={r.body_ar} rows={4} dir="rtl" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-12 text-muted">English</span>
          <textarea name="body_en" defaultValue={r.body_en} rows={4} dir="ltr" className={field} />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-12 text-muted">الدرجة (١–١٠، لا تدخل تقييم الجمهور)</span>
          <input
            name="rating"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            step={1}
            defaultValue={r.rating ?? undefined}
            dir="ltr"
            className={`${field} w-20 tabular-nums`}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonClass({ variant: "surface", size: "sm" })}>
            حفظ
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
    </details>
  );
}

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; err?: string; ok?: string; n?: string; confirm?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const state: State = STATES.some((s) => s.key === sp.state) ? (sp.state as State) : "waiting";
  const shown = Math.min(Math.max(Number(sp.n) || PAGE, PAGE), 200);
  const [settings, all] = await Promise.all([
    getAdminPersonaSettings().catch(() => null),
    getAdminPersonaReviews().catch(() => [] as AdminPersonaReview[]),
  ]);
  const rows = state === "all" ? all : all.filter((r) => stateOf(r) === state);
  const countOf = (k: State) => (k === "all" ? all.length : all.filter((r) => stateOf(r) === k).length);
  /* ٦٠١ — الإيقافُ العامُّ يحجب نشرَ الشخصيات كلِّها: خطوةُ تأكيدٍ قبل الحجب، والاستئنافُ بلا تأكيد لأنّه يعيد الطبيعيّ */
  const confirming = sp.confirm === "pause" && settings && !settings.paused;

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
          settings.paused ? (
            <form action={pause}>
              <input type="hidden" name="paused" value="0" />
              <input type="hidden" name="state" value={state} />
              <button type="submit" className={buttonClass({ variant: "primary", size: "sm" })}>
                {`استئناف النشر (موقوف منذ ${riyadh(settings.paused_at)})`}
              </button>
            </form>
          ) : confirming ? (
            <form action={pause} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="paused" value="1" />
              <input type="hidden" name="state" value={state} />
              <span className="text-12 text-muted">لن يظهر شيءٌ جديدٌ حتى تستأنف</span>
              <button type="submit" className={buttonClass({ variant: "danger", size: "sm" })}>تأكيد الإيقاف</button>
              <Link href={`/admin/personas?state=${state}`} className={buttonClass({ variant: "ghost", size: "sm" })}>تراجع</Link>
            </form>
          ) : (
            <Link href={`/admin/personas?state=${state}&confirm=pause`} className={buttonClass({ variant: "surface", size: "sm" })}>
              إيقاف النشر
            </Link>
          )
        ) : null}
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} okText={sp.ok ? OK_TEXT[sp.ok] : undefined} />

      <nav className={`${chipRow} flex gap-2`} aria-label="تصفية المراجعات">
        {STATES.map((s) => (
          <Link key={s.key} href={`/admin/personas?state=${s.key}`} className={chipClass(s.key === state)}>
            {s.label} <span className="tabular-nums" dir="ltr">{countOf(s.key)}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-14 text-muted">لا مراجعات هنا.</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, shown).map((r) => (
            <Row key={r.id} r={r} state={state} shown={shown} />
          ))}
          {rows.length > shown ? (
            <Link
              href={`/admin/personas?state=${state}&n=${shown + PAGE}`}
              className={buttonClass({ variant: "surface", size: "sm", full: true })}
            >
              اعرض المزيد ({rows.length - shown})
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
