"use client";

import { useState, useTransition } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { VerifiedBadge } from "@/components/AccountIdentity";
import { requestVerification } from "@/lib/actions";
import { flashError, toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import type {
  VerifyEligibility,
  VerifyState,
  LinkedProvider,
} from "@/lib/actions";

/**
 * ================= شاشةُ طلب التوثيق (D-775) =================
 *
 * **مسارُ أحمد بخطواته**: فحصُ الأهليّة ← نوعُ الحساب ← الإثباتات ←
 * الحالة. **وأربعُ شاشاتٍ لأربع خطواتٍ كانت ستجعل الطلبَ رحلة** —
 * **وصفحةٌ واحدةٌ تُقرأ من أعلاها إلى أسفلها تقول القصّةَ كلَّها**،
 * فيعرف من لا يستحقُّ أنّه لا يستحقُّ قبل أن يكتب حرفاً.
 *
 * 🔑 **والإثباتُ صار ربطَ حسابٍ لا صورةَ هويّة** (حكمُ أحمد): تسجيلُ
 * الدخول من حساب X أو فيسبوك **هو البرهانُ عينُه على الملكيّة، لا دليلاً
 * عليه** — **ولا نخزّن وثيقةً حكوميّةً ولا قياساً حيويّاً**، فتسقط
 * مسؤوليّةُ الاحتفاظ من أوّلها.
 *
 * ⚠️ **والأهليّةُ تُقرأ من القاعدة ولا تُحسب هنا**: الشاشةُ تعرض ما
 * قالته `verification_eligibility` — **وحسابٌ ثانٍ في الواجهة يفترق عن
 * الأوّل يومَ يتغيّر أحدُهما** (D-145). **والزرُّ يُخفى، والدالّةُ تمنع**
 * (D-011): من نادى الفعلَ بلا شاشةٍ ارتدّ.
 */

const KINDS = [
  { id: "person", labelKey: "verifyKindPerson" },
  { id: "org", labelKey: "verifyKindOrg" },
  { id: "media", labelKey: "verifyKindMedia" },
] as const;

/** صفُّ شرطٍ — **علامةٌ تقول نعم أو لا، وسطرٌ يقول لماذا** */
function Check({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-0.5 shrink-0 grid place-items-center w-[18px] h-[18px] rounded-full ${
          ok ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-muted"
        }`}
        aria-hidden
      >
        <Icon name={ok ? "check" : "close"} size={11} strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span className={`block text-14 ${ok ? "" : "text-muted"}`}>{label}</span>
        {note && <span className="block text-12 text-muted mt-0.5">{note}</span>}
      </span>
    </li>
  );
}

export function VerifyScreen({
  locale,
  eligibility,
  state,
  providers,
}: {
  locale: Locale;
  eligibility: VerifyEligibility;
  state: VerifyState;
  providers: LinkedProvider[];
}) {
  const t = getDict(locale);
  const [kind, setKind] = useState<string>(state.kind ?? "person");
  const [links, setLinks] = useState("");
  const [website, setWebsite] = useState("");
  const [sources, setSources] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [linking, setLinking] = useState(false);

  /**
   * **ربطُ مزوّدٍ إضافيّ** — `linkIdentity` من supabase-js.
   * ⚠️ **والعميلُ يُستورد عند الضغط لا مع الصفحة** (عُرفُ `client.ts`):
   * الحزمةُ ٢٤٥ ك.ب، **ولا تُدفع لصفحةٍ قد لا يُضغط فيها زرّ.**
   * ⚠️ **والمزوّدُ قد يكون غيرَ مفعَّلٍ في المشروع** — وهو الحالُ حتى
   * يضع أحمدُ مفاتيحَ تطبيقه بنفسه في لوحة Supabase. **فالفشلُ يُقال
   * بجملةٍ تشرح، لا بانكسار.**
   */
  async function link(provider: "twitter" | "facebook") {
    tap(8);
    setLinking(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = await createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/profile/settings/verify` },
      });
      if (error) flashError(t.verifyLinkFailed);
    } catch {
      flashError(t.verifyLinkFailed);
    } finally {
      setLinking(false);
    }
  }

  function submit() {
    tap(10);
    start(async () => {
      try {
        await requestVerification({
          kind,
          links: links.split(/\s*[\n,]\s*/).filter(Boolean),
          website,
          sources,
          reason,
        });
        toast(t.verifyStatusPending);
      } catch (e) {
        flashError(e instanceof Error ? e.message : t.errSaveShort);
      }
    });
  }

  /* ===== حالةٌ قائمة: الطلبُ يسبق النموذج ===== */
  const statusLabel =
    state.status === "pending"
      ? t.verifyStatusPending
      : state.status === "more_info"
        ? t.verifyStatusMoreInfo
        : state.status === "approved"
          ? t.verifyStatusApproved
          : state.status === "rejected"
            ? t.verifyStatusRejected
            : null;

  const showForm = eligibility.eligible && state.canApply && !eligibility.verified;

  return (
    <div className="space-y-5">
      {/* ===== ما هي العلامة، وما ليست ===== */}
      <section className="rounded-2xl border border-border bg-surface-2 p-4">
        <div className="flex items-center gap-2">
          <VerifiedBadge t={t} />
          <h2 className="text-15 font-bold">{t.verifyTitle}</h2>
        </div>
        <p className="mt-2 text-14 text-muted leading-relaxed">{t.verifySub}</p>
        {/* ⚖️ **وهذا السطرُ ليس زينةً**: حكمُ أحمد «التوثيق لا يُباع ولا
            يأتي تلقائيّاً مع Plus» — **وقولُه في الشاشة نفسِها هو ما
            يمنع صاحبَ البلس من انتظاره مجّاناً.** */}
        <p className="mt-2 text-12 text-muted leading-relaxed">{t.verifyNotSold}</p>
      </section>

      {/* ===== حالةُ الحساب أو الطلب ===== */}
      {eligibility.verified ? (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-4 flex items-center gap-2.5">
          <VerifiedBadge t={t} />
          <p className="text-14 font-semibold">{t.verifyAlready}</p>
        </section>
      ) : statusLabel ? (
        <section className="rounded-2xl border border-border bg-surface-2 p-4">
          <p className="text-14 font-bold">{statusLabel}</p>
          {state.note && <p className="mt-1.5 text-12 text-muted leading-relaxed">{state.note}</p>}
          {state.status === "pending" && (
            <p className="mt-1.5 text-12 text-muted">{t.verifyReviewTime}</p>
          )}
          {state.status === "rejected" && state.nextApplyAt && !state.canApply && (
            <p className="mt-1.5 text-12 text-muted">
              {t.verifyReapplyAt(new Date(state.nextApplyAt).toLocaleDateString(locale))}
            </p>
          )}
        </section>
      ) : null}

      {/* ===== ١) الشروط — تُقرأ من القاعدة ===== */}
      {!eligibility.verified && (
        <section>
          <h3 className="text-12 font-bold text-muted mb-1">{t.verifyStepChecks}</h3>
          <ul className="rounded-2xl border border-border bg-surface-2 px-4 py-2">
            <Check ok={eligibility.complete} label={t.verifyChkComplete} />
            <Check
              ok={eligibility.active}
              label={t.verifyChkActive}
              note={t.verifyChkActiveN(eligibility.activeDays, eligibility.needDays)}
            />
            <Check ok={eligibility.clean} label={t.verifyChkClean} />
          </ul>
          {!eligibility.eligible && (
            <p className="mt-1.5 text-12 text-muted">{t.verifyNotEligible}</p>
          )}
        </section>
      )}

      {/* ===== ٢) الحسابات المرتبطة — البرهان ===== */}
      {!eligibility.verified && (
        <section>
          <h3 className="text-12 font-bold text-muted mb-1">{t.verifyLinked}</h3>
          <div className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3">
            <p className="text-12 text-muted leading-relaxed">{t.verifyLinkHint}</p>
            {providers.length === 0 ? (
              <p className="text-12 text-muted">{t.verifyLinkedNone}</p>
            ) : (
              <ul className="space-y-1.5">
                {providers.map((p) => (
                  <li key={p.provider} className="flex items-center gap-2 text-14">
                    <Icon name="check" size={13} className="text-accent shrink-0" strokeWidth={2.4} />
                    <span className="font-semibold capitalize">{p.provider}</span>
                    {p.handle && (
                      <span className="text-muted truncate" dir="ltr">
                        {p.handle}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="surface" size="sm" disabled={linking} onClick={() => link("twitter")}>
                {t.verifyLinkX}
              </Button>
              <Button variant="surface" size="sm" disabled={linking} onClick={() => link("facebook")}>
                {t.verifyLinkFacebook}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ===== ٣) النوع والإثباتات — لا تظهر إلّا لمن يستطيع التقديم ===== */}
      {showForm && (
        <>
          <section>
            <h3 className="text-12 font-bold text-muted mb-1">{t.verifyStepKind}</h3>
            <div className="rounded-2xl border border-border bg-surface-2 p-2 space-y-1">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    tap(6);
                    setKind(k.id);
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-14 transition ${
                    kind === k.id ? "bg-accent/15 text-foreground" : "hover:bg-surface-3"
                  }`}
                  aria-pressed={kind === k.id}
                >
                  <span
                    className={`shrink-0 w-[16px] h-[16px] rounded-full border-2 grid place-items-center ${
                      kind === k.id ? "border-accent" : "border-border"
                    }`}
                    aria-hidden
                  >
                    {kind === k.id && <span className="w-2 h-2 rounded-full bg-accent" />}
                  </span>
                  {t[k.labelKey]}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-12 font-bold text-muted">{t.verifyStepProof}</h3>
            <label className="block">
              <span className="block text-12 text-muted mb-1">{t.verifyLinksLabel}</span>
              <textarea
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                rows={3}
                dir="ltr"
                placeholder="https://x.com/…"
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-14 outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="block text-12 text-muted mb-1">{t.verifyWebsite}</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                dir="ltr"
                placeholder="https://…"
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-14 outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="block text-12 text-muted mb-1">{t.verifySources}</span>
              <textarea
                value={sources}
                onChange={(e) => setSources(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-14 outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="block text-12 text-muted mb-1">{t.verifyReason}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-14 outline-none focus:border-accent"
              />
            </label>
            <Button full disabled={pending || reason.trim().length < 10} onClick={submit}>
              {t.verifySubmit}
            </Button>
          </section>
        </>
      )}

      {/* ===== القواعدُ التي يجب أن تُقرأ قبل الضغط لا بعده ===== */}
      <ul className="text-12 text-muted leading-relaxed space-y-1 px-1">
        <li>· {t.verifyReviewTime}</li>
        <li>· {t.verifyReapply}</li>
        {/* **وقاعدةُ المعرّف تُقال هنا لا تُكتشف لاحقاً**: من غيّر `@`
            يفقد الختم — **وعقوبةٌ لا تُعلَن قبل وقوعها ظلم.** */}
        <li>· {t.verifyRehandle}</li>
      </ul>
    </div>
  );
}
