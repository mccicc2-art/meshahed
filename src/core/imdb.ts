// محلّل تصدير IMDb — يعمل في الجهاز على ملفات المستخدم نفسها، كأخويه (`letterboxd.ts` · `tvtime.ts`).
//
// **لماذا هو أدقُّ الأربعة:** كلُّ صفٍّ يحمل معرّفَ العمل في IMDb (`Const` = `tt…`)، وTMDB يجد العملَ به
// مباشرةً (`/find`) — **فلا تخمينَ بالاسم والسنة** يخطئ في «The Office» الثلاثة. والخادمُ كان يعرف هذا
// الطريق قبل أن يصله ملفّ (`resolveImportItems` · `kind: "imdb"`).
//
// ⚠️ **وIMDb لا يحفظ سجلَّ مشاهدة** — يحفظ تقييماتٍ وقائمةَ «أشاهده لاحقاً» وقوائمَ صاحبها. فمعنى كلِّ صفٍّ
// قرارٌ لا قراءة (أحمد ٤ نوفمبر):
// - **فيلمٌ قيّمتَه** ⇐ شاهدتَه، بتقييمه.
// - **مسلسلٌ قيّمتَه** ⇐ شاهدتَه **كلَّه** («١ ب») — كلُّ ما عُرض منه يُعلَّم على الخادم.
// - **حلقةٌ قيّمتَها** ⇐ شاهدتَها **وما قبلها** («٢ أ»).
// - **ويومُ التقييم يومُ المشاهدة** في اليوميات («٣ أ») — أقربُ ما في الملف إلى الحقيقة.
// - **قوائمُه** تدخل قوائمَه في Loopz خاصّةً، باسم الملف وبترتيبها («٤ أ»).
// - الألعابُ والبودكاست والفيديو الموسيقيّ ليست أعمالاً نتتبّعها: تُترك بصمت.
//
// 🔑 **وما يعنيه الملفُّ يُعرف من أعمدته لا من اسمه وحده**: ملفُّ التقييمات بلا `Position`، وقائمةُ المشاهدة
// والقوائمُ بها — والفرقُ بينهما الاسم («watchlist»). والأعمدةُ تُشَمّ بمرادفاتها (`findCol`): IMDb غيّر
// ترويساته بين التصدير القديم والجديد (`Title Type` «tvSeries» ثم «TV Series»).

import { findCol, parseCsv, readZip, toDate, toInt, type ParseOutcome, type RawRecord } from "./importParse.ts";

const COL = {
  id: ["const", "tconst", "imdb id", "imdbid", "id"],
  title: ["title", "name"],
  type: ["title type", "titletype", "type"],
  rating: ["your rating", "rating"],
  rated: ["date rated", "date_rated", "rated"],
  position: ["position"],
} as const;

/** نوعُ العمل في IMDb ⇐ جهتُه عندنا. `null` = ليس عملاً نتتبّعه */
export function mediaOfImdbType(raw: string | undefined): "movie" | "tv" | "episode" | null {
  const k = String(raw ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (k === "tvepisode" || k === "episode") return "episode";
  if (k === "tvseries" || k === "tvminiseries" || k === "series" || k === "miniseries") return "tv";
  /* الفيلمُ التلفزيونيُّ والقصيرُ والخاصُّ أفلامٌ عند TMDB — هناك يجدها `/find` */
  if (k === "movie" || k === "feature" || k === "tvmovie" || k === "short" || k === "tvshort" || k === "video" || k === "tvspecial") return "movie";
  return null; // videogame · podcastseries · podcastepisode · musicvideo …
}

/** تقييمُ IMDb من عشرة — مقياسُنا نفسُه، فلا تحويل */
function toRating(v: string | undefined): number | undefined {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n) : undefined;
}

/** اسمُ القائمة من اسم ملفّها — بلا مسارٍ ولا امتداد، و«IMDb» لاسمٍ فارغ */
export function listNameOf(path: string): string {
  const base = (path.split("/").pop() ?? path).replace(/\.csv$/i, "").replace(/[_]+/g, " ").trim();
  return base.slice(0, 60) || "IMDb";
}

type FileRole = "ratings" | "watchlist" | "list";

/** يُستخرج للاختبار: ملفٌّ واحدٌ ⇐ سجلّاتُه، و`null` لملفٍّ ليس من IMDb */
export function parseImdbCsv(path: string, text: string): RawRecord[] | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const headers = rows[0];
  const cId = findCol(headers, COL.id);
  const cType = findCol(headers, COL.type);
  if (cId < 0 || cType < 0) return null; // بلا معرّفٍ ونوعٍ ليس تصديرَ IMDb

  const cTitle = findCol(headers, COL.title);
  const cRating = findCol(headers, COL.rating);
  const cRated = findCol(headers, COL.rated);
  const cPos = findCol(headers, COL.position);

  const base = (path.split("/").pop() ?? path).toLowerCase();
  const role: FileRole = cPos < 0 ? "ratings" : base.includes("watchlist") ? "watchlist" : "list";
  const list = role === "list" ? listNameOf(path) : undefined;

  const out: RawRecord[] = [];
  for (const r of rows.slice(1)) {
    const imdb = String(r[cId] ?? "").trim();
    if (!/^tt\d{5,12}$/.test(imdb)) continue;
    const media = mediaOfImdbType(r[cType]);
    if (!media) continue;
    const name = String(cTitle >= 0 ? (r[cTitle] ?? "") : "").trim() || imdb;
    const rating = cRating >= 0 ? toRating(r[cRating]) : undefined;
    const at = cRated >= 0 ? toDate(r[cRated]) : undefined;

    if (role === "list") {
      /* الحلقةُ لا تدخل قائمةً عندنا — عناصرُ القائمة أعمالٌ لا حلقات */
      if (media !== "episode") out.push({ kind: "imdb", imdb, media, name, role: "list", list, pos: toInt(r[cPos]) ?? out.length + 1 });
    } else if (role === "watchlist") {
      if (media !== "episode") out.push({ kind: "imdb", imdb, media, name, role: "watchlist" });
    }
    /* **التقييمُ مشاهدةٌ أينما ورد**: ملفُّ التقييمات، وعمودُ «Your Rating» في القائمة وقائمة المشاهدة — تقييمُ صاحبها
       نفسِه. وتكرارُه بين الملفّات لا يضرّ: التجميعُ بمعرّف TMDB (`buildImport`) */
    if (rating != null) out.push({ kind: "imdb", imdb, media, name, role: "rated", rating, at });
  }
  return out.length ? out : null;
}

/** المدخل: ملفات المستخدم كما رفعها (csv مفردة أو عدّة، أو zip يجمعها) */
export async function parseImdbFiles(files: { name: string; buf: ArrayBuffer }[]): Promise<ParseOutcome> {
  const records: RawRecord[] = [];
  const parsedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const handle = async (name: string, buf: ArrayBuffer) => {
    if (name.toLowerCase().endsWith(".zip")) {
      try {
        for (const entry of await readZip(buf)) await handle(entry.name, entry.bytes.buffer as ArrayBuffer);
      } catch {
        skippedFiles.push(name);
      }
      return;
    }
    const got = name.toLowerCase().endsWith(".csv") ? parseImdbCsv(name, new TextDecoder().decode(buf)) : null;
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
