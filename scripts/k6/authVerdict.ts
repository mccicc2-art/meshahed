/**
 * ====== K6a — حكمُ الخادم على الخروج والدخول ======
 *
 * **ولمَ من الخادم لا من الجهاز؟** لأنّ علاماتِ التطبيق تُرسل عبر الشبكة التي نختبرها نفسِها، وتُكتب بعد أن
 * يقرّر الكودُ أنّه «نجح» — وعطلا ٢٧ سبتمبر (الخروجُ بضغطتين والدخولُ بمحاولتين) لم يظهرا في أيِّ علامة، وظهرا
 * في سجلّ Supabase وحدَه. **الخادمُ يعدّ ما حدث لا ما ظُنّ أنّه حدث**: خروجٌ سليم = نداءُ `logout` واحد، ودخولٌ
 * سليم = نافذةُ Google واحدة (`authorize` إلى مخطّط التطبيق) + تبادلُ PKCE واحدٌ ناجح.
 *
 * الصفوفُ من `AUTH_LOG_SQL` (Supabase MCP `query_logs`)؛ الحكمُ هنا دالّةٌ نقيّة لأنّ محرّكَ السجلّات يرفض
 * دوالَّ النوافذ والمصفوفات («Backend error»، ٢٨ سبتمبر) — فالتقسيمُ إلى حلقاتٍ يجري خارجه ويُختبر.
 */

export type AuthEvent = "logout" | "authorize" | "pkce";
export type AuthRow = { t: string; ev: AuthEvent; st?: string };

export type Verdict = "PASS" | "no-login" | "FAIL:repeat" | "FAIL:no-exchange" | "FAIL:double-logout";

export type Episode = {
  /** أوّلُ حدثٍ في الحلقة (UTC كما جاء من السجلّ) */
  start: string;
  logouts: number;
  windows: number;
  pkce: number;
  verdict: Verdict;
};

/** نداءا خروجٍ بينهما أقلُّ من هذا بلا دخول = ضغطةٌ واحدةٌ أرسلت مرّتين، أو ضغطتان لأنّ الأولى لم تُخرج */
export const DOUBLE_LOGOUT_MS = 20_000;

/**
 * السجلُّ نفسُه — **نداءاتُ التطبيق وحدَها**: نافذةُ Google التي ترجع إلى `com.loopztv.app` (لا دخولُ الويب)،
 * وتبادلُ PKCE من `supabase-js` في react-native، والخروجُ من أيِّ جهة (الغلافُ يرسله عبر `/auth/signout`
 * في الخادم — لذا يأتي من `node`). **الحالةُ الناجحة وحدَها** تُعدّ: تبادلٌ فشل ليس دخولاً.
 * ⚠️ لا يُفرَز بمستخدم: نافذةُ Google لا تحمل هويّةً بعد — فالنافذةُ الزمنيّةُ تُضيَّق على وقت الاختبار.
 */
export const AUTH_LOG_SQL = `select formatDateTime(timestamp,'%Y-%m-%d %H:%i:%S') as t,
 multiIf(log_attributes['request.path']='/auth/v1/logout','logout',
         log_attributes['request.path']='/auth/v1/authorize','authorize','pkce') as ev,
 log_attributes['response.status_code'] as st
from logs where source='edge_logs' and (
 (log_attributes['request.path']='/auth/v1/authorize' and log_attributes['request.search'] like '%redirect_to=com.loopztv.app%')
 or (log_attributes['request.path']='/auth/v1/token' and log_attributes['request.search']='?grant_type=pkce'
     and log_attributes['request.headers.x_client_info'] like '%react-native%' and log_attributes['response.status_code']='200')
 or (log_attributes['request.path']='/auth/v1/logout' and log_attributes['response.status_code']='204'))
order by timestamp`;

function ms(t: string): number {
  /* السجلُّ يعطي «YYYY-MM-DD HH:MM:SS» أو ISO — كلاهما UTC */
  const n = Date.parse(t.includes("T") ? (t.endsWith("Z") ? t : `${t}Z`) : `${t.replace(" ", "T")}Z`);
  return Number.isFinite(n) ? n : 0;
}

function judge(e: Omit<Episode, "verdict">, doubled: boolean): Verdict {
  if (doubled) return "FAIL:double-logout";
  if (e.windows === 0) return e.pkce === 0 ? "no-login" : "FAIL:repeat";
  if (e.windows === 1 && e.pkce === 1) return "PASS";
  if (e.pkce === 0) return "FAIL:no-exchange";
  return "FAIL:repeat";
}

/**
 * الحلقةُ تبدأ بكلِّ خروج (أو ببداية النافذة) وتمتدّ إلى الخروج التالي. خروجٌ ثانٍ خلال `DOUBLE_LOGOUT_MS`
 * بلا دخولٍ بينهما لا يفتح حلقةً جديدة — يُعدّ في الحلقة نفسِها ويُسقطها.
 */
export function authVerdict(rows: readonly AuthRow[]): Episode[] {
  const sorted = [...rows].sort((a, b) => ms(a.t) - ms(b.t));
  const out: Episode[] = [];
  let cur: Omit<Episode, "verdict"> | null = null;
  let doubled = false;
  let lastLogout = -Infinity;
  const close = () => {
    if (cur) out.push({ ...cur, verdict: judge(cur, doubled) });
  };
  for (const r of sorted) {
    const at = ms(r.t);
    if (r.ev === "logout") {
      if (cur && cur.windows === 0 && cur.pkce === 0 && at - lastLogout < DOUBLE_LOGOUT_MS) {
        cur.logouts++;
        doubled = true;
        lastLogout = at;
        continue;
      }
      close();
      cur = { start: r.t, logouts: 1, windows: 0, pkce: 0 };
      doubled = false;
      lastLogout = at;
      continue;
    }
    if (!cur) cur = { start: r.t, logouts: 0, windows: 0, pkce: 0 };
    if (r.ev === "authorize") cur.windows++;
    else cur.pkce++;
  }
  close();
  return out;
}

/** سطرٌ واحدٌ لكلِّ حلقة + خلاصة — ما يُلصق في المحادثة أو في `04` */
export function formatVerdict(eps: readonly Episode[]): string {
  const lines = eps.map((e) => `${e.start}  logout=${e.logouts} google=${e.windows} pkce=${e.pkce}  ${e.verdict}`);
  const judged = eps.filter((e) => e.verdict !== "no-login");
  const pass = judged.filter((e) => e.verdict === "PASS").length;
  lines.push(`— ${pass}/${judged.length} PASS`);
  return lines.join("\n");
}
