import { widgetMarkRoute } from "@/lib/widgetToken";

/** `POST /api/v1/widget/mark` — ✓ من الودجت برمزه الخاصّ (W14). الردُّ `{ next }`: الحلقةُ التالية بسطر البطاقة. */
export const POST = widgetMarkRoute(true);
