import { widgetDmRoute } from "@/lib/widgetToken";

/** 🆕 1.12.7 — `POST /api/v1/widget/dm-read` `{ to | group }`: «تمييز كمقروءة» من إشعار الرسالة برمز الودجت (`DmPush.kt`). */
export const POST = widgetDmRoute("read");
