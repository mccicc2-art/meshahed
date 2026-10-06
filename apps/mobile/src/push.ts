import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api, queryClient } from "./api";
import { CONFIG } from "./config";
import { session } from "./session";
import { currentLocale } from "./i18n";
import type { PushForgetBody, PushRegisterBody } from "@/core/push";

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

async function readPermission(ask: boolean | "user"): Promise<State> {
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted && ask && p.canAskAgain && p.status !== "denied" && (ask === "user" || !askedBefore())) {
    try {
      SecureStore.setItem(ASKED_KEY, "1");
    } catch {
      /* لا شيء */
    }
    p = await Notifications.requestPermissionsAsync();
  }
  return p.granted ? "granted" : p.status === "undetermined" ? "undetermined" : "denied";
}

async function sync(ask: boolean | "user") {
  if (busy || !session.seen()) return;
  busy = true;
  try {
    await ensureChannel();
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
    const key = `${token}|${lang}`;
    if (registered === key || Date.now() - lastTry < RETRY_MS) return;
    lastTry = Date.now();
    try {
      SecureStore.setItem(TOKEN_KEY, token);
    } catch {
      /* لا شيء */
    }
    const body: PushRegisterBody = { token, lang, platform: Platform.OS === "ios" ? "ios" : "android" };
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
  void fetch(`${CONFIG.apiBase}/api/v1/app/push/forget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}

export const push = {
  state: (): State => state,
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
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
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
  AppState.addEventListener("change", (s) => {
    if (s === "active") void sync(false);
  });
} catch {
  state = "unavailable";
}
