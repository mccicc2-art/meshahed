import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { radius, space } from "../theme";
import { Avatar } from "../community/CommunityCards";
import { IdentityBadges } from "../IdentityBadges";
import { Sheet } from "../library/Sheet";
import { Field, Group, Row } from "../settings/ui";
import { pendingInvite } from "../invite/pending";
import type {
  ClaimReferralBody,
  ClaimReferralPayload,
  InviterLite,
  MyReferralPayload,
  ReferralPeoplePayload,
  ReferralPerson,
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
 * ⚖️ **ليست خطوةً سادسة ولا قفلاً**: «التالي» يمضي بلا جواب، والسؤالُ صفٌّ تحت بطاقة «هذا أنت».
 */
type State =
  | { kind: "none" }
  | { kind: "ask" }
  | { kind: "confirm"; who: InviterLite; by: ClaimReferralBody }
  | { kind: "done"; who: InviterLite | null; gift: boolean };

export function InviteCard() {
  const { t, tokens } = useApp();
  const [state, setState] = useState<State>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

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
        if (pre.inviter) {
          setState({ kind: "confirm", who: pre.inviter, by: { code } });
          return;
        }
        await pendingInvite.clear();
      }
      setState({ kind: "ask" });
    } catch {
      /* سؤالٌ لا يُرسم خيرٌ من سؤالٍ يكسر الخطوة الأولى */
      if (alive.current) setState({ kind: "none" });
    }
  }, []);
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
         حارسٌ تغيّر) ⇒ يعود سطرُ البحث بسطرٍ يقوله. «تعذّر» لخطأ الشبكة وحدَه (أدناه) */
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
        <View style={{ gap: space.sm }}>
          <Group>
            <Row icon="person-plus" title={t.refAsk} subtitle={t.refAskHint} onPress={() => { haptic.pick(); setError(null); setSearch(true); }} />
          </Group>
          {error ? <Text size={12} color={tokens.error} style={{ paddingHorizontal: 4 }}>{error}</Text> : null}
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
      {search ? (
        <PeopleSheet
          onClose={() => setSearch(false)}
          onPick={(p) => {
            setSearch(false);
            setError(null);
            setState({ kind: "confirm", who: p, by: { username: p.username } });
          }}
        />
      ) : null}
    </View>
  );
}

/** ورقةُ «من دعاك؟» — البحثُ بالاسم بعد حرفين، ونصفُ ثانيةٍ بين الكتابة والسؤال */
function PeopleSheet({ onClose, onPick }: { onClose: () => void; onPick: (p: ReferralPerson) => void }) {
  const { t, tokens } = useApp();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<ReferralPerson[] | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setPeople(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      api<ReferralPeoplePayload>(`/api/v1/me/referral/people?q=${encodeURIComponent(term)}`)
        .then((r) => live && setPeople(r.data.people))
        .catch(() => live && setPeople([]));
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);
  return (
    <Sheet title={t.refSearchTitle} onClose={onClose}>
      <View style={{ gap: space.md }}>
        <Group>
          <Field label={t.refSearchLabel} value={q} onChange={setQ} placeholder={t.refSearchPlaceholder} maxLength={40} autoFocus />
        </Group>
        {people && people.length === 0 ? (
          <Text size={14} muted style={{ textAlign: "center", paddingVertical: space.lg }}>{t.refSearchNone}</Text>
        ) : null}
        {people && people.length > 0 ? (
          <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, overflow: "hidden" }}>
            {people.map((p, i) => (
              <Pressable
                key={p.username}
                accessibilityRole="button"
                onPress={() => { haptic.pick(); onPick(p); }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar uri={p.avatar_url} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{p.name ?? p.username}</Text>
                    {p.verified ? <IdentityBadges flags={{ partner: false, plus: false, founder: false, verified: true }} nameSize={14} /> : null}
                  </View>
                  <Text size={12} muted numberOfLines={1} style={{ writingDirection: "ltr", textAlign: "auto" }}>{`@${p.username}`}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
