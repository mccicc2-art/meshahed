/**
 * 🆕 **اسمُ الخطّة رسماً: «Loopz Plus» و«Loopz Gold»** — نظيرُ `apps/mobile/src/PlanWordmark.tsx` في الويب (T408).
 * «Plus» بلون التمييز، و«Gold» بتدرّج الذهب نفسِه في التطبيق (#FFE680 → #FFD200 → #F59E0B). اسمٌ علامةٌ لا يُترجم،
 * فيُكتب من اليسار دائماً (`dir="ltr"`) داخل الجملة العربيّة.
 */
export function PlanWordmark({ tier, className = "" }: { tier: "plus" | "gold"; className?: string }) {
  return (
    <span dir="ltr" className={`font-extrabold whitespace-nowrap [unicode-bidi:isolate] ${className}`}>
      Loopz{" "}
      {tier === "plus" ? (
        <span className="text-accent">Plus</span>
      ) : (
        <span className="bg-gradient-to-br from-[#FFE680] via-[#FFD200] to-[#F59E0B] bg-clip-text text-transparent">Gold</span>
      )}
    </span>
  );
}
