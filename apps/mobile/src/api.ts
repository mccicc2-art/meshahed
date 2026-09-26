import { useEffect } from "react";
import { QueryClient } from "@tanstack/react-query";
import { CONFIG } from "./config";
import { accessToken } from "./auth";
import { session } from "./session";
import { currentLocale } from "./i18n";
import type { AppError, Tag } from "./contracts";

/**
 * ====== عميلُ `/api/v1` — Bearer، شكلٌ واحد، إبطالٌ بالوسوم ======
 *
 * 🔑 **الردُّ إمّا `{data, invalidates}` أو `{error}`** (Phase 9 §4.3): لا
 * تخمينَ من رمز HTTP وحدَه. **والوسومُ التي يعيدها الخادم هي مفاتيحُ
 * الاستعلامات هنا** — فما أبطله الخادمُ يُعاد جلبُه، **لا أكثر ولا أقلّ،
 * ولا قاعدةَ إبطالٍ ثانيةً مكتوبةً في التطبيق.**
 *
 * 🔑 **`401` = رمزٌ جديدٌ من الصفحة، بمحاولتين** (Phase 11 · B1 §٤): الرمزُ
 * الذي يحمله الغلافُ رمزُ وصولٍ يشيخ بعد ساعة **ولا يجدّده الغلافُ أبداً**
 * — يطلبه من الـWebView (`session.request`، بـnonce) ويعيد النداء. **محاولتان
 * كحدٍّ أقصى** ثمّ الخطأُ يصعد إلى الشاشة التي تعود إلى الـWebView برسالة.
 * ولا نداءَ بلا رمز: إن لم يكن في الذاكرة يُطلب **قبل** أوّل طلب (§٦-ج).
 */
export class ApiError extends Error {
  constructor(public readonly error: AppError, public readonly status: number) {
    super(error.message_key);
  }
}

type Envelope<T> = { data: T; invalidates: Tag[] } | { error: AppError };

export const queryClient = new QueryClient({
  defaultOptions: {
    /* 🆕 D-1118 — `gcTime` ٣٠ دقيقة لا ٥: صفحةُ عملٍ تُترك ثمّ يُعاد إليها بعد دقائق كانت تُجلب من الصفر،
       وما يُستعاد من ملفّ الكاش عند الإقلاع (صفحاتُ الأعمال ومواسمُها الآن) كان يُكنس بعد خمسِ دقائق بلا مشاهد. */
    queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** كلُّ استعلامٍ في التطبيق يُفتح بوسمٍ — فالإبطالُ بالوسم يجده. */
export const qk = {
  tag: (tag: Tag) => [tag] as const,
  title: (kind: "tv" | "movie", id: number) => [`title:${kind}:${id}`] as const,
  season: (id: number, n: number) => [`title:tv:${id}`, "season", n] as const,
  person: (id: number) => [`person:${id}`] as const,
  /** D-1036 — صفحةُ القائمة؛ المفتاحُ وسمُها (`list:<id>`) فتُبطلها كتاباتُ القوائم بالوسم نفسِه */
  list: (id: string) => [`list:${id}`] as const,
};

export function invalidateTags(tags: Tag[]) {
  for (const tag of tags) void queryClient.invalidateQueries({ queryKey: [tag] });
}

export async function api<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; auth?: boolean },
): Promise<{ data: T; invalidates: Tag[] }> {
  const auth = init?.auth !== false;
  /* بلا رمزٍ في الذاكرة يُطلب قبل النداء لا بعده — نداءٌ سيُرفض حتماً كلفةٌ بلا معنى */
  if (auth && !session.has()) await session.request();
  for (let attempt = 0; ; attempt++) {
    const headers = await baseHeaders(auth, path);
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${CONFIG.apiBase}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!json || "error" in json) {
      if (res.status === 401 && auth && attempt < 2) {
        session.clear();
        const fresh = await session.request();
        if (fresh) continue;
      }
      const error: AppError = json?.error ?? { code: "internal", message_key: "apiInternal" };
      throw new ApiError(error, res.status);
    }
    return json;
  }
}

/**
 * ====== 🆕 D-1141 — القراءةُ العامّةُ لا تنتظر الرمز ======
 *
 * **لماذا**: صفحةُ العمل وحلقاتُها كانتا تنتظران الرمزَ من الـWebView (حتى ٨ث للمحاولة) قبل أن تُطلبا —
 * في تسجيل خالد (٢٦ سبتمبر): ٦ث للصفحة ثمّ ١٠ث للحلقات. **والخادمُ لا يحتاجه لهما**: المساراتُ تقبل
 * الزائرَ وتعيد العملَ كاملاً، والرمزُ يضيف حالتي وحدَها (D-892). وأسوأُ من البطء: بعد مهلةٍ بلا رمزٍ
 * كان الطلبُ يمضي زائراً **فتُرسم حلقاتٌ «غيرُ مشاهَدة» وقد شوهدت**.
 *
 * 🔑 **الرمزُ حاضرٌ ⇒ الطلبُ كما كان. غائبٌ ⇒ يُطلب العملُ زائراً فوراً ويُوسم `_guest`، ويُطلب الرمزُ في
 * الخلفيّة**، و`useGuestUpgrade` يعيد الجلبَ لحظةَ يصل. **والشاشةُ لا ترسم حالتي من ردِّ زائر** —
 * أفعالُها وعلاماتُها هيكلٌ معطَّلٌ حتى الترقية: لا «غير مشاهَد» كاذب، ولا فعلَ على حالٍ لا نعرفها.
 */
export type Soft<T> = T & { _guest?: true };

export async function softGet<T extends object>(path: string): Promise<Soft<T>> {
  if (session.has()) return (await api<T>(path)).data;
  void session.request();
  const r = await api<T>(path, { auth: false });
  return { ...r.data, _guest: true };
}

export function isGuest(v: unknown): boolean {
  return !!v && typeof v === "object" && (v as { _guest?: unknown })._guest === true;
}

/** ردُّ زائرٍ على الشاشة ⇒ يُعاد الجلبُ حين يصل الرمز (أو فوراً إن كان وصل قبل التركيب) */
export function useGuestUpgrade(guest: boolean, refetch: () => unknown) {
  useEffect(() => {
    if (!guest) return;
    if (session.has()) {
      void refetch();
      return;
    }
    return session.subscribe(() => {
      if (session.has()) void refetch();
    });
  }, [guest, refetch]);
}

/**
 * 🆕 D-1106 — **رفعُ ملفٍّ** (`multipart/form-data`): صورةُ الملفّ والغلاف. الترويساتُ نفسُها وإعادةُ
 * المحاولة عند `401` نفسُها كـ`api` — ولا `Content-Type` يدويّاً: `fetch` يكتب الحدَّ (`boundary`) بنفسه.
 */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  if (!session.has()) await session.request();
  for (let attempt = 0; ; attempt++) {
    const headers = await baseHeaders(true, path);
    const res = await fetch(`${CONFIG.apiBase}${path}`, { method: "POST", headers, body: form });
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!json || "error" in json) {
      if (res.status === 401 && attempt < 2) {
        session.clear();
        const fresh = await session.request();
        if (fresh) continue;
      }
      throw new ApiError(json?.error ?? { code: "internal", message_key: "apiInternal" }, res.status);
    }
    invalidateTags(json.invalidates);
    return json.data;
  }
}

/** كتابةٌ تُطبِّق إبطالَها بنفسها — السطرُ الذي يجعل الوسومَ حيّة. */
export async function write<T>(path: string, body: unknown): Promise<T> {
  const r = await api<T>(path, { method: "POST", body });
  invalidateTags(r.invalidates);
  return r.data;
}

/**
 * الترويساتُ المشتركة: الرمزُ إن وُجد، **ولغةُ الحساب في `Accept-Language`**
 * (D-946: لغةُ الويب تغلب لغةَ الجهاز) — فالمساراتُ التي تسقط إليها بلا كوكي
 * (`getLocale`) تعيد العنوانَ والعدَّ بلغة ما يراه المستخدم في الصفحة.
 */
async function baseHeaders(auth: boolean, path = ""): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": currentLocale(),
    /* D-986 — حزامٌ ثانٍ من جهة الهاتف: OkHttp يملك كاشاً قرصيّاً يحترم `max-age`، فقراءةٌ بعد
       كتابةٍ كانت تعود قديمة (تابع ثمّ يرتدّ). `no-cache` يجبره على سؤال الخادم كلَّ مرّة.
       D-1003 — **لما يحمل حالةَ المستخدم فقط** (`/me/` · `/title/` · `/person/` · `/view`):
       صفوفُ «اكتشف» المنسَّقةُ سواءٌ للجميع وصالحةٌ عشرَ دقائق، وكانت تُعاد من الخادم في
       كلِّ فتحٍ — فتُترك لكاش OkHttp كما يقول رأسُها. */
    ...(/\/api\/v1\/(me\/|title\/|person\/|discover\/view)/.test(path) ? { "Cache-Control": "no-cache" } : {}),
  };
  if (auth) {
    /* الجسرُ أوّلاً (Phase 11 · B1)؛ وجلسةُ الدخول العابرةُ سقوطٌ لا يكاد يُبلغ */
    const token = session.get() ?? (await accessToken());
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** مسارٌ قائمٌ من قبل `v1` (بلا غلاف `{data}`) — للبحث والاقتراح. */
export async function rawGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CONFIG.apiBase}${path}`, { headers: await baseHeaders(true, path) });
  if (!res.ok) throw new ApiError({ code: res.status === 429 ? "rate_limited" : "upstream", message_key: res.status === 429 ? "apiRateLimited" : "apiUpstream" }, res.status);
  return (await res.json()) as T;
}
