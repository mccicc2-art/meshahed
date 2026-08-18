import Image from "next/image";
import { IMG } from "@/lib/media";
import { regionName } from "@/lib/region";
import { getDict, type Locale } from "@/lib/i18n";
import type { Provider, WatchOptions } from "@/lib/tmdb";

/**
 * «أين أشاهده» كاملاً — **بالشكل المتعارف عليه، لا بشكلٍ من عندنا**
 * (D-150، طلب أحمد: «حسب المتعارف، لن أخترع نظاماً جديداً»).
 *
 * الشارة في الترويسة تُجيب السؤال بمنصّةٍ واحدة، وهي الصواب هناك. لكن
 * السؤال الكامل — «باشتراكٍ عندي؟ أم أستأجره؟ بكم؟» — كان جوابُه رابطاً
 * إلى موقعٍ آخر. وخلطُ الاشتراك بالإيجار بالشراء في صفٍّ واحد **يكذب**:
 * منصّةٌ في صفّ الإيجار تعني «ادفع»، ومثلُها في صفّ الاشتراك تعني «مشمول».
 *
 * **والتقسيم ليس اختراعاً بل هو تقسيم JustWatch وTMDB أنفسهما** — نفس
 * المجموعات الأربع بنفس ترتيبها المألوف: مجاني ← اشتراك ← إيجار ← شراء.
 * ومن رأى الشكل في أي تطبيقٍ آخر يقرؤه هنا بلا تعلّم.
 *
 * **والترتيب داخل الصفّ `display_priorities[region]` لا `display_priority`**:
 * الأولوية العامّة ترتيبٌ عالميّ، والقائمة قائمةُ بلدٍ بعينه — فنتفلكس قد
 * تسبق شاهد عالمياً وتتأخّر عنها في السعودية. TMDB تعطي الاثنين، والصحيح
 * للحالة هو الخاصّ بالبلد.
 *
 * **ورابط JustWatch يبقى معروضاً**: TMDB تشترط عرضه مع البيانات، وهو أيضاً
 * الباب إلى الأسعار — ونحن لا نملكها ولا ندّعيها.
 */
export function WatchProviders({
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

  const groups: { key: string; label: string; rows: Provider[] }[] = [
    { key: "free", label: t.watchFree, rows: [...options.free, ...(options.ads ?? [])] },
    { key: "flatrate", label: t.watchFlatrate, rows: options.flatrate },
    { key: "rent", label: t.watchRent, rows: options.rent },
    { key: "buy", label: t.watchBuy, rows: options.buy },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) return null;

  /* أولويةُ البلد أولاً، فالعامّة، فالاسم — والأخير كي يبقى الترتيب ثابتاً
     بين رسمتين حين تتساوى الأولويتان (وإلا تراقص الصفّ بلا سبب) */
  const order = (rows: Provider[]) =>
    [...rows].sort(
      (a, b) =>
        (a.display_priorities?.[region] ?? a.display_priority ?? 999) -
          (b.display_priorities?.[region] ?? b.display_priority ?? 999) ||
        a.provider_name.localeCompare(b.provider_name),
    );

  const elsewhere = region !== userRegion;

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-[15px] font-bold">{t.watchWhereTitle}</h2>
        {/* البلد يُسمّى دائماً هنا لا حين يختلف وحده: القائمة الكاملة قرارُ
            شراء، ومن يقرأ سعراً يجب أن يعرف لأيّ سوقٍ هو */}
        <span className="text-[11px] text-muted">
          {regionName(region, locale === "en" ? "en" : "ar")}
          {elsewhere ? ` · ${t.watchElsewhere}` : ""}
        </span>
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key} className="flex items-start gap-3">
            <span className="shrink-0 w-20 pt-1.5 text-[12px] text-muted">{g.label}</span>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {order(g.rows).map((p) => (
                <span
                  key={p.provider_id}
                  title={p.provider_name}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-surface-2 border border-border ps-1 pe-2 py-1 rounded-lg"
                >
                  {p.logo_path && (
                    <Image
                      src={`${IMG}/w92${p.logo_path}`}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded-[5px] shrink-0"
                    />
                  )}
                  {p.provider_name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {options.link && (
        <a
          href={options.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-block mt-3 text-[12px] text-accent hover:underline"
        >
          {t.watchOnJustWatch}
        </a>
      )}
    </section>
  );
}
