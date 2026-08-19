import Image from "next/image";
import { IMG } from "@/lib/media";
import { regionName } from "@/lib/region";
import { getDict, type Locale } from "@/lib/i18n";
import type { WatchOptions } from "@/lib/tmdb";

/**
 * شارة «أين يُبثّ» في ترويسة صفحة العمل — **رموزٌ بلا أسماء، وطبقةٌ
 * واحدة** (D-190، طلب أحمد: «لا تكتب شاهد VIP، اكتفِ بالرمز وحطّ رمز تود
 * كذلك… فقط منصّات الاشتراك، إن ما فيه نذكر رنت، ما فيه نذكر البيع بهذا
 * الترتيب — ممنوع ذكر الثلاثة»).
 *
 * **ثلاثة تغييرات، ولكلٍّ سببُه:**
 *
 * ١) **الاسم سقط، والشعار بقي.** «Shahid VIP» كلمتان بالحروف اللاتينية
 *    في ترويسةٍ عربية، وشعارُ شاهد يُعرَف في لمحةٍ عند من يعرفه — **ومن لا
 *    يعرفه لن ينفعه الاسم أيضاً**. والضغطُ يفتح JustWatch بكلّ التفاصيل،
 *    فالشارةُ إشارةٌ لا جدول. و`title` و`alt` يحملان الاسم لقارئ الشاشة
 *    ولمن يمرّ بالفأرة — **حُذف من العين لا من المعنى**.
 *
 * ٢) **كلُّ منصّات الطبقة لا واحدة.** كانت تعرض الأولى وحدها، فمن عنده
 *    «تود» ولا «شاهد» يقرأ «غير متاح لي» وهو متاح. والشعاراتُ صغيرةٌ
 *    فثلاثةٌ منها أضيقُ من اسمٍ واحد — **الصدقُ هنا أرخصُ من الكذب**.
 *    وسقفُ أربعةٍ يمنع صفّاً يلتفّ في الترويسة.
 *
 * ٣) **طبقةٌ واحدة تُعرض، والباقي يُطوى.** الاشتراكُ ثم التأجيرُ ثم الشراء
 *    — **ولا يُخلط اثنان**. وسببُه أن الخلط يُنتج سؤالاً لا جواباً: من
 *    يرى «شاهد» و«آبل» معاً لا يعرف أيُّهما بالاشتراك وأيُّهما بالدفع،
 *    **والشارةُ التي تحتاج شرحاً ليست شارة**. أمّا التفاصيل الكاملة فمكانُها
 *    JustWatch — وقد حُذف قسم «أين أشاهده» من تبويب «معلومات» (نفس الطلب)،
 *    فصارت هذه الشارةُ **البابَ الوحيد**، وهو ما يجعل صدقَها ألزم.
 *
 * **والمجّانيّ يُحسب مع الاشتراك، وهذا اجتهادٌ يُقال:** أحمد سمّى ثلاثاً
 * (اشتراك · تأجير · شراء) و`free` طبقةٌ رابعة عند TMDB. وجوابُ المستخدم
 * فيهما واحد — «تستطيع مشاهدته الآن بلا دفعٍ إضافي» — فضمُّها إلى الأولى
 * أصدقُ من إسقاطها أو من طبقةٍ رابعة لم تُطلب.
 *
 * **والشارة تسمّي البلد حين لا يكون بلد المستخدم** (D-150): التوفّر يختلف
 * جوهرياً، وكان التطبيق يجرّب السعودية ثم الإمارات ثم مصر ثم أمريكا ويعرض
 * أوّل ما وجد بلا كلمة — فيرى المشاهد في المغرب منصّةً لا يفتحها ويظنّها
 * له. السقوطُ بقي، لكنه مُعلَن.
 */
export function WatchChip({
  options,
  region,
  userRegion,
  locale,
}: {
  options: WatchOptions;
  /** البلد الذي جاءت منه هذه البيانات فعلاً */
  region: string;
  /** بلد المستخدم المختار */
  userRegion: string;
  locale: Locale;
}) {
  const t = getDict(locale);

  /* الطبقةُ الأولى غيرُ الفارغة وحدها — بهذا الترتيب حرفياً.
     🆕 **و`ads` مع `free` في الطبقة الأولى** (D-415): «مجّاناً بفواصل
     إعلانيّة» **جوابٌ عن سؤال «أقدر أشاهده؟» تماماً كالاشتراك** —
     **والفرقُ بينهما ثمنُ وقتٍ لا ثمنُ مال**، وأكثرُ المنصّات العربيّة
     تعيش هناك. */
  const firstTier = [...options.flatrate, ...options.free, ...(options.ads ?? [])];
  const tier =
    firstTier.length > 0
      ? firstTier
      : options.rent.length > 0
        ? options.rent
        : options.buy;
  if (tier.length === 0) return null;

  /* لا تكرار لمنصّةٍ ظهرت في `flatrate` و`free` معاً */
  const seen = new Set<number>();
  const shown = tier.filter((p) => !seen.has(p.provider_id) && seen.add(p.provider_id)).slice(0, 4);
  if (shown.length === 0) return null;

  const elsewhere = region !== userRegion;
  const names = shown.map((p) => p.provider_name).join(" · ");
  const inner = (
    <span className="inline-flex items-center gap-1.5 bg-surface-2 border border-border px-2 py-1 rounded-lg hover:border-accent/50 transition">
      {shown.map((p) =>
        p.logo_path ? (
          <Image
            key={p.provider_id}
            src={`${IMG}/w92${p.logo_path}`}
            alt={p.provider_name}
            title={p.provider_name}
            width={18}
            height={18}
            className="rounded-[5px] shrink-0"
          />
        ) : (
          /* بلا شعار؟ اسمُه — **فالبديل عن الرمز الاسمُ لا الفراغ** */
          <span key={p.provider_id} className="text-[12px] font-semibold text-foreground/90">
            {p.provider_name}
          </span>
        ),
      )}
      {elsewhere && (
        <span className="text-[12px] text-muted font-normal">
          {regionName(region, locale === "en" ? "en" : "ar")}
        </span>
      )}
    </span>
  );

  return options.link ? (
    <a
      href={options.link}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`${t.watchWhereTitle}: ${names}`}
      title={names}
    >
      {inner}
    </a>
  ) : (
    inner
  );
}
