import React from "react";
import { NewPostScreen } from "../src/community/NewPostScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/** 🆕 D-1448 — `/new-post`: «بوست جديد» من زرّ القلم العائم في «المجتمع» */
export default function NewPost() {
  return (
    <ErrorBoundary screen="community">
      <NewPostScreen />
    </ErrorBoundary>
  );
}
