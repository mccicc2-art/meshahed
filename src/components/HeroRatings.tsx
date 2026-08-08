import { externalRatings } from "@/lib/omdb";
import { tvImdbId } from "@/lib/tmdb";

/**
 * تقييما IMDb وطماطم في سطر ترويسة العمل (طلب أحمد — ينقض D-027).
 *
 * مكوّن خادمٍ صغير خلف Suspense: رحلة OMDb (مخبّأة يوماً) لا تؤخّر رسم
 * الترويسة، والهيكل البديل هو نجمة TMDB القديمة نفسها — فلا قفزة تخطيط
 * (D-046) ولا فراغ. وحين لا مفتاح (`OMDB_API_KEY`) أو لا بيانات، تبقى
 * النجمة القديمة: تدهورٌ صريح لا عطلٌ صامت (نمط D-077).
 *
 * «RT» بلون الخطأ الأحمر — لون الطماطم من سلّم الألوان القائم لا لونٌ
 * جديد (D-003/D-039)، و«IMDb» بلون التمييز. لا رموز إيموجي (D-002).
 */
export async function HeroRatings({
  imdbId,
  tvId,
  tmdbVote,
}: {
  /** معرّف IMDb إن كان بيدنا (الفيلم يحمله في تفاصيله) */
  imdbId?: string | null;
  /** مسلسل؟ يُحلّ معرّفه من /external_ids هنا — خارج مسار الترويسة الحرج */
  tvId?: number;
  tmdbVote: number;
}) {
  const iid = imdbId ?? (tvId ? await tvImdbId(tvId) : null);
  const ext = await externalRatings(iid);

  if (!ext) {
    return <TmdbStar vote={tmdbVote} />;
  }
  return (
    <>
      {ext.imdb && (
        <>
          <span aria-hidden>·</span>
          <span className="font-semibold tabular-nums">
            <span className="text-accent font-bold">IMDb</span>{" "}
            <span dir="ltr">{ext.imdb}</span>
          </span>
        </>
      )}
      {ext.rt && (
        <>
          <span aria-hidden>·</span>
          <span className="font-semibold tabular-nums">
            <span className="font-bold" style={{ color: "var(--error)" }}>
              RT
            </span>{" "}
            <span dir="ltr">{ext.rt}</span>
          </span>
        </>
      )}
    </>
  );
}

/** نجمة TMDB القديمة — هيكلُ الانتظار واحتياطُ الغياب معاً */
export function TmdbStar({ vote }: { vote: number }) {
  if (!(vote > 0)) return null;
  return (
    <>
      <span aria-hidden>·</span>
      <span className="text-accent font-semibold tabular-nums">
        ★ {vote.toFixed(1)}
      </span>
    </>
  );
}
