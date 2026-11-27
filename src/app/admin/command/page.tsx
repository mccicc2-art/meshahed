import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { getCommandBoard, getReleaseQueue } from "@/lib/command";
import { canDecideNow } from "./parts";
import { CommandRoomView } from "./view";

/**
 * ====== 🆕 غرفةُ القيادة (مهمّة ٥٩٣، التصميم «ب — خريطة الأقسام»، اختيارُ أحمد ٢٧ نوفمبر) ======
 *
 * 🎯 **سؤالٌ واحدٌ تجيبه الصفحةُ في خمس ثوانٍ: «ماذا ينتظرني؟»** — لا «ماذا فعل
 * الوكلاء». فالترتيبُ ترتيبُ القرار: العدّادات → أهمُّ بندٍ بأزراره → طابورُ
 * الرفع → الأقسامُ بنقطةِ حالة → نبضُ المنتج. **والتفاصيلُ في «البنود» و«الوكلاء».**
 *
 * 🔑 **كلُّ زرٍّ هنا يسجّل لا ينفّذ** (قرار «٢أ»): «وافق على الرفع» صفٌّ في
 * السجلّ، **والرفعُ نفسُه في محادثةٍ تقرأه** — فلا مفتاحَ GitHub في الخادم ولا
 * طريقَ من زرٍّ إلى `main`.
 *
 * ⚖️ **والسجلُّ في مشروع المعاينة لا الإنتاج** (قرار «١أ»): غيابُ المفتاح أو
 * تعطّلُ المعاينة يُظهر سطراً هادئاً لا صفحةً مكسورة — الإدارةُ الباقيةُ تعمل.
 */
export const dynamic = "force-dynamic";

export default async function CommandRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const [board, queue, canDecide] = await Promise.all([
    getCommandBoard(),
    getReleaseQueue(),
    canDecideNow(),
  ]);

  return (
    <CommandRoomView
      board={board}
      queue={queue}
      canDecide={canDecide}
      sp={sp}
    />
  );
}
