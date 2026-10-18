import React from "react";
import { useLocalSearchParams } from "expo-router";
import { NewChatScreen } from "../../src/messages/NewChatScreen";
import { originOf } from "../../src/messages/common";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** 🆕 `/messages/create-group` — إنشاءُ قروب؛ و`?group=<id>` إضافةُ أعضاءٍ إليه (المشرف، من صفحة معلوماته) */
export default function CreateGroup() {
  const { from, group } = useLocalSearchParams<{ from?: string; group?: string }>();
  const id = typeof group === "string" && /^[0-9a-f-]{36}$/i.test(group) ? group : undefined;
  return (
    <ErrorBoundary screen="messages">
      <NewChatScreen mode={id ? "add" : "create"} groupId={id} from={originOf(from)} />
    </ErrorBoundary>
  );
}
