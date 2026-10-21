import { useCallback, useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
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
  /* 🆕 N3-fix — **وسمُ ملفّي يُبطل شاشةَ الملفّ الأصليّة** (تسجيلُ أحمد ٣٠ سبتمبر: رتّب التبويبات في «التخصيص» وحفظ، فبقي ملفُّه
     بترتيبه القديم نحو عشرين ثانية): الخادمُ يقول `user:me:profile` بعد التخصيص وتعديل الملفّ والسمة والخصوصيّة، ومفتاحُ الشاشة
     `profile:<اسم>` (N1) — فلم يكن الوسمُ يجده، وانتظرت الشاشةُ `staleTime`. المطابقةُ بالبادئة: `me` لا يعرف اسمَ المستخدم، والملفّاتُ
     المفتوحةُ غيرُ ملفّي تُعلَّم شائخةً فقط (لا جلبَ لما لا يُرى). */
  if (tags.some((t) => t.startsWith("user:") && t.endsWith(":profile")))
    void queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("profile:") });
}

/**
 * 🔴 **نداءاتُ التطبيق بلا كوكيز** (D-1409، تشخيصُ ١٥ أكتوبر): «حمايةُ التوافق» في Vercel (Skew Protection، ١٢ ساعة) تربط
 * من يحمل كوكي `__vdpl` بالنسخة التي فتحها — والـWebView يضعه، ونداءُ التطبيق الأصليُّ يحمل كوكيز الـWebView نفسَها
 * (جرّةٌ واحدةٌ للنطاق). فكان الخادمُ يجيب التطبيقَ من نسخةٍ عمرُها ساعات: إشعارُ الرسالة خرج بالطريقة القديمة بعد نشر
 * الجديدة (السجلُّ قرأ الأجهزةَ بكود ما قبل الهجرة ٢٠٤). والتطبيقُ لا يحتاج كوكياً أصلاً — هويّتُه `Bearer`. فالنداءُ هنا
 * بلا كوكيز يصل آخرَ نسخةٍ دائماً، وصفحاتُ الويب محميّةٌ كما كانت. الاستثناءُ الوحيد سكُّ الجلسة من كوكي الويب (`ownSession`).
 */
export const NO_COOKIES: RequestCredentials = "omit";

export async function api<T>(
  path: string,
  /* 🆕 D-1232 — `signal`: من يملك مهلةً يقطع الطلبَ نفسَه فيُفرغ مكانَه في الشبكة (لا يبقى معلّقاً خلف ردٍّ لن يُقرأ) */
  init?: { method?: "GET" | "POST"; body?: unknown; auth?: boolean; signal?: AbortSignal },
): Promise<{ data: T; invalidates: Tag[] }> {
  const auth = init?.auth !== false;
  /* بلا رمزٍ في الذاكرة يُطلب قبل النداء لا بعده — نداءٌ سيُرفض حتماً كلفةٌ بلا معنى */
  if (auth && !session.has()) await session.request();
  for (let attempt = 0; ; attempt++) {
    const headers = await baseHeaders(auth, path);
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${CONFIG.apiBase}${path}`, {
      credentials: NO_COOKIES,
      method: init?.method ?? "GET",
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init?.signal,
    });
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!json || "error" in json) {
      if (res.status === 401 && auth && attempt < 2) {
        session.clear();
        const fresh = await session.request();
        if (fresh) continue;
      }
      const error: AppError = json?.error ?? { code: "internal", message_key: "apiInternal" };
      /* 🆕 D-1341 — الخادمُ يقول «أكمل الترحيب»: تُكتب العلامةُ فيُنزل الغلافُ الشاشاتِ الأصليّةَ ويعود بصاحبها إليه */
      if (error.message_key === "apiFinishWelcome") session.setWelcomePending(true);
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
 * الخلفيّة**، و`useGuestUpgrade` يعيد الجلبَ لحظةَ يصل. **والشاشةُ لا ترسم حالتي من ردِّ زائر** —
 * أفعالُها وعلاماتُها هيكلٌ معطَّلٌ حتى الترقية: لا «غير مشاهَد» كاذب، ولا فعلَ على حالٍ لا نعرفها.
 */
export type Soft<T> = T & { _guest?: true };

export async function softGet<T extends object>(path: string, signal?: AbortSignal): Promise<Soft<T>> {
  if (session.has()) return (await api<T>(path, { signal })).data;
  void session.request();
  const r = await api<T>(path, { auth: false, signal });
  return { ...r.data, _guest: true };
}

export function isGuest(v: unknown): boolean {
  return !!v && typeof v === "object" && (v as { _guest?: unknown })._guest === true;
}

/**
 * ردُّ زائرٍ على الشاشة ⇒ يُعاد الجلبُ حين يصل الرمز (أو فوراً إن كان وصل قبل التركيب).
 *
 * 🆕 D-1144 — **ولا تعطيلَ صامتاً**: يطلب الرمزَ بنفسه، فإن انتهى الطلبُ بلا رمزٍ أعاد `failed` —
 * والشاشةُ تقول «تعذّر تحميل حالتك» مع «حاول مجدداً» (`retry`) بدل صفِّ أفعالٍ خافتٍ لا يستجيب ولا يشرح
 * (تسجيلُ خالد، ٢٦ سبتمبر). `retry` يطلب الرمزَ ثانيةً؛ وصولُه يُطلق الجلبَ عبر الاشتراك.
 */
export function useGuestUpgrade(guest: boolean, refetch: () => unknown): { failed: boolean; retry: () => void } {
  const [failed, setFailed] = useState(false);
  const ask = useCallback(() => {
    setFailed(false);
    void session.request().then((tok) => {
      if (!tok) setFailed(true);
    });
  }, []);
  useEffect(() => {
    if (!guest) {
      setFailed(false);
      return;
    }
    if (session.has()) {
      void refetch();
      return;
    }
    ask();
    return session.subscribe(() => {
      if (session.has()) void refetch();
    });
  }, [guest, refetch, ask]);
  return { failed: guest && failed, retry: ask };
}

/**
 * 🔴 M3-fix — **جزءُ ملفٍّ في النموذج من ملفٍّ على القرص** — الشكلُ الوحيدُ الذي يقبله `fetch` في Expo 57.
 *
 * `fetch` العامُّ صار `expo/fetch` (يثبّته `expo/src/winter`)، و`convertFormData` فيه **لا يقبل جزءَ `{uri,name,type}`**
 * الذي كان RN يقرأ ملفَّه بنفسه: يرمي «Unsupported FormDataPart implementation» قبل أن يخرج الطلب — فلا أثرَ في
 * الخادم ولا في المخزن (بلاغُ خالد بلقطة ٢٨ سبتمبر بعد أن سمّت M3-fix السبب). يقبل ما له `bytes()`، ويأخذ اسمَ
 * الملفّ ونوعَه من `name`/`type` — فهذا كائنٌ بالثلاثة، والبايتاتُ تُقرأ من القرص حين يُبنى الجسم (ومحاولةُ `401`
 * الثانية تقرؤها ثانيةً). **وصورةُ الملفّ والغلاف كانتا على الشكل القديم نفسِه** فتمرّان من هنا أيضاً.
 */
export function filePart(uri: string, name: string, type: string): Blob {
  return { name, type, bytes: async () => new Uint8Array(await new File(uri).arrayBuffer()) } as unknown as Blob;
}

/**
 * 🆕 D-1359 — **تنزيلُ ردٍّ خامٍ إلى ملف** (تصديرُ البيانات): الجسمُ يُكتب من الشبكة إلى القرص في الطبقة الأصليّة فلا يمرّ نصّاً
 * بذاكرة JS. الترويساتُ نفسُها وإعادةُ المحاولة عند `401` نفسُها كـ`api`. `downloadFileAsync` يرمي عند غير 2xx خطأً رسالتُه
 * تحمل رقمَ الحالة ولا يترك ملفّاً — يُقرأ الرقمُ منها؛ وما لا يُقرأ «خللٌ» عامّ (الشاشةُ تقول «جرّب مرة أخرى»).
 */
export async function downloadTo(path: string, dest: File): Promise<File> {
  if (!session.has()) await session.request();
  for (let attempt = 0; ; attempt++) {
    const headers = await baseHeaders(true, path);
    try {
      return await File.downloadFileAsync(`${CONFIG.apiBase}${path}`, dest, { headers, idempotent: true });
    } catch (e) {
      const status = Number(/\b([45]\d\d)\b/.exec(e instanceof Error ? e.message : "")?.[1] ?? 0);
      if (status === 401 && attempt < 2) {
        session.clear();
        const fresh = await session.request();
        if (fresh) continue;
      }
      throw new ApiError(status === 429 ? { code: "rate_limited", message_key: "apiRateLimited" } : { code: "internal", message_key: "apiInternal" }, status);
    }
  }
}

/**
 * 🆕 D-1106 — **رفعُ ملفٍّ** (`multipart/form-data`): صورةُ الملفّ والغلاف. الترويساتُ نفسُها وإعادةُ
 * المحاولة عند `401` نفسُها كـ`api` — ولا `Content-Type` يدويّاً: `fetch` يكتب الحدَّ (`boundary`) بنفسه.
 */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  if (!session.has()) await session.request();
  for (let attempt = 0; ; attempt++) {
    const headers = await baseHeaders(true, path);
    const res = await fetch(`${CONFIG.apiBase}${path}`, { method: "POST", headers, body: form, credentials: NO_COOKIES });
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!json || "error" in json) {
      if (res.status === 401 && attempt < 2) {
        session.clear();
        const fresh = await session.request();
        if (fresh) continue;
      }
      if (json?.error?.message_key === "apiFinishWelcome") session.setWelcomePending(true); /* D-1341 */
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
/**
 * 🆕 D-1354 — **«أفهم بوّابةَ اسم المستخدم»**: الخادمُ يحبس عضواً قائماً بلا اسم مستخدم عند شاشة «هذا أنت» —
 * **لمن يملك تلك الشاشةَ وحدَه**. تطبيقٌ على تحديثٍ أقدم لا يرسل هذه الترويسة فيُحكم له بالختم وحدَه كما كان
 * (`lib/v1.ts` → `gateAware`)، وإلّا رُفع له الترحيبُ بخطواته الخمس فوق مكتبةٍ قائمة. كلُّ نداءٍ لـ`/api/v1` يحملها،
 * ومنه النداءاتُ الخامُ برمز الدخول (`prime` · سؤالُ `/me` في شاشة الدخول). ووسمُ الـWebView توأمُها (`WebLayer`).
 */
export const GATE_HEADERS = { "X-Loopz-Gate": "2" } as const;

async function baseHeaders(auth: boolean, path = ""): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...GATE_HEADERS,
    "Accept-Language": currentLocale(),
    /* 🔴 D-1501 — **لغةُ التطبيق صريحةً** (أحمد ٢١ أكتوبر: «إذا التطبيق باللغة الإنجليزي يظهر الكلام والمحتوى بالانجلش»): الخادمُ
       (`getLocale`) يقدّم كوكي اللغة على `Accept-Language`، وكوكي قديمٌ في مخزن الهاتف كان يعيد النبذةَ والأنواعَ بلغةٍ غيرِ لغة
       التطبيق. هذه الترويسةُ تغلب الكوكي — توأمُ ما يرسله الغلافُ لصفحات الويب (`WebLayer.langHeaders`، D-1463) */
    "x-loopz-locale": currentLocale(),
    /* D-986 — حزامٌ ثانٍ من جهة الهاتف: OkHttp يملك كاشاً قرصيّاً يحترم `max-age`، فقراءةٌ بعد
       كتابةٍ كانت تعود قديمة (تابع ثمّ يرتدّ). `no-cache` يجبره على سؤال الخادم كلَّ مرّة.
       D-1003 — **لما يحمل حالةَ المستخدم فقط** (`/me/` · `/title/` · `/person/` · `/view`):
       صفوفُ «اكتشف» المنسَّقةُ سواءٌ للجميع وصالحةٌ عشرَ دقائق، وكانت تُعاد من الخادم في
       كلِّ فتحٍ — فتُترك لكاش OkHttp كما يقول رأسُها. */
    /* 🆕 D-1486 — و`discover/trailers`: شخصيّةٌ كالمكتبة (اقتراحاتُه) — نسخةٌ فارغةٌ في كاش القرص كانت تُعاد خمسَ دقائق */
    ...(/\/api\/v1\/(me\/|title\/|person\/|discover\/view|discover\/trailers)/.test(path) ? { "Cache-Control": "no-cache" } : {}),
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
  const res = await fetch(`${CONFIG.apiBase}${path}`, { headers: await baseHeaders(true, path), credentials: NO_COOKIES });
  if (!res.ok) throw new ApiError({ code: res.status === 429 ? "rate_limited" : "upstream", message_key: res.status === 429 ? "apiRateLimited" : "apiUpstream" }, res.status);
  return (await res.json()) as T;
}
