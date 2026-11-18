import Image from "next/image";
import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { backdropUrl, getPersonCredits, isTvProgram, titleOf, yearOf, type SearchResult } from "@/lib/tmdb";
import { SectionTitle } from "../Icon";
import { webWords } from "../webWords";

type Credit = SearchResult & { character?: string | null; job?: string | null; episode_count?: number };

/* ظهورُه بنفسه (ضيفٌ في برنامج، راوٍ، لقاء) ليس «دوراً» — ولا يُعدّ من أشهر أعماله */
const SELF = /^(self|himself|herself|themselves|narrator|host|guest)\b|\(voice\)$|^voice$/i;

/**
 * 🆕 R267 — **«أشهر أعماله» على الحاسوب** (أحمد ١٨ نوفمبر — «أ»): أربعُ بطاقاتٍ عريضةٍ بخلفيّة العمل واسمِ دوره.
 *
 * ⚠️ **ترتيبُها ليس ترتيبَ الشبكة تحتها**: الشبكةُ بشعبيّة TMDB كما هي (لم يُطلب تغييرُها)، وهي تضع برامجَ الحوار وظهورَ
 * الضيف أوّلاً (Breaking Bad رقم ١٩ عند كرانستون). أمّا هنا فالسؤالُ «بماذا يُعرف؟» — فالأدوارُ الفعليّة وحدها (لا برامج،
 * ولا «Self»، ولا حلقةٌ أو اثنتان ضيفاً في مسلسل)، مرتّبةً بعدد المصوّتين: ما رآه الناسُ فعلاً. النداءُ نفسُه الذي تقرؤه
 * الشبكة (`getPersonCredits` مخبّأ) — لا رحلةٌ ثانية.
 */
export async function PersonKnownFor({ personId, locale }: { personId: number; locale: Locale }) {
  const t = getDict(locale);
  const w = webWords(locale);
  const all = (await getPersonCredits(personId)) as Credit[];
  const picks = all
    .filter((r) => r.backdrop_path && !isTvProgram(r))
    .filter((r) => {
      const role = (r.character ?? r.job ?? "").trim();
      if (!role || SELF.test(role)) return false;
      return r.media_type !== "tv" || (r.episode_count ?? 99) >= 4;
    })
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .slice(0, 4);
  if (picks.length < 2) return null;

  return (
    <section className="hidden desk:block mt-8">
      <SectionTitle icon="star" className="mb-3">
        {w.personKnownFor}
      </SectionTitle>
      <div className="grid grid-cols-4 gap-4">
        {picks.map((r) => {
          const img = backdropUrl(r.backdrop_path, "w780");
          const role = (r.character ?? r.job ?? "").trim();
          return (
            <Link
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              prefetch={false}
              className="group relative block h-[150px] overflow-hidden rounded-2xl border border-border bg-surface-2"
            >
              {img ? <Image src={img} alt="" fill sizes="300px" className="object-cover opacity-70 group-hover:opacity-90 transition" /> : null}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <span className="absolute inset-x-3 bottom-2.5">
                <bdi className="block truncate text-15 font-bold text-white">{titleOf(r)}</bdi>
                <span className="block truncate text-12 text-white/75">
                  {w.personAsRole(role)}
                  {yearOf(r) ? ` · ${yearOf(r)}` : ""}
                  {r.media_type === "tv" ? ` · ${t.typeSeries}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
