import type React from "react";

/**
 * **وجهُ بطاقة المشاركة — رسمٌ خالصٌ بلا قراءةٍ واحدة** (D-715).
 *
 * ================= ولماذا ملفٌّ مستقلٌّ عن المسار =================
 *
 * 🔴 **لأن `satori` كذّابةٌ في وقت البناء وصادقةٌ في وقت الرسم**:
 * المترجِمُ يقبل كلَّ ما هنا، **وأربعةُ أعطالٍ منفصلةٍ سقطت في الإنتاج
 * بـ500 في D-697** — Fragment داخل `<svg>`، وقيمةُ نمطٍ `undefined`،
 * وجملةٌ عربيّةٌ بلا bidi، وكلمةٌ كبيرةٌ تُقاس منفصلةً وتُرسم موصولة.
 * **ومسارُ `route.tsx` لا يُستدعى إلّا بجلسةٍ حقيقيّة، فلا يُجرَّب
 * محلّيّاً** — **ودالّةٌ خالصةٌ تُرسم ببياناتٍ وهميّةٍ في سطرين.**
 * **فالفصلُ هنا شرطُ الاختبار لا ترتيبُ ملفّات.**
 *
 * ================= ⚖️ 🆕 والوجهُ صار الصفحةَ نفسَها (D-720) =================
 *
 * **حكمُ أحمد**: «في مشاركة الإحصائيات أبغى أرسل الصفحة نفسها — الصورة
 * للهيدر الأوّل مع الكارد، **والكارد ما يكون داخل الهيدر يكون تحته**
 * مثل التصميم بالضبط».
 *
 * ⚖️ **نقضٌ لتخطيط D-715**: كانت الملصقاتُ **خلفيّةَ الصورة كلِّها**
 * والشريطُ في قاعها — **فالبطاقةُ كانت تلبس ألوانَ الصفحة ولا تلبس
 * بنيتَها.** **والبنيةُ هي المعنى هنا**: بطاقةٌ سينمائيّةٌ مغلقةٌ على
 * ملصقاتها، ثمّ شريطُ أرقامٍ عارٍ، ثمّ بطاقةُ ذوقٍ مستقلّة — **ثلاثةُ
 * أجسامٍ لا جسمٌ واحدٌ ملوَّن.**
 * 🔑 **والدرسُ العامّ**: **«اجعلها تشبه الصفحة» ليست طلبَ لونٍ بل طلبَ
 * تخطيط** — **وصورةٌ تنسخ ألوانَ سطحٍ وتخالف ترتيبَه تُقرأ سطحاً آخر.**
 *
 * ⚠️ **والقياسُ صار طوليّاً** (١٠٨٠×١٩٢٠ بدل ١٢٠٠×٦٣٠): **الصفحةُ عمودٌ
 * والعرضيُّ لا يحمل عموداً.** **ولا يكسر هذا معاينةَ الروابط**:
 * `ShareCard` تشارك **ملفَّ صورةٍ** عبر واجهة النظام لا رابطاً بمعاينة
 * (`og:image` لها مسارُها الخاصّ في `app/opengraph-image.tsx`) —
 * **فالنسبةُ حرّةٌ هنا وحدَها.**
 */

export interface ShareStripCell {
  /* 🆕 **و`check` أُضيفت لخانة «أيّام متتالية»** (D-810) — **الشريطُ
     في «تقريرك» ثلاثُ خاناتٍ لا أربع** (`ReportView`: حلقة · فيلم ·
     أيّام متتالية)، **والصورةُ تتبع الصفحة.** */
  icon: "tv" | "film" | "play" | "comment" | "check";
  value: string;
  label: string;
}

/** خانةٌ من بطاقة «ذوقك» — صفوفُها وصورُ خلفيّتها جاهزةً (D-720) */
export interface ShareTasteCell {
  title: string;
  /** وصفٌ بجانب العنوان — «متوسّط» بجانب «التنوّع» */
  note?: string;
  rows: { name: string; value: string; unit?: string }[];
  /** صورُ الخلفيّة `data:` — ملصقاتٌ أو وجوه (D-717/D-718) */
  images: string[];
}

export interface ShareCardData {
  rtl: boolean;
  /** اسمُ العرض */
  name: string;
  /** «٥ متابعين» — جاهزةً بلغة القارئ، و`null` حين لا رقم */
  followers: string | null;
  /** النبذةُ في سطرٍ واحد، مقصوصةً — و`null` حين لا نبذة */
  bio: string | null;
  /** أجزاءُ الوقت الكبير مرتّبةً للرسم */
  timeParts: { v: string; u: string }[];
  /** «وقت المشاهدة · كل الأوقات» */
  watchLine: string;
  headline: string;
  strip: ShareStripCell[];
  /** ملصقاتُ خلفيّة الترويسة `data:` — صفرٌ إلى ثلاثة */
  posters: string[];
  /** الصورةُ الشخصيّة `data:` أو `null` */
  avatar: string | null;
  /**
   * 🆕 **هويّةُ الحساب على البطاقة** (D-792) — **القرصُ والختمُ كما في
   * `AccountIdentity`** (D-773)، لا نجمةَ زينةٍ تُرسم للجميع.
   */
  /* ⚠️ **والثلاثةُ اختياريّةٌ لإصدارٍ واحدٍ لا أكثر** (D-028): **قارئُها
     `‎/api/share` يهبط في التزامٍ تالٍ** — والمجلّدان مختلفان فلا
     يجتمعان في التزام. **والافتراضُ «لا شارة» فلا تكذب البطاقةُ في
     الدقائق التي بينهما.** */
  tier?: "plus" | "partner" | null;
  founder?: boolean;
  verified?: boolean;
  /** عنوانُ بطاقة الذوق («ذوقك») — و`null` حين لا ذوقَ يُرسم */
  tasteTitle: string | null;
  /** كلمةُ «السمات» */
  themesLabel: string;
  themes: string[];
  tasteCells: ShareTasteCell[];
}

/**
 * 🆕 **هويّةُ الحساب على بطاقة المشاركة** (D-792) — **نقلٌ لمواصفة
 * D-773 إلى satori، لا تصميمٌ ثانٍ** (القاعدة ٣).
 *
 * 🔑 **ولمَ نقلٌ لا استيرادٌ للمكوّن**: `AccountIdentity` يقيس بالـ`em`
 * ويستعمل `inline-grid` و`role`/`title` — **وsatori محرّكٌ آخرُ يفهم
 * جزءاً من CSS** — **ومكوّنٌ يعمل في المتصفّح ويسقط صامتاً في الصورة
 * أسوأُ من نقلٍ مُعلَن.** **والأرقامُ هي أرقامُ اللوح نفسُها محسوبةً
 * على خطِّ الاسم ٥٤**: `0.82 × 54 = 44` ارتفاعاً، **والنِّسَبُ ٣٨:١٦
 * و٦٢:١٦ و٥:١٦ و٩:١٦ محفوظةٌ حرفاً.**
 * ⚠️ **ولونا الهويّة ثابتان ولا يتبعان الثيم** (نصُّ D-773).
 */
const ID_H = 44;
const ID_INK = "#050505";

function PlanMark({ tier, founder }: { tier: "plus" | "partner" | null; founder: boolean }) {
  if (!tier) return null;
  const word = tier === "partner" ? "PARTNER" : "PLUS";
  const width = ((tier === "partner" ? 62 : 38) / 16) * ID_H;
  const tracking = ((tier === "partner" ? 1.1 : 1.3) / 9) * ((9 / 16) * ID_H);
  /* **والمؤسِّسُ يحمل قرصَ PLUS نفسَه** (D-773): **الصفةُ في التسمية
     لا في الشكل** — ولا قرصَ ثالثٌ يُخترع هنا. */
  void founder;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width,
        height: ID_H,
        background: ID_INK,
        border: `1px solid ${ACCENT}`,
        borderRadius: (5 / 16) * ID_H,
        color: ACCENT,
        fontSize: (9 / 16) * ID_H,
        letterSpacing: tracking,
      }}
    >
      {word}
    </div>
  );
}

function VerifiedMark() {
  return (
    <svg width={ID_H} height={ID_H} viewBox="0 0 24 24">
      <path
        fill={ACCENT}
        d="M 10.555 2.054 Q 12.000 1.000 13.445 2.054 Q 14.889 3.108 16.677 3.104 Q 18.466 3.101 19.015 4.803 Q 19.564 6.504 21.013 7.553 Q 22.462 8.601 21.906 10.300 Q 21.350 12.000 21.906 13.700 Q 22.462 15.399 21.013 16.447 Q 19.564 17.496 19.015 19.197 Q 18.466 20.899 16.677 20.896 Q 14.889 20.892 13.445 21.946 Q 12.000 23.000 10.555 21.946 Q 9.111 20.892 7.323 20.896 Q 5.534 20.899 4.985 19.197 Q 4.436 17.496 2.987 16.447 Q 1.538 15.399 2.094 13.700 Q 2.650 12.000 2.094 10.300 Q 1.538 8.601 2.987 7.553 Q 4.436 6.504 4.985 4.803 Q 5.534 3.101 7.323 3.104 Q 9.111 3.108 10.555 2.054 Z"
      />
      <path
        d="M7 12.2L10.4 15.6L17.4 8.6"
        fill="none"
        stroke={ID_INK}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * **ظلُّ الحرف — وصفةُ D-712 بحرفها** (D-715).
 * 📏 **وأنها أربعُ طبقاتٍ لا واحدة مقيسٌ لا مفترَض**: رُسمت البطاقةُ
 * ثلاثَ مرّاتٍ محلّيّاً (بلا ظلّ · بالطبقة الأولى وحدَها · بالأربع)
 * **وفرقُ البكسل بين الأخيرتين ١٥٧** — **فsatori تكدّس الطبقات.**
 * **ولولا القياسُ لكُتب هنا حدسٌ يُنقل بعدها في كلِّ ملفّ.**
 */
const SHADOW =
  "0 2px 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.7), 0 0 18px rgba(0,0,0,0.7), 0 0 18px rgba(0,0,0,0.7)";

/** ألوانُ الصفحة بأعيانها — ولا سجلَّ ثانياً لها هنا (D-682) */
const ACCENT = "#FFD400";
const FG = "#F7F7F7";
const MUTED = "#C9C9C9";
const SURFACE = "#121212";
const BORDER = "rgba(255,255,255,0.10)";
const DIVIDER = "rgba(255,255,255,0.14)";

/** ⚠️ **لا Fragment داخل `<svg>`** — `<g>` تقوم مقامها (عطلُ D-697) */
const ICON_PATHS: Record<string, React.ReactNode> = {
  play: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.8v6.4l5-3.2-5-3.2Z" />
    </g>
  ),
  film: (
    <g>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 9.5h17M8 5v14M16 5v14" />
    </g>
  ),
  tv: (
    <g>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="m8.5 3.5 3.5 3 3.5-3" />
    </g>
  ),
  check: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.2 2.6 2.6 5-5.6" />
    </g>
  ),
  comment: (
    <path d="M12 4.5c-4.7 0-8.5 3.1-8.5 7 0 3.9 3.8 7 8.5 7 .9 0 1.8-.1 2.6-.3L19 20l-.7-3.5c1.4-1.2 2.2-3 2.2-5 0-3.9-3.8-7-8.5-7Z" />
  ),
};

/** **هل يحمل النصُّ حروفاً عربيّة؟** — اتّجاهُ النصِّ في حروفه (D-716) */
function hasArabic(s: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(s);
}

/**
 * ⚖️ 🆕 **وسطرُ النصِّ صار مشتركاً بين البطاقتين** (D-810): **كان
 * داخلَ `ShareCard`** — **وبطاقةُ التقرير قارئٌ ثانٍ** (D-376).
 *
 * 🔴 **ولمَ صفٌّ من كلماتٍ لا نصٌّ واحد**: **satori بلا bidi للجمل** —
 * «وقت المشاهدة» تخرج «المشاهدة وقت» — **فكلُّ كلمةٍ عقدةٌ والصفُّ
 * يرتّبها بأيدينا.** ⚠️ **ولا اتّكالَ على `direction`**: Yoga تذبذبَت
 * بين سطرٍ وآخر (قِيس).
 * 🔴 **والعكسُ يتبع لغةَ النصِّ لا لغةَ البطاقة** (D-716): **نبذةٌ
 * إنجليزيّةٌ في بطاقةٍ عربيّةٍ خرجت مقلوبةً في أوّل نشرةٍ حيّة.**
 * 🔴 **ولا `fontWeight` هنا البتّة** (D-720): **الخطُّ مسجَّلٌ بوزنٍ
 * واحدٍ (٧٠٠)**، **وطلبُ ٤٠٠ ينهار في قياس الحرف** — **والعربيّةُ
 * وحدَها تنهار واللاتينيّةُ تسقط إلى وجهها الثاني بصمت.**
 */
function TextLine({
  rtl,
  text,
  size,
  color,
  shadow = true,
}: {
  rtl: boolean;
  text: string;
  size: number;
  color?: string;
  shadow?: boolean;
}) {
  const words = text.split(/\s+/);
  if (rtl && hasArabic(text)) words.reverse();
  return (
    <div
      style={{
        display: "flex",
        gap: Math.round(size * 0.2),
        fontSize: size,
        color: color ?? FG,
        ...(shadow ? { textShadow: SHADOW } : {}),
      }}
    >
      {words.map((w, i) => (
        <div key={i}>{w}</div>
      ))}
    </div>
  );
}

export function ShareCard(d: ShareCardData) {
  const { rtl } = d;
  const row = rtl ? "row-reverse" : "row";
  const side = rtl ? "flex-end" : "flex-start";

  /* 🔴 **مولّدُ الصور يبعثر الجملةَ العربيّة** (satori بلا bidi للجمل):
     «وقت المشاهدة» كانت تخرج «المشاهدة وقت» — **فكلُّ كلمةٍ عقدةٌ
     والصفُّ يرتّبها بأيدينا.** ⚠️ **ولا نتّكل على `direction`**:
     Yoga تذبذبَت بين سطرٍ وآخر (قِيس).
     🔴 **والعكسُ يتبع لغةَ النصِّ لا لغةَ البطاقة** (D-716): نبذةٌ
     إنجليزيّةٌ في بطاقةٍ عربيّةٍ خرجت مقلوبةً في أوّل نشرةٍ حيّة —
     **والنصُّ يحمل اتّجاهَه في حروفه لا في تفضيلات صاحبه.** */
  /* 🔴 🆕 **ولا `fontWeight` هنا البتّة** (D-720، خامسُ أعطال satori
     وقد سقط محلّيّاً قبل النشر): **الخطُّ مسجَّلٌ بوزنٍ واحد (٧٠٠)**،
     **وطلبُ ٤٠٠ يجعل المحرّكَ يبحث عن وجهٍ لا وجود له فينهار في قياس
     الحرف** (`charToGlyphIndex` على `undefined`) — **والعربيّةُ وحدَها
     تنهار، واللاتينيّةُ تسقط إلى وجهها الثاني بصمت.**
     🔑 **والدرسُ**: **وزنٌ لا يُسجَّل لا يُطلب** — **وعطلٌ يظهر في لغةٍ
     دون أخرى يُقرأ عطلَ نصٍّ وهو عطلُ خطّ.** */
  /* ⚖️ 🆕 **والرسمُ صار في `TextLine` أعلاه** (D-810): **نداءاتُها
     العشرون هنا لم تُمسّ**، **والغلافُ يمرّر `rtl` وحدَه** — **ونسخةٌ
     ثانيةٌ من قاعدة عكس الكلمات في بطاقةٍ أخرى تفترق عند أوّل عطلٍ
     يُصلَح في إحداهما** (D-145). */
  const Line = (p: { text: string; size: number; color?: string; shadow?: boolean }) => (
    <TextLine rtl={rtl} {...p} />
  );

  const stripView = rtl ? [...d.strip].reverse() : d.strip;
  /* 🔴 **والملصقاتُ تُعكس كما يُعكس الشريط** (D-716): ترتيبُ D-704
     منطقيٌّ (فيلم · أنمي · مسلسل) **والصفحةُ تردّه بالاتّجاه**، **وsatori
     لا تعرف الاتّجاه فتُرسم يساراً دائماً.** */
  const postersView = rtl ? [...d.posters].reverse() : d.posters;

  /** صفٌّ من صورٍ يملأ خلفيّةَ خانةٍ — ١٥٪ رماديّةً (D-717) */
  const CellArt = ({ images }: { images: string[] }) =>
    images.length === 0 ? null : (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
        }}
      >
        {images.map((src, i) => (
          <div key={i} style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* ⚠️ **والشفافيّةُ والرماديُّ على الصورة لا على غلافها**:
                `<img>` داخل غلافٍ يحمل `filter` لا يُرسم أصلاً في satori
                (قِيس) — **والمُرشِّحُ يُوضع حيث تُرسم البكسلات.** */}
            {/* 🔴 🆕 **والبطاقةُ كانت حكمين وراء الصفحة** (D-794):
                **D-724 أسقطت الرماديَّ ورفعت الشفافيّة إلى ٢٠٪ بحكمه**
                («الكارت الي تحت ما فيه حياة أبيض وأسود — ضيف فيه
                ألوان»)، **وD-788 أضافت حجابَ العتمة** — **وبقيت هذه
                رماديّةً عند ١٥٪ لأن أحداً لم يفتح البطاقةَ بعدهما.**
                🔑 **والدرسُ**: **سطحٌ لا يُنظر إليه لا تصله الأحكام** —
                **ومن غيّر مظهراً فليعدّ أسطحَه لا صفحتَه.** */}
            <img
              src={src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.2,
                filter: "saturate(1.5)",
              }}
            />
          </div>
        ))}
        {/* **حجابُ العتمة كما في الصفحة** (D-788): **ينزل بالإضاءة
            ويترك الصبغة** — ولا يُخفَّض اللونُ ثانيةً من بابٍ آخر. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.35)",
          }}
        />
      </div>
    );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        /* 🆕 **والفائضُ يُقسَم على الطرفين لا يُترك ذيلاً** (D-720):
           **العربيّةُ أقصرُ من اللاتينيّة بـ١٥٠px في القياس المحلّيّ**
           (الأسماءُ اللاتينيّةُ أعرضُ فتلتفّ) — **وقماشٌ واحدٌ لِلغتين
           يفيض في إحداهما**، **وشريطٌ أسودُ في القاع يُقرأ صورةً
           مقصوصةً، والفراغُ المتناظرُ يُقرأ هامشاً.** */
        justifyContent: "center",
        padding: "56px 48px",
        background: "#050505",
        color: FG,
        fontFamily: "Cairo, CairoLatin",
      }}
    >
      {/* ===== الترويسةُ الصغيرة ===== */}
      <div
        style={{
          display: "flex",
          flexDirection: row,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              background: "linear-gradient(135deg, #FFD400, #FBBF24 55%, #F59E0B)",
            }}
          />
          <div style={{ fontSize: 38, letterSpacing: -1 }}>Loopz</div>
        </div>
        <Line text={d.headline} size={28} color={MUTED} shadow={false} />
      </div>

      {/* ===== ١) البطاقةُ السينمائيّة — مغلقةٌ على ملصقاتها ===== */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: side,
          borderRadius: 40,
          border: `1px solid ${BORDER}`,
          background: SURFACE,
          padding: "44px 40px",
          overflow: "hidden",
        }}
      >
        {postersView.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
            }}
          >
            {postersView.map((p, i) => (
              <div key={i} style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                <img src={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        )}
        {/* ⚖️ **حجابُ D-712/D-717 نفسُه — ٤٠٪ مستوٍ** (والعتمةُ على الحرف
            لا على المساحة). ⚠️ **ولا `mask-image` في satori**: الدرزُ
            الذائبُ (D-695) لا يُنقل، **فالدرزُ حادٌّ ويُقال ولا يُدَّعى.** */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(5,5,5,0.40)",
          }}
        />

        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 22 }}>
          {d.avatar ? (
            <img
              src={d.avatar}
              width={96}
              height={96}
              style={{ width: 96, height: 96, borderRadius: 48, objectFit: "cover" }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", alignItems: side, gap: 4 }}>
            <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 54, textShadow: SHADOW }}>{d.name}</div>
              {/* 🔴 🆕 **والنجمةُ الرباعيّةُ سقطت** (D-792): **كانت تُرسم
                  لكلِّ من شارك بطاقتَه** — **زينةٌ في موضع هويّة**،
                  وهو العطلُ نفسُه الذي أُصلح في بطاقة الإحصائيات
                  (D-780). **والبطاقةُ تخرج إلى الناس، فأولى الأسطح
                  بالصدق.** */}
              <PlanMark tier={d.tier ?? null} founder={d.founder ?? false} />
              {d.verified ? <VerifiedMark /> : null}
            </div>
            {d.followers ? <Line text={d.followers} size={28} color={MUTED} /> : null}
          </div>
        </div>

        {d.bio ? (
          <div style={{ display: "flex", marginTop: 16 }}>
            <Line text={d.bio} size={30} color="#EDEDED" />
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 26 }}>
          {d.timeParts.map((p) => (
            <div key={p.u + p.v} style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
              {/* 🔴 **الرقمُ الكبيرُ والوحدةُ الصغيرةُ مركَّبان يدويّاً**:
                  satori تقيس الكلمةَ العربيّة بحروفها المنفصلة وترسمها
                  موصولةً — ففي «يوم» بحجم ٨٠ فراغٌ داخليٌّ فاضح. */}
              {rtl ? (
                <div style={{ fontSize: 40, color: MUTED, paddingBottom: 16, textShadow: SHADOW }}>
                  {p.u}
                </div>
              ) : null}
              <div style={{ fontSize: 104, lineHeight: 1, textShadow: SHADOW }}>{p.v}</div>
              {!rtl ? (
                <div style={{ fontSize: 40, color: MUTED, paddingBottom: 16, textShadow: SHADOW }}>
                  {p.u}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 8 }}>
          <Line text={d.watchLine} size={28} color={MUTED} />
        </div>
        {/* الخطُّ الأصفرُ المنحني — زينةُ الصفحة نفسُها */}
        <svg width="250" height="26" viewBox="0 0 220 24" style={{ marginTop: 10 }}>
          <path
            d="M2 20 C 58 4, 140 24, 218 6"
            stroke={ACCENT}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* ===== ٢) شريطُ الأرقام — عارٍ بين البطاقتين كما في الصفحة ===== */}
      <div style={{ display: "flex", marginTop: 30, marginBottom: 30 }}>
        {stripView.map((c, i) => (
          <div
            key={c.label}
            /* ⚠️ **ولا مفتاحَ نمطٍ قيمتُه `undefined`**: satori تستدعي
               `.trim()` على القيمة فينهار الرسمُ كلُّه — الفاصلُ يُبنى
               بالنشر الشرطيّ فلا يوجد المفتاحُ أصلاً حين لا فاصل. */
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              ...(i > 0 ? { borderLeft: `1px solid ${DIVIDER}` } : {}),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICON_PATHS[c.icon]}
              </svg>
              <div style={{ fontSize: 48 }}>{c.value}</div>
            </div>
            <Line text={c.label} size={26} color={MUTED} shadow={false} />
          </div>
        ))}
      </div>

      {/* ===== ٣) بطاقةُ «ذوقك» — تحت الترويسة لا داخلَها (حكمُه) ===== */}
      {d.tasteTitle && d.tasteCells.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: side,
            borderRadius: 40,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            padding: "32px 36px",
          }}
        >
          <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
            {/* رمزُ الحلقات الثلاث — أيقونةُ «ذوقك» بعينها */}
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7">
              <g>
                <circle cx="12" cy="7.5" r="3.6" />
                <circle cx="7.6" cy="15.5" r="3.6" />
                <circle cx="16.4" cy="15.5" r="3.6" />
              </g>
            </svg>
            <div style={{ fontSize: 44 }}>{d.tasteTitle}</div>
          </div>

          {d.themes.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: row,
                alignItems: "center",
                gap: 18,
                marginTop: 14,
              }}
            >
              <Line text={d.themesLabel} size={28} color={MUTED} shadow={false} />
              {(rtl ? [...d.themes].reverse() : d.themes).map((th, i) => (
                <div key={th} style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 18 }}>
                  {i > 0 ? (
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: "rgba(247,247,247,0.4)" }} />
                  ) : null}
                  <Line text={th} size={30} color={FG} shadow={false} />
                </div>
              ))}
            </div>
          ) : null}

          {/* **عمودان كما في الصفحة** — والصفوفُ اثنان اثنان */}
          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 10 }}>
            {[0, 2, 4].map((start) => {
              const pair = d.tasteCells.slice(start, start + 2);
              if (pair.length === 0) return null;
              const view = rtl ? [...pair].reverse() : pair;
              return (
                <div key={start} style={{ display: "flex", width: "100%" }}>
                  {view.map((cell, ci) => (
                    <div
                      key={cell.title}
                      style={{
                        position: "relative",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: side,
                        overflow: "hidden",
                        padding: "16px 14px",
                        ...(start > 0 ? { borderTop: `1px solid ${DIVIDER}` } : {}),
                        ...(ci > 0 ? { marginLeft: 24 } : {}),
                      }}
                    >
                      <CellArt images={cell.images} />
                      <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 10 }}>
                        <Line text={cell.title} size={26} color={FG} shadow={false} />
                        {cell.note ? <Line text={`· ${cell.note}`} size={26} color={ACCENT} shadow={false} /> : null}
                      </div>
                      {cell.rows.map((r) => (
                        <div
                          key={r.name}
                          style={{
                            display: "flex",
                            flexDirection: row,
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            width: "100%",
                            marginTop: 8,
                            gap: 16,
                          }}
                        >
                          <Line text={r.name} size={28} shadow={false} />
                          <div style={{ display: "flex", flexDirection: row, alignItems: "baseline", gap: 8 }}>
                            <div style={{ fontSize: 28, color: ACCENT }}>{r.value}</div>
                            {r.unit ? (
                              <Line text={r.unit} size={26} color={MUTED} shadow={false} />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ================= 🆕 بطاقةُ «شارك تقريرك» (D-810) ================= */

/**
 * **وجهُ مشاركة التقرير — رسمٌ خالصٌ بلا قراءةٍ واحدة**، أختُ `ShareCard`.
 *
 * ⚖️ **ولمَ بطاقةٌ ثانيةٌ لا وسيطٌ في الأولى**: **الأولى «كلُّ الأوقات»
 * وهذه مدّةٌ بعينها** — **وبنيتاهما تفترقان في كلِّ جسم**: تلك شريطُ
 * أرقامٍ وذوقٌ في ستِّ خانات، **وهذه رقمُ مدّةٍ وسطرُ افتتاحٍ وأكثرُ ما
 * شوهد.** **وشرطٌ يقلب نصفَ الرسم ليس إعادةَ استعمالٍ، هو بطاقتان في
 * دالّةٍ واحدة.** **والمشتركُ استُخرج** (`TextLine`، `PlanMark`،
 * `VerifiedMark`، الألوان، الظلّ) — **وهو حدُّ القاعدة ٣ بالضبط.**
 *
 * ⚖️ **والوجهُ يتبع الصفحةَ لا يخترع** (درسُ D-720): **ترتيبُ `/reports`
 * بعينه** — الرقمُ الكبير، ثمّ حلقةُ الأيّام، ثمّ سطرُ الافتتاح، ثمّ
 * شريطُ الأرقام، ثمّ «الأكثر مشاهدة». **وصورةٌ تنسخ ألوانَ سطحٍ وتخالف
 * ترتيبَه تُقرأ سطحاً آخر.**
 *
 * ⚠️ **ولا حلقةَ مرسومةً هنا**: **`conic-gradient` لا وجودَ لها في
 * satori** — **وقوسٌ في `<svg>` يحتاج حسابَ زاويةٍ بيدنا** — **والنصُّ
 * «٢٠ / ٣١ يوماً» يقول ما تقوله الحلقةُ بلا كذبٍ بصريّ.**
 */
export interface ReportShareTitle {
  title: string;
  /** «12h 48m» — مصوغاً */
  time: string;
  /** الملصقُ `data:` أو `null` */
  poster: string | null;
}

export interface ReportShareData {
  rtl: boolean;
  /** «تقريرك» */
  title: string;
  /** «أغسطس ٢٠٢٦» — نطاقُ المدّة كما تكتبه الصفحة */
  range: string;
  name: string;
  avatar: string | null;
  tier?: "plus" | "partner" | null;
  founder?: boolean;
  verified?: boolean;
  /** «121h 50m» */
  time: string;
  /** «وقت المشاهدة» */
  watchLine: string;
  /** «+12%» — و`null` حين لا مقارنةَ صادقة (حارسُ D-805) */
  delta: string | null;
  deltaUp: boolean;
  /**
   * سطرُ الافتتاح — **شطرُه الأوّلُ وحدَه** (`avg` + `plain` من
   * `reportLead`)، و`null` حين لا معدّل.
   * ⚖️ **ولا شطرَ ثانٍ في الصورة** (D-810): **علّتُه في `statsFormat`
   * عند `plain`** — **واسمُ العمل مرسومٌ تحته باسمه ووقته.**
   */
  lead: { avg: string; plain: string } | null;
  /** حلقةُ الأيّام — «٢٠ من ٣١» */
  daysActive: number;
  daysTotal: number;
  /** «أيّام» */
  daysLabel: string;
  strip: ShareStripCell[];
  /** «الأكثر مشاهدة» — و`null` حين لا أعمال */
  topLabel: string | null;
  top: ReportShareTitle[];
}

/**
 * 🆕 **حلقةُ الأيّام النشطة** (D-810) — **نقلُ `DaysRing` من الصفحة إلى
 * satori**، لا شكلٌ ثانٍ (القاعدة ٣).
 *
 * 🔑 **والقوسُ `stroke-dasharray` لا `conic-gradient`**: **المحيطُ
 * `2πr`**، **والمرسومُ منه نسبةُ الأيّام**، **والفجوةُ بطول المحيط
 * كلِّه** فلا يتكرّر القوس. **والدورانُ `-90` يبدأ من القمّة** كما تبدأ
 * حلقةُ الصفحة.
 * ⚠️ **و`transform` سمةُ SVG على `<g>`** لا نمطاً على `<svg>`.
 */
function DaysRing({
  rtl,
  active,
  total,
  label,
}: {
  rtl: boolean;
  active: number;
  total: number;
  label: string;
}) {
  const R = 78;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(1, Math.max(0, active / total)) : 0;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: 186,
        height: 186,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="186" height="186" viewBox="0 0 186 186" style={{ position: "absolute" }}>
        <g transform="rotate(-90 93 93)">
          <circle cx="93" cy="93" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" />
          <circle
            cx="93"
            cy="93"
            r={R}
            fill="none"
            stroke={ACCENT}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${C * pct} ${C}`}
          />
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* **والكسرُ لاتينيٌّ في اللغتين** — «20 / 31» أرقامٌ لا كلمات */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          {/* 🔴 **ووَلدٌ عدديٌّ ليس نصّاً في satori** (D-810، عطلُها
              السابع — **بُصر بالرسم المحلّيّ لا بالمترجِم**):
              **`{active}` ورقمُه ٢٠ يرمي «Expected <div> to have
              explicit display: flex»** — **رسالةٌ تتّهم النمطَ والعلّةُ
              في نوع الولد.** 🔑 **والدرسُ**: **كلُّ ما يدخل عقدةَ نصٍّ
              هنا يُصاغ نصّاً عند مصدره**، **ورسالةُ خطأٍ في محرّكٍ
              أجنبيٍّ تدلّ على مكانٍ لا على سبب.** */}
          <div style={{ fontSize: 48, lineHeight: 1 }}>{String(active)}</div>
          {/* 🔴 **وعقدةٌ نصّيّةٌ واحدةٌ لا اثنتان** (D-810، عطلُ satori
              السادس وقد سقط في الرسم المحلّيّ): **`/ {total}` في JSX
              ولدان في `div` بلا `display:flex`** — **والمحرّكُ يرمي
              «Expected <div> to have explicit display: flex»**،
              **والمترجِمُ يقبلها.** **والقالبُ يجمعهما عقدةً.** */}
          <div style={{ fontSize: 26, color: MUTED }}>{`/ ${total}`}</div>
        </div>
        <div style={{ display: "flex", marginTop: 4 }}>
          <TextLine rtl={rtl} text={label} size={24} color={MUTED} shadow={false} />
        </div>
      </div>
    </div>
  );
}

const UP = "#3DBE6B";
const DOWN = "#E5484D";

export function ReportShareCard(d: ReportShareData) {
  const { rtl } = d;
  const row = rtl ? "row-reverse" : "row";
  const side = rtl ? "flex-end" : "flex-start";
  /* ⚠️ **ولا غلافَ محلّيّاً لـ`TextLine`** (D-810): **`const Line = …`
     داخل مكوّنٍ يخلق مكوّناً في كلِّ رسم** — **وهو خطأُ
     `react-hooks/static-components` بعينه** (وقد سقط في هذا الملفّ
     نفسِه حين كُتب). **والنداءُ المباشرُ بـ`rtl` أوضحُ وأرخص.** */

  const stripView = rtl ? [...d.strip].reverse() : d.strip;
  /* **والأعمالُ تُعكس كما يُعكس الشريط** (D-716): **satori لا تعرف
     الاتّجاه فتُرسم يساراً دائماً.** */
  const topView = rtl ? [...d.top].reverse() : d.top;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "56px 48px",
        background: "#050505",
        color: FG,
        fontFamily: "Cairo, CairoLatin",
      }}
    >
      {/* ===== الترويسةُ الصغيرة ===== */}
      <div
        style={{
          display: "flex",
          flexDirection: row,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              background: "linear-gradient(135deg, #FFD400, #FBBF24 55%, #F59E0B)",
            }}
          />
          <div style={{ fontSize: 38, letterSpacing: -1 }}>Loopz</div>
        </div>
        {/* 🆕 **والمدّةُ في الترويسة كما في اسم الصفحة** (D-804):
            **«تقريرك · أغسطس ٢٠٢٦»** — **ونطاقٌ بلا اسمٍ يُقرأ تاريخَ
            التقاط.** ⚠️ **والنطاقُ عقدةٌ مستقلّةٌ عن الاسم**: قد يحمل
            رقماً لاتينيّاً («٢٠٢٦» تُكتب `2026`) **فلا يُخلط بجملةٍ
            عربيّةٍ تُعكس كلماتُها.** */}
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 12 }}>
          <TextLine rtl={rtl} text={d.title} size={28} color={MUTED} shadow={false} />
          <div style={{ fontSize: 28, color: MUTED }}>·</div>
          <div style={{ fontSize: 28, color: MUTED }}>{d.range}</div>
        </div>
      </div>

      {/* ===== ١) البطاقةُ السينمائيّة — الرقمُ والافتتاح ===== */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: side,
          borderRadius: 40,
          border: `1px solid ${BORDER}`,
          background: "linear-gradient(160deg, #17140B 0%, #121212 55%)",
          padding: "44px 40px",
          overflow: "hidden",
        }}
      >
        {/* 🔴 **وملصقاتُ الخلفيّة سقطت — عطلٌ كشفه الرسمُ المحلّيّ** (D-810):
            **الملصقاتُ الثلاثةُ نفسُها كانت تُرسم مرّتين في صورةٍ واحدة**
            — خلفيّةً هنا وبطاقاتٍ في «الأكثر مشاهدة» — **وتكرارٌ بلا
            معنىً في صورةٍ واحدةٍ يُقرأ خطأً في التوليد لا تصميماً.**
            **والملصقُ يكسب موضعَه مرّةً: حيث يُسمّى.**
            ⚖️ **وهذا فرقٌ عن `ShareCard`** (D-720): **ملصقاتُها مفضّلاتٌ
            لا تتكرّر تحتها**، **وهذه أعمالُ المدّة نفسُها** — **والقاعدةُ
            تُنقل بعلّتها لا بشكلها.**
            **والحياةُ تأتي من مسحةٍ دافئةٍ في السطح** لا من صورةٍ مكرّرة. */}

        {/* صاحبُ التقرير */}
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 22 }}>
          {d.avatar ? (
            <img
              src={d.avatar}
              width={80}
              height={80}
              style={{ width: 80, height: 80, borderRadius: 40, objectFit: "cover" }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 44, textShadow: SHADOW }}>{d.name}</div>
            <PlanMark tier={d.tier ?? null} founder={d.founder ?? false} />
            {d.verified ? <VerifiedMark /> : null}
          </div>
        </div>

        {/* الرقمُ الكبير وسطرُ وصفه · وحلقةُ الأيّام مقابلَه — كما في الصفحة */}
        {/* ⚖️ 🔴 **والحلقةُ رُسمت ولم تُترك نصّاً** (D-810): **أوّلُ
            محاولةٍ كتبَتها «٢٠ / ٣١» نصّاً بحجّة أنّ `conic-gradient`
            غائبةٌ في satori** — **والرسمُ المحلّيُّ أرى النتيجة: نصفُ
            البطاقة فارغٌ حيث تضع الصفحةُ حلقتَها.**
            🔑 **والقوسُ لا يحتاج تدرّجاً**: **`stroke-dasharray` على
            دائرةٍ يرسم أيَّ نسبة** — **ودورانٌ بـ`-90` يبدأ من القمّة.**
            **و«تعذّرَ» في محرّكٍ ليست حكماً حتى تُجرَّب فيه.** */}
        <div
          style={{
            display: "flex",
            flexDirection: row,
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 26,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: side }}>
            <div style={{ fontSize: 104, lineHeight: 1, textShadow: SHADOW }}>{d.time}</div>
            <div
              style={{
                display: "flex",
                flexDirection: row,
                alignItems: "center",
                gap: 16,
                marginTop: 10,
              }}
            >
              <TextLine rtl={rtl} text={d.watchLine} size={28} color={MUTED} />
              {d.delta ? (
                <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: "rgba(247,247,247,0.4)" }} />
                  <div style={{ fontSize: 28, color: d.deltaUp ? UP : DOWN }}>{d.delta}</div>
                </div>
              ) : null}
            </div>
          </div>

          <DaysRing rtl={rtl} active={d.daysActive} total={d.daysTotal} label={d.daysLabel} />
        </div>

        {/* سطرُ الافتتاح — **الجملةُ نفسُها التي تفتتح الصفحة** (D-810) */}
        {/* 🔴 **ولا التفافَ هنا البتّة — عطلٌ كشفه الرسمُ المحلّيّ**:
            **`flex-wrap` مع `row-reverse` في Yoga يُنزل السطرَ الثاني
            إلى وسط البطاقة لا إلى حافّتها** — **وجملةٌ تبدأ يميناً
            وتُكمل وسطاً تُقرأ جملتين.** **والشطرُ الواحدُ لا يلتفّ**،
            فسقط الالتفافُ بسقوط سببه. */}
        {d.lead ? (
          <div
            style={{
              display: "flex",
              flexDirection: row,
              alignItems: "baseline",
              gap: 12,
              marginTop: 22,
            }}
          >
            <div style={{ fontSize: 34 }}>{d.lead.avg}</div>
            <TextLine rtl={rtl} text={d.lead.plain} size={34} />
          </div>
        ) : null}

        {/* الخطُّ الأصفرُ المنحني — زينةُ الصفحة نفسُها */}
        <svg width="250" height="26" viewBox="0 0 220 24" style={{ marginTop: 14 }}>
          <path
            d="M2 20 C 58 4, 140 24, 218 6"
            stroke={ACCENT}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* ===== ٢) شريطُ الأرقام — عارٍ بين البطاقتين كما في الصفحة ===== */}
      <div style={{ display: "flex", marginTop: 30, marginBottom: 30 }}>
        {stripView.map((c, i) => (
          <div
            key={c.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              ...(i > 0 ? { borderLeft: `1px solid ${DIVIDER}` } : {}),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICON_PATHS[c.icon]}
              </svg>
              <div style={{ fontSize: 48 }}>{c.value}</div>
            </div>
            <TextLine rtl={rtl} text={c.label} size={26} color={MUTED} shadow={false} />
          </div>
        ))}
      </div>

      {/* ===== ٣) «الأكثر مشاهدة» — ثلاثةُ ملصقاتٍ بأسمائها ===== */}
      {d.topLabel && d.top.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: side,
            borderRadius: 40,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            padding: "32px 36px",
          }}
        >
          <TextLine rtl={rtl} text={d.topLabel} size={40} shadow={false} />
          <div style={{ display: "flex", flexDirection: "row", width: "100%", marginTop: 22, gap: 22 }}>
            {topView.map((x, i) => (
              <div
                key={`${x.title}-${i}`}
                style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center" }}
              >
                {/* ⚠️ **وغيابُ الملصق مربّعٌ مصمَت لا فجوة**: **صفٌّ
                    يفقد عنصراً يعيد توزيعَ العرض على الباقين** — **فتخرج
                    البطاقةُ بمقاسين لعملين.** */}
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: 384,
                    borderRadius: 24,
                    overflow: "hidden",
                    background: "#1A1A1A",
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  {x.poster ? (
                    <img
                      src={x.poster}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                </div>
                <div style={{ display: "flex", marginTop: 14 }}>
                  <TextLine rtl={rtl} text={x.title} size={26} shadow={false} />
                </div>
                <div style={{ fontSize: 26, color: ACCENT, marginTop: 4 }}>{x.time}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ===== ٤) الذيل — **اسمُ الموقع وحدَه** ===== */}
      {/* ⚖️ **وجملةٌ عربيّةٌ تنتهي بعنوانٍ لاتينيٍّ سقطت** (D-810):
          **اتّجاهان في سطرٍ واحدٍ من أجل كلمتين** — **والعنوانُ وحدَه
          يقول ما تقوله الجملة**، **وأقلُّ ما يُكتب أقلُّ ما ينكسر.** */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 30,
        }}
      >
        <div style={{ fontSize: 28, color: "rgba(247,247,247,0.5)" }}>loopztv.com</div>
      </div>
    </div>
  );
}
