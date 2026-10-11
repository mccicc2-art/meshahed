import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Group, Row, Field, RowsSkeleton, Chevron } from "./ui";
import { messageOf, useOpenWeb } from "./api";
import { PartnerDashboard } from "./PartnerDashboard";
import type { ToastHostRef } from "../HoldHost";
import { formatDate } from "@/core/when";
import type { MyPartnerPayload, PartnerApplicationFields, PartnerApplyBody } from "@/core/contracts/profile";

/**
 * ====== تبويبُ «Loopz Partners» أصليّاً — الدفعةُ ١ (🆕 D-1361 · Phase 11-V · V-C · C7 — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «الشركاء الآن» ثمّ «نفذ»** بعد صورةٍ للحالات الأربع. هذه الدفعةُ ثلاثٌ منها، بترتيب `PartnersTab` في الويب (نموذجُه،
 * D-770/D-855): **قبل التقديم** (بطاقةُ «شارك القصص» · شريطُ ٢٥٪/سنة/١٠٠ · «كيف يعمل» · «من يمكنه التقديم؟») · **النموذج**
 * (تقديمٌ أوّل · تعديلُ طلبٍ قيد المراجعة · إعادةُ تقديمٍ بعد الرفض) · **قيد المراجعة** (تعديلٌ وسحب).
 *  - 🔑 **شرطا التقديم يُعرضان مكانَ النموذج لمن لم يستوفِهما** (حجّةُ الصفحة: نموذجٌ يُملأ ثمّ يُرفض عند الباب إهدار)، وكلُّ شرطٍ
 *    ناقصٍ بابٌ إلى إكماله: توثيقُ X شاشةٌ أصليّة (`settings/verify`)، وبلس صفحتُه الويبيّة (باقيةٌ بقرار ٤ في خطّة 11-V).
 *  - 🆕 D-1362 (الدفعة ٢) — **ولوحةُ الموافَق عليه أصليّة** (`PartnerDashboard`: الأرباحُ · بياناتُ التحويل · الهويّة) — كانت الحبّةُ
 *    تفتح له لوحةَ الويب، وهي آخرُ ما بقي من هذا التبويب خارج التطبيق.
 *  - الموافقةُ على الشروط تُعاد مع كلِّ إرسال (خانةُ الويب لا تُحفظ)، والزرُّ معطَّلٌ حتى تُملأ الحقولُ المطلوبة وتُؤشَّر.
 */
const EMPTY: PartnerApplicationFields = { channelUrl: "", contentType: "", platforms: "", followersRange: "", country: "", contentLanguage: "", reason: "" };

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { tokens } = useApp();
  return <View style={[{ borderRadius: radius.card, backgroundColor: tokens.surface, overflow: "hidden" }, style]}>{children}</View>;
}

/** علامةُ «مستوفى» — دائرةٌ بحدِّ التمييز وصحّ (نموذجُ الصفحة) */
function Done() {
  const { tokens } = useApp();
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
      <Icon name="check" size={11} color={tokens.accent} />
    </View>
  );
}

/** سطرٌ مطويٌّ يفتح ما تحته في مكانه (`<details>` في الويب) */
function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 4 }}>
        <Text size={14} weight="600" muted>{label}</Text>
        <Chevron open={open} />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

function TermsCard() {
  const { t, tokens } = useApp();
  return (
    <Group label={t.prtTermsTitle}>
      {[t.prtTermRate, t.prtTermDirect, t.prtTermHold, t.prtTermMin, t.prtTermNature].map((line) => (
        <View key={line} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}>
          <Icon name="shield" size={15} color={tokens.accent} />
          <Text size={14} style={{ flex: 1, lineHeight: 22 }}>{line}</Text>
        </View>
      ))}
      {/* الصدقُ في وجه الصفحة: لا مالَ قبل فتح الاشتراكات */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}>
        <Icon name="clock" size={15} color={tokens.muted} />
        <Text size={14} muted style={{ flex: 1, lineHeight: 22 }}>{t.prtMoneyLater}</Text>
      </View>
    </Group>
  );
}

/** شرطا التقديم (D-855): المستوفى صفٌّ ساكنٌ بعلامة صحّ، والناقصُ بابٌ إلى إكماله */
function Requirements({ x, plus }: { x: boolean; plus: boolean }) {
  const { t } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  return (
    <View style={{ gap: 10 }}>
      <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.prtReqTitle}</Text>
      <Group>
        <Row icon="person-check" title={t.prtReqX} subtitle={x ? undefined : t.prtReqGo} onPress={x ? undefined : () => router.push({ pathname: "/settings/[section]", params: { section: "verify" } })} trailing={x ? <Done /> : undefined} />
        <Row icon="sparkle-star" title={t.prtReqPlus} subtitle={plus ? undefined : t.prtReqGo} onPress={plus ? undefined : () => openWeb("/plus")} busy={openWeb.busy === "/plus"} trailing={plus ? <Done /> : undefined} />
      </Group>
    </View>
  );
}

export function PartnersTab({ q, form, setForm, toast }: { q: UseQueryResult<MyPartnerPayload>; form: boolean; setForm: (v: boolean) => void; toast: React.RefObject<ToastHostRef | null> }) {
  const { t, tokens } = useApp();
  const d = q.data;
  const [f, setF] = useState<PartnerApplicationFields>(EMPTY);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState<"submit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* النموذجُ يُفتح على ما أُرسل آخرَ مرّة (تعديلٌ أو إعادةُ تقديم) — والموافقةُ تُعاد كلَّ مرّة */
  const app = d?.application ?? null;
  const showForm = !!d && (d.status === "rejected" || (form && d.status !== "approved"));
  useEffect(() => {
    if (!showForm) return;
    setF(app ?? EMPTY);
    setTerms(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  if (!d) {
    return q.isError ? (
      <View style={{ alignItems: "center", gap: 12, paddingTop: 48 }}>
        <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
        <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
      </View>
    ) : (
      <>
        <View style={{ height: 220, borderRadius: radius.card, backgroundColor: tokens.surface }} />
        <RowsSkeleton rows={3} />
      </>
    );
  }
  /* الموافَقُ عليه: لوحتُه (D-1362). `dashboard` غائبٌ = خادمٌ أقدمُ من هذه النسخة (دقائقُ النشر) أو موافَقٌ بلا كود — يُعاد السؤال */
  if (d.status === "approved") {
    return d.dashboard ? (
      <PartnerDashboard
        d={d.dashboard}
        xDone={d.requirements.x}
        refetch={q.refetch}
        toast={toast}
        disclosure={(label, children) => <Disclosure label={label}>{children}</Disclosure>}
        terms={<TermsCard />}
      />
    ) : (
      <View style={{ alignItems: "center", gap: 12, paddingTop: 48 }}>
        <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
        <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
      </View>
    );
  }

  const eligible = d.requirements.x && d.requirements.plus;
  const dict = t as unknown as Record<string, unknown>;
  const set = (k: keyof PartnerApplicationFields) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const ready = !!(f.channelUrl.trim() && f.contentType.trim() && f.platforms.trim() && f.country.trim() && f.contentLanguage.trim() && terms);

  const submit = async () => {
    if (busy || !ready) return;
    haptic.pick();
    setBusy("submit");
    setError(null);
    try {
      await api<{ done: boolean }>("/api/v1/me/partner/apply", { method: "POST", body: { ...f, terms: true } satisfies PartnerApplyBody });
      await q.refetch();
      setForm(false);
    } catch (e) {
      setError(messageOf(e, dict, t.apiPartnerSubmit));
    } finally {
      setBusy(null);
    }
  };
  const withdraw = async () => {
    if (busy) return;
    haptic.pick();
    setBusy("withdraw");
    try {
      await api<{ done: boolean }>("/api/v1/me/partner/withdraw", { method: "POST", body: {} });
      await q.refetch();
    } catch (e) {
      setError(messageOf(e, dict, t.apiInternal));
    } finally {
      setBusy(null);
    }
  };

  /* ———— قيد المراجعة ———— */
  if (d.status === "pending" && !showForm) {
    return (
      <>
        <Card style={{ padding: 20, alignItems: "center" }}>
          <Icon name="hourglass" size={26} color={tokens.accent} />
          <Text size={15} weight="700" style={{ marginTop: 8, textAlign: "center" }}>{t.prtUnderReview}</Text>
          <Text size={14} muted style={{ marginTop: 4, textAlign: "center" }}>{t.prtReviewBody}</Text>
          {d.applied_at ? <Text size={12} muted style={{ marginTop: 4, textAlign: "center" }}>{t.prtAppliedAt(formatDate(d.applied_at, t))}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 14 }}>
            <Button size="sm" variant="ghost" label={t.prtEdit} disabled={!!busy} onPress={() => { haptic.pick(); setForm(true); }} />
            <Button size="sm" variant="ghost" label={t.prtCancelApp} busy={busy === "withdraw"} onPress={() => void withdraw()} />
          </View>
          {error ? <Text size={12} color={tokens.error} style={{ marginTop: 10, textAlign: "center" }}>{error}</Text> : null}
        </Card>
        <Disclosure label={t.prtTermsLink}><TermsCard /></Disclosure>
      </>
    );
  }

  /* ———— النموذج: تقديمٌ أوّل · تعديل · بعد الرفض ———— */
  if (showForm) {
    if (!eligible) {
      return (
        <>
          <Requirements x={d.requirements.x} plus={d.requirements.plus} />
          <Disclosure label={t.prtTermsLink}><TermsCard /></Disclosure>
        </>
      );
    }
    return (
      <>
        {d.status === "rejected" ? (
          <Card style={{ padding: 16, alignItems: "center" }}>
            <Icon name="info" size={24} color={tokens.muted} />
            <Text size={15} weight="700" style={{ marginTop: 8, textAlign: "center" }}>{t.prtRejectedTitle}</Text>
            <Text size={14} muted style={{ marginTop: 4, textAlign: "center" }}>{t.prtRejectedBody}</Text>
          </Card>
        ) : null}
        <Group label={t.prtApplyTitle}>
          <Field label={t.prtFieldChannel} value={f.channelUrl} onChange={set("channelUrl")} maxLength={300} ltr placeholder="https://" />
          <Field label={t.prtFieldContent} value={f.contentType} onChange={set("contentType")} maxLength={120} />
          <Field label={t.prtFieldPlatforms} value={f.platforms} onChange={set("platforms")} maxLength={200} />
          <Field label={t.prtFieldFollowers} value={f.followersRange} onChange={set("followersRange")} maxLength={40} />
          <Field label={t.prtFieldCountry} value={f.country} onChange={set("country")} maxLength={60} />
          <Field label={t.prtFieldLanguage} value={f.contentLanguage} onChange={set("contentLanguage")} maxLength={60} />
          <Field label={t.prtFieldReason} value={f.reason} onChange={set("reason")} maxLength={600} multiline lines={3} />
          <View style={{ padding: 14, gap: 14 }}>
            <Pressable onPress={() => { haptic.pick(); setTerms((v) => !v); }} accessibilityRole="checkbox" accessibilityState={{ checked: terms }} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: terms ? tokens.accent : tokens.muted, backgroundColor: terms ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                {terms ? <Icon name="check" size={12} color={tokens.onAccent} /> : null}
              </View>
              <Text size={14} style={{ flex: 1 }}>{t.prtTermsAgree}</Text>
            </Pressable>
            {error ? <Text size={13} color={tokens.error} style={{ lineHeight: 20 }}>{error}</Text> : null}
            <Button label={t.prtSubmit} disabled={!ready} busy={busy === "submit"} onPress={() => void submit()} />
          </View>
        </Group>
        <TermsCard />
      </>
    );
  }

  /* ———— قبل التقديم: وجهُ البرنامج (نموذجُه) ———— */
  const apply = eligible ? <Button label={t.prtApplyJoin} onPress={() => { haptic.pick(); setForm(true); }} /> : null;
  const facts: [string, string][] = [
    [t.prtValRate, t.prtStatCommission],
    [t.prtValPeriod, t.prtStatPeriod],
    [t.prtValMin, t.prtStatMin],
  ];
  const steps: [number, string, string][] = [
    [1, t.prtStep1, t.prtStep1Sub],
    [2, t.prtStep2, t.prtStep2Sub],
    [3, t.prtStep3, t.prtStep3Sub],
  ];
  return (
    <>
      <Card style={{ padding: 22, alignItems: "center" }}>
        <Icon name="people" size={40} color={tokens.accent} />
        <Text size={24} weight="800" style={{ marginTop: 12, textAlign: "center", lineHeight: 34 }}>{t.prtHeroTitle1}</Text>
        <Text size={24} weight="800" style={{ textAlign: "center", lineHeight: 34 }}>{t.prtHeroTitle2}</Text>
        <Text size={14} muted style={{ marginTop: 8, textAlign: "center", lineHeight: 23 }}>{t.prtHeroBody}</Text>
        {apply ? <View style={{ alignSelf: "stretch", marginTop: 16 }}>{apply}</View> : null}
      </Card>

      {eligible ? null : <Requirements x={d.requirements.x} plus={d.requirements.plus} />}

      <Card style={{ flexDirection: "row" }}>
        {facts.map(([v, label], i) => (
          <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, borderStartWidth: i > 0 ? 1 : 0, borderStartColor: tokens.divider }}>
            <Text size={20} weight="800" color={tokens.accent} numberOfLines={1}>{v}</Text>
            <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </Card>

      <View style={{ gap: 10 }}>
        <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.prtHowTitle}</Text>
        <Card>
          {steps.map(([n, title, sub], i) => (
            <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                <Text size={14} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{String(n)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} weight="700">{title}</Text>
                <Text size={12} muted style={{ marginTop: 2 }}>{sub}</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.prtWhoTitle}</Text>
        <Card>
          <View style={{ padding: 14 }}><Text size={14} weight="700">{t.prtWhoHead}</Text></View>
          {[t.prtWho1, t.prtWho2, t.prtWho3].map((line) => (
            <View key={line} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: tokens.divider }}>
              <Done />
              <Text size={14} style={{ flex: 1 }}>{line}</Text>
            </View>
          ))}
        </Card>
      </View>

      {apply}

      <Disclosure label={t.prtTermsLink}><TermsCard /></Disclosure>

      <Text size={12} muted style={{ textAlign: "center" }}>{t.prtReviewNote}</Text>
    </>
  );
}
