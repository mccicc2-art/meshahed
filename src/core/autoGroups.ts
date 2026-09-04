/**
 * ============ المجموعاتُ التلقائيّة — منطقٌ خالصٌ بلا قراءة (D-820) ============
 *
 * **حكمُ أحمد**: «نفّذ الـ٢٤» — البندُ الرابع: **مجموعاتٌ تتكوّن وحدَها
 * حول مخرجٍ أو فنّان.**
 *
 * ⚖️ **وليست تبويبَ «الفنانون» بشكلٍ ثانٍ** (القاعدة ٣): **ذاك يعرض من
 * تتابعهم**، **وهذه تكتشف من يتكرّر في مكتبتك ولم تتابعه** — **والفرقُ
 * فرقُ سؤالٍ لا فرقُ رسم**: «من اخترتُ؟» مقابل «ماذا يقول اختياري عنّي؟».
 * **وثمرتُها زرُّ متابعةٍ يحوّل الاكتشافَ إلى اختيار.**
 *
 * 🔴 **ولا مجموعاتِ «سلسلة/عالم»** رغم ورودها في القائمة: **انتماءُ عملٍ
 * إلى مجموعةٍ سينمائيّة (`belongs_to_collection`) لا يُخزَّن في
 * `title_meta`** — **و`FRANCHISES` رفوفٌ محرَّرةٌ بأسماء أعمالٍ مختارة،
 * لا دالّةُ انتماء.** **والغيابُ يُقال غياباً ولا يُخمَّن** (D-063):
 * تلحق يومَ يُخزَّن الحقل، **ولا تُزوَّر بمطابقةِ أسماء.**
 */

/** الحدُّ الأدنى — **عملان صدفةٌ، وثلاثةٌ نمط** */
export const GROUP_MIN = 3;
/** سقفُ ما يُعرض — **قائمةٌ لا تُقرأ ليست قائمة** */
export const GROUP_CAP = 12;

export interface AutoGroupItem {
  key: string;
  media_type: "tv" | "movie";
  tmdb_id: number;
  title: string;
  poster: string | null;
}

export interface AutoGroup {
  kind: "director" | "actor";
  /** اسمُ الشخص — **هو المفتاحُ كذلك**: `title_meta` تخزّن اسماً لا معرّفاً */
  name: string;
  /** مسارُ وجهه إن وُجد — **وغيابُه حرفٌ أوّلُ لا مربّعٌ فارغ** */
  photo: string | null;
  items: AutoGroupItem[];
}

interface MetaLike {
  director: string | null;
  director_profile: string | null;
  top_cast: string[] | null;
  cast_profiles: (string | null)[] | null;
}

interface FollowLike {
  media_type: "tv" | "movie";
  tmdb_id: number;
  title: string;
  poster_path: string | null;
}

/** **اسمٌ يُطابَق بعد تطبيع الفراغات** — «Denis  Villeneuve» و«Denis Villeneuve» واحد */
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * **مكتبةٌ + بطاقاتُ هويّةٍ ⇒ مجموعات.**
 *
 * ⚠️ **والممثّلُ يُحسب من `top_cast` وحدَها**: **هي ما خزّنّاه، وهي
 * الطاقمُ الأوّل** — **وطاقمٌ كاملٌ يجعل كلَّ ممثّلِ مشهدٍ «مجموعة».**
 * ⚠️ **و`cast_profiles` موازيةٌ بالترتيب** (D-718) — **والموازاةُ تُقرأ
 * بالفهرس لا بالبحث**، وطولٌ مختلفٌ يعني `null` لا انزياحاً.
 */
export function buildAutoGroups(
  follows: readonly FollowLike[],
  metas: ReadonlyMap<string, MetaLike>,
  opts: { min?: number; cap?: number } = {},
): AutoGroup[] {
  const min = opts.min ?? GROUP_MIN;
  const cap = opts.cap ?? GROUP_CAP;

  const byPerson = new Map<
    string,
    { kind: "director" | "actor"; name: string; photo: string | null; items: AutoGroupItem[] }
  >();

  const add = (
    kind: "director" | "actor",
    rawName: string,
    photo: string | null,
    item: AutoGroupItem,
  ) => {
    const name = norm(rawName);
    if (!name) return;
    /* **والمفتاحُ يحمل الصفةَ**: **مخرجٌ مثّل في عملٍ آخر مجموعتان لا
       مجموعةٌ واحدةٌ ملتبسة** — **وسؤالُ «أخرج لك» غيرُ «مثّل لك».** */
    const key = `${kind}:${name}`;
    const cur = byPerson.get(key);
    if (cur) {
      if (!cur.items.some((x) => x.key === item.key)) cur.items.push(item);
      if (!cur.photo && photo) cur.photo = photo;
      return;
    }
    byPerson.set(key, { kind, name, photo, items: [item] });
  };

  for (const f of follows) {
    const k = `${f.media_type}-${f.tmdb_id}`;
    const meta = metas.get(k);
    if (!meta) continue;
    const item: AutoGroupItem = {
      key: k,
      media_type: f.media_type,
      tmdb_id: f.tmdb_id,
      title: f.title,
      poster: f.poster_path,
    };
    if (meta.director) add("director", meta.director, meta.director_profile ?? null, item);
    const cast = meta.top_cast ?? [];
    for (let i = 0; i < cast.length; i++) {
      const nameAt = cast[i];
      if (!nameAt) continue;
      add("actor", nameAt, meta.cast_profiles?.[i] ?? null, item);
    }
  }

  /* **والمخرجُ يسبق الممثّل عند تساوي العدد**: **«أخرج لك ستّةً» أدلُّ
     على ذوقٍ من «ظهر في ستّة»** — والظهورُ قد يكون دوراً ثانوياً. */
  return [...byPerson.values()]
    .filter((g) => g.items.length >= min)
    .sort(
      (a, b) =>
        b.items.length - a.items.length ||
        (a.kind === b.kind ? 0 : a.kind === "director" ? -1 : 1) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, cap);
}
