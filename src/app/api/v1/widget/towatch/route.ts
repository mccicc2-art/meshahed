import { widgetActionRoute } from "@/lib/widgetToken";

/** 🆕 D-1571 — `POST /api/v1/widget/towatch` — «+» على «الآن في السينما» يضيف الفيلمَ إلى «للمشاهدة»، أو تراجعٌ عنه (`on: false`) */
export const POST = widgetActionRoute("towatch");
