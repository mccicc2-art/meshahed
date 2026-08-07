import { normalizeTerm } from "@/lib/media";

/**
 * قاموس الجنسيات — «سعودي» يصير فلتراً، لا نتيجة بحث.
 *
 * لماذا قاموسٌ لا بحثٌ ذكي: TMDB لا يفهم «مسلسلات سعودية». مسار البحث عنده
 * يطابق العناوين وحدها، فالكلمة تعود بأعمالٍ اسمها فيه «سعودي» لا بأعمالٍ
 * سعودية. والبحث الدلاليّ الحقيقي (متجهات وتضمينات) يحتاج قاعدةً وكلفةً
 * شهرية ومسارَ تحديث — مخالفٌ لمبدأ «شخصٌ واحد يقدر على صيانته».
 * والقاموس يحلّ ٩٥٪ من الحالات بصفر بنية تحتية، ويُقرأ ويُصحَّح بالعين.
 *
 * والمخرَج فلترُ تصفّحٍ لا نتائج مُقحمة: تُعرض رقاقةٌ واحدة فوق النتائج
 * تقود إلى «اكتشف» بالفلتر مطبَّقاً. لا تتغيّر الشاشة تحت المستخدم، ولا
 * تختلط نتائجُ عنوانٍ بنتائجِ بلد — يُقترح، ويُتجاهل بلا ثمن.
 *
 * **حدٌّ صريح: الأشخاص خارج هذا القاموس.** جنسية الشخص تعيش في
 * `place_of_birth` داخل `/person/{id}` وحده — غير قابلةٍ للبحث ولا
 * للتصفية عند TMDB. فلا سبيل إلى «ممثلون سعوديون» إلا بجلب مئات الأشخاص
 * وقراءة تفاصيل كلٍّ منهم. الطريق العملي إليهم: صفّ طاقم العمل داخل أي
 * عملٍ سعودي.
 */

export interface NationalityHit {
  /** رمز اللغة في `BROWSE_LANGS` */
  lang: string;
  /** رمز البلد في `BROWSE_COUNTRIES` — للعربية وحدها */
  country: string | null;
  ar: string;
  en: string;
}

interface Entry extends NationalityHit {
  terms: string[];
}

/* المصطلحات تُكتب هنا كما يكتبها الناس؛ التطبيع يتكفّل بالهمزات والتاء
   المربوطة والألف المقصورة، فلا حاجة لتكرار كل صورة */
const TABLE: Entry[] = [
  { lang: "ar", country: "SA", ar: "السعودية", en: "Saudi Arabia", terms: ["سعودي", "سعودية", "السعودية", "السعودي", "saudi"] },
  { lang: "ar", country: "EG", ar: "مصر", en: "Egypt", terms: ["مصري", "مصرية", "المصري", "مصر", "egyptian"] },
  { lang: "ar", country: "KW", ar: "الكويت", en: "Kuwait", terms: ["كويتي", "كويتية", "الكويت", "kuwaiti"] },
  { lang: "ar", country: "AE", ar: "الإمارات", en: "the UAE", terms: ["اماراتي", "اماراتية", "الامارات", "emirati"] },
  { lang: "ar", country: "LB", ar: "لبنان", en: "Lebanon", terms: ["لبناني", "لبنانية", "لبنان", "lebanese"] },
  { lang: "ar", country: "SY", ar: "سوريا", en: "Syria", terms: ["سوري", "سورية", "سوريا", "syrian"] },
  { lang: "ar", country: "JO", ar: "الأردن", en: "Jordan", terms: ["اردني", "اردنية", "الاردن", "jordanian"] },
  { lang: "ar", country: "IQ", ar: "العراق", en: "Iraq", terms: ["عراقي", "عراقية", "العراق", "iraqi"] },
  { lang: "ar", country: "MA", ar: "المغرب", en: "Morocco", terms: ["مغربي", "مغربية", "المغرب", "moroccan"] },
  { lang: "ar", country: "TN", ar: "تونس", en: "Tunisia", terms: ["تونسي", "تونسية", "تونس", "tunisian"] },
  { lang: "ar", country: "QA", ar: "قطر", en: "Qatar", terms: ["قطري", "قطرية", "قطر", "qatari"] },
  { lang: "ar", country: "BH", ar: "البحرين", en: "Bahrain", terms: ["بحريني", "بحرينية", "البحرين", "bahraini"] },
  /* «عربي» بلا بلد: من كتبها يريد العربية كلها لا بلداً بعينه */
  { lang: "ar", country: null, ar: "العالم العربي", en: "the Arab world", terms: ["عربي", "عربية", "عرب", "arabic"] },
  { lang: "tr", country: null, ar: "تركيا", en: "Turkey", terms: ["تركي", "تركية", "تركيا", "turkish"] },
  { lang: "ko", country: null, ar: "كوريا", en: "Korea", terms: ["كوري", "كورية", "كوريا", "korean"] },
  { lang: "ja", country: null, ar: "اليابان", en: "Japan", terms: ["ياباني", "يابانية", "اليابان", "japanese"] },
  { lang: "hi", country: null, ar: "الهند", en: "India", terms: ["هندي", "هندية", "الهند", "بوليوود", "indian", "bollywood"] },
  { lang: "es", country: null, ar: "إسبانيا", en: "Spain", terms: ["اسباني", "اسبانية", "اسبانيا", "spanish"] },
];

/** فهرسٌ مسطَّح يُبنى مرّةً عند تحميل الوحدة، لا عند كل بحث */
const INDEX = new Map<string, NationalityHit>();
for (const e of TABLE) {
  const hit: NationalityHit = { lang: e.lang, country: e.country, ar: e.ar, en: e.en };
  for (const term of e.terms) {
    const key = normalizeTerm(term);
    if (key && !INDEX.has(key)) INDEX.set(key, hit);
  }
}

/**
 * هل في نصّ البحث كلمةُ جنسية؟
 *
 * تُجرَّب العبارة كاملةً أولاً ثم كلماتها: «مسلسلات سعودية» يطابق على
 * الكلمة، و«سعودية» يطابق على العبارة — والأولوية للعبارة كي لا تلتقط
 * كلمةٌ عابرة في جملةٍ طويلة فلتراً لم يُطلب.
 */
export function matchNationality(query: string): NationalityHit | null {
  const norm = normalizeTerm(query);
  if (!norm) return null;

  const whole = INDEX.get(norm);
  if (whole) return whole;

  const words = norm.split(" ");
  // كلمتان فأقل: البحث قصيرٌ ونيّةُ الجنسية فيه واضحة. أطولُ من ذلك عنوانُ
  // عملٍ غالباً، والاقتراح فيه تشويشٌ لا مساعدة
  if (words.length > 2) return null;
  for (const w of words) {
    const hit = INDEX.get(w);
    if (hit) return hit;
  }
  return null;
}
