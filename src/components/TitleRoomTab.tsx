import { getCommunityRoom, getTitleRoomOf } from "@/lib/data";
import { localizeTitleRooms } from "@/lib/localize";
import { type Locale } from "@/lib/i18n";
import { CommunityRoom } from "./Communities";
import { TitleRoomLink } from "./TitleRoomLink";

/**
 * تبويب «المجتمع» في صفحة العمل — **الغرفةُ نفسها لا رابطٌ إليها**
 * (D-191، طلب أحمد: «تبويب اسمه كوميونيتي مربوط بغرفة الكوميونيتي الخاصة
 * فيه لو فتحناها»).
 *
 * **وما كان قبله:** سطرٌ في تبويب «الآراء» (`TitleRoomLink`) يقول «غرفة
 * النقاش» ويأخذك إلى `/people?tab=all&c=<id>` — أي **يُخرجك من العمل**
 * لتتكلّم عنه، ثم يعيدك. وغرفُ الأعمال (D-140) أثمنُ ما في المجتمع
 * وأخفاه: تُنشأ يومياً بـ`pg_cron` وينتهي أمرُها إلى سطرٍ في تبويبٍ ثالث.
 * **فبابُها صار هنا، حيث الحديث عن العمل يقع أصلاً.**
 *
 * **وحُذف السطرُ القديم مع نقلها — لا بابان لغرفةٍ واحدة** (قاعدة ٦:
 * نسخةٌ ثانية عيب). ومن حفظ الرابط القديم يصل إلى نفس الغرفة في المجتمع،
 * فلا شيء انكسر.
 *
 * ⚠️ **وكلفتُه تُقال:** `DetailTabs` يرسم كلَّ التبويبات على الخادم ويُخفي
 * غير المختار بـCSS (فالتبديل فوريّ بلا طلب). فرسائلُ الغرفة تُقرأ **لكل
 * من يفتح صفحة العمل** لا لمن يفتح التبويب. النداءُ واحدٌ خلف `Suspense`
 * ومحدودُ العدد، لكنه ثمنٌ يُدفع على أسخن صفحةٍ في التطبيق — **وإن ثقل
 * فالعلاجُ تحميلٌ متأخّر للتبويب لا حذفُه** (بندٌ في `05`).
 *
 * **ولا غرفة؟ يُعاد `TitleRoomLink` نفسه** في حالته الثانية: زرُّ «ابدأ
 * غرفة النقاش» (الميلادُ الكسول، هجرة ٥٣). **لا نصٌّ جديد ولا زرٌّ ثانٍ** —
 * المكوّن يعرف الحالتين منذ D-140، وكلُّ ما تغيّر أن حالتَه الأولى (الرابط)
 * لم تعد تُستعمل: الغرفةُ نفسُها حلّت محلّها.
 */
export async function TitleRoomTab({
  tmdbId,
  mediaType,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
}) {
  const found = await getTitleRoomOf(tmdbId, mediaType);
  /* لا غرفة — أو غرفةٌ لا تُقرأ (مؤرشفة أو حُذفت بين النداءين): الزرُّ
     نفسه، فيُنشئها الضغط ولا يقف القارئ أمام فراغٍ بلا فعل. */
  const raw = found ? await getCommunityRoom(found.id) : null;
  if (!raw) {
    return (
      <TitleRoomLink tmdbId={tmdbId} mediaType={mediaType} room={null} locale={locale} />
    );
  }

  /* اسمُ الغرفة بلغة القارئ لا بلغة من ولّدها (D-147) — والصفحة هي من
     يملك `locale` لا طبقةُ البيانات (D-048). */
  const room = (await localizeTitleRooms([raw], locale))[0] ?? raw;

  return <CommunityRoom room={room as typeof raw} locale={locale} />;
}
