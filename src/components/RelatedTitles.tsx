import { getCollection, relatedTitles, titleOf, yearOf } from "@/lib/tmdb";
import type { MediaType } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { PosterRail, RailItem } from "./PosterRail";
import { PosterCard } from "./PosterCard";

/**
 * ذيل صفحة العمل: الأجزاء ثم الأعمال المرتبطة.
 *
 * لماذا خارج التبويبات: التبويبات تُخفي بعضها بعضاً، وهذا الصفّ جوابٌ على
 * سؤالٍ يأتي بعد قراءة الصفحة كلها — «وبعد؟». فيسكن أسفلها ظاهراً مهما
 * كان التبويب المفتوح، كما تفعل كل منصّات المشاهدة. ولذلك أيضاً يحمل
 * `id` ثابتاً: ضغطة «للمشاهدة» تنزلق إليه.
 *
 * ولماذا صفّان لا واحد: «الأجزاء» علاقةٌ يقينية يصرّح بها TMDB
 * (`belongs_to_collection`)، و«المرتبط» ترجيحٌ مبنيّ على السلوك. خلطهما في
 * صفٍّ واحد يجعل الجزء الرابع من السلسلة والعملَ الشبيه في مرتبةٍ واحدة —
 * وهما ليسا كذلك عند من يبحث عن تسلسل قصّة.
 *
 * **بلا أزرارٍ هنا منذ نقلة الترويسة (طلب المالك):** زرّا «احفظ الأجزاء»
 * و«احفظ العالم» صعدا إلى جنب الملصق أعلى الصفحة، وبقي هذا الذيل للتصفّح
 * وحده — بابٌ واحد لكل فعل، وزرٌّ مكرّر في مكانين حالتان تفترقان.
 */
export async function RelatedTitles({
  mediaType,
  tmdbId,
  collectionId,
  locale,
}: {
  mediaType: MediaType;
  tmdbId: number;
  /** معرّف السلسلة — للأفلام وحدها، و`null` لما لا سلسلة له */
  collectionId?: number | null;
  locale: Locale;
}) {
  const t = getDict(locale);

  const [collection, related] = await Promise.all([
    collectionId ? getCollection(collectionId) : Promise.resolve(null),
    relatedTitles(mediaType, tmdbId),
  ]);

  if (!collection && related.length === 0) return null;

  const href = (r: { id: number; media_type: MediaType | "person" }) =>
    `/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`;

  return (
    /* `scroll-mt`: الترويسة لاصقة، ولولا هذا الهامش لاستقرّ عنوان الصفّ
       تحتها بعد الانزلاق فيبدو أن شيئاً لم يحدث */
    <div
      id="related"
      className="mt-10 space-y-8 scroll-mt-[calc(var(--header-h)+1rem)]"
    >
      {collection && (
        <PosterRail
          title={t.relatedPartsTitle}
          icon="film"
          subtitle={collection.name}
        >
          {collection.parts.map((p) => (
            <RailItem key={p.id}>
              <PosterCard
                href={href(p)}
                title={titleOf(p)}
                posterPath={p.poster_path}
                year={yearOf(p)}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {related.length > 0 && (
        <PosterRail
          title={t.relatedTitlesTitle}
          icon="sparkles"
          subtitle={t.relatedTitlesHint}
        >
          {related.map((r) => (
            <RailItem key={`${r.media_type}-${r.id}`}>
              <PosterCard
                href={href(r)}
                title={titleOf(r)}
                posterPath={r.poster_path}
                year={yearOf(r)}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}
    </div>
  );
}
