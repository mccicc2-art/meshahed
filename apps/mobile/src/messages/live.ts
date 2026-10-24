import { AppState, type AppStateStatus } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../auth";
import { queryClient } from "../api";
import { session } from "../session";
import { mark } from "../perfMarks";

/**
 * ====== فوريّةُ «الرسائل» — طبقتان لا واحدة (D-067 ثمّ D-069) · Phase 11-M · M4 (خطّة §٣/§٧) ======
 *
 * 🔑 **الأولى Realtime**: قناةٌ على جداول الخيط الثلاثة (`title_shares` · `list_shares` · `share_replies`) — **إشارةُ
 * إيقاظٍ لا ناقل** (D-069): وصولُ صفٍّ يعيد طلبَ `GET /api/v1/me/messages` بعد نافذة ١٥٠ms تجمع الدفقة، والقراءةُ من مسار
 * الخادم نفسِه (RLS كما هي) — فلا مسارَ قراءةٍ ثانٍ. **والقناةُ تحمل رمزَ جلسة التطبيق** (`realtime.setAuth`) **ويُجدَّد
 * مع كلِّ رمزٍ جديد** (`session.subscribe`) — وإلّا انقطعت بعد ساعةٍ بصمت (خطّة §٧).
 *
 * 🔑 **الثانية الاستطلاع كلَّ ٢٠ ثانية** شبكةَ أمان — قناةٌ تسقط بصمت (شبكةُ جوّال) لا تُجمّد المحادثة (`usePoll` في الويب).
 *
 * 🔑 **وتصمتان في الخلفيّة** (`AppState`) — لا قناةَ مفتوحةً ولا مؤقّتَ والتطبيقُ خلف غيره (بطاريّة)، **والعودةُ تجدّد فوراً**
 * ثمّ تعيد الاشتراك. **قناةٌ واحدةٌ للتطبيق كلِّه**: الصندوقُ والمحادثةُ فوقه يحجزانها بعدّاد (`retainLive`) — شاشتان
 * مفتوحتان لا تعنيان قناتين ولا استطلاعين.
 */
/* 🆕 D-1380 — والرسائلُ النصّيّةُ المباشرة (الهجرة ٢٠٠) */
/* 🆕 والقروبات (الهجرة ٢٠٥): رسائلُها، وأعضاؤها (القراءةُ ✓✓ · الإضافةُ · الخروج) */
const TABLES = ["title_shares", "list_shares", "share_replies", "direct_messages", "dm_group_messages", "dm_group_members"] as const;
const POLL_MS = 20_000;
const COALESCE_MS = 150;
/** مفتاحُ الكاش — وسمُ الخادم نفسُه (`me:messages`)، فكتاباتُه تُبطله بلا قاعدةٍ ثانية */
export const MESSAGES_KEY = ["me:messages"] as const;

let holders = 0;
/** 🆕 1.12.7 — من يحتاج الاستطلاعَ أيضاً (شاشاتُ الرسائل)؛ الرئيسيّةُ تكتفي بـRealtime فلا طلبَ كلَّ ٢٠ث */
let pollers = 0;
let channel: RealtimeChannel | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let appSub: { remove: () => void } | null = null;
let tokenSub: (() => void) | null = null;
let lastToken: string | null = null;
/* A-19 (المدقّق ٢٤ أكتوبر) — إعادةُ الاشتراك بعد سقوط القناة */
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retries = 0;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;
let active = AppState.currentState === "active";

/** يعيد طلبَ الصندوق (والمحادثةِ وسطرِ حضورها — كلُّها تحت المفتاح نفسِه) — المرئيُّ وحدَه */
function wake(delay = COALESCE_MS) {
  if (wakeTimer) return;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
    /* 🆕 N2-fix2 — **والإشعاراتُ معه** (أحمد ٢٩ سبتمبر: طلبُ متابعةٍ ثانٍ وصل القاعدةَ ولم يظهر): تبويبُ «الإشعارات» كان يُجلب عند
       فتحه وحدَه، فطلبٌ يصل وهو مفتوحٌ لا يظهر حتى سحبِ التحديث. الاستطلاعُ (٢٠ث) وإيقاظُ Realtime يُحدّثانه الآن — `invalidate`
       لا يطلب إلّا ما هو معروضٌ (مشترَكٌ فيه). */
    void queryClient.invalidateQueries({ queryKey: ["me:signals"] });
    /* 🆕 1.12.7 — **وشارتا الرئيسيّة**: إشعارُ الرسالة يرسمه الكودُ الأصليُّ الآن (`DmPush.kt`) فلا يمرّ بمستمع Expo الذي كان
       يجدّدها — فإشارةُ Realtime هي التي تقول «وصل جديد» والتطبيقُ مفتوحٌ على أيّ شاشة */
    void queryClient.invalidateQueries({ queryKey: ["me:badges"] });
  }, delay);
}

async function authorize(): Promise<boolean> {
  const tok = session.get() ?? (await session.request());
  if (!tok) return false;
  if (tok !== lastToken) {
    lastToken = tok;
    await Promise.resolve(supabase.realtime.setAuth(tok)).catch(() => {});
  }
  return true;
}

async function subscribe() {
  if (channel || !active || holders === 0) return;
  const t0 = Date.now();
  if (!(await authorize())) {
    mark("messages.live", Date.now() - t0, { result: "none", why: "token" });
    return;
  }
  /* انتظرنا الرمز: ربّما أُغلقت الشاشاتُ أو ذهب التطبيقُ إلى الخلفيّة أو اشترك غيرُنا في الأثناء */
  if (channel || !active || holders === 0) return;
  let ch = supabase.channel(`inbox:${Date.now()}`);
  for (const table of TABLES) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => wake());
  let reported = false;
  const mine = ch;
  channel = ch;
  ch.subscribe((status) => {
    if (!reported && (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")) {
      reported = true;
      mark("messages.live", Date.now() - t0, status === "SUBSCRIBED" ? { result: "ok" } : { result: "none", why: status.toLowerCase().slice(0, 16) });
    }
    if (status === "SUBSCRIBED") {
      /* عادت بعد سقوط ⇒ ما فاتها في الأثناء يُجلب الآن */
      if (retries > 0) wake(0);
      retries = 0;
      return;
    }
    /* A-19 (المدقّق ٢٤ أكتوبر) — قناةٌ سقطت (خطأ · مهلة · إغلاقٌ لم نطلبه) كانت تبقى في `channel` فلا يُعاد الاشتراكُ حتى
       الخروجِ إلى الخلفيّة والعودة، والرئيسيّةُ بلا استطلاعٍ تعتمد عليها وحدَها في الشارات. الآن تُزال ويُعاد الاشتراكُ بمهلةٍ
       تتضاعف (٢ث … ٦٠ث). وإغلاقُنا نحن (`unsubscribe`) يُفرغ `channel` قبله فلا يُعدّ سقوطاً. */
    if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && channel === mine) {
      channel = null;
      lastToken = null;
      void supabase.removeChannel(mine).catch(() => {});
      scheduleRetry();
    }
  });
}

function scheduleRetry() {
  if (retryTimer || !active || holders === 0) return;
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(retries, 5));
  retries++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void subscribe();
  }, delay);
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retries = 0;
}

function unsubscribe() {
  clearRetry();
  const ch = channel;
  channel = null;
  /* الاشتراكُ التالي يضع الرمزَ من جديد — حدثُ دخولٍ أو خروجٍ في العميل قد يكون أعاد القناةَ إلى المفتاح العامّ بيننا */
  lastToken = null;
  if (ch) void supabase.removeChannel(ch).catch(() => {});
}

function startPoll() {
  if (poll || !active || pollers === 0) return;
  poll = setInterval(() => wake(0), POLL_MS);
}
function stopPoll() {
  if (poll) clearInterval(poll);
  poll = null;
}

function onAppState(next: AppStateStatus) {
  const was = active;
  active = next === "active";
  if (active && !was) {
    /* العودةُ من الخلفيّة: ما فات يُجلب الآن، ثمّ القناةُ والاستطلاعُ من جديد */
    wake(0);
    startPoll();
    void subscribe();
  } else if (!active && was) {
    stopPoll();
    unsubscribe();
  }
}

/** شاشةٌ تحتاج الفوريّة — تعيد دالّةَ التحرير. الأولى تفتح القناةَ والاستطلاع، والأخيرةُ تغلقهما. */
export function retainLive(opts: { poll?: boolean } = {}): () => void {
  const polls = opts.poll !== false;
  holders++;
  if (polls) {
    pollers++;
    startPoll();
  }
  if (holders === 1) {
    active = AppState.currentState === "active";
    appSub = AppState.addEventListener("change", onAppState);
    /* رمزٌ جديد (تجديدُ الجلسة المملوكة أو الجسر) ⇐ القناةُ تحمله قبل أن يشيخ القديم */
    tokenSub = session.subscribe(() => {
      const tok = session.get();
      if (tok && tok !== lastToken && channel) void authorize();
      else if (tok && !channel) void subscribe();
    });
    startPoll();
    void subscribe();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    if (polls && --pollers === 0) stopPoll();
    if (holders > 0) return;
    appSub?.remove();
    appSub = null;
    tokenSub?.();
    tokenSub = null;
    stopPoll();
    unsubscribe();
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
  };
}
