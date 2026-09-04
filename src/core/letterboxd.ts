// محلّل تصدير Letterboxd — يعمل في المتصفح على ملفات المستخدم نفسها.
//
// **لماذا Letterboxd بدل تراكت (D-153):** تراكت أقفل إنشاء تطبيقات OAuth
// خلف اشتراك VIP، **وتصديرُ CSV عنده ميزةُ VIP أيضاً** — فلا طريق مجانياً
// إليه لا لنا ولا لمستخدمنا. وLetterboxd يصدّر لكل الناس مجاناً وبلا
// مفاتيح ولا OAuth: صندوقٌ يرفعه صاحبه، ونحن نقرؤه في جهازه.
//
// ⚠️ **والتصدير غير الاستيراد، وهذا مزلق:** صفحة Letterboxd الرسمية توثّق
// أعمدة **الاستيراد إليها** (`tmdbID` و`imdbID` و`Rating10`…)، وهي **ليست**
// أعمدة الصندوق الذي تصدّره. الصندوق يحمل الاسم والسنة والرابط والتقييم
// لا معرّفاً خارجياً — فالمطابقة **بالاسم والسنة** كما في TV Time. ومن قرأ
// صفحة الاستيراد وبنى عليها محلّلاً كتب شيئاً لا يعمل.
//
// ولهذا الأعمدة **تُشَمّ بمرادفاتها** (`findCol`) ولا تُفترض حرفياً.

import {
  findCol,
  parseCsv,
  readZip,
  splitYear,
  toDate,
  toInt,
  type ParseOutcome,
  type RawRecord,
} from "./importParse";

const COL = {
  name: ["name", "title", "film", "film name", "film title"],
  year: ["year", "release year", "film year"],
  /** نجومٌ من خمس، بأنصاف — يُضاعف ليصير من عشرة */
  rating: ["rating"],
  /** إن وُجد فهو مقياسنا نفسه، فلا يُضاعف */
  rating10: ["rating10", "rating 10"],
  /** «Watched Date» في اليوميات = يوم المشاهدة، و«Date» = يوم التسجيل */
  watchedAt: ["watched date", "watched_date", "watcheddate"],
  loggedAt: ["date", "logged date"],
} as const;

/**
 * ماذا يعني كلُّ ملفٍّ في الصندوق — **بالاسم لا بالمحتوى**.
 *
 * الملفات كلُّها تتشابه أعمدةً (اسم · سنة · رابط)، فلو حُكم عليها بالشكل
 * لصار **الإعجابُ مشاهدةً** و**قائمةُ الانتظار مكتبةً مُشاهَدة**. الاسم
 * هو ما يحمل المعنى هنا، والمجهول يُترك لا يُخمَّن.
 */
type FileRole = "watched" | "watchlist" | "skip";

function roleOf(path: string): FileRole {
  const p = path.toLowerCase();
  const base = p.split("/").pop() ?? p;

  /* مجلّدات القوائم والإعجابات: أعمدتها كأعمدة المشاهدة تماماً — وقراءتُها
     مشاهدةً كذبٌ صريح على صاحبها. «أعجبني» ليس «شاهدته». */
  if (p.includes("lists/") || p.includes("likes/")) return "skip";

  if (base.startsWith("watchlist")) return "watchlist";

  /* المشاهدة تصل من أربعة ملفات، وتكرارُ الفيلم بينها مقصودٌ لا مشكلة:
     التجميع لاحقاً بمفتاح TMDB، فالفيلم الواحد صفٌّ واحد مهما تكرّر.
     - watched : كلُّ ما شوهد
     - diary   : بتاريخ المشاهدة الحقيقي والتقييم
     - reviews : مثل اليوميات ومعها نصّ لا نستورده
     - ratings : تقييمٌ يعني مشاهدةً عند Letterboxd */
  if (
    base.startsWith("watched") ||
    base.startsWith("diary") ||
    base.startsWith("reviews") ||
    base.startsWith("ratings")
  ) {
    return "watched";
  }

  return "skip"; // profile.csv · comments.csv · وأي جديدٍ لا نعرفه
}

/**
 * نجومُ Letterboxd (٠٫٥ إلى ٥ بأنصاف) إلى مقياسنا (١–١٠).
 *
 * الضرب في اثنين ليس تقريباً بل **تطابقٌ تامّ**: عشر درجاتٍ عندهم وعشرٌ
 * عندنا، فنصفُ نجمةٍ = درجة. و`Rating10` إن وُجد يُؤخذ كما هو — وهو
 * موجودٌ في صيغة الاستيراد وقد يظهر في التصدير يوماً.
 */
function toTen(rating?: string, rating10?: string): number | undefined {
  const r10 = Number(String(rating10 ?? "").trim());
  if (Number.isFinite(r10) && r10 >= 1 && r10 <= 10) return Math.round(r10);

  const r5 = Number(String(rating ?? "").trim());
  if (!Number.isFinite(r5) || r5 <= 0) return undefined;
  return Math.min(10, Math.max(1, Math.round(r5 * 2)));
}

function parseFile(path: string, text: string): RawRecord[] | null {
  const role = roleOf(path);
  if (role === "skip") return null;

  const rows = parseCsv(text);
  if (rows.length < 2) return null;

  const headers = rows[0];
  const cName = findCol(headers, COL.name);
  if (cName < 0) return null; // بلا اسمٍ لا شيء يُطابَق

  const cYear = findCol(headers, COL.year);
  const cRating = findCol(headers, COL.rating);
  const cRating10 = findCol(headers, COL.rating10);
  const cWatched = findCol(headers, COL.watchedAt);
  const cLogged = findCol(headers, COL.loggedAt);

  const out: RawRecord[] = [];
  for (const r of rows.slice(1)) {
    const raw = String(r[cName] ?? "").trim();
    if (!raw) continue;

    /* السنة عمودٌ مستقلّ عادةً، وقد تأتي داخل الاسم «Dune (2021)» —
       فيُجرَّب العمود أوّلاً ثم يُشقّ الاسم */
    const split = splitYear(raw);
    const year = (cYear >= 0 ? toInt(r[cYear]) : null) ?? split.year;
    const name = split.name;

    if (role === "watchlist") {
      out.push({ kind: "movie-watchlist", name, year });
      continue;
    }

    /* **يوم المشاهدة يسبق يوم التسجيل**: من سجّل اليوم فيلماً شاهده قبل
       سنة، تاريخُ التسجيل يكذب على يومياته (D-041: تُحفظ كما عاشها صاحبها) */
    const at =
      (cWatched >= 0 ? toDate(r[cWatched]) : undefined) ??
      (cLogged >= 0 ? toDate(r[cLogged]) : undefined);

    out.push({
      kind: "movie-name",
      name,
      year,
      at,
      rating: toTen(cRating >= 0 ? r[cRating] : undefined, cRating10 >= 0 ? r[cRating10] : undefined),
    });
  }

  return out.length ? out : null;
}

/** المدخل: ملفات المستخدم كما رفعها (zip الصندوق كاملاً، أو csv مفردة) */
export async function parseLetterboxdFiles(
  files: { name: string; buf: ArrayBuffer }[],
): Promise<ParseOutcome> {
  const records: RawRecord[] = [];
  const parsedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const handle = async (name: string, buf: ArrayBuffer) => {
    if (name.toLowerCase().endsWith(".zip")) {
      try {
        for (const entry of await readZip(buf)) {
          await handle(entry.name, entry.bytes.buffer as ArrayBuffer);
        }
      } catch {
        skippedFiles.push(name);
      }
      return;
    }

    /* المتجاهَل عمداً (القوائم والإعجابات والملفّ الشخصي) لا يُعدّ
       «فاشلاً»: إعلانُه في قائمة الفشل يوهم صاحبه أن شيئاً ضاع */
    if (roleOf(name) === "skip") return;

    const got = parseFile(name, new TextDecoder().decode(buf));
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
