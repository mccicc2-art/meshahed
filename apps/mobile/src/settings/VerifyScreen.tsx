import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { api, queryClient, write } from "../api";
import type { ToastHostRef } from "../HoldHost";
import type { VerifyBody, VerifyPayload } from "../contracts";
import { SettingsScreen, Group, Field, OptionList, OptionRow, RowsSkeleton } from "./ui";
import { SETTINGS_KEY, messageOf, useOpenWeb } from "./api";

/**
 * ====== التوثيقُ أصليّاً — Phase 11-I · I3 (D-1107) ======
 *
 * 🔑 **`VerifyScreen` الويب بترتيبه**: ما العلامةُ وما ليست («لا تُباع ولا تأتي مع Plus» — حكمُ أحمد) ·
 * حالةُ الحساب أو الطلب · ١) الشروطُ من القاعدة · ٢) الحساباتُ المرتبطة · ٣) النوعُ والإثباتات (لمن
 * يستطيع التقديم وحدَه) · القواعدُ قبل الضغط لا بعده (ومنها: تغييرُ `@` يُسقط الختم).
 *
 * **ربطُ X/فيسبوك بابٌ**: `linkIdentity` تسجيلُ دخولٍ في جلسة الويب (D-932) — الزرّان يفتحان صفحةَ
 * التوثيق نفسَها، والرجوعُ منها يعود هنا (D-1101) فتُعاد القراءةُ (`staleTime` صفر) وتظهر الحساباتُ.
 */
const KEY = ["me:verify"] as const;
const KINDS = [
  { id: "person", key: "verifyKindPerson" },
  { id: "org", key: "verifyKindOrg" },
  { id: "media", key: "verifyKindMedia" },
] as const;

export function VerifyScreen() {
  const { t, tokens, locale } = useApp();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<VerifyPayload>("/api/v1/me/verify")).data, staleTime: 0 });
  const d = q.data;

  const [kind, setKind] = useState<string>("person");
  const seeded = useRef(false);
  useEffect(() => {
    if (d && !seeded.current) {
      seeded.current = true;
      if (d.state.kind) setKind(d.state.kind);
    }
  }, [d]);
  const [links, setLinks] = useState("");
  const [website, setWebsite] = useState("");
  const [sources, setSources] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending) return;
    haptic.pick();
    setPending(true);
    try {
      const body: VerifyBody = { kind, links: links.split(/\s*[\n,]\s*/).filter(Boolean), website, sources, reason };
      const out = await write<VerifyPayload>("/api/v1/me/verify", body);
      queryClient.setQueryData(KEY, out);
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      haptic.success();
      toast.current?.say(t.verifyStatusPending);
    } catch (e) {
      toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.errSaveShort));
    } finally {
      setPending(false);
    }
  }

  if (!d) {
    return (
      <SettingsScreen title={t.verifyTitle}>
        {q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={4} />}
      </SettingsScreen>
    );
  }

  const { eligibility: e, state: s, providers } = d;
  const statusLabel =
    s.status === "pending" ? t.verifyStatusPending
    : s.status === "more_info" ? t.verifyStatusMoreInfo
    : s.status === "approved" ? t.verifyStatusApproved
    : s.status === "rejected" ? t.verifyStatusRejected
    : null;
  const showForm = e.eligible && s.canApply && !e.verified;

  const check = (ok: boolean, label: string, note?: string) => (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
      <View style={{ marginTop: 1, width: 18, height: 18, borderRadius: 9, backgroundColor: ok ? tokens.accent : tokens.surface2, alignItems: "center", justifyContent: "center" }}>
        <Icon name={ok ? "check" : "close"} size={11} color={ok ? tokens.onAccent : tokens.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} muted={!ok}>{label}</Text>
        {note ? <Text size={12} muted style={{ marginTop: 2 }}>{note}</Text> : null}
      </View>
    </View>
  );

  const busyWeb = openWeb.busy === "/profile/settings/verify";

  return (
    <SettingsScreen title={t.verifyTitle} toast={toast}>
      {/* ===== ما هي العلامة، وما ليست ===== */}
      <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="check-line" size={16} color={tokens.verified} />
          <Text size={15} weight="700">{t.verifyTitle}</Text>
        </View>
        <Text size={14} muted style={{ lineHeight: 21 }}>{t.verifySub}</Text>
        <Text size={12} muted style={{ lineHeight: 18 }}>{t.verifyNotSold}</Text>
      </View>

      {/* ===== حالةُ الحساب أو الطلب ===== */}
      {e.verified ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: tokens.accent + "66", backgroundColor: tokens.accent + "1A", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="check-line" size={16} color={tokens.verified} />
          <Text size={14} weight="600">{t.verifyAlready}</Text>
        </View>
      ) : statusLabel ? (
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 14, gap: 6 }}>
          <Text size={14} weight="700">{statusLabel}</Text>
          {s.note ? <Text size={12} muted style={{ lineHeight: 18 }}>{s.note}</Text> : null}
          {s.status === "pending" ? <Text size={12} muted>{t.verifyReviewTime}</Text> : null}
          {s.status === "rejected" && s.nextApplyAt && !s.canApply ? <Text size={12} muted>{t.verifyReapplyAt(new Date(s.nextApplyAt).toLocaleDateString(locale))}</Text> : null}
        </View>
      ) : null}

      {/* ===== ١) الشروط — من القاعدة ===== */}
      {!e.verified ? (
        <View>
          <Group label={t.verifyStepChecks}>
            {check(e.complete, t.verifyChkComplete)}
            {check(e.active, t.verifyChkActive, t.verifyChkActiveN(e.activeDays, e.needDays))}
            {check(e.clean, t.verifyChkClean)}
          </Group>
          {!e.eligible ? <Text size={12} muted style={{ marginTop: 6, paddingHorizontal: 4 }}>{t.verifyNotEligible}</Text> : null}
        </View>
      ) : null}

      {/* ===== ٢) الحساباتُ المرتبطة — البرهان ===== */}
      {!e.verified ? (
        <Group label={t.verifyLinked}>
          <View style={{ padding: 14, gap: 10 }}>
            <Text size={12} muted style={{ lineHeight: 18 }}>{t.verifyLinkHint}</Text>
            {providers.length === 0 ? (
              <Text size={12} muted>{t.verifyLinkedNone}</Text>
            ) : (
              providers.map((p) => (
                <View key={p.provider} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="check" size={13} color={tokens.accent} />
                  <Text size={14} weight="600">{p.provider.charAt(0).toUpperCase() + p.provider.slice(1)}</Text>
                  {p.handle ? <Text size={14} muted numberOfLines={1} style={{ flexShrink: 1, writingDirection: "ltr" }}>{p.handle}</Text> : null}
                </View>
              ))
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button size="sm" variant="ghost" disabled={busyWeb} label={t.verifyLinkX} onPress={() => openWeb("/profile/settings/verify")} />
              <Button size="sm" variant="ghost" disabled={busyWeb} label={t.verifyLinkFacebook} onPress={() => openWeb("/profile/settings/verify")} />
            </View>
          </View>
        </Group>
      ) : null}

      {/* ===== ٣) النوعُ والإثباتات — لمن يستطيع التقديم وحدَه ===== */}
      {showForm ? (
        <>
          <View>
            <Text size={12} weight="600" muted style={{ paddingHorizontal: 4, marginBottom: 6 }}>{t.verifyStepKind}</Text>
            <OptionList>
              {KINDS.map((k) => (
                <OptionRow key={k.id} selected={kind === k.id} title={t[k.key]} onSelect={() => { haptic.pick(); setKind(k.id); }} />
              ))}
            </OptionList>
          </View>
          <Group label={t.verifyStepProof}>
            <Field label={t.verifyLinksLabel} value={links} onChange={setLinks} multiline lines={3} ltr placeholder="https://x.com/…" />
            <Field label={t.verifyWebsite} value={website} onChange={setWebsite} ltr placeholder="https://…" />
            <Field label={t.verifySources} value={sources} onChange={setSources} multiline lines={2} maxLength={600} />
            <Field label={t.verifyReason} value={reason} onChange={setReason} multiline lines={3} maxLength={600} />
          </Group>
          <Button label={t.verifySubmit} busy={pending} disabled={reason.trim().length < 10} onPress={() => void submit()} />
        </>
      ) : null}

      {/* ===== القواعدُ قبل الضغط لا بعده ===== */}
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        {[t.verifyReviewTime, t.verifyReapply, t.verifyRehandle].map((line) => (
          <Text key={line} size={12} muted style={{ lineHeight: 18 }}>{`· ${line}`}</Text>
        ))}
      </View>
    </SettingsScreen>
  );
}
