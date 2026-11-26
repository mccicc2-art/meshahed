import React, { useState } from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { Group, Row, SwitchPill } from "../settings/ui";
import { LIST_MEMBERS_MAX } from "@/core/contracts/library";
import type { ListDetailPayload } from "../contracts";

/**
 * ====== 🆕 T578 — ورقةُ «⋯» في صفحة القائمة (ت٣ «أ» · أحمد ٢٦ نوفمبر ٢٠٢٦) ======
 *
 * **لماذا**: الصفحةُ كانت تحمل تحت الأعمال أزراراً شبحيّةً («عدّل القائمة» · «أضف أعمالاً») ورقاقتَي «ادعُ» و«تابِع
 * المشاهدة» في سطرٍ مزدحم. حكمُ أحمد: **الصفحةُ بلا أزرار، وكلُّ أدوات القائمة في «⋯» بالزاوية** — بهذا الترتيب: الإضافةُ
 * أوّلاً لأنّها الأكثرُ استعمالاً، ثمّ التشغيلُ مفتاحاً، والدعوة، والتعديلُ والغلافُ والترتيب، والحذفُ آخراً بالأحمر.
 * 🔑 **لا عنصرَ جديداً**: `Sheet` · صفوفُ الإعدادات (`Group`/`Row`/`SwitchPill`) · `Button`. والحذفُ بخطوتين في مكانه كما
 * كان في ورقة التعديل (لا رجعةَ فيه) — انتقل إلى هنا ولم يُنسخ.
 * ⚖️ قائمةُ غيرك: ما يخصّك منها وحده — التشغيلُ إن حفظتها، والإضافةُ والأعضاءُ إن كنت عضواً فيها.
 */
export type ListMoreAction = "add" | "smart" | "invite" | "members" | "edit" | "cover" | "reorder" | "unsave";

/** هل في الورقة شيءٌ لهذه القائمة؟ — بلا صفوفٍ لا يُرسم «⋯» أصلاً */
export function hasListMore(d: ListDetailPayload): boolean {
  return d.mine || d.can_edit_items || d.playlist !== null || (d.members ?? []).filter((m) => m.role !== "pending").length > 1;
}

export function ListMoreSheet({
  list,
  busy,
  onAction,
  onPlaylist,
  onDelete,
  onClose,
}: {
  list: ListDetailPayload;
  busy: boolean;
  onAction: (a: ListMoreAction) => void;
  onPlaylist: (on: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const [confirming, setConfirming] = useState(false);
  const d = list;
  const members = (d.members ?? []).filter((m) => m.role !== "pending");
  const rows: React.ReactNode[] = [];
  /* الإضافةُ — والقائمةُ الذكيّةُ تمتلئ وحدَها فبابُها تعديلُ شرطها (T454) */
  if (d.mine && d.smart) rows.push(<Row key="smart" icon="sliders" title={t.smartListUpdate(d.name)} onPress={() => onAction("smart")} />);
  else if (d.mine || d.can_edit_items) rows.push(<Row key="add" icon="plus" title={t.listAddTitles} onPress={() => onAction("add")} />);
  if (d.playlist !== null) {
    rows.push(<Row key="play" icon="play" title={t.listMorePlaylist} subtitle={t.listMorePlaylistSub} onPress={() => onPlaylist(!d.playlist)} disabled={busy} trailing={<SwitchPill checked={!!d.playlist} />} />);
  }
  /* الدعوةُ: قائمةٌ فيها أعضاءٌ تفتح ورقتَهم (ومنها «ادعُ»)، وإلّا ورقةُ الدعوة مباشرةً — كما كانت رقاقةُ «ادعُ» */
  if (d.can_invite) rows.push(<Row key="invite" icon="person-plus" title={t.listMoreInvite} subtitle={t.listMoreInviteSub} onPress={() => onAction(members.length > 1 ? "members" : "invite")} />);
  else if (members.length > 1) rows.push(<Row key="members" icon="people" title={t.listMembersTitle(members.length, LIST_MEMBERS_MAX)} onPress={() => onAction("members")} />);
  /* 🆕 T583 («١ب») — قائمةٌ حفظتَها: إلغاءُ الحفظ هنا (والعلامةُ في صفّ الغلاف تفعله أيضاً — «٣أ»)، ويُخرجها من صفّ المشاهدة */
  if (!d.mine && d.saved_by_me) rows.push(<Row key="unsave" icon="bookmark" title={t.listUnsaveLabel} onPress={() => onAction("unsave")} />);
  if (d.mine) {
    rows.push(<Row key="edit" icon="edit" title={t.listEditTitle} subtitle={t.listMoreEditSub} onPress={() => onAction("edit")} />);
    if (d.items.length > 0) rows.push(<Row key="cover" icon="image" title={t.listMoreCover} onPress={() => onAction("cover")} />);
    if (!d.smart && d.items.length > 1) rows.push(<Row key="reorder" icon="list" title={t.listMoreReorder} onPress={() => onAction("reorder")} />);
  }

  return (
    <Sheet title={t.listMoreLabel} onClose={onClose}>
      {rows.length ? <Group>{rows}</Group> : null}
      {d.mine ? (
        confirming ? (
          <View style={{ gap: 10 }}>
            <Text size={13} muted style={{ lineHeight: 20 }}>{t.listDeleteBody}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label={t.cancelLabel} variant="ghost" onPress={() => setConfirming(false)} />
              <Button label={t.listDeleteYes} variant="danger" busy={busy} style={{ flex: 1 }} onPress={onDelete} />
            </View>
          </View>
        ) : (
          <Group>
            <Row icon="trash" title={t.listDeleteThis} danger trailing={null} onPress={() => setConfirming(true)} />
          </Group>
        )
      ) : null}
    </Sheet>
  );
}
