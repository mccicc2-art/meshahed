import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { radius, space } from "../theme";
import { Avatar } from "../community/CommunityCards";
import { IdentityBadges } from "../IdentityBadges";
import { Field, Group } from "../settings/ui";
import { pendingInvite } from "../invite/pending";
import { cleanInviteCode, inviteCodeFromText } from "@/core/storeLinks";
import type {
  ClaimReferralBody,
  ClaimReferralPayload,
  InviterLite,
  MyReferralPayload,
  ReferralPreviewPayload,
} from "@/core/contracts/referral";

/**
 * ====== 🆕 «هل دعاك أحمد؟» — في الخطوة الأولى من الترحيب (المهمة ٣٧٠، قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ») ======
 *
 * 🔴 **العلّة**: النسبةُ كانت في ردهة دخول الويب وحدَها، فلم تُنسب دعوةُ عضوٍ سجّل من التطبيق قطّ.
 * 🔑 **لماذا هنا لا بعد الترحيب**: `claim_referral` ترفض حساباً تابع عملاً واحداً (العضوُ القديمُ ليس مدعوّاً جاء بالرابط)،
 * والأعمالُ تُكتب في آخر ضغطةٍ من الترحيب — **فالخطوةُ الأولى آخرُ موضعٍ تُقبل فيه النسبة**.
 *
 * الحالاتُ الأربع:
 *  - **سؤالٌ بالاسم** («هل دعاك أحمد؟» نعم/لا) — حين جاء كودٌ من زرّ «افتح الدعوة في التطبيق» (`invite/pending.ts`)، أو بعد أن
 *    يختار العضوُ شخصاً من البحث.
 *  - **سطرُ «هل دعاك أحدٌ إلى Loopz؟»** — لمن ذهب إلى المتجر مباشرةً (iPhone لا يمرّر مصدرَ التثبيت): يفتح ورقةَ البحث بالاسم.
 *  - **«دعاك أحمد»** — بعد النعم، أو لمن نُسب في الويب (كوكي الرابط). وسطرُ الهديّة لدعوة الصديق وحدَها (الشريكُ بلا هديّة).
 *  - **لا شيء** — حسابٌ لا يقبل نسبةً (قديمٌ، أو تابع، أو نُسب) ولا داعيَ له.
 *  - 🆕 المهمة ٣٩٤ — **كودُ الحملة (`source: "campaign"`) يُنسب بلا سؤال ولا بطاقة**: لا يصل الكودُ إلى التطبيق إلّا من رابطنا،
 *    فسؤالُ «هل دعاك Loopz؟» لا يضيف شيئاً — و«لا» تُسقط العضوَ من عدّ الحملة. وفشلُ الشبكة يُبقي الكودَ لمحاولةٍ تالية.
 * ⚖️ **ليست خطوةً سادسة ولا قفلاً**: «التالي» يمضي بلا جواب، والسؤالُ صفٌّ تحت بطاقة «هذا أنت».
 *
 * 🆕 **المهمة ٤٢٨ — الكودُ وحدَه يَنسب، والبحثُ بالاسم أُلغي** (أحمد ١٨ نوفمبر: «اذا خليته يختار الشخص يسير فيه تلاعب»، ثمّ «اجل سوي ب»):
 *  - الاسمُ ليس دليلَ دعوة؛ الكودُ لا يصل إلّا ممّن أرسل الرابط. وصفحةُ الدعوة تنسخ الرابطَ إلى الحافظة لحظةَ الضغط على المتجر.
 *  - **iPhone: زرُّ «لصق» من Apple** (`ClipboardPasteButton` = `UIPasteControl`) — ضغطتُه إذنٌ فلا يظهر سؤالُ «السماح باللصق».
 *    ولا نقرأ الحافظةَ بأنفسنا هناك أبداً (كلُّ قراءةٍ بلا تلك الضغطة تُظهر السؤال). يظهر الزرُّ لمن في حافظته نصٌّ فقط —
 *    `hasStringAsync` يجيب «نعم/لا» بلا سؤال ولا يكشف النصّ.
 *  - **أندرويد: قراءةٌ وحدَها مرّةً عند الظهور** (النظامُ لا يسأل، ويُظهر إشعاراً صغيراً)، فإن كان فيها رابطُ دعوةٍ ظهر «هل دعاك
 *    أحمد؟» مباشرةً. وزرُّ «لصق» عاديٌّ لمن نسخ بعد ذلك.
 *  - **وحقلُ الكود** لمن رفض اللصق أو جاءه الكودُ مكتوباً (أكوادُ الشركاء).
 */
type State =
  | { kind: "none" }
  | { kind: "ask" }
  | { kind: "confirm"; who: InviterLite; by: ClaimReferralBody }
  | { kind: "done"; who: InviterLite | null; gift: boolean };

/** ما كتبه العضو أو لصقه في الحقل: رابطُ دعوةٍ كامل أو الكودُ وحدَه */
const typedCode = (raw: string) => inviteCodeFromText(raw, true) ?? cleanInviteCode(raw);

/** 🆕 المهمة ٣٩٤ — نسبةُ كود الحملة بلا سؤال. فشلُ الشبكة يُبقي الكودَ في `pendingInvite` ليُعاد عند الظهور التالي */
async function claimCampaign(code: string): Promise<void> {
  try {
    await api<ClaimReferralPayload>("/api/v1/me/referral", { method: "POST", body: { code } });
    await pendingInvite.clear();
  } catch {
    /* يُعاد لاحقاً */
  }
}

export function InviteCard() {
  const { t, tokens } = useApp();
  const [state, setState] = useState<State>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  /* iPhone: زرُّ Apple يظهر لمن في حافظته نصٌّ فقط — «نعم/لا» بلا قراءة */
  const [canPaste, setCanPaste] = useState(false);
  const autoRead = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  /**
   * 🆕 المهمة ٤٢٨ — كودٌ جاء من الحافظة أو الحقل: من صاحبُه؟ داعٍ ⇒ «هل دعاك فلان؟»؛ كودُ الحملة ⇒ يُنسب بلا سؤال؛ لا أحد ⇒
   * `quiet` (القراءةُ الآليّة) لا تقول شيئاً، والضغطةُ تقول «لا نعرف هذا الكود». يعيد `true` إن صار للبطاقة حالٌ غيرُ السؤال.
   */
  const lookup = useCallback(
    async (code: string, quiet = false): Promise<boolean> => {
      try {
        const pre = (await api<ReferralPreviewPayload>(`/api/v1/referral/${encodeURIComponent(code)}`)).data;
        if (!alive.current) return true;
        if (pre.inviter && pre.source === "campaign") {
          await claimCampaign(code);
          if (alive.current) setState({ kind: "none" });
          return true;
        }
        if (pre.inviter) {
          setError(null);
          setState({ kind: "confirm", who: pre.inviter, by: { code } });
          return true;
        }
        if (!quiet) setError(t.refCodeUnknown);
      } catch {
        if (!quiet && alive.current) setError(t.refFailed);
      }
      return false;
    },
    [t],
  );

  /* يُقرأ عند الظهور، ومن جديد إن وصل رابطُ دعوةٍ والترحيبُ مفتوح */
  const load = useCallback(async () => {
    try {
      const me = (await api<MyReferralPayload>("/api/v1/me/referral")).data;
      if (!alive.current) return;
      if (!me.eligible) {
        await pendingInvite.clear();
        setState(me.inviter ? { kind: "done", who: me.inviter, gift: false } : { kind: "none" });
        return;
      }
      const code = await pendingInvite.get();
      if (code) {
        const pre = (await api<ReferralPreviewPayload>(`/api/v1/referral/${encodeURIComponent(code)}`)).data;
        if (!alive.current) return;
        if (pre.inviter && pre.source === "campaign") {
          await claimCampaign(code);
          if (alive.current) setState({ kind: "none" });
          return;
        }
        if (pre.inviter) {
          setState({ kind: "confirm", who: pre.inviter, by: { code } });
          return;
        }
        await pendingInvite.clear();
      }
      /* أندرويد: الحافظةُ مرّةً واحدةً عند أوّل ظهور — رابطُ دعوةٍ فيها يُسأل عنه مباشرةً */
      if (Platform.OS === "android" && !autoRead.current) {
        autoRead.current = true;
        const found = inviteCodeFromText(await Clipboard.getStringAsync().catch(() => ""));
        if (found && (await lookup(found, true))) return;
      }
      if (Platform.OS === "ios" && Clipboard.isPasteButtonAvailable) {
        const has = await Clipboard.hasStringAsync().catch(() => false);
        if (alive.current) setCanPaste(has);
      }
      if (alive.current) setState({ kind: "ask" });
    } catch {
      /* سؤالٌ لا يُرسم خيرٌ من سؤالٍ يكسر الخطوة الأولى */
      if (alive.current) setState({ kind: "none" });
    }
  }, [lookup]);
  useEffect(() => {
    void load();
    return pendingInvite.subscribe(() => void load());
  }, [load]);

  const claim = async (by: ClaimReferralBody) => {
    if (busy) return;
    haptic.pick();
    setBusy(true);
    setError(null);
    try {
      const out = (await api<ClaimReferralPayload>("/api/v1/me/referral", { method: "POST", body: by })).data;
      await pendingInvite.clear();
      if (!alive.current) return;
      if (out.claimed) setState({ kind: "done", who: out.inviter, gift: out.source === "friend" });
      else if (out.inviter) setState({ kind: "done", who: out.inviter, gift: false });
      /* 🆕 المراجعةُ المستقلّة — رفضٌ دائمٌ لا «حاول مجدداً»: حسابٌ لا يقبل نسبةً ⇒ يختفي السؤال؛ داعٍ لا يصحّ (اسمٌ غائب · كودي ·
         حارسٌ تغيّر) ⇒ يعود السؤالُ بسطرٍ يقوله. «تعذّر» لخطأ الشبكة وحدَه (أدناه) */
      else if (out.reason === "ineligible") setState({ kind: "none" });
      else {
        setState({ kind: "ask" });
        setError(t.refCantPick);
      }
    } catch {
      if (alive.current) setError(t.refFailed);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const decline = () => {
    haptic.pick();
    setError(null);
    void pendingInvite.clear();
    setState({ kind: "ask" });
  };

  if (state.kind === "none") return null;

  return (
    <View style={{ marginTop: space.lg }}>
      {state.kind === "ask" ? (
        <View style={{ backgroundColor: tokens.surface, borderRadius: radius.card, padding: space.md, gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tokens.accent }}>
              <Icon name="person-plus" size={18} color={tokens.onAccent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="700">{t.refAsk}</Text>
              <Text size={12} muted style={{ marginTop: 2, lineHeight: 18 }}>{t.refAskHint}</Text>
            </View>
          </View>
          {/* iPhone: زرُّ Apple نفسُه — كلمتُه وأيقونتُه منه ولا تُغيَّران، ونختار لونَه وزواياه فقط */}
          {Platform.OS === "ios" && canPaste ? (
            <Clipboard.ClipboardPasteButton
              acceptedContentTypes={["plain-text"]}
              displayMode="iconAndLabel"
              cornerStyle="medium"
              backgroundColor={tokens.accent}
              foregroundColor={tokens.onAccent}
              style={{ height: 44, width: "100%" }}
              onPress={(data) => {
                if (data.type !== "text") return;
                haptic.pick();
                const code = inviteCodeFromText(data.text, true);
                if (code) void lookup(code);
                else setError(t.refCodeUnknown);
              }}
            />
          ) : null}
          {Platform.OS === "android" ? (
            <Button
              label={t.refPaste}
              size="sm"
              onPress={async () => {
                haptic.pick();
                const code = inviteCodeFromText(await Clipboard.getStringAsync().catch(() => ""), true);
                if (code) void lookup(code);
                else setError(t.refCodeUnknown);
              }}
            />
          ) : null}
          <Group>
            <Field label={t.refCodeLabel} value={typed} onChange={(v) => { setTyped(v); setError(null); }} placeholder={t.refCodePlaceholder} maxLength={80} ltr />
          </Group>
          <Button
            label={t.refCodeGo}
            size="sm"
            variant="ghost"
            busy={busy}
            disabled={typedCode(typed).length < 4}
            onPress={() => {
              haptic.pick();
              void lookup(typedCode(typed));
            }}
          />
          {error ? <Text size={12} color={tokens.error}>{error}</Text> : null}
        </View>
      ) : (
        <View style={{ backgroundColor: tokens.surface, borderRadius: radius.card, padding: space.md, gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Avatar uri={state.who?.avatar_url ?? null} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={15} weight="700" numberOfLines={2} style={{ flexShrink: 1 }}>
                  {state.kind === "confirm"
                    ? state.who.name ? t.refConfirm(state.who.name) : t.refConfirmAnon
                    : state.who?.name ? t.refDone(state.who.name) : t.refDoneAnon}
                </Text>
                {state.who?.verified ? <IdentityBadges flags={{ partner: false, plus: false, founder: false, verified: true }} nameSize={15} /> : null}
              </View>
              {state.who?.username ? <Text size={12} muted numberOfLines={1} style={{ writingDirection: "ltr", textAlign: "auto" }}>{`@${state.who.username}`}</Text> : null}
            </View>
            {state.kind === "done" ? (
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: tokens.success }}>
                <Icon name="check-line" size={14} color="#fff" />
              </View>
            ) : null}
          </View>
          {state.kind === "confirm" ? (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button label={t.refYes} size="sm" busy={busy} onPress={() => void claim(state.by)} style={{ flex: 1 }} />
              <Button label={t.refNo} size="sm" variant="ghost" disabled={busy} onPress={decline} style={{ flex: 1 }} />
            </View>
          ) : state.gift ? (
            <Text size={13} color={tokens.accent} weight="600" style={{ lineHeight: 20 }}>{t.refDoneGift}</Text>
          ) : null}
          {error ? <Text size={12} color={tokens.error}>{error}</Text> : null}
        </View>
      )}
    </View>
  );
}
