import { AppState } from "react-native";
import { api } from "./api";
import { session } from "./session";

/**
 * ====== نبضةُ الحضور من التطبيق (D-1307) ======
 *
 * أختُ `PresencePing` في الويب بإيقاعها حرفاً: نبضةٌ بعد الإقلاع، ثمّ كلَّ أربع دقائق والتطبيقُ في الواجهة، ونبضةٌ عند
 * العودة من الخلفيّة — وحارسُ دقيقةٍ هنا فوق حارس الدالّة في القاعدة. قبلها كان الحضورُ يُكتب مرّةً عند الإقلاع وحدَه،
 * فمن يكتب لصاحبه من التطبيق ظهر عنده غائباً (بلاغُ خالد، ٦ أكتوبر).
 *
 * ⚠️ صامتةٌ كلُّها: انقطاعُها يجمّد «آخر ظهور» ولا يكسر شاشة. وبلا جلسةٍ معروفة لا تُرسل (زائرٌ لا حضورَ له).
 */
const EVERY_MS = 240_000;
const GUARD_MS = 60_000;
let last = 0;

function beat() {
  if (AppState.currentState !== "active" || !session.seen()) return;
  const now = Date.now();
  if (now - last < GUARD_MS) return;
  last = now;
  void api("/api/v1/me/presence", { method: "POST" }).catch(() => {});
}

try {
  setTimeout(beat, 5000);
  setInterval(beat, EVERY_MS);
  AppState.addEventListener("change", (s) => {
    if (s === "active") beat();
  });
} catch {
  /* لا شيء */
}
