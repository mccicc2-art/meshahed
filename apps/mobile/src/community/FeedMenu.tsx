import React, { useState } from "react";
import { Clipboard, Pressable, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { Sheet } from "../library/Sheet";
import { CONFIG } from "../config";
import { write } from "../api";
import { displayNameOf, profileHref } from "@/core/people";
import type { CommunityFeedRow, TrackResult, UnrateBody } from "../contracts";
import type { CardDoors } from "./CommunityCards";

/**
 * ====== 🆕 D-1448 — ورقةُ ⋯ في بطاقة «المجتمع» ======
 *
 * أحمد ١٧ أكتوبر: «ثلاث نقاط في زاوية الصفّ الأوّل». الصفوفُ بوصفة «المزيد» في صفحة العمل (`TitleScreen`، D-1020) — رمزٌ
 * وكلمة — لا ورقةَ جديدة: صفحةُ العمل (أو القائمة) · صفحةُ صاحبه · نسخُ الرابط · المشاركة، **ولرأيك وحدَك** «حذف تقييمي»
 * بتأكيدٍ في الورقة نفسِها (الحذفُ لا يُتراجع عنه بضغطة) — المسارُ نفسُه في صفحة العمل (`track/unrate`).
 * 🆕 D-1595 — **«إبلاغ» على رأي غيرك** (مهمّةُ Asana «زر إبلاغ في قائمة بطاقة المنشور»): المسارُ صار موجوداً —
 * `POST /api/v1/thread/report` بـ`what: "review"`، وهو نفسُه زرُّ «إبلاغ» في صفحة الرأي (`ThreadScreen`). للرأي المكتوب
 * وحدَه: القائمةُ وتقييمُ الحلقة لا هدفَ بلاغٍ لهما في الخادم، ورأيُك لا تُبلغ عنه، والزائرُ لا يُبلغ (`requireUser`).
 * الحدُّ والتكرارُ في الخادم (عشرةٌ في الدقيقة · `ignoreDuplicates`)، فالبلاغُ الثاني على الرأي نفسِه لا يضرّ.
 */
type Item = { icon: IconName; label: string; run: () => void; danger?: boolean };

export function FeedMenu({
  row,
  meId,
  doors,
  onShare,
  onCopied,
  onClose,
  onDeleted,
  onReported,
  onError,
}: {
  /* 🆕 R58 — صفُّ النقاش بلا ⋯ (بابُه غرفتُه) */
  row: Exclude<CommunityFeedRow, { kind: "talk" }>;
  meId: string | null;
  doors: CardDoors;
  onShare: (path: string, title: string) => void;
  onCopied: () => void;
  onClose: () => void;
  onDeleted: () => void;
  /** 🆕 D-1595 — وصل البلاغ */
  onReported: () => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const it = row.item;
  const titlePath = `/${it.media_type === "tv" ? "show" : "movie"}/${it.tmdb_id}`;
  const items: Item[] = [];
  let link = titlePath;
  let shareTitle = it.title ?? "";
  let mine = false;
  let reportable = false;

  if (row.kind === "news") {
    link = `/post/${encodeURIComponent(row.item.key)}`;
    items.push({ icon: "film", label: t.postMenuOpenTitle(row.item.title), run: () => doors.onTitle(row.item.media_type, row.item.tmdb_id) });
  } else {
    const a = row.item;
    const name = displayNameOf(a.person, t.anonymousUser);
    const who = profileHref(a.person);
    if (a.listId) {
      link = `/list/${a.listId}`;
      items.push({ icon: "list", label: t.postMenuOpenTitle(a.title ?? ""), run: () => doors.onList(a.listId as string) });
    } else {
      link = `/review/${a.media_type}/${a.tmdb_id}/${a.person.id}`;
      items.push({ icon: a.media_type === "tv" ? "tv" : "film", label: t.postMenuOpenTitle(a.title ?? ""), run: () => doors.onTitle(a.media_type, a.tmdb_id) });
      mine = !!meId && a.person.id === meId;
      reportable = !!meId && !mine && a.kind !== "ep_rate";
    }
    if (who && !mine) items.push({ icon: "people", label: t.viewProfileOf(name), run: () => doors.onWeb(who) });
    shareTitle = a.title ?? "";
  }
  items.push({ icon: "link", label: t.shareCopyLink, run: () => {
    Clipboard.setString(`${CONFIG.apiBase}${link}`);
    onCopied();
  } });
  items.push({ icon: "share", label: t.shareLinkLabel, run: () => onShare(link, shareTitle) });

  const remove = async () => {
    if (row.kind !== "comment") return;
    setBusy(true);
    try {
      await write<TrackResult>("/api/v1/track/unrate", { tmdbId: row.item.tmdb_id, mediaType: row.item.media_type } satisfies UnrateBody);
      onDeleted();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const report = () => {
    if (row.kind !== "comment") return;
    const a = row.item;
    write("/api/v1/thread/report", { target: { kind: "review", user_id: a.person.id, tmdb_id: a.tmdb_id, media_type: a.media_type }, what: "review" })
      .then(onReported)
      .catch(onError);
  };

  if (confirm) {
    return (
      <Sheet title={t.deleteRating} onClose={onClose} placement="center">
        <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>{t.postDeleteConfirm}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label={t.cancelLabel} variant="ghost" onPress={onClose} />
          <View style={{ flex: 1 }}>
            <Button label={t.deleteRating} variant="danger" busy={busy} onPress={() => void remove()} />
          </View>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet title={t.moreMenuTitle} onClose={onClose}>
      {items.map((x) => (
        <Pressable
          key={x.label}
          onPress={() => {
            onClose();
            x.run();
          }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name={x.icon} size={19} color={tokens.fg} />
          <Text size={14}>{x.label}</Text>
        </Pressable>
      ))}
      {reportable ? (
        <>
          <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          {/* الرمزُ والكلمةُ نفسُهما في صفحة الرأي (`ThreadScreen`) — بلاغٌ واحدٌ بشكلٍ واحد */}
          <Pressable
            onPress={() => {
              onClose();
              report();
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="shield" size={19} color={tokens.fg} />
            <Text size={14}>{t.reportLabel}</Text>
          </Pressable>
        </>
      ) : null}
      {mine ? (
        <>
          <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          <Pressable onPress={() => setConfirm(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="trash" size={19} color={tokens.error} />
            <Text size={14} color={tokens.error}>{t.deleteRating}</Text>
          </Pressable>
        </>
      ) : null}
    </Sheet>
  );
}
