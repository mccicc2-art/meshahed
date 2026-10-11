import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { api } from "../api";
import { CONFIG } from "../config";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import type { ToastHostRef } from "../HoldHost";
import { Group, Row, Field } from "./ui";
import { messageOf } from "./api";
import { LinkCard } from "./LinkCard";
import { formatDate } from "@/core/when";
import type { PartnerDashboard as Dash, PartnerDetailsBody, PartnerIdStartBody, PartnerIdStartPayload, PartnerPayout } from "@/core/contracts/profile";

/**
 * ====== لوحةُ الشريك أصليّةً — الدفعةُ ٢ (🆕 D-1362 · Phase 11-V · V-C · C7 — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **أمرُ أحمد: «نفذ الدفعة الثانية»**. أقسامُ لوحة الويب بترتيبها (نموذجُه الثالث، D-770c · D-858 · D-901): استكمالُ البيانات في
 * رأسها ما دام فيها نقص · الأرباحُ المتاحة وزرُّ التحويل · طلباتُ التحويل · رابطُ الشريك · العدّاداتُ الأربعة · «عمولتك» · حركةُ
 * الأرباح · «بيانات التحويل» مطويّةً بعد الاكتمال · «شروط الشركاء».
 *  - 🔑 **الأرقامُ تُقرأ ولا تُثبَّت**: الرصيدُ صفرٌ **بالواقع** حتى يُفتح الدفع، والزرُّ يقول «بانتظار الربط» ما دام صفراً ويصير
 *    طلباً حقيقيّاً من نفسه حين يبلغ الحدّ (D-901) — والحارسُ في جسم `request_payout` لا هنا.
 *  - 🔑 **وثيقةُ الهويّة تصعد إلى المخزن مباشرةً** برابطٍ موقَّعٍ من الخادم (`…/partner/id`) ثمّ تُثبَّت (`…/id/confirm`): جسمُ الخادم
 *    يقف عند ٤٫٥MB والحدُّ ٨. **من الصور** تُحوَّل JPEG (صورُ iOS بصيغة HEIC يرفضها المخزن)، **ومن الملفات** صورةٌ أو PDF كما هي.
 *  - ⚖️ **«اشتركوا» صفرٌ حقيقيّ**: `subscribed_at` لا يكتبه شيءٌ قبل قناة الاشتراك (حجّةُ الصفحة).
 *  - الأرقامُ لاتينيّةٌ كبقيّة الشاشة؛ والمبلغُ بخانتين.
 */
const MIN_PAYOUT = 100;
const ID_MAX_BYTES = 8 * 1024 * 1024;
const ID_MAX_EDGE = 2400;
const ID_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { tokens } = useApp();
  return <View style={[{ borderRadius: radius.card, backgroundColor: tokens.surface, overflow: "hidden" }, style]}>{children}</View>;
}

function Done() {
  const { tokens } = useApp();
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
      <Icon name="check" size={11} color={tokens.accent} />
    </View>
  );
}

type Picked = { uri: string; type: string };
/* iOS لا يعرض منتقياً فوق ورقةٍ ما زالت تنزل (العرضُ الثاني يُهمَل بصمت) — يُنتظر نزولُها. أندرويد لا يحتاج */
const sheetGone = () => (Platform.OS === "ios" ? new Promise<void>((r) => setTimeout(r, 450)) : Promise.resolve());

export function PartnerDashboard({
  d,
  xDone,
  refetch,
  toast,
  disclosure,
  terms,
}: {
  d: Dash;
  xDone: boolean;
  refetch: () => Promise<unknown>;
  toast: React.RefObject<ToastHostRef | null>;
  /** السطرُ المطويُّ وبطاقةُ الشروط من `PartnersTab` — نسخةٌ واحدةٌ منهما في التبويب كلِّه */
  disclosure: (label: string, children: React.ReactNode) => React.ReactNode;
  terms: React.ReactNode;
}) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const dict = t as unknown as Record<string, unknown>;
  const [f, setF] = useState<PartnerDetailsBody>({ iban: d.details.iban, bankName: d.details.bank_name, accountName: d.details.account_name, phone: d.details.phone });
  const [busy, setBusy] = useState<"save" | "payout" | "id" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [picking, setPicking] = useState(false);
  /* المحفوظُ يعود من الخادم مطبَّعاً (آيبانٌ بلا فراغات · جوالٌ دوليّ) — الحقولُ تأخذه بعد كلِّ حفظٍ ناجح */
  useEffect(() => {
    setF({ iban: d.details.iban, bankName: d.details.bank_name, accountName: d.details.account_name, phone: d.details.phone });
  }, [d.details.iban, d.details.bank_name, d.details.account_name, d.details.phone]);

  const bankDone = !!(d.details.iban && d.details.bank_name && d.details.account_name);
  const setupDone = xDone && bankDone && !!d.details.phone && d.details.id_uploaded;
  const canRequest = d.available >= MIN_PAYOUT && !d.has_pending_payout;
  const conv = d.clicks > 0 ? Math.round((d.joined / d.clicks) * 100) : 0;
  const ready = !!(f.iban.trim() && f.bankName.trim() && f.accountName.trim() && f.phone.trim());
  const set = (k: keyof PartnerDetailsBody) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (busy || !ready) return;
    haptic.pick();
    setBusy("save");
    setFormError(null);
    try {
      await api<{ done: boolean }>("/api/v1/me/partner/details", { method: "POST", body: f });
      await refetch();
      toast.current?.say(t.prtDetailsSaved, undefined, undefined, "success");
    } catch (e) {
      setFormError(messageOf(e, dict, t.apiPartnerSave));
    } finally {
      setBusy(null);
    }
  };

  const requestPayout = async () => {
    if (busy || !canRequest) return;
    haptic.pick();
    setBusy("payout");
    setPayError(null);
    try {
      /* الرصيدُ كلُّه كما في الويب — والخادمُ يعيد فحصَه على رصيده هو لا على هذا الرقم */
      await api<{ done: boolean }>("/api/v1/me/partner/payout", { method: "POST", body: { amount: d.available } });
      await refetch();
      setPaid(true);
    } catch (e) {
      setPayError(messageOf(e, dict, t.apiInternal));
    } finally {
      setBusy(null);
    }
  };

  /** الملفُّ ← رابطٌ موقَّع ← المخزن ← تثبيتُ المسار. أيُّ حلقةٍ تنقطع تُبقي الوثيقةَ السابقة كما هي */
  const upload = async (picked: Picked) => {
    setBusy("id");
    setIdError(null);
    try {
      if (!ID_TYPES.includes(picked.type)) return setIdError(t.prtIdErrType);
      const file = new File(picked.uri);
      const size = file.size ?? 0;
      if (size > ID_MAX_BYTES) return setIdError(t.prtIdErrSize);
      const start = (await api<PartnerIdStartPayload>("/api/v1/me/partner/id", { method: "POST", body: { type: picked.type, size } satisfies PartnerIdStartBody })).data;
      /* الرابطُ الموقَّعُ إذنُه في رمزه؛ والمفتاحُ المنشورُ (عامٌّ بطبيعته — رأسُ `config.ts`) يُرفق لمخزن المشروع وحدَه احتياطاً لبوّابته */
      const headers: Record<string, string> = { "content-type": picked.type };
      if (CONFIG.supabaseUrl && CONFIG.supabasePublishableKey && start.upload_url.startsWith(CONFIG.supabaseUrl)) headers.apikey = CONFIG.supabasePublishableKey;
      const res = await fetch(start.upload_url, { method: "PUT", headers, body: new Uint8Array(await file.arrayBuffer()) });
      if (!res.ok) return setIdError(res.status === 413 ? t.prtIdErrSize : t.apiPartnerIdUpload);
      await api<{ done: boolean }>("/api/v1/me/partner/id/confirm", { method: "POST", body: { path: start.path } });
      await refetch();
    } catch (e) {
      setIdError(messageOf(e, dict, t.apiPartnerIdUpload));
    } finally {
      setBusy(null);
    }
  };

  const fromPhotos = async () => {
    setPicking(false);
    if (busy) return;
    try {
      await sheetGone();
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      setBusy("id");
      setIdError(null);
      /* دائماً JPEG: يوحّد صيغَ الهاتف (HEIC) على ما يقبله المخزن، ويُبقي الوثيقةَ مقروءةً (حافّةٌ ٢٤٠٠) تحت الحدّ بكثير */
      const ctx = ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width || 0, a.height || 0) > ID_MAX_EDGE) ctx.resize(a.width >= a.height ? { width: ID_MAX_EDGE } : { height: ID_MAX_EDGE });
      const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      await upload({ uri: img.uri, type: "image/jpeg" });
    } catch {
      setBusy(null);
      setIdError(t.apiPartnerIdUpload);
    }
  };

  const fromFiles = async () => {
    setPicking(false);
    if (busy) return;
    try {
      await sheetGone();
      /* تحميلٌ عند الحاجة: منتقي الملفّات لا يُحمَّل مع الشاشة لمن لا يرفع وثيقة */
      const DocumentPicker = await import("expo-document-picker");
      const r = await DocumentPicker.getDocumentAsync({ type: ID_TYPES, copyToCacheDirectory: true, multiple: false });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      await upload({ uri: a.uri, type: a.mimeType ?? "" });
    } catch {
      setBusy(null);
      setIdError(t.apiPartnerIdUpload);
    }
  };

  const payoutChip = (s: PartnerPayout["status"]): { label: string; bg: string; fg: string } =>
    s === "paid"
      ? { label: t.prtPayoutStPaid, bg: `${tokens.success}26`, fg: tokens.success }
      : s === "rejected"
        ? { label: t.prtPayoutStRejected, bg: tokens.surface2, fg: tokens.muted }
        : { label: s === "approved" ? t.prtPayoutStApproved : t.prtPayoutStPending, bg: `${tokens.accent}26`, fg: tokens.accent };

  /* كتلةُ الاستكمال — قطعةٌ واحدةٌ لموضعيها (رأسُ اللوحة ما دام فيها نقص · خلف «بيانات التحويل» بعد الاكتمال): D-858 */
  const setup = (
    <View style={{ gap: 12 }}>
      <Group>
        <Row icon="person-check" title={t.prtReqX} onPress={xDone ? undefined : () => router.push({ pathname: "/settings/[section]", params: { section: "verify" } })} trailing={xDone ? <Done /> : undefined} />
        <Row
          icon="shield"
          title={t.prtRowId}
          subtitle={idError ?? (busy === "id" ? t.prtIdBusy : d.details.id_uploaded ? t.prtIdDone : t.prtIdPick)}
          onPress={busy ? undefined : () => { haptic.pick(); setPicking(true); }}
          busy={busy === "id"}
          trailing={d.details.id_uploaded && busy !== "id" && !idError ? <Done /> : undefined}
        />
      </Group>
      <Group>
        <Field label={t.prtBankIban} value={f.iban} onChange={set("iban")} maxLength={34} ltr placeholder="SA0380000000608010167519" />
        <Field label={t.prtBankName} value={f.bankName} onChange={set("bankName")} maxLength={60} />
        <Field label={t.prtBankHolder} value={f.accountName} onChange={set("accountName")} maxLength={80} />
        <Field label={t.prtPhoneField} value={f.phone} onChange={set("phone")} maxLength={20} ltr placeholder="05xxxxxxxx" />
        <View style={{ padding: 14, gap: 12 }}>
          {formError ? <Text size={13} color={tokens.error} style={{ lineHeight: 20 }}>{formError}</Text> : null}
          <Button label={t.prtSaveDetails} disabled={!ready} busy={busy === "save"} onPress={() => void save()} />
        </View>
      </Group>
    </View>
  );

  const stats: [number, string, string][] = [
    [d.clicks, t.prtStatClicks, ""],
    [d.joined, t.prtStatJoined, ""],
    [0, t.prtStatPaid, ""],
    [conv, t.prtStatConv, "%"],
  ];
  const chips: [IconName, string][] = [
    ["people", t.prtChipDirect],
    ["calendar", t.prtChipHold],
    ["chart", t.prtChipNet],
  ];

  return (
    <>
      {setupDone ? null : (
        <View style={{ gap: 10 }}>
          <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.prtSetupTitle}</Text>
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 19 }}>{t.prtSetupBody}</Text>
          {setup}
        </View>
      )}

      {/* الأرباحُ المتاحة — المبلغُ بلون الهويّة والتحويلُ في الطرف */}
      <Card style={{ padding: 16 }}>
        <Text size={12} weight="600" muted>{t.prtEarnLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <Text size={30} weight="800">{t.prtCurrency}</Text>
          <Text size={30} weight="800" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{money(d.available)}</Text>
        </View>
        <Text size={14} muted style={{ marginTop: 2 }}>{`${t.prtCurrency} ${money(d.pending)} ${t.prtPendingSuffix}`}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
          <Text size={12} muted style={{ flex: 1 }}>{t.prtMinPayout}</Text>
          {/* ثلاثُ حالاتٍ صادقة (D-901): صفرٌ = «بانتظار الربط» · دون الحدّ أو طلبٌ معلَّق = «سحب» معطَّل · بلغ الحدّ = طلبٌ حقيقيّ */}
          <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: tokens.accent, opacity: canRequest ? 1 : 0.5 }}>
            <Button
              size="sm"
              variant="ghost"
              label={canRequest ? t.prtRequestPayout : d.available === 0 && !d.has_pending_payout ? t.prtAwaitingLink : t.prtWithdraw}
              disabled={!canRequest}
              busy={busy === "payout"}
              onPress={() => void requestPayout()}
            />
          </View>
        </View>
        {payError ? <Text size={12} color={tokens.error} style={{ marginTop: 8 }}>{payError}</Text> : null}
        {paid && !payError ? <Text size={12} color={tokens.success} style={{ marginTop: 8 }}>{t.prtPayoutOk}</Text> : null}
      </Card>

      {/* طلباتُ التحويل — تظهر حين يكون لها صفٌّ واحدٌ على الأقلّ (فراغُها اليوم حقيقيّ) */}
      {d.payouts.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.prtPayoutsListTitle}</Text>
          <Card>
            {d.payouts.map((r, i) => {
              const chip = payoutChip(r.status);
              const when = r.requested_at ? formatDate(r.requested_at, t) : "";
              return (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{`${t.prtCurrency} ${money(r.amount)}`}</Text>
                    <Text size={12} muted>{[when, r.note].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <View style={{ borderRadius: radius.pill, backgroundColor: chip.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text size={12} weight="700" color={chip.fg}>{chip.label}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Text size={12} weight="600" muted style={{ paddingHorizontal: 4, marginBottom: -4 }}>{t.prtYourLink}</Text>
        <LinkCard url={d.url} toast={toast} />
      </View>

      {/* الأرقامُ الأربعة — نقرات · انضمّوا · اشتركوا · التحويل */}
      <Card style={{ flexDirection: "row" }}>
        {stats.map(([n, label, unit], i) => (
          <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, borderStartWidth: i > 0 ? 1 : 0, borderStartColor: tokens.divider }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, direction: "ltr" }}>
              <Text size={22} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{n.toLocaleString("en-US")}</Text>
              {unit ? <Text size={12} weight="700" muted>{unit}</Text> : null}
            </View>
            <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </Card>

      {/* عمولتك — ٢٥٪ (D-781) وثلاثُ رقائقِ شروطٍ مصغّرة */}
      <Card style={{ padding: 16 }}>
        <Text size={15} weight="700">{t.prtCommTitle}</Text>
        <Text size={30} weight="800" color={tokens.accent} style={{ marginTop: 4 }}>{t.prtValRate}</Text>
        <Text size={14} muted style={{ marginTop: 4, lineHeight: 22 }}>{t.prtCommBody}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
          {chips.map(([icon, label], i) => (
            <View key={icon} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4, borderStartWidth: i > 0 ? 1 : 0, borderStartColor: tokens.divider }}>
              <Icon name={icon} size={15} color={tokens.muted} />
              <Text size={12} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* حركةُ الأرباح — فارغةٌ بحقٍّ حتى يُفتح الدفع */}
      <View style={{ gap: 10 }}>
        <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.prtActivityTitle}</Text>
        <Card style={{ padding: 24, alignItems: "center" }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            <Icon name="card" size={24} color={tokens.accent} />
          </View>
          <Text size={15} weight="700" style={{ marginTop: 12, textAlign: "center" }}>{t.prtNoEarnTitle}</Text>
          <Text size={14} muted style={{ marginTop: 4, textAlign: "center" }}>{t.prtNoEarnBody}</Text>
        </Card>
      </View>

      {setupDone ? disclosure(t.prtDetailsTitle, setup) : null}
      {disclosure(t.prtTermsLink, terms)}

      {picking ? (
        <Sheet title={t.prtRowId} onClose={() => setPicking(false)}>
          <Group>
            <Row icon="image" title={t.prtIdFromPhotos} onPress={() => void fromPhotos()} />
            <Row icon="list" title={t.prtIdFromFiles} subtitle={t.prtIdPick} onPress={() => void fromFiles()} />
          </Group>
        </Sheet>
      ) : null}
    </>
  );
}
