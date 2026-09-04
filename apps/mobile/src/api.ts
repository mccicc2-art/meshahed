import { QueryClient } from "@tanstack/react-query";
import { CONFIG } from "./config";
import { accessToken } from "./auth";
import { deviceLocale } from "./i18n";
import type { AppError, Tag } from "./contracts";

/**
 * ====== عميلُ `/api/v1` — Bearer، شكلٌ واحد، إبطالٌ بالوسوم ======
 *
 * 🔑 **الردُّ إمّا `{data, invalidates}` أو `{error}`** (Phase 9 §4.3): لا
 * تخمينَ من رمز HTTP وحدَه. **والوسومُ التي يعيدها الخادم هي مفاتيحُ
 * الاستعلامات هنا** — فما أبطله الخادمُ يُعاد جلبُه، **لا أكثر ولا أقلّ،
 * ولا قاعدةَ إبطالٍ ثانيةً مكتوبةً في التطبيق.**
 *
 * 🔑 **`401` يُترجم إلى خروج**: رمزٌ رُفض في الخادم = جلسةٌ لا تصلح، **ولا
 * معنى لإعادة المحاولة بالرمز نفسِه.**
 */
export class ApiError extends Error {
  constructor(public readonly error: AppError, public readonly status: number) {
    super(error.message_key);
  }
}

type Envelope<T> = { data: T; invalidates: Tag[] } | { error: AppError };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** كلُّ استعلامٍ في التطبيق يُفتح بوسمٍ — فالإبطالُ بالوسم يجده. */
export const qk = {
  tag: (tag: Tag) => [tag] as const,
  title: (kind: "tv" | "movie", id: number) => [`title:${kind}:${id}`] as const,
  season: (id: number, n: number) => [`title:tv:${id}`, "season", n] as const,
};

export function invalidateTags(tags: Tag[]) {
  for (const tag of tags) void queryClient.invalidateQueries({ queryKey: [tag] });
}

export async function api<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; auth?: boolean },
): Promise<{ data: T; invalidates: Tag[] }> {
  const headers = await baseHeaders(init?.auth !== false);
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${CONFIG.apiBase}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json || "error" in json) {
    const error: AppError = json?.error ?? { code: "internal", message_key: "apiInternal" };
    throw new ApiError(error, res.status);
  }
  return json;
}

/** كتابةٌ تُطبِّق إبطالَها بنفسها — السطرُ الذي يجعل الوسومَ حيّة. */
export async function write<T>(path: string, body: unknown): Promise<T> {
  const r = await api<T>(path, { method: "POST", body });
  invalidateTags(r.invalidates);
  return r.data;
}

/**
 * الترويساتُ المشتركة: الرمزُ إن وُجد، **ولغةُ الجهاز في `Accept-Language`** —
 * فالمساراتُ القائمة (`/api/search`…) تقرأها كما تقرأ لغةَ زائرٍ جديد في الويب.
 */
async function baseHeaders(auth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": deviceLocale(),
  };
  if (auth) {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** مسارٌ قائمٌ من قبل `v1` (بلا غلاف `{data}`) — للبحث والاقتراح. */
export async function rawGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CONFIG.apiBase}${path}`, { headers: await baseHeaders(true) });
  if (!res.ok) throw new ApiError({ code: res.status === 429 ? "rate_limited" : "upstream", message_key: res.status === 429 ? "apiRateLimited" : "apiUpstream" }, res.status);
  return (await res.json()) as T;
}
