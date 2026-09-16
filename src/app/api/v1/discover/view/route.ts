import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getTabPrefs, getHiddenRails } from "@/lib/locale";
import { parseMyRows, MY_ROWS_COOKIE } from "@/core/myRows";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { DiscoverViewPayload } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/view` — تفضيلاتُ «عرض» في «اكتشف» (D-997): ترتيبُ التبويبات وظهورُها،
 * الصفوفُ المخفيّة، وصفوفُ المستخدم (نوع + موضوع). **كوكيٌّ لا عمود** كما في الويب (D-179/D-826):
 * `fetch` الأصليّ في أندرويد يشترك في جرّة الكوكي مع WebView، فالتطبيقُ يقرأ ما كتبه الويبُ
 * والعكس — ولا تفضيلَ يُكتب مرّتين.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:discover:view:${ip}`, 120, 60_000);
      if (lim) return lim;
      const [tabs, hidden, store] = await Promise.all([getTabPrefs("discover"), getHiddenRails(), cookies()]);
      const payload: DiscoverViewPayload = {
        tabs,
        hidden_rails: [...hidden],
        my_rows: parseMyRows(store.get(MY_ROWS_COOKIE)?.value),
      };
      return ok(payload);
    },
    { cacheControl: "private, no-store" },
  );
}
