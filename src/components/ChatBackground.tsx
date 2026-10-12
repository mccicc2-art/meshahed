import { posterUrl } from "@/core/media";
import { CHAT_BG_DOODLE_OPACITY, CHAT_BG_SIDE_BLUR, CHAT_BG_SIDE_SIZE, CHAT_BG_TITLE_SIZE, CHAT_BG_TITLE_VEIL, type ChatBg } from "@/core/chatBg";

/**
 * 🆕 D-1382 — خلفيّةُ الخيط المفتوح (الويب).
 *
 * طبقةٌ ثابتةٌ خلف المحادثة لا خلفيّةُ الصفحة: الخيطُ يمرَّر في المستند كلِّه (D-767)، فطبقةٌ `fixed` تبقى
 * تحت الفقاعات أينما نزل القارئ، **ولا تمسّ بقيّةَ الصفحات**. لا تُلمس (`pointer-events-none`) ولا تُقرأ (`aria-hidden`).
 *
 * • Loopz — الرسومُ **قناعٌ** يُلوَّن بلون النصّ: صورةٌ واحدةٌ تتبع كلَّ ثيمٍ والوضعَ النهاريّ.
 * • العمل — 🆕 ملصقُه المختار كاملاً ممطوطاً لمقاس المساحة تحت الشريط العلويّ (D-1386)، فوقه غشاءٌ بلون خلفيّة الثيم: تعتيمٌ في الداكن وغسلٌ في النهاريّ.
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
          {/* 🆕 D-1386 — جانبا الشاشة العريضة (الحاسوب): نسخةٌ مضبّبة — على الجوال لا تُرى لأنّ الملصقَ بعرض الشاشة */}
          {/* eslint-disable-next-line @next/next/no-img-element -- طبقةٌ مضبّبة: مقاسٌ صغيرٌ يكفي */}
          <img
            src={posterUrl(bg.path, CHAT_BG_SIDE_SIZE) ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: `blur(${CHAT_BG_SIDE_BLUR}px)`, transform: "scale(1.1)" }}
          />
          {/* الملصقُ كاملاً بحجمه الأصليّ، **ممطوطاً لمقاس المساحة** من تحت الشريط العلويّ إلى القاع («مطّ للمقاس») */}
          {/* eslint-disable-next-line @next/next/no-img-element -- الملصقُ الأصليّ من TMDB: لا مقاسَ أكبرَ يُختار */}
          <img
            src={posterUrl(bg.path, CHAT_BG_TITLE_SIZE) ?? undefined}
            alt=""
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[640px] object-fill"
            style={{ top: "var(--sticky-top)", height: "calc(100% - var(--sticky-top))" }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: "var(--background)", opacity: CHAT_BG_TITLE_VEIL }} />
        </>
      )}
    </div>
  );
}
