import { sendFeedback } from "@/lib/feedback";
import { bodyRoute } from "@/lib/v1body";
import type { FeedbackBody } from "@/core/contracts/feedback";

/** `POST /api/v1/feedback` — «أرسل مشكلة أو اقتراح» من التطبيق (D-1499): نفسُ `sendFeedback`؛ لا يُبطل شيئاً */
export const POST = bodyRoute<FeedbackBody, { ok: true }>((b) => sendFeedback(b), () => []);
