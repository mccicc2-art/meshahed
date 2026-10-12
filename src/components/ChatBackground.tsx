import { backdropUrl } from "@/core/media";
import { CHAT_BG_DOODLE_OPACITY, CHAT_BG_TITLE_BLUR, CHAT_BG_TITLE_VEIL, type ChatBg } from "@/core/chatBg";

/**
 * 🆕 D-1382 — خلفيّةُ الخيط المفتوح (الويب).
 *
 * طبقةٌ ثابتةٌ خلف المحادثة لا خلفيّةُ الصفحة: الخيطُ يمرَّر في المستند كلِّه (D-767)، فطبقةٌ `fixed` تبقى
 * تحت الفقاعات أينما نزل القارئ، **ولا تمسّ بقيّةَ الصفحات**. لا تُلمس (`pointer-events-none`) ولا تُقرأ (`aria-hidden`).
 *
 * • Loopz — الرسومُ **قناعٌ** يُلوَّن بلون النصّ: صورةٌ واحدةٌ تتبع كلَّ ثيمٍ والوضعَ النهاريّ.
 * • العمل — خلفيّتُه العريضة مضبّبةً، فوقها غشاءٌ بلون خلفيّة الثيم: تعتيمٌ في الداكن وغسلٌ في النهاريّ.
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
          {/* eslint-disable-next-line @next/next/no-img-element -- صورةٌ مضبّبةٌ خلف المحادثة: لا تحسينَ يُرى ولا مقاسَ يُختار */}
          <img
            src={backdropUrl(bg.path, "w780") ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: `blur(${CHAT_BG_TITLE_BLUR}px)`, transform: "scale(1.15)" }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: "var(--background)", opacity: CHAT_BG_TITLE_VEIL }} />
        </>
      )}
    </div>
  );
}
