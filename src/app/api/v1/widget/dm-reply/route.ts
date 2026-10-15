import { widgetDmRoute } from "@/lib/widgetToken";

/** 🆕 1.12.7 — `POST /api/v1/widget/dm-reply` `{ to | group, body }`: «رد» من إشعار الرسالة برمز الودجت (`DmPush.kt`). */
export const POST = widgetDmRoute("reply");
