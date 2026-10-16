/**
 * ====== 🆕 D-1443 — النصُّ الغنيّ: روابطُ ومنشن في مسحٍ واحد — للتطبيق والويب، للرسائل والنقاش ======
 *
 * وُلد في فقاعة الرسالة في التطبيق (D-1436 المنشن · D-1439 الروابط)، ثمّ طلبه أحمد في النقاش («كل المزايا اللي عملناها في
 * الرسائل الخاصة اعملها في المناقشات»). نسخةٌ ثانيةٌ من المسح كانت ستفترق عن الأولى في أوّل إصلاح — فهنا مرّةً، والرسمُ عند كلِّ
 * قارئ (لونُه وخطُّه ولمستُه).
 * - `@اسم`: قاعدةُ `mentionsIn` (٣–٢٤ من a–z · 0–9 · `_`، والحرفُ قبله ليس حرفاً) — **ويُعدّ منشناً ما يقبله `isMention` وحده**
 *   (عضوٌ في القروب · مشاركٌ في النقاش)؛ غيرُه نصٌّ عاديّ.
 * - رابط: يبدأ بـ`http(s)://` أو `www.` أو نطاقِ لوبز. علامةُ الترقيم في آخر الجملة ليست منه.
 */
export type RichToken =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; name: string }
  | { kind: "link"; text: string; href: string };

const TOKEN_RE = /(^|[^A-Za-z0-9_@/.])(@[A-Za-z0-9_]{3,24}(?![A-Za-z0-9_])|(?:https?:\/\/|www\.|loopztv\.com\/)[^\s]+)/gi;
const HINT = /@|https?:\/\/|www\.|loopztv\.com\//i;
const TRAIL = /[.,!?؟،:;)\]}»"']+$/;

/** نطاقاتُ لوبز: مسارُها شاشةٌ عندنا (أصليّةٌ في التطبيق، صفحةٌ في الويب) لا موقعٌ غريب */
export const LOOPZ_HOSTS: ReadonlySet<string> = new Set(["loopztv.com", "www.loopztv.com", "meshahed.vercel.app"]);

/** مسارُ رابطِ لوبز (`/tv/1399?x=1`) — أو `null` لغيره ولما لا يُقرأ رابطاً */
export function loopzPath(href: string): string | null {
  try {
    const u = new URL(href);
    return LOOPZ_HOSTS.has(u.hostname.toLowerCase()) ? `${u.pathname}${u.search}` : null;
  } catch {
    return null;
  }
}

export function richTokens(str: string, isMention: (name: string) => boolean = () => false): RichToken[] {
  if (!str || !HINT.test(str)) return [{ kind: "text", text: str }];
  const out: RichToken[] = [];
  let last = 0;
  for (const m of str.matchAll(TOKEN_RE)) {
    const start = (m.index ?? 0) + (m[1]?.length ?? 0);
    let tok = m[2] ?? "";
    if (tok.startsWith("@")) {
      const name = tok.slice(1).toLowerCase();
      if (!isMention(name)) continue;
      if (start > last) out.push({ kind: "text", text: str.slice(last, start) });
      out.push({ kind: "mention", text: tok, name });
      last = start + tok.length;
      continue;
    }
    tok = tok.replace(TRAIL, "");
    if (!tok) continue;
    if (start > last) out.push({ kind: "text", text: str.slice(last, start) });
    out.push({ kind: "link", text: tok, href: /^https?:\/\//i.test(tok) ? tok : `https://${tok}` });
    last = start + tok.length;
  }
  if (!out.length) return [{ kind: "text", text: str }];
  if (last < str.length) out.push({ kind: "text", text: str.slice(last) });
  return out;
}
