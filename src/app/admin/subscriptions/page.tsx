import { notFound } from "next/navigation";
import Link from "next/link";
import { getAmAdmin } from "@/lib/data";
import { getAdminBilling, PROVIDERS, type AdminBilling } from "@/lib/admin";
import { pillClass } from "@/components/admin/style";

/**
 * 🆕 **الاشتراكات** (المهمّة ٦٠١ · أحمد ٢٧ نوفمبر: «ملخّص الاشتراكات مستقلّ»).
 *
 * 🔴 **الفجوةُ التي تسدّها**: المتجرُ والعمولةُ يعملان منذ نوفمبر (الهجرة ٢٣٨) ولا صفحةَ في الإدارة تقرأ
 * `subscriptions` أو `billing_events` أو `partner_commissions` — فلا يُعرف كم مشتركاً حقيقيّاً، ولا أحداثَ دفعٍ عالقة.
 *
 * 🔑 **ثلاثةُ أصنافٍ لا تُجمع أبداً** (الحقيقيُّ من المتجر · المنحُ اليدويّة · تجاربُ sandbox): جمعُها جعل ثمانيةَ
 * صفوفٍ تُقرأ «ثمانيةَ مشتركين» في مراجعة اليوم وليس بينها شراءٌ واحد. والتصنيفُ في القاعدة (`admin_billing_summary`).
 *
 * 🔑 **وأوّلُ اشتراكٍ حقيقيٍّ بابُ تذكير** (أحمد: «ذكرني بالرخصة مع اول اشتراك حقيقي»): مفتاحُ TMDB غيرُ تجاريّ،
 * فيظهر التنبيهُ هنا وفي النظرة العامّة يومَ يصل — ويختفي حين يُحدَّث سطرُ TMDB في `PROVIDERS`.
 */
export const dynamic = "force-dynamic";

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
const sar = (n: number | null | undefined) => `${(n ?? 0).toFixed(2)} ر.س`;
const riyadh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }) : "—";

const STORE_AR: Record<string, string> = { app_store: "App Store", play_store: "Google Play", stripe: "الويب" };
const PLAN_AR: Record<string, string> = { plus: "Plus", gold: "Gold" };

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-control bg-surface-2 px-3 py-2.5">
      <p className="text-12 text-muted">{label}</p>
      <p className={`mt-0.5 text-20 font-bold tabular-nums${warn ? " text-error" : ""}`} dir="ltr">
        {value}
      </p>
      {sub ? <p className="text-12 text-muted">{sub}</p> : null}
    </div>
  );
}

function Body({ b }: { b: AdminBilling }) {
  const tmdbFree = PROVIDERS.find((p) => p.name === "TMDB")?.paid === false;
  return (
    <>
      {/* ——— التذكيرُ الذي طلبه أحمد ——— */}
      {b.real.first_at && tmdbFree ? (
        <section className="rounded-xl border border-error/50 bg-surface p-4 space-y-1">
          <h2 className="text-14 font-bold text-error">راجع رخصة TMDB التجاريّة</h2>
          <p className="text-13 leading-relaxed">
            وصل أوّلُ اشتراكٍ حقيقيٍّ في {riyadh(b.real.first_at)}. مفتاحُ TMDB الحاليّ مجانيٌّ غيرُ تجاريّ، والرخصةُ
            التجاريّةُ شرطٌ عند تحقيق دخل — والكتالوجُ وصورُ الأعمال كلُّها منهم.
          </p>
        </section>
      ) : (
        <p className="text-12 text-muted leading-relaxed">
          تذكيرٌ مسجَّل: حين يصل أوّلُ اشتراكٍ حقيقيٍّ يظهر هنا وفي النظرة العامّة تنبيهُ رخصة TMDB التجاريّة.
        </p>
      )}

      {/* ——— ١) المتجر ——— */}
      <section className="rounded-xl bg-surface p-4 space-y-3">
        <h2 className="text-14 font-bold">
          اشتراكاتُ المتجر الحقيقيّة{" "}
          <span className="text-12 font-normal text-muted">— دفعٌ فعليٌّ عبر RevenueCat، بلا تجارب ولا منح</span>
        </h2>
        {b.real.ever === 0 ? (
          <p className="text-14 text-muted">لم يصل أيُّ اشتراكٍ حقيقيٍّ بعد.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="نشِط الآن" value={fmt(b.real.active)} sub={`${fmt(b.real.renewing)} يتجدّد`} />
              <Stat label="ألغى ويبقى حتى نهاية فترته" value={fmt(b.real.cancel_pending)} />
              <Stat label="جديد ٣٠ يوماً" value={fmt(b.real.new_30d)} />
              <Stat label="انتهى مؤخّراً" value={fmt(b.real.ended_30d)} sub="تقريباً في ٣٠ يوماً" />
              <Stat label="منذ البداية" value={fmt(b.real.ever)} sub={`أوّلُه ${riyadh(b.real.first_at)}`} />
            </div>
            {b.real.by_product.length > 0 ? (
              <ul className="divide-y divide-border">
                {b.real.by_product.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 py-2 text-13">
                    <span className={pillClass(p.plan === "gold" ? "warn" : "mute")}>
                      {PLAN_AR[p.plan ?? ""] ?? p.plan ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {STORE_AR[p.store ?? ""] ?? p.store ?? "—"} ·{" "}
                      <code className="text-12 text-muted" dir="ltr">{p.product ?? "—"}</code>
                    </span>
                    <b className="tabular-nums" dir="ltr">{fmt(p.n)}</b>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      {/* ——— ٢) من يملك المزايا الآن ——— */}
      <section className="rounded-xl bg-surface p-4 space-y-3">
        <h2 className="text-14 font-bold">
          من يملك المزايا الآن{" "}
          <span className="text-12 font-normal text-muted">— بكلِّ مصادرها: المتجر والمنحُ والشركاء</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Plus فعّال" value={fmt(b.members.plus)} />
          <Stat label="منها Gold" value={fmt(b.members.gold)} />
          <Stat label="ينتهي خلال ٧ أيام" value={fmt(b.members.plus_ending_7d)} />
          <Stat label="منحٌ يدويّةٌ فعّالة" value={fmt(b.members.manual_active)} />
        </div>
      </section>

      {/* ——— ٣) الدفعُ والعمولات ——— */}
      <section className="rounded-xl bg-surface p-4 space-y-3">
        <h2 className="text-14 font-bold">أحداثُ الدفع وعمولاتُ الشركاء</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="أحداثُ المتجر ٣٠ يوماً" value={fmt(b.events.received_30d)} sub={`آخرُها ${riyadh(b.events.last_at)}`} />
          <Stat
            label="عالقةٌ بلا معالجة"
            value={fmt(b.events.stuck)}
            sub={b.events.stuck > 0 ? "مشتركٌ قد لا يصله ما دفع له" : "لا شيء عالق"}
            warn={b.events.stuck > 0}
          />
          <Stat label="عمولاتٌ مستحقّة" value={sar(b.commissions.earned)} sub={`${fmt(b.commissions.partners)} شريك`} />
          <Stat label="معلّقةٌ ثلاثين يوماً" value={sar(b.commissions.on_hold)} />
          <Stat label="مسترجعة" value={sar(b.commissions.reversed)} />
          <Stat label="طلباتُ تحويلٍ تنتظر" value={fmt(b.payouts.pending)} sub={sar(b.payouts.pending_amount)} />
        </div>
        <p className="text-12 text-muted">
          صُرف للشركاء حتى الآن {sar(b.payouts.paid_amount)} ·{" "}
          <Link href="/admin/payouts" className="text-accent hover:underline">طلبات التحويل</Link>
        </p>
      </section>

      <p className="text-12 text-muted leading-relaxed">
        تجاربُ sandbox لا تُحسب في شيءٍ أعلاه: {fmt(b.sandbox.subs)} اشتراك · {fmt(b.sandbox.events)} حدث.
      </p>
    </>
  );
}

export default async function AdminSubscriptionsPage() {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const b = await getAdminBilling();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-22 font-bold">الاشتراكات</h1>
          <p className="text-12 text-muted">{b ? `مقروءةٌ الآن من القاعدة · ${riyadh(b.at)}` : "—"}</p>
        </div>
        {b ? (
          <span className={pillClass(b.real.active > 0 ? "ok" : "mute")}>
            {b.real.active > 0 ? `${fmt(b.real.active)} مشترك حقيقيّ` : "لا مشتركين من المتجر بعد"}
          </span>
        ) : null}
      </header>

      {b ? (
        <Body b={b} />
      ) : (
        <p className="text-14 text-muted">تعذّر القياس — إمّا أنّ الهجرة ٢٧٤ لم تُشغَّل بعد، أو أنّ القاعدة لم تُجب الآن.</p>
      )}
    </div>
  );
}
