import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { NO_COOKIES, api, queryClient } from "./api";
import { CONFIG } from "./config";
import { session } from "./session";
import { currentLocale } from "./i18n";
import type { PushCap, PushForgetBody, PushRegisterBody } from "@/core/push";
import { defineDmCategory } from "./notifications/dmReply";
import { LoopzWidget } from "../modules/loopz-widget";
import { hasWidgetToken, onWidgetToken } from "./widget/feed";

/**
 * ====== إشعاراتُ الدفع في التطبيق — الإذنُ والرمزُ (D-1305) ======
 *
 * 🔑 **الإذنُ عند أوّل فتحٍ بعد الدخول** (قرارُ أحمد «عند أوّل فتح»، والدخولُ شرطُه): الرمزُ يُسجَّل لحساب، وزائرٌ بلا
 * حسابٍ رمزُه بلا صاحب. فالسؤالُ يُطرح مرّةً متى عرف الجهازُ جلسةً (`session.seen`)، ولا يُعاد إن رُفض — أندرويد نفسُه
 * لا يعرضه ثانيةً، والطريقُ بعدها إعداداتُ النظام (صفٌّ في «الإشعارات»).
 *
 * 🔑 **الرمزُ يُسجَّل في كلِّ إقلاع** لا مرّةً في العمر: اللغةُ قد تبدّلت (نصُّ الإشعار بلغة الجهاز المسجَّلة)، وExpo قد
 * يدوّر الرمز، ومن دخل بحسابٍ آخر يأخذ صفَّ الجهاز (الهجرة ١٩٥).
 *
 * 🔑 **الخروجُ ينسى الجهاز** (`app/push/forget` بلا جلسة): بدونه ترنّ رسائلُ صاحب الحساب على شاشةٍ خرج منها.
 * الرمزُ محفوظٌ في SecureStore كي يُنسى ولو وقع الخروجُ في إقلاعٍ لم يُسجَّل فيه.
 *
 * ⚠️ كلُّ ما هنا صامت: هاتفٌ بلا خدمات Google، أو بناءٌ قديمٌ بلا الوحدة الأصليّة (تحديثٌ عبر الهواء لا يحملها)، يرمي
 * عند أوّل نداء — فيُلتقط ولا يظهر شيء.
 */
export const PUSH_CHANNEL = "default";
const TOKEN_KEY = "loopz.push.token";
const RETRY_MS = 60_000;

type State = "unknown" | "granted" | "denied" | "undetermined" | "unavailable";
let state: State = "unknown";
let registered: string | null = null; /* `رمز|لغة` الذي قبله الخادمُ في هذا الإقلاع */
let busy = false;
let lastTry = 0;

/**
 * 🆕 1.12.7 — ما يقدر عليه هذا الجهاز: «dm-native» = **كودُه الأصليُّ يرسم إشعارَ الرسالة بزرّيه والتطبيقُ مقفول**
 * (`DmPush.kt`)، فيرسلها الخادمُ له «بيانات». الجوابُ من البناء نفسِه (`dmNative` في الجسر — بناءٌ أقدمُ لا يملكها، والتحديثُ
 * عبر الهواء لا يضيفها)، **ومعه رمزُ الودجت** الذي يرسل به الردّ. «dm-data» (D-1408) لم يعد يُعلن: الخادمُ أوقفه.
 */
function dmCaps(): PushCap[] {
  if (Platform.OS !== "android") return [];
  try {
    return LoopzWidget?.dmNative?.() === true && hasWidgetToken() ? ["dm-native"] : [];
  } catch {
    return [];
  }
}
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  /* أندرويد ١٣+: نافذةُ الإذن لا تظهر قبل أن توجد قناة */
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: "Loopz",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#FFD400",
  });
}

/** النافذةُ تُعرض تلقائيّاً مرّةً في عمر التثبيت: من أغلقها بلا جواب لا تلاحقه في كلِّ إقلاع — صفُّ الإعدادات بابُه بعدها */
const ASKED_KEY = "loopz.push.asked";
function askedBefore(): boolean {
  try {
    return SecureStore.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 🔴 إصلاح ٦ أكتوبر (بلاغُ خالد، S24): الشرطُ كان يستثني `status === "denied"` — وأندرويد لا يعرف «لم يُسأل»:
 * قبل أوّل سؤالٍ يردّ `denied` مع `canAskAgain: true`، فلم تُعرض النافذةُ لأحد. **المرجعُ `canAskAgain` وحدَه**
 * لا اسمُ الحالة. وللسبب نفسِه `undetermined` هنا معناها «السؤالُ ما زال ممكناً» (صفُّ الإعدادات يسأل مباشرةً)،
 * و`denied` «رفضٌ نهائيّ» (لا طريقَ إلّا إعداداتُ النظام).
 */
async function readPermission(ask: boolean | "user"): Promise<State> {
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted && ask && p.canAskAgain && (ask === "user" || !askedBefore())) {
    try {
      SecureStore.setItem(ASKED_KEY, "1");
    } catch {
      /* لا شيء */
    }
    p = await Notifications.requestPermissionsAsync();
  }
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

async function sync(ask: boolean | "user") {
  if (busy || !session.seen()) return;
  busy = true;
  try {
    await ensureChannel();
    /* 🆕 D-1406 — زرّا «رد» و«تمييز كمقروءة» بلغة الجهاز الآن (يُعاد في كلِّ إقلاع: اللغةُ قد تبدّلت) */
    await defineDmCategory().catch(() => {});
    const next = await readPermission(ask);
    if (next !== state) {
      state = next;
      emit();
    }
    if (state !== "granted") return;
    const id = projectId();
    if (!id) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const lang = currentLocale() === "en" ? "en" : "ar";
    const caps = dmCaps();
    const key = `${token}|${lang}|${caps.join(",")}`;
    if (registered === key || Date.now() - lastTry < RETRY_MS) return;
    lastTry = Date.now();
    try {
      SecureStore.setItem(TOKEN_KEY, token);
    } catch {
      /* لا شيء */
    }
    const body: PushRegisterBody = { token, lang, platform: Platform.OS === "ios" ? "ios" : "android", caps };
    const r = await api<{ registered: boolean }>("/api/v1/me/push", { method: "POST", body });
    if (r.data.registered) registered = key;
  } catch {
    if (state === "unknown") {
      state = "unavailable";
      emit();
    }
  } finally {
    busy = false;
  }
}

function forget() {
  registered = null;
  let token: string | null = null;
  try {
    token = SecureStore.getItem(TOKEN_KEY);
  } catch {
    /* لا شيء */
  }
  if (!token) return;
  SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  const body: PushForgetBody = { token };
  void fetch(`${CONFIG.apiBase}/api/v1/app/push/forget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: NO_COOKIES }).catch(() => {});
}

/**
 * 🆕 D-1307 (تسجيلُ خالد، ٦ أكتوبر): شريطُ الإشعار كان ينزل فوق المحادثة نفسِها مع كلِّ رسالةٍ من صاحبها — والرسالةُ
 * أمامه. **الخيطُ المفتوحُ الآن** تعلنه شاشةُ المحادثة عند تركيزها وتمسحه عند مغادرتها، ورسالةٌ منه والتطبيقُ في الواجهة
 * تمرّ بلا شريطٍ ولا صوتٍ ولا سطرٍ في القائمة. رسالةٌ من غيره، وكلُّ نوعٍ آخر، كما كان.
 */
let openPeer: string | null = null;
const PEER_URL = /^\/messages\?with=([0-9a-fA-F-]{36})$/;
/* 🆕 القروب (الهجرة ٢٠٥): شاشتُه تعلن `g:<معرّف>`، ورسالتُه تصل بـ`/messages?group=` */
const GROUP_URL = /^\/messages\?group=([0-9a-fA-F-]{36})$/;
function inOpenThread(n: Notifications.Notification): boolean {
  if (!openPeer || AppState.currentState !== "active") return false;
  const url = (n.request.content.data as { url?: unknown } | undefined)?.url;
  if (typeof url !== "string") return false;
  const m = PEER_URL.exec(url);
  if (m) return m[1].toLowerCase() === openPeer.toLowerCase();
  const g = GROUP_URL.exec(url);
  return !!g && `g:${g[1].toLowerCase()}` === openPeer.toLowerCase();
}

/**
 * 🆕 1.12.7 — **فتحُ المحادثة يمسح إشعاراتِها من الشريط** (كالواتس): ما قرأتَه أمامك لا يبقى ينتظرك فوق. نوعان يُمسحان:
 * إشعارُ Expo (الآيفون وما قبل 1.12.7) يُعرف برابطه `?with=`/`?group=`، وإشعارُ الكود الأصليّ (`DmPush.kt`) يُعرف بوسمه —
 * Expo يسمّيه `expo-notifications://foreign_notifications?tag=<peer أو g:قروب>&id=…` ويمسحه بالاسم نفسِه.
 */
async function clearThread(key: string): Promise<void> {
  try {
    const want = key.toLowerCase();
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      const id = n.request.identifier;
      let hit = false;
      if (id.startsWith("expo-notifications://foreign_notifications")) {
        const tag = /[?&]tag=([^&]+)/.exec(id)?.[1];
        hit = !!tag && decodeURIComponent(tag).toLowerCase() === want;
      } else {
        const url = (n.request.content.data as { url?: unknown } | undefined)?.url;
        if (typeof url === "string") {
          const m = PEER_URL.exec(url);
          const g = GROUP_URL.exec(url);
          hit = m ? m[1].toLowerCase() === want : !!g && `g:${g[1].toLowerCase()}` === want;
        }
      }
      if (hit) await Notifications.dismissNotificationAsync(id).catch(() => {});
    }
  } catch {
    /* المسحُ تحسين — فشلُه لا يمسّ فتحَ المحادثة */
  }
}

export const push = {
  state: (): State => state,
  /** شاشةُ المحادثة: `peer` عند التركيز، و`null` عند المغادرة (تمسح ما أعلنته هي وحدَها) */
  setOpenPeer(peer: string | null, only?: string) {
    if (peer === null && only && openPeer !== only) return;
    openPeer = peer;
    if (peer) void clearThread(peer);
    /* 🆕 1.12.7 — والكودُ الأصليُّ يعرفه أيضاً: رسالةٌ من المحادثة المفتوحة لا يرسمها والتطبيقُ أمامك (`DmPush.kt`) */
    try {
      LoopzWidget?.setDmOpen?.(peer);
    } catch {
      /* بناءٌ أقدمُ بلا الدالّة */
    }
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  /** من صفّ «السماح بالإشعارات» في الإعدادات، وبعد العودة من إعدادات النظام */
  refresh: (ask = false) => sync(ask ? "user" : false),
};

/* ===== التسجيلُ عند الإقلاع (وحدةُ أثرٍ جانبيّ كـ`ota`) ===== */
try {
  /* التطبيقُ في الواجهة: الإشعارُ يظهر شريطاً ويُدرج — والشاراتُ تُجدَّد (الظرفُ والجرسُ لا ينتظران الاستطلاع) */
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      /* رسالةٌ «بيانات» بلا عنوانٍ ولا نصّ لا تُعرض فارغةً (إشعارُ الرسالة الأصليّ يرسمه `DmPush.kt` لا Expo) */
      const empty = !n.request.content.title && !n.request.content.body;
      const show = !empty && !inOpenThread(n);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  Notifications.addNotificationReceivedListener(() => {
    void queryClient.invalidateQueries({ queryKey: ["me:messages"] });
    void queryClient.invalidateQueries({ queryKey: ["me:signals"] });
    void queryClient.invalidateQueries({ queryKey: ["me:badges"] });
  });
  /* مهلةٌ قصيرة: نافذةُ الإذن لا تسبق أوّلَ رسمةٍ للرئيسيّة */
  setTimeout(() => void sync(true), 2500);
  /* جلسةٌ ظهرت (دخولٌ للتوّ) ⇒ يُسأل ويُسجَّل؛ والعودةُ من الخلفيّة تعيد قراءةَ الإذن (قد تغيّر في إعدادات النظام) */
  session.subscribe(() => void sync(true));
  session.onSignOut(forget);
  /* 🆕 1.12.7 — رمزُ الودجت كُتب للتوّ ⇒ «dm-native» صار صادقاً: التسجيلُ يُعاد الآن */
  onWidgetToken(() => {
    lastTry = 0;
    void sync(false);
  });
  AppState.addEventListener("change", (s) => {
    if (s === "active") void sync(false);
  });
} catch {
  state = "unavailable";
}
