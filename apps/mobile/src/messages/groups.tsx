import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Icon } from "../icons";
import { MESSAGES_KEY } from "./live";
import { patchKeep } from "./common";
import { displayNameOf, type PersonLite } from "@/core/people";
import type { Dict } from "@/core/i18n";
import type { GroupMsgEvent, GroupSysEvent, MessagesPayload, MsgEvent, MsgGroupConversation } from "../contracts";

/**
 * ====== القروبات في التطبيق — ما تتشاركه شاشاتُها (الهجرة ٢٠٥) ======
 *
 * 🔑 **القروبُ في حمولة الصندوق نفسِها** (`groups`)، فالشاشاتُ تقرأ من الكاش الواحد وتعدّله تفاؤلاً بـ`patchGroup`.
 * 🔑 **الفقاعةُ فقاعةُ الخاص** (`Bubble`): رسالةُ القروب تُحوَّل إلى شكل الردّ المباشر (`asBubbleEvent`) فيبقى الوقتُ وعلامةُ
 * القراءة والاقتباسُ والصورةُ والـGIF والتحديدُ كما هي — ويُزاد فوقها اسمُ المرسِل وصورتُه.
 */

export function patchGroup(id: string, fn: (g: MsgGroupConversation) => MsgGroupConversation) {
  patchKeep<MessagesPayload>(MESSAGES_KEY, (p) => ({ ...p, groups: (p.groups ?? []).map((g) => (g.group_id === id ? fn(g) : g)) }));
}

export function dropGroup(id: string) {
  patchKeep<MessagesPayload>(MESSAGES_KEY, (p) => ({ ...p, groups: (p.groups ?? []).filter((g) => g.group_id !== id) }));
}

export function personIn(g: MsgGroupConversation, id: string | null): PersonLite | null {
  return id ? g.people.find((p) => p.id === id) ?? null : null;
}

/** اسمُ شخصٍ في القروب — «أنت» لصاحب الجهاز */
export function nameIn(g: MsgGroupConversation, id: string | null, meId: string, t: Dict): string {
  if (id && id === meId) return t.grpYou;
  return displayNameOf(personIn(g, id), t.anonymousUser);
}

/** سطرُ النظام بلغة القارئ */
export function sysLine(e: GroupSysEvent, g: MsgGroupConversation, meId: string, t: Dict): string {
  const a = nameIn(g, e.actor_id, meId, t);
  const b = nameIn(g, e.target_id, meId, t);
  switch (e.sys) {
    case "created":
      return t.grpSysCreated(a);
    case "added":
      return t.grpSysAdded(a, b);
    case "left":
      return t.grpSysLeft(a);
    case "removed":
      return t.grpSysRemoved(a, b);
    case "renamed":
      return t.grpSysRenamed(a, e.text ?? "");
    case "photo":
      return t.grpSysPhoto(a);
  }
}

/** سطرُ المعاينة في الصندوق: «فلان: النصّ» */
export function groupPreview(g: MsgGroupConversation, meId: string, t: Dict): string {
  const last = g.events[g.events.length - 1];
  if (!last) return "";
  if (last.kind === "sys") return sysLine(last, g, meId, t);
  const who = last.mine ? t.convYou : nameIn(g, last.sender_id, meId, t);
  const what = last.deleted ? (last.mine ? t.msgDeletedMine : t.msgDeleted) : last.gif_id ? t.msgGifPreview : last.image ? (last.body ? `${t.msgImagePreview} · ${last.body}` : t.msgImagePreview) : last.title ? titleText(last) : last.body;
  return `${who}: ${what}`;
}

/** 🆕 D-1435 — نصُّ رسالة العمل حيث لا بطاقة (المعاينة · الاقتباس · النسخ): «🎬 الاسم · التعليق» */
export function titleText(e: GroupMsgEvent): string {
  if (!e.title) return e.body;
  return [`🎬 ${e.title.title ?? ""}`.trim(), e.body.trim()].filter(Boolean).join(" · ");
}

/** رسالةُ القروب بشكل الردّ المباشر — لتُرسم بـ`Bubble` نفسِها */
export function asBubbleEvent(e: GroupMsgEvent): MsgEvent {
  /* 🆕 D-1435 — بطاقةُ العمل تُرسم بطاقةَ مشاركة الخاص نفسَها (`share`)، والتعليقُ ملاحظتُها */
  if (e.title)
    return {
      kind: "share",
      id: e.id,
      mine: e.mine,
      tmdb_id: e.title.tmdb_id,
      media_type: e.title.media_type,
      title: e.title.title,
      poster_path: e.title.poster_path,
      note: e.body.trim() || null,
      created_at: e.created_at,
      ...(e.mine && typeof e.read === "boolean" ? { read: e.read } : {}),
    };
  return {
    kind: "reply",
    id: e.id,
    mine: e.mine,
    body: e.body,
    created_at: e.created_at,
    dm: true,
    ...(e.gif_id ? { gif_id: e.gif_id } : {}),
    ...(e.image ? { image: e.image } : {}),
    ...(e.mine && typeof e.read === "boolean" ? { read: e.read } : {}),
    /* 🆕 D-1441 — المحذوفةُ للجميع تُرسم سطرَ «حُذفت» نفسَه في الخاص */
    ...(e.deleted ? { deleted: true } : {}),
    ...(e.reply
      ? { reply: { id: e.reply.id, mine: e.reply.mine, kind: e.reply.kind, body: e.reply.body, ...(e.reply.image ? { image: e.reply.image } : {}), ...(e.reply.gif_id ? { gif_id: e.reply.gif_id } : {}) } }
      : {}),
  };
}

/**
 * لونُ اسم المرسِل فوق فقاعته — ثابتٌ لكلِّ شخص (من معرّفه) كالواتس، وثمانيةُ ألوانٍ وسطى تُقرأ على الغامق والفاتح.
 */
const SENDER_COLORS = ["#E0803A", "#2FA36B", "#3D8FD6", "#9B5DE5", "#D6455D", "#14A3A3", "#C9A227", "#E05FA8"];
export function senderColor(id: string | null): string {
  if (!id) return SENDER_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

/**
 * صورةُ القروب: صورتُه إن رُفعت، وإلّا صورُ ثلاثةٍ من أعضائه متداخلةً (غيرك أوّلاً) — كما في الصور المعتمدة.
 */
export function GroupAvatar({ g, meId, size = 44 }: { g: MsgGroupConversation; meId: string; size?: number }) {
  const { tokens } = useApp();
  if (g.photo) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: tokens.surface2 }}>
        <Image source={{ uri: g.photo.url, cacheKey: g.photo.key }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
      </View>
    );
  }
  const faces = [...g.members.filter((m) => m.id !== meId), ...g.members.filter((m) => m.id === meId)]
    .slice(0, 3)
    .map((m) => personIn(g, m.id));
  const small = Math.round(size * 0.62);
  const mid = Math.round((size - small) / 2);
  /* واحدٌ في الوسط · اثنان قُطراً · ثلاثةٌ مثلّثاً */
  const spots =
    faces.length === 1
      ? [{ top: mid, start: mid }]
      : faces.length === 2
        ? [{ top: 0, start: 0 }, { bottom: 0, end: 0 }]
        : [{ top: 0, start: 0 }, { top: 0, end: 0 }, { bottom: 0, start: mid }];
  return (
    <View style={{ width: size, height: size }}>
      {faces.map((p, i) => (
        <View
          key={p?.id ?? i}
          style={[
            { position: "absolute", width: small, height: small, borderRadius: small / 2, overflow: "hidden", borderWidth: 1.5, borderColor: tokens.bg, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" },
            spots[i] ?? spots[0],
          ]}
        >
          {p && !p.hide_name && p.avatar_url ? (
            <Image source={{ uri: p.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Icon name="people" size={small * 0.45} color={tokens.muted} />
          )}
        </View>
      ))}
    </View>
  );
}
