import { posterUrl } from "@/core/media";
import { CHAT_BG_DOODLE_OPACITY, CHAT_BG_TAIL_BLUR, CHAT_BG_TAIL_SIZE, CHAT_BG_TITLE_SIZE, CHAT_BG_TITLE_VEIL, type ChatBg } from "@/core/chatBg";

/**
 * 🆕 D-1382 — خلفيّةُ الخيط المفتوح (الويب).
 *
 * طبقةٌ ثابتةٌ خلف المحادثة لا خلفيّةُ الصفحة: الخيطُ يمرَّر في المستند كلِّه (D-767)، فطبقةٌ `fixed` تبقى
 * تحت الفقاعات أينما نزل القارئ، **ولا تمسّ بقيّةَ الصفحات**. لا تُلمس (`pointer-events-none`) ولا تُقرأ (`aria-hidden`).
 *
 * • Loopz — الرسومُ **قناعٌ** يُلوَّن بلون النصّ: صورةٌ واحدةٌ تتبع كلَّ ثيمٍ والوضعَ النهاريّ.
 * • العمل — 🆕 ملصقُه المختار كاملاً حادّاً تحت الشريط العلويّ (D-1385) وتحته نسخةٌ مضبّبةٌ تكمله، فوقهما غشاءٌ بلون خلفيّة الثيم: تعتيمٌ في الداكن وغسلٌ في النهاريّ.
 * • السوداء — لا شيء: خلفيّةُ الصفحة كما كانت.
 */
export function ChatBackground({ bg }: { bg: ChatBg }) {
  if (bg.k === "plain") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {bg.k === "loopz" ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--foreground)",
            opacity: CHAT_BG_DOODLE_OPACITY,
            WebkitMaskImage: "url(/chat-doodle.png)",
            maskImage: "url(/chat-doodle.png)",
            WebkitMaskSize: "200px 200px",
            maskSize: "200px 200px",
            WebkitMaskRepeat: "repeat",
            maskRepeat: "repeat",
          }}
        />
      ) : (
        <>
          {/* 🆕 D-1385 — تحتَه: الملصقُ نفسُه مضبّباً يغطّي المساحةَ كلَّها (القاعُ وجانبا الشاشة العريضة) */}
          {/* eslint-disable-next-line @next/next/no-img-element -- طبقةٌ مضبّبة: مقاسٌ صغيرٌ يكفي */}
          <img
            src={posterUrl(bg.path, CHAT_BG_TAIL_SIZE) ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-bottom"
            style={{ filter: `blur(${CHAT_BG_TAIL_BLUR * 2}px)`, transform: "scale(1.1)" }}
          />
          {/* الملصقُ كاملاً حادّاً بحجمه الأصليّ، ملتصقاً تحت الشريط العلويّ، بعرض عمود الصفحة؛ وحافّتُه السفلى تذوب في التكملة */}
          {/* eslint-disable-next-line @next/next/no-img-element -- الملصقُ الأصليّ من TMDB: لا مقاسَ أكبرَ يُختار */}
          <img
            src={posterUrl(bg.path, CHAT_BG_TITLE_SIZE) ?? undefined}
            alt=""
            className="absolute inset-x-0 mx-auto w-full max-w-[640px] h-auto"
            style={{
              top: "var(--sticky-top)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 92%, transparent)",
              maskImage: "linear-gradient(to bottom, #000 92%, transparent)",
            }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: "var(--background)", opacity: CHAT_BG_TITLE_VEIL }} />
        </>
      )}
    </div>
  );
}
