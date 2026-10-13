import { widgetMarkRoute } from "@/lib/widgetToken";

/** `POST /api/v1/widget/unmark` — التراجعُ عن ✓ (W14) — الزرُّ يصل مع البناء العامّ، والمسارُ جاهزٌ قبله. */
export const POST = widgetMarkRoute(false);
