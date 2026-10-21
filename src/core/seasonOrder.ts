/**
 * ====== ترتيبُ المواسم — «المتابَعةُ أوّلاً» (D-1500) ======
 *
 * اقتراحُ أحمد من «أرسل مشكلة أو اقتراح» (٢١ أكتوبر): «الموسم اللي شاهدته ينزل للأخير في ترتيب المواسم».
 * قاعدةٌ واحدةٌ للتطبيق (`SeasonAccordion`) والويب (`EpisodeTracker`) فلا يختلف الترتيبُ بين المنصّتين:
 *
 * • المواسمُ غيرُ المكتملة (والقادمةُ معها) فوق بترتيبها، والمكتملةُ تحتها بترتيبها.
 * • لا يتغيّر شيءٌ إلا إذا كان الترتيبُ سيختلف فعلاً — أي موسمٌ مكتملٌ يسبق موسماً بُثّ ولم يكتمل.
 *   فالعملُ الذي لم يُبدأ، والمكتملُ كلُّه (حتى لو بقي موسمٌ «قريباً»)، يبقيان بترتيب TMDB، ولا يظهر مفتاحُ الترتيب.
 * • من ستّة مواسم مكتملة (`SEASON_FOLD_MIN`، اختيارُ أحمد «٦ أو أكثر») تنطوي في صندوقٍ واحد؛ أقلُّ من ذلك بطاقاتٌ عادية.
 * • الاختيارُ («المتابَعة أولاً» / «الترتيب الأصلي») يُحفظ على الجهاز (اختيارُه «٢ أ») بالمفتاح نفسِه في المنصّتين.
 *
 * والمكتملُ يُحسب **عند فتح الصفحة** لا مع كلِّ تأشير (المستدعي يجمّده): موسمٌ يكتمل تحت الإصبع لا يقفز من مكانه.
 */
export const SEASON_FOLD_MIN = 6;
export const SEASON_ORDER_KEY = "loopz.seasonOrder";

export type SeasonOrder = "progress" | "original";

export function parseSeasonOrder(v: unknown): SeasonOrder {
  return v === "original" ? "original" : "progress";
}

export type SeasonSplit<T> = {
  /** غيرُ المكتملة والقادمة — بترتيبها */
  active: T[];
  /** المكتملة — بترتيبها */
  done: T[];
  /** هل يختلف «المتابَعة أولاً» عن الأصل؟ — وإلّا لا ترتيبَ ولا مفتاح */
  differs: boolean;
  /** تُطوى المكتملة في صندوقٍ واحد */
  fold: boolean;
};

/**
 * `isDone(s)`: الموسمُ مكتمل · `hasAired(s)`: بُثّ منه شيء.
 */
export function splitSeasons<T>(seasons: T[], isDone: (s: T) => boolean, hasAired: (s: T) => boolean): SeasonSplit<T> {
  const active: T[] = [];
  const done: T[] = [];
  let sawDone = false;
  let differs = false;
  for (const s of seasons) {
    if (isDone(s)) {
      done.push(s);
      sawDone = true;
    } else {
      active.push(s);
      /* موسمٌ بُثّ ولم يكتمل بعد موسمٍ مكتمل: هنا وحدَه يفيد الترتيب */
      if (sawDone && hasAired(s)) differs = true;
    }
  }
  return { active, done, differs, fold: differs && done.length >= SEASON_FOLD_MIN };
}
