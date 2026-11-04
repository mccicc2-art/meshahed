// محلّل تصدير MyAnimeList — يعمل في الجهاز على ملفّ صاحبه، كإخوته (`imdb.ts` · `letterboxd.ts` · `tvtime.ts`).
//
// **الملفّ**: من MyAnimeList ← Profile ← Export ← «Export My Anime List»: `animelist_….xml.gz` (XML مضغوطٌ gzip)،
// لكلِّ عملٍ صفٌّ `<anime>` فيه رقمُه هناك (`series_animedb_id`) وما شاهده منه وحالتُه وتقييمُه وتاريخا البدء والانتهاء.
//
// ⚠️ **وMyAnimeList يعدّ كلَّ موسمٍ عملاً**، وTMDB يجمع المواسم في مسلسلٍ واحد — فالربطُ ليس بالاسم بل بجدول Fribb
// (`lib/fribb.ts`، المنشور على GitHub): رقمُ MAL ⇐ رقمُ TMDB **وموسمُه وإزاحتُه**. يُطابَق على الخادم (الجدولُ ٧٫٥ م.ب)،
// وهنا يُقرأ الملفّ وحده. والقراراتُ (أحمد ٤ نوفمبر «١ أ · ٢ أ · ٣ أ»):
// - **الحالات** («١ أ»): «Completed» ⇐ حلقاتُ ذلك الموسم كلُّها · «Watching» ⇐ ما سجّله منها · «On-Hold» ⇐ موقوفٌ مؤقّتاً
//   وما شاهده · «Dropped» ⇐ متروكٌ وما شاهده · «Plan to Watch» ⇐ في المكتبة بلا مشاهدة.
// - **التاريخ** («٢ أ»): المكتملُ بيوم انتهائه، وغيرُه بيوم بدئه، وبلا تاريخٍ يومُ الاستيراد.
// - **الأوفا والخاصّات** بلا موسمٍ عاديٍّ في TMDB («٣ أ»): لا تُخمَّن — تُذكر بأسمائها فيما لم نجده (قرارُ الخادم).
//
// 🔑 **XML بلا `DOMParser`**: محرّكُ التطبيق لا يحمله، والملفُّ مسطّحٌ (وسومٌ بلا تداخلٍ داخل `<anime>`) — فقراءةٌ بالأنماط
// تكفيه وتعمل في الطرفين بالحرف نفسِه.

import { gunzip, readZip, toDate, type ParseOutcome, type RawRecord } from "./importParse.ts";

export type MalStatus = "watching" | "completed" | "onhold" | "dropped" | "plan";

/** الحالةُ كما تكتبها MAL — نصّاً في التصدير الحاليّ، ورقماً في القديم (١ مشاهدة · ٢ مكتمل · ٣ موقوف · ٤ متروك · ٦ أنوي) */
export function malStatusOf(raw: string | undefined): MalStatus | null {
  const k = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (k === "watching" || k === "1") return "watching";
  if (k === "completed" || k === "2") return "completed";
  if (k === "onhold" || k === "3") return "onhold";
  if (k === "dropped" || k === "4") return "dropped";
  if (k === "plantowatch" || k === "6") return "plan";
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** قيمةُ وسمٍ داخل صفّ — بـ CDATA أو بدونه، والكياناتُ الخمسة تُفكّ */
function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${name}>`));
  if (!m) return undefined;
  if (m[1] != null) return m[1].trim();
  return (m[2] ?? "").replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]).trim();
}

const nat = (v: string | undefined) => {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

/** يُستخرج للاختبار: نصُّ XML ⇐ سجلّاتُه، و`null` لملفٍّ ليس قائمةَ أنمي من MAL (قائمةُ المانغا تُترك) */
export function parseMalXml(text: string): RawRecord[] | null {
  if (!/<myanimelist[\s>]/i.test(text)) return null;
  const out: RawRecord[] = [];
  for (const m of text.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const b = m[1];
    const mal = nat(tag(b, "series_animedb_id"));
    const status = malStatusOf(tag(b, "my_status"));
    if (!mal || !status) continue;
    const score = nat(tag(b, "my_score"));
    /* «٢ أ»: المكتملُ بيوم انتهائه وغيرُه بيوم بدئه — و`0000-00-00` (لا تاريخ) يسقط في `toDate` */
    const finish = toDate(tag(b, "my_finish_date"));
    const start = toDate(tag(b, "my_start_date"));
    out.push({
      kind: "mal",
      mal,
      name: tag(b, "series_title") || `MAL ${mal}`,
      status,
      watched: nat(tag(b, "my_watched_episodes")),
      total: nat(tag(b, "series_episodes")),
      rating: score >= 1 && score <= 10 ? score : undefined,
      at: status === "completed" ? (finish ?? start) : start,
    });
  }
  return out.length ? out : null;
}

/** المدخل: الملفّ كما نزل (`.xml.gz`)، أو مفكوكاً (`.xml`)، أو داخل zip */
export async function parseMalFiles(files: { name: string; buf: ArrayBuffer }[]): Promise<ParseOutcome> {
  const records: RawRecord[] = [];
  const parsedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const handle = async (name: string, buf: ArrayBuffer) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        for (const entry of await readZip(buf)) await handle(entry.name, entry.bytes.buffer as ArrayBuffer);
      } catch {
        skippedFiles.push(name);
      }
      return;
    }
    let text: string | null = null;
    try {
      if (lower.endsWith(".gz")) text = new TextDecoder().decode(await gunzip(new Uint8Array(buf)));
      else if (lower.endsWith(".xml")) text = new TextDecoder().decode(buf);
    } catch {
      text = null;
    }
    const got = text ? parseMalXml(text) : null;
    if (got) {
      records.push(...got);
      parsedFiles.push(name);
    } else {
      skippedFiles.push(name);
    }
  };

  for (const f of files) await handle(f.name, f.buf);
  return { records, parsedFiles, skippedFiles };
}
