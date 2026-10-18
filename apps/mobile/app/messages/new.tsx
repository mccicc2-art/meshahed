import React from "react";
import { useLocalSearchParams } from "expo-router";
import { NewChatScreen } from "../../src/messages/NewChatScreen";
import { originOf } from "../../src/messages/common";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** 🆕 `/messages/new` — «محادثة جديدة»: «إنشاء قروب» أوّلاً، ثمّ من تتابعهم (الصورُ المعتمدة ١٥ أكتوبر) */
export default function NewChat() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <ErrorBoundary screen="messages">
      <NewChatScreen mode="new" from={originOf(from)} />
    </ErrorBoundary>
  );
}
