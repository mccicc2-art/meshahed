import React from "react";
import { useLocalSearchParams } from "expo-router";
import { GroupInfoScreen } from "../../../../src/messages/GroupInfoScreen";
import { originOf } from "../../../../src/messages/common";
import { ErrorBoundary } from "../../../../src/ErrorBoundary";

/** 🆕 `/messages/group/[id]/info` — معلوماتُ القروب: الأعضاء · الإضافة · الكتم · التعديل · الخروج */
export default function GroupInfo() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  return (
    <ErrorBoundary screen="messages">
      <GroupInfoScreen id={String(id)} from={originOf(from)} />
    </ErrorBoundary>
  );
}
