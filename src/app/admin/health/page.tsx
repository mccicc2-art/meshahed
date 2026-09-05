import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import {
  DATA_MAP,
  KIND_AR,
  SEV_AR,
  findingsOf,
  getAdminHealth,
  type DataKind,
} from "@/lib/admin";
import { settingsCard, settingsCardRows } from "@/components/settings/SettingsGroup";

/**
 * 🆕 **الأداء والحماية** (D-924، طلبُ أحمد: «أحتاج أعرف فيها حالة الأداء
 * والسرعة والتأخير، وحالة الأمان وحفظ البيانات وأنواع البيانات التي نجمعها
 * ومستوى الحماية والثغرات والتوصيات»).
 *
 * 🔑 **صفحةٌ تعرض رقماً لا تقيسه أسوأُ من صفحةٍ لا تعرضه** (D-063/D-219):
 * كلُّ رقمٍ هنا من `admin_health()` (الهجرة ١٨٤) ومصدرُه حيّ —
 * `pg_stat_statements` للزمن و`pg_policies` للحماية. **ولا لوحةَ ثانية**:
 * أرقامُ مستشار Supabase أُعيد حسابُها بالسؤال نفسِه (`initplan` = ١١٩،
 * مطابَقٌ حرفيّاً ٥ سبتمبر) فلا يُفتح تبويبٌ في موقعٍ آخر كلَّ صباح.
 *
 * 🔑 **والتوصياتُ مشتقّةٌ من الأرقام لا مكتوبةٌ قائمة** (`findingsOf`):
 * **قائمةٌ ثابتةٌ تكذب بعد أوّل إصلاح**، وهذه تختفي وحدَها متى عولج سببُها.
 *
 * ⚖️ **وما لا يُقاس يُقال أنّه لا يُقاس**: زمنُ الشبكة والتصيير (Vercel) ليس
 * هنا — أدواتُه ترفض هذا المشروع (403)، **وصفرٌ مكانه كذب**.
 */
export const dynamic = "force-dynamic";

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
const mb = (n: number) => `${(n / 1048576).toFixed(1)} م.ب`;
const riyadh = (iso: string) =>
  new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" });

const KIND_TONE: Record<DataKind, string> = {
  identity: "bg-accent/15 text-accent",
  financial: "bg-[color:var(--error)]/15 text-[color:var(--error)]",
  behaviour: "bg-surface-2 text-muted",
  technical: "bg-surface-2 text-muted",
};
const SEV_TONE = {
  high: "bg-[color:var(--error)]/15 text-[color:var(--error)]",
  med: "bg-accent/15 text-accent",
  low: "bg-surface-2 text-muted",
} as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-12 text-muted">{label}</p>
      <p className="mt-0.5 text-20 font-bold tabular-nums" dir="ltr">{value}</p>
      {sub && <p className="text-12 text-muted">{sub}</p>}
    </div>
  );
}

export default async function AdminHealthPage() {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const h = await getAdminHealth();
  if (!h) {
    return (
      <p className="text-14 text-muted">
        تعذّر قياسُ الحالة — الهجرة ١٨٤ لم تُشغَّل بعد أو الدالّة غيرُ متاحة.
      </p>
    );
  }

  const findings = findingsOf(h);
  const worst = findings.some((x) => x.sev === "high") ? "high" : findings.length ? "med" : "low";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-22 font-bold">الأداء والحماية</h1>
          <p className="text-12 text-muted">
            كلُّ رقمٍ مقروءٌ الآن من القاعدة · {riyadh(h.at)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-12 font-bold ${SEV_TONE[worst]}`}>
          {findings.length === 0 ? "لا ثغرات مفتوحة" : `${findings.length} بندٌ يستحقّ عملاً`}
        </span>
      </header>

      {/* ——— ١) السرعة والتأخير ——— */}
      <section className={`${settingsCard} p-4 space-y-3`}>
        <h2 className="text-15 font-bold">
          السرعة والتأخير{" "}
          <span className="text-12 font-normal text-muted">
            — زمنُ القاعدة وحدَه، مقيسٌ منذ {h.perf.since?.slice(0, 10)}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="متوسّط الاستعلام" value={`${h.perf.avg_ms} م.ث`} sub="كلُّ استعلامٍ في القاعدة" />
          <Stat label="عدد الاستعلامات" value={fmt(h.perf.calls)} sub={`${fmt(h.perf.total_s)} ثانيةً إجمالاً`} />
          <Stat label="إصابةُ الذاكرة" value={`${h.perf.cache_hit}٪`} sub="لا قراءةَ قرصٍ تقريباً" />
          <Stat label="حجم القاعدة" value={mb(h.perf.db_bytes)} sub={`${fmt(h.perf.unused_indexes)} فهرساً بلا قراءة`} />
        </div>
        <div className="space-y-1.5">
          <p className="text-12 text-muted">أثقلُ ستّ عملياتٍ بنصيبها من زمن القاعدة</p>
          {(h.perf.top ?? []).map((t) => (
            <div key={t.name} className="flex items-center gap-2 text-12">
              <code className="w-32 shrink-0 truncate" dir="ltr">{t.name}</code>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${t.pct}%`, background: t.pct >= 20 ? "var(--error)" : "var(--accent)" }}
                />
              </div>
              <span className="w-40 shrink-0 text-end tabular-nums text-muted" dir="ltr">
                {t.pct}% · {fmt(t.calls)} × {t.mean_ms}ms
              </span>
            </div>
          ))}
        </div>
        <p className="text-12 text-muted leading-relaxed">
          ⚠️ <b>هذا زمنُ القاعدة لا زمنُ الصفحة</b>: زمنُ التصيير والشبكة عند Vercel،
          وأدواتُه ترفض هذا المشروع (403) — <b>فلا يُعرض هنا رقمٌ لا نقيسه</b>. المتصفّحُ
          يقيسه لك في Vercel Speed Insights.
        </p>
      </section>

      {/* ——— ٢) مستوى الحماية ——— */}
      <section className={`${settingsCard} p-4 space-y-3`}>
        <h2 className="text-15 font-bold">
          مستوى الحماية <span className="text-12 font-normal text-muted">— الحكمُ في القاعدة لا في الصفحة (D-011)</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="جداولُ بحمايةِ صفوف"
            value={`${h.sec.tables - h.sec.rls_off} / ${h.sec.tables}`}
            sub={h.sec.rls_off === 0 ? "لا جدولَ مكشوفاً" : `${h.sec.rls_off} بلا RLS`}
          />
          <Stat label="سياساتٌ مفتوحة" value={`${h.sec.open_policies} / ${h.sec.policies}`} sub="عامّةٌ بقصد" />
          <Stat label="دوالُّ definer" value={`${h.sec.definer_anon} / ${h.sec.definer}`} sub="ينفّذها الزائر" />
          <Stat label="سياساتٌ تُعاد لكلِّ صفّ" value={fmt(h.sec.initplan)} sub="auth.uid() بلا select" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-12 text-muted">أبوابُ الدخول</p>
            <div className="flex flex-wrap gap-1.5">
              {(h.sec.providers ?? []).map((p) => (
                <span
                  key={p.provider}
                  className={`rounded-full px-2.5 py-1 text-12 font-bold ${
                    p.provider === "google" ? "bg-surface-2 text-muted" : "bg-accent/15 text-accent"
                  }`}
                  dir="ltr"
                >
                  {p.provider} · {p.n}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-12 text-muted">دِلاءُ الملفّات</p>
            <div className="flex flex-wrap gap-1.5">
              {(h.sec.buckets ?? []).map((b) => (
                <span
                  key={b.id}
                  className={`rounded-full px-2.5 py-1 text-12 font-bold ${
                    b.public ? "bg-surface-2 text-muted" : "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                  }`}
                  dir="ltr"
                >
                  {b.id} · {b.public ? "عامّ" : "خاصّ"} · {b.objects}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ——— ٣) ما نجمعه وكم نحفظه ——— */}
      <section className={`${settingsCard} p-4 space-y-2`}>
        <h2 className="text-15 font-bold">
          ما نجمعه وكم نحفظه{" "}
          <span className="text-12 font-normal text-muted">— القاعدةُ تقول كم، والشيفرةُ تقول ما هو</span>
        </h2>
        <div className={settingsCardRows}>
          {DATA_MAP.map((d) => {
            const g = h.data?.[d.table];
            return (
              <div key={d.table} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-12" dir="ltr">{d.table}</code>
                  <span className={`rounded-full px-2 py-0.5 text-12 font-bold ${KIND_TONE[d.kind]}`}>
                    {KIND_AR[d.kind]}
                  </span>
                  <span className="ms-auto shrink-0 tabular-nums text-12 text-muted" dir="ltr">
                    {fmt(g?.rows)} صفّ{g?.oldest ? ` · منذ ${g.oldest}` : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-13">{d.what}</p>
                <p className="text-12 text-muted">
                  الاحتفاظ: {d.keep}
                  {!d.pruned && (g?.rows ?? 0) > 0 ? " · لا حذفَ دوريّ" : ""}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-12 text-muted leading-relaxed">
          وخارجَ هذا الجدول: بريدُ الحساب وصورتُه في <code dir="ltr">auth.users</code> و
          <code dir="ltr">avatars</code> (يمحوهما <code dir="ltr">delete_my_account</code> فوراً بلا نسخةِ
          ثلاثين يوماً — <b>وهو ما تعلنه صفحةُ /account/delete</b>)، ووثيقةُ هويّةِ الشريك في
          الدلو الخاصّ <code dir="ltr">partner-ids</code>. <b>ولا يُخزَّن وكيلُ متصفّحٍ كامل ولا IP
          ولا موقعٌ جغرافيّ</b> (D-666).
        </p>
      </section>

      {/* ——— ٤) الثغرات والتوصيات ——— */}
      <section className={`${settingsCard} p-4 space-y-2`}>
        <h2 className="text-15 font-bold">
          الثغرات والتوصيات{" "}
          <span className="text-12 font-normal text-muted">— مشتقّةٌ من الأرقام، تختفي متى عولجت</span>
        </h2>
        {findings.length === 0 ? (
          <p className="text-14 text-[color:var(--success)]">لا بندَ مفتوحاً.</p>
        ) : (
          <div className={settingsCardRows}>
            {findings.map((x) => (
              <div key={x.id} className="px-3 py-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-12 font-bold ${SEV_TONE[x.sev]}`}>
                    {SEV_AR[x.sev]}
                  </span>
                  <p className="text-14 font-bold">{x.title}</p>
                </div>
                <p className="text-13 text-muted leading-relaxed">{x.why}</p>
                <p className="text-13"><b className="text-accent">العلاج: </b>{x.fix}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
