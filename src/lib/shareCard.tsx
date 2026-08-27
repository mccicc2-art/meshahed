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
 * ================= وقيودُ satori مكتوبةٌ عند مواضعها =================
 * انظر التعليقات المعلَّمة ⚠️ داخل الجسم — كلُّ واحدٍ منها عطلٌ وقع.
 */

export interface ShareStripCell {
  icon: "tv" | "film" | "play" | "comment";
  value: string;
  label: string;
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
  /** ملصقاتُ الخلفيّة `data:` — صفرٌ إلى ثلاثة */
  posters: string[];
  /** الصورةُ الشخصيّة `data:` أو `null` */
  avatar: string | null;
}

/**
 * **ظلُّ الحرف — وصفةُ D-712 بحرفها** (D-715).
 * 📏 **وأنها أربعُ طبقاتٍ لا واحدة مقيسٌ لا مفترَض**: رُسمت البطاقةُ
 * ثلاثَ مرّاتٍ محلّيّاً (بلا ظلّ · بالطبقة الأولى وحدَها · بالأربع)
 * **وفرقُ البكسل بين الأخيرتين ١٥٧** — **فsatori تكدّس الطبقات.**
 * **ولولا القياسُ لكُتب هنا حدسٌ يُنقل بعدها في كلِّ ملفّ.**
 */
const SHADOW = "0 1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.7), 0 0 9px rgba(0,0,0,0.7), 0 0 9px rgba(0,0,0,0.7)";

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
  return /[\u0600-\u06FF\u0750-\u077F]/.test(s);
}

export function ShareCard(d: ShareCardData) {
  const { rtl } = d;
  const row = rtl ? "row-reverse" : "row";
  const side = rtl ? "flex-end" : "flex-start";

  /* 🔴 **مولّدُ الصور يبعثر الجملةَ العربيّة** (satori بلا bidi للجمل):
     «وقت المشاهدة» كانت تخرج «المشاهدة وقت» — **فكلُّ كلمةٍ عقدةٌ
     والصفُّ يرتّبها بأيدينا.** ⚠️ **ولا نتّكل على `direction`**:
     Yoga تذبذبَت بين سطرٍ وآخر (قِيس).

     🔴 🆕 **والعكسُ يتبع لغةَ النصِّ لا لغةَ البطاقة** (D-716، أوّلُ
     نشرةٍ حيّة): نبذةُ أحمد إنجليزيّةٌ في بطاقةٍ عربيّة، **فخرجت
     «rise and adapt, fall, minds strong how Watching»** — **كلُّ
     كلمةٍ سليمةٌ والجملةُ مقلوبة.** **والعلّةُ أنّي جعلتُ اتّجاهَ
     القارئ يقرّر ترتيبَ كلماتٍ ليست بلغته** — **والنصُّ يحمل اتّجاهَه
     في حروفه لا في تفضيلات صاحبه.** */
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
          gap: Math.round(size * 0.24),
          fontSize: size,
          color: color ?? "#F7F7F7",
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
  /* 🔴 🆕 **والملصقاتُ تُعكس كما يُعكس الشريط** (D-716): ترتيبُ D-704
     منطقيٌّ (فيلم · أنمي · مسلسل) **والصفحةُ تردّه بالاتّجاه**، **وsatori
     لا تعرف الاتّجاه فتُرسم يساراً دائماً** — **فخرج الفيلمُ في طرفٍ
     والصفحةُ تضعه في الطرف الآخر.** **ومرآةٌ يدويّةٌ هي القاعدةُ هنا
     منذ D-697، وقد نُسيت في الخلفيّة وحدَها.** */
  const postersView = rtl ? [...d.posters].reverse() : d.posters;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px 60px",
        background: "#050505",
        color: "#F7F7F7",
        fontFamily: "Cairo, CairoLatin",
      }}
    >
      {/* 🆕 **الخلفيّةُ ملصقاتُك الثلاثة** (D-715) — **الوجهُ نفسُه الذي
          تراه في الصفحة** (D-697: رقمٌ واحدٌ بوجهين يفترقان، والوجهُ
          كذلك). ⚠️ **ولا `mask-image` في satori**: الدرزُ الذائبُ
          (D-695) لا يُنقل، **فالدرزُ حادٌّ ويُقال ولا يُدَّعى.** */}
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
                backgroundPosition: "center",
              }}
            />
          ))}
        </div>
      )}
      {/* ⚖️ **حجابُ D-712 نفسُه — ٣٠٪ مستوٍ** (والعتمةُ على الحرف لا على
          المساحة). ⚠️ **ويُرسم ولو بلا ملصقات**: طبقةٌ فوق أسودَ لا
          تُرى، **وشرطٌ ثانٍ لا يشتري شيئاً.** */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(5,5,5,0.30)",
        }}
      />

      {/* ===== الترويسة ===== */}
      <div
        style={{
          display: "flex",
          flexDirection: row,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: "linear-gradient(135deg, #FFD400, #FBBF24 55%, #F59E0B)",
            }}
          />
          <div style={{ fontSize: 30, letterSpacing: -1, textShadow: SHADOW }}>Loopz</div>
        </div>
        <Line text={d.headline} size={24} color="#C9C9C9" />
      </div>

      {/* ===== الهويّةُ والوقت ===== */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: side, gap: 2 }}>
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 16 }}>
          {d.avatar ? (
            <img
              src={d.avatar}
              width={64}
              height={64}
              style={{ width: 64, height: 64, borderRadius: 32, objectFit: "cover" }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", alignItems: side, gap: 2 }}>
            <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 40, textShadow: SHADOW }}>{d.name}</div>
              {/* نجمةُ لوبز الرباعية — كما في الترويسة */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFD400">
                <path d="M12 3.5c.6 4.4 4.1 7.9 8.5 8.5-4.4.6-7.9 4.1-8.5 8.5-.6-4.4-4.1-7.9-8.5-8.5 4.4-.6 7.9-4.1 8.5-8.5Z" />
              </svg>
            </div>
            {d.followers ? <Line text={d.followers} size={22} color="#C9C9C9" /> : null}
          </div>
        </div>

        {d.bio ? <Line text={d.bio} size={23} color="#EDEDED" /> : null}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 8 }}>
          {d.timeParts.map((p) => (
            <div key={p.u + p.v} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              {/* 🔴 **الرقمُ الكبيرُ والوحدةُ الصغيرةُ مركَّبان يدويّاً**:
                  satori تقيس الكلمةَ العربيّة بحروفها المنفصلة وترسمها
                  موصولةً — ففي «يوم» بحجم ٨٠ فراغٌ داخليٌّ فاضح. */}
              {rtl ? (
                <div style={{ fontSize: 28, color: "#C9C9C9", paddingBottom: 12, textShadow: SHADOW }}>
                  {p.u}
                </div>
              ) : null}
              <div style={{ fontSize: 78, lineHeight: 1, textShadow: SHADOW }}>{p.v}</div>
              {!rtl ? (
                <div style={{ fontSize: 28, color: "#C9C9C9", paddingBottom: 12, textShadow: SHADOW }}>
                  {p.u}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <Line text={d.watchLine} size={24} color="#C9C9C9" />
        {/* الخطُّ الأصفرُ المنحني — زينةُ الصفحة نفسُها */}
        <svg width="190" height="19" viewBox="0 0 220 24" style={{ marginTop: 4 }}>
          <path
            d="M2 20 C 58 4, 140 24, 218 6"
            stroke="#FFD400"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* ===== شريطُ الأرقام الأربعة ===== */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid rgba(255,255,255,0.14)",
          paddingTop: 22,
        }}
      >
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
              gap: 6,
              ...(i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.14)" } : {}),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFD400"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICON_PATHS[c.icon]}
              </svg>
              <div style={{ fontSize: 40, textShadow: SHADOW }}>{c.value}</div>
            </div>
            <Line text={c.label} size={22} color="#C9C9C9" />
          </div>
        ))}
      </div>
    </div>
  );
}
