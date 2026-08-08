import { getCollection, relatedTitles, titleOf, yearOf } from "@/lib/tmdb";
import type { MediaType } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { universeOf, universeName } from "@/lib/universes";
import { PosterRail, RailItem } from "./PosterRail";
import { PosterCard } from "./PosterCard";
import { AddWorksToList } from "./AddWorksToList";
import { Icon } from "./Icon";

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
  const loc = locale === "en" ? "en" : "ar";

  /* العالم فحصٌ محليّ في القاموس — لا طلب شبكة (universes.ts, D-074) */
  const universe = mediaType === "movie" ? universeOf(tmdbId) : null;

  const [collection, related] = await Promise.all([
    collectionId ? getCollection(collectionId) : Promise.resolve(null),
    relatedTitles(mediaType, tmdbId),
  ]);

  if (!collection && related.length === 0 && !universe) return null;

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
          action={
            collectionId ? (
              <AddWorksToList source="collection" id={collectionId} locale={locale} />
            ) : undefined
          }
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

      {/* ===== العالم الكامل (D-074) =====
          بطاقةٌ لا صفُّ ملصقات: رسمُ عالمٍ من ٣٧ فيلماً يكلّف ٣٧ طلباً في
          كل فتح صفحة، والزرّ لا يحمل بيانات أصلاً (D-052) — فالبطاقة تحمل
          الاسم والوعد («بترتيب الأحداث») والزرّ، والقائمة الناتجة هي العرض */}
      {universe && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <span
            className="grid place-items-center w-10 h-10 rounded-full bg-accent/10 text-accent shrink-0"
            aria-hidden
          >
            <Icon name="sparkle-star" size={18} />
          </span>
          <span className="min-w-0 flex-1 basis-52">
            <span className="block text-[14px] font-bold truncate">
              {universeName(universe, loc)}
            </span>
            <span className="block text-[12px] text-muted leading-snug mt-0.5">
              {t.universeHint}
            </span>
          </span>
          <AddWorksToList source="universe" id={universe.slug} locale={locale} />
        </section>
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
