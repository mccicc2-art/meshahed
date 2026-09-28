import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { TitlePicker } from "../search/TitlePickerSheet";
import { FriendPicker, NoteField } from "./FriendPicker";
import { displayNameOf, type PersonLite } from "@/core/people";
import type { MsgShareBody, SearchTitle } from "../contracts";

/**
 * ====== الإرسالُ من التطبيق — Phase 11-M · M5 (خطّة §٣) ======
 *
 * 🔑 **بابان لفعلٍ واحد** (`sendShare` ⇐ `POST /api/v1/me/messages/share`)، كما في الويب:
 *  - **«أرسِله لـ…»** (`SendShareSheet`): العملُ ثابت، والصديقُ يُختار — من صفحة العمل.
 *  - **«ابدأ محادثة»** (`StartConversationSheet`): الصديقُ ثابت، والعملُ يُختار — من «الرسائل». **لا محادثةَ من فراغ** (D-051):
 *    أوّلُ رسالةٍ عملٌ لا نصٌّ حرّ.
 * كانا بابين ويبيّين (`/people?send=` · `/messages?start=`) — الآن ورقتان أصليّتان بالمنتقيَين القائمَين (`FriendPicker` ·
 * `TitlePicker`) **لا منتقٍ ثالث**. والصندوقُ يُبطَل بوسم الخادم (`me:messages`) فيظهر ما أُرسل حين يُفتح.
 */

type Share = Omit<MsgShareBody, "recipient_id" | "note">;

function sendTo(recipient: string, s: Share, note: string | null) {
  return write<{ done: true }>("/api/v1/me/messages/share", { recipient_id: recipient, ...s, note } satisfies MsgShareBody);
}

/** «أرسِله لـ…» — العملُ ثابت */
export function SendTitleSheet({ share, onClose, onToast, onError }: { share: Share; onClose: () => void; onToast: (s: string) => void; onError: (e: unknown) => void }) {
  const { t } = useApp();
  return (
    <Sheet title={t.shareSendSheetTitle(share.title ?? "")} onClose={onClose}>
      <FriendPicker
        onSend={async (recipient, note) => {
          await sendTo(recipient, share, note);
          onToast(t.shareSentToast);
          onClose();
        }}
        onError={onError}
      />
    </Sheet>
  );
}

/** «ابدأ محادثة» — الصديقُ ثابت، والعملُ يُختار ثمّ سطرٌ اختياريّ ثمّ «أرسل» — ثمّ الخيطُ الجديد */
export function StartConversationSheet({
  person,
  onClose,
  onSent,
  onError,
}: {
  person: PersonLite;
  onClose: () => void;
  /** أُرسل: صاحبُ الورقة يفتح الخيط */
  onSent: () => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const name = displayNameOf(person, t.anonymousUser);
  const [picked, setPicked] = useState<SearchTitle | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      await sendTo(person.id, { tmdb_id: picked.id, media_type: picked.mediaType, title: picked.title, poster_path: picked.posterPath ?? null }, note.trim() || null);
      haptic.success();
      onSent();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t.convStartTitle(name)} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Text size={12} muted>{t.convStartHint}</Text>
        {/* الطرفُ ثابتٌ فوق البحث — يُذكّر بمن نبدأ معه، بشارته (D-773ب) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Avatar uri={person.hide_name ? null : person.avatar_url} size={30} />
          <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
          {person.hide_name ? null : <IdentityBadges flags={identityFlags(person)} nameSize={14} />}
        </View>

        {picked ? (
          /* عملٌ مُختار: بطاقةٌ صغيرةٌ تُلغى بـ× + سطرٌ اختياريّ + إرسال — كذيل «أرسِله لـ…» */
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
              <View style={{ width: 40, aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                {picked.poster ? <Image source={{ uri: picked.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={13} color={tokens.muted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} weight="700" numberOfLines={1}>{picked.title}</Text>
                <Text size={12} muted>{`${picked.mediaType === "tv" ? t.typeSeries : t.typeMovie}${picked.year ? ` · ${picked.year}` : ""}`}</Text>
              </View>
              <Pressable onPress={() => setPicked(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.closeLabel} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={16} color={tokens.muted} />
              </Pressable>
            </View>
            <NoteField value={note} onChange={setNote} />
            <Button label={t.shareSendButton} busy={busy} onPress={() => void send()} />
          </>
        ) : (
          <TitlePicker
            placeholder={t.convStartSearchPlaceholder}
            onPick={(r) => {
              haptic.pick();
              setPicked(r);
            }}
          />
        )}
      </View>
    </Sheet>
  );
}
