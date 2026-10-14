import { widgetActionRoute } from "@/lib/widgetToken";

/** `POST /api/v1/widget/movie` — «✓ شاهدته» لفيلمٍ من الودجت أو تراجعٌ عنه (`watched: false`) برمزه الخاصّ (W35 · W37) */
export const POST = widgetActionRoute("movie");
