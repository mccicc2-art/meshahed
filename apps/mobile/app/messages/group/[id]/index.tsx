import React from "react";
import { useLocalSearchParams } from "expo-router";
import { GroupScreen } from "../../../../src/messages/GroupScreen";
import { originOf } from "../../../../src/messages/common";
import { ErrorBoundary } from "../../../../src/ErrorBoundary";

/** 🆕 `/messages/group/[id]` — خيطُ القروب (الهجرة ٢٠٥)؛ وإشعارُه (`/messages?group=`) يصل هنا */
export default function Group() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  return (
    <ErrorBoundary screen="messages">
      <GroupScreen id={String(id)} from={originOf(from)} />
    </ErrorBoundary>
  );
}
