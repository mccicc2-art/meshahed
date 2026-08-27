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
  icon: "tv" | "film" | "play" | "comment";
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
  /** عنوانُ بطاقة الذوق («ذوقك») — و`null` حين لا ذوقَ يُرسم */
  tasteTitle: string | null;
  /** كلمةُ «السمات» */
  themesLabel: string;
  themes: string[];
  tasteCells: ShareTasteCell[];
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
  comment: (
    <path d="M12 4.5c-4.7 0-8.5 3.1-8.5 7 0 3.9 3.8 7 8.5 7 .9 0 1.8-.1 2.6-.3L19 20l-.7-3.5c1.4-1.2 2.2-3 2.2-5 0-3.9-3.8-7-8.5-7Z" />
  ),
};

/** **هل يحمل النصُّ حروفاً عربيّة؟** — اتّجاهُ النصِّ في حروفه (D-716) */
function hasArabic(s: string): boolean {
  return /[؀-ۿݐ-ݿ]/.test(s);
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
  const Line = ({
    text,
    size,
    color,
    shadow = true,
  }: {
    text: string;
    size: number;
    color?: string;
    shadow?: boolean;
  }) => {
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
  };

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
          opacity: 0.15,
          /* ⚠️ **الرماديُّ مُرشِّحٌ لا لون**: satori تدعم `filter` على
             العنصر — **وإن سقطَت يوماً بقيت الصورةُ ملوّنةً عند ١٥٪ لا
             مفقودة** (سقوطٌ يُقرأ، لا انهيار). */
          filter: "grayscale(1)",
        }}
      >
        {images.map((src, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flex: 1,
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              /* 🔴 🆕 **و`no-repeat` صريحةٌ لا افتراضيّة** (D-720، مقيسٌ
                 على أوّل نشرةٍ حيّة): **الافتراضُ في CSS `repeat`** —
                 **فملصقٌ طويلٌ في صندوقٍ عريضٍ يتكرّر رأسيّاً**،
                 وخرجت الترويسةُ بستّة ملصقاتٍ بدل ثلاثة. */
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          />
        ))}
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
              <div
                key={i}
                style={{
                  display: "flex",
                  flex: 1,
                  backgroundImage: `url(${p})`,
                  backgroundSize: "cover",
              /* 🔴 🆕 **و`no-repeat` صريحةٌ لا افتراضيّة** (D-720، مقيسٌ
                 على أوّل نشرةٍ حيّة): **الافتراضُ في CSS `repeat`** —
                 **فملصقٌ طويلٌ في صندوقٍ عريضٍ يتكرّر رأسيّاً**،
                 وخرجت الترويسةُ بستّة ملصقاتٍ بدل ثلاثة. */
              backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              />
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
              {/* نجمةُ لوبز الرباعية — كما في الترويسة */}
              <svg width="30" height="30" viewBox="0 0 24 24" fill={ACCENT}>
                <path d="M12 3.5c.6 4.4 4.1 7.9 8.5 8.5-4.4.6-7.9 4.1-8.5 8.5-.6-4.4-4.1-7.9-8.5-8.5 4.4-.6 7.9-4.1 8.5-8.5Z" />
              </svg>
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
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: "rgba(255,212,0,0.5)" }} />
                  ) : null}
                  <Line text={th} size={30} color={ACCENT} shadow={false} />
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
                        <Line text={cell.title} size={26} color={MUTED} shadow={false} />
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
