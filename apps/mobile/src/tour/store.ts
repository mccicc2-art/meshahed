import { TOUR_VERSION, liveTour, type TourState } from "@/core/tour";
import { api, qk, queryClient } from "../api";
import { HOME_KEY } from "../home/useHome";
import type { HomePayload, LibraryPayload, UiStateBody } from "../contracts";

/**
 * ====== حالةُ الجولة في التطبيق — مخزنٌ خارج React (🆕 D-1318 · Phase 11-T · T1) ======
 *
 * 🔑 **حالةُ الحساب هي الأصل** (`profiles.ui_state.tour`): تصل مع حمولتَي الرئيسيّة والمكتبة بعد `liveTour` — فمن
 * بدأ الجولةَ في المتصفّح لا تُعرَض عليه هنا، ومن أنهاها هنا لا تُعرَض عليه هناك. وهذا المخزنُ يحمل **ما كتبته هذه
 * الجلسة** فوقها: الكتابةُ تُرى فوراً ولا تنتظر جوابَ الخادم (التقدّمُ شأنُ الجهاز الفعّال — حجّةُ `persistTourState`).
 *
 * 🔑 **وثلاثُ قيمٍ لا اثنتان**: `undefined` = لا أعرف بعد (لا حمولةَ، أو حمولةٌ محفوظةٌ من قبل هذه الرفعة بلا
 * الحقل) · `null` = لم تُعرَض عليه جولةُ هذا الإصدار · حالة. **والعرضُ لا يُطلق على «لا أعرف»** — عرضٌ يظهر ثمّ
 * يتبيّن أنّه أنهاها أمس على جهازٍ آخر إزعاجٌ لا تعريف.
 *
 * مخزنٌ لا سياق: يقرؤه مضيفُ الجولة وصفُّ «المساعدة» وقاعدةُ التلميحات — وثلاثتُهم في شجراتٍ مختلفة، وتبدّلُه لا
 * يعيد رسمَ إلّا من اشترك (نهجُ `navDock` و`webLayer`).
 */
type Snap = {
  /** ما كتبته هذه الجلسة — يغلب حمولةَ الخادم حتى تلحق به */
  local: TourState | null | undefined;
  /** الجولةُ على الشاشة الآن (عرضاً أو خطوةً) — التلميحاتُ تصمت ما دامت (`useHintTurn`) */
  busy: boolean;
  /**
   * الرئيسيّةُ هي الظاهرة — **تقوله الرئيسيّةُ نفسُها** (`useFocusEffect`). حالةُ التبويبات داخل `(tabs)` لا تُكتب في
   * حالة المكدّس الجذر قبل أوّل تبديل (عُرفُ React Navigation: `route.state` غائبٌ حتى يحدث تنقّلٌ داخله) — وعند
   * الإقلاع، حين يُعرَض الاقتراح، لم يحدث بعد.
   */
  home: boolean;
};

let snap: Snap = { local: undefined, busy: false, home: false };
const subs = new Set<() => void>();
const set = (next: Partial<Snap>) => {
  snap = { ...snap, ...next };
  subs.forEach((f) => f());
};

function post(body: UiStateBody) {
  /* `api` لا `write`: الجوابُ يُبطل `me:library`، وإعادةُ جلب المكتبة كاملةً مع كلِّ «التالي» ثمنٌ بلا مكسب —
     الكاشُ يُحدَّث هنا بيدٍ بالقيمة نفسِها. والفشلُ صامت: التقدّمُ محفوظٌ في الجلسة، والحسابُ ذاكرةُ الأجهزة الأخرى. */
  void api<{ ok: boolean }>("/api/v1/me/prefs/ui-state", { method: "POST", body }).catch(() => {});
}

export const tourStore = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  get: () => snap,
  /** الحالةُ التي تُقرأ: ما كتبته الجلسة، وإلّا حمولةُ الخادم — وإصدارٌ أقدمُ فيهما «لم تُعرَض» */
  resolve(server: TourState | null | undefined): TourState | null | undefined {
    if (snap.local !== undefined) return liveTour(snap.local);
    return server === undefined ? undefined : liveTour(server);
  },
  save(next: Omit<TourState, "v" | "id">) {
    const state: TourState = { v: TOUR_VERSION, id: "basics", ...next };
    set({ local: state });
    /* الكاشُ المحفوظُ على القرص يحمل الحمولتين — فإقلاعٌ بلا شبكةٍ لا يعرض جولةً أُنهيت */
    queryClient.setQueryData<HomePayload>(HOME_KEY, (p) => (p ? { ...p, tour: state } : p));
    queryClient.setQueryData<LibraryPayload>(qk.tag("me:library"), (p) => (p ? { ...p, tour: state } : p));
    post({ tour: state });
  },
  /** «ابدأ الجولة» من «المساعدة» أو من بطاقة العرض — المضيفُ يرى `active` فيُبحر إلى الخطوة الأولى */
  start() {
    tourStore.save({ i: 0, s: "active" });
  },
  setBusy(busy: boolean) {
    if (snap.busy !== busy) set({ busy });
  },
  busy: () => snap.busy,
  setHome(home: boolean) {
    if (snap.home !== home) set({ home });
  },
  /**
   * تلميحاتٌ شرحتها الجولةُ تُعلَّم مقروءةً (حكمُ أحمد: لا يقرأ الجملةَ مرّتين). **في الحمولتين معاً**: الرئيسيّةُ
   * تقرأ `home.hints` والبحثُ والمكتبةُ `me:library.hints`.
   */
  markHints(ids: string[]) {
    const add = (h: string[] | undefined) => [...new Set([...(h ?? []), ...ids])];
    queryClient.setQueryData<HomePayload>(HOME_KEY, (p) => (p ? { ...p, hints: add(p.hints) } : p));
    queryClient.setQueryData<LibraryPayload>(qk.tag("me:library"), (p) => (p ? { ...p, hints: add(p.hints) } : p));
    post({ addHints: ids });
  },
};
