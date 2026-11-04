/**
 * ====== 🩺 أين ذهبت اللمسة — أهدافٌ مسجَّلة (تقييمُ ٥ نوفمبر، البند ٢أ — المهمّة ٣١٩) ======
 *
 * **لماذا**: `dock.miss` و`edge.tap` يقولان إنّ نقرةً لم تضغط شيئاً، ولا يقولان **ما الذي كان تحت الإصبع**.
 * بعد R159 (D-1629) بقيت النقراتُ الميتة في الرئيسيّة على الآيفون، وأغلبُها `src=over`: اللمسةُ تحت حافّة الدوك
 * والدوكُ لم يستلمها — فشيءٌ فوقه أخذها. المرشّحون من الكود طبقاتٌ تملأ الشاشة ويتبع لمسُها حالةَ JS (`visible` ·
 * `open`) بينما موضعُها قيمةٌ على الخيط الأصليّ — **ولم يثبت أيٌّ منهم**. وأحمد: «ما ابغى استنتاجات».
 *
 * 🔑 **كلُّ طبقةٍ أو زرٍّ مشتبهٍ به يسجّل نفسَه هنا**: اسماً قصيراً، ودالّةَ قياسٍ في النافذة، ودالّةً تقول هل يقبل
 * اللمسَ الآن **بحسب JS**. لحظةَ النقرة الميتة تُقاس المسجَّلةُ الحيّةُ وتُكتب أسماءُ ما يحوي موضعَ النقرة (`hit`).
 * فـ`hit=none` مع `src=over` يعني: لا شيءَ تعرفه JS فوق الدوك — والعلّةُ إذن في فرقٍ بين JS والخيط الأصليّ
 * (كما في D-1558). ⚖️ **قياسٌ لا إصلاح**: لا يغيّر لمساً ولا رسماً.
 *
 * ⚖️ **لا شيءَ في مسار اللمس**: التسجيلُ عند التركيب، والقياسُ عند النقرة الميتة وحدَها (وهي مرّةٌ في الثانية على
 * الأكثر — حدُّ العلامتين). وقياسٌ لا يعود (عنصرٌ زال) لا يحبس العلامة: مهلةٌ قصيرةٌ ثمّ تُكتب بما وصل.
 *
 * ⚖️ **الأسماءُ قصيرةٌ عمداً**: الخادمُ يقبل نصّاً من ١٦ حرفاً (`[\w.-]`) — اسمان أو ثلاثة بنقطةٍ بينها.
 */
type Measure = (cb: (x: number, y: number, w: number, h: number) => void) => void;
type Target = { name: string; measure: Measure; live: () => boolean };

const targets = new Set<Target>();
const states = new Map<string, () => number>();
const MEASURE_WAIT_MS = 300;
const VALUE_MAX = 16;

/** يسجّل هدفاً ويعيد دالّةَ إزالته — تُنادى عند الفكّ */
export function touchTarget(name: string, measure: Measure, live: () => boolean = () => true): () => void {
  const t: Target = { name, measure, live };
  targets.add(t);
  return () => {
    targets.delete(t);
  };
}

/** رقمٌ حيٌّ يُكتب مع النقرة الميتة (مثل موضع القائمة الجانبيّة على الخيط الأصليّ) */
export function touchState(key: string, read: () => number): () => void {
  states.set(key, read);
  return () => {
    if (states.get(key) === read) states.delete(key);
  };
}

/** القيمُ الحيّةُ الآن — رقمٌ صحيحٌ لكلِّ مفتاح، وما رمى يُسقط */
export function touchStates(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, read] of states) {
    try {
      const v = read();
      if (Number.isFinite(v)) out[k] = Math.round(v);
    } catch {
      /* لا شيء */
    }
  }
  return out;
}

/** أسماءُ الأهداف الحيّة التي تحوي النقطة (بنقطةٍ بينها، مرتّبةً) — أو `none` */
export function targetsAt(x: number, y: number, cb: (names: string) => void) {
  const live = [...targets].filter((t) => {
    try {
      return t.live();
    } catch {
      return false;
    }
  });
  if (live.length === 0 || !(x >= 0)) {
    cb("none");
    return;
  }
  const hits = new Set<string>();
  let left = live.length;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    cb(hits.size ? [...hits].sort().join(".").slice(0, VALUE_MAX) : "none");
  };
  const timer = setTimeout(finish, MEASURE_WAIT_MS);
  for (const t of live) {
    const settle = () => {
      left -= 1;
      if (left === 0) finish();
    };
    try {
      t.measure((tx, ty, w, h) => {
        if (w > 0 && h > 0 && x >= tx && x <= tx + w && y >= ty && y <= ty + h) hits.add(t.name);
        settle();
      });
    } catch {
      settle();
    }
  }
}
