import React from "react";
import { useLocalSearchParams } from "expo-router";
import { NewListScreen } from "../../src/newlist/NewListScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** 🆕 T450 — «قائمة جديدة» أصليّاً: `from=library` يقيّدها بمكتبتك، `tab=smart` على «قائمة ذكيّة»، `add=<id>` «أضف أعمالاً» */
export default function NewList() {
  const { from, tab, add, edit } = useLocalSearchParams<{ from?: string; tab?: string; add?: string; edit?: string }>();
  return (
    <ErrorBoundary screen="list">
      <NewListScreen from={from === "library" ? "library" : "discover"} initialTab={tab === "smart" ? "smart" : "list"} addId={add ? String(add) : null} editId={edit ? String(edit) : null} />
    </ErrorBoundary>
  );
}
