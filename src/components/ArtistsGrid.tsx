import { PosterCard } from "./PosterCard";
import { posterGrid } from "./ui/controls";
import type { Dict } from "@/lib/i18n";
import type { ArtistShelfItem } from "@/lib/artists";

/**
 * رفُّ الفنانين — تبويب المكتبة الرابع (D-128)، وقسمُ «فنّانوك» في
 * البروفايل لاحقاً (D-129). يُبنى مرّة ويظهر مرّتين.
 *
 * **البطاقة هي `PosterCard` نفسها، لا شبكة صورٍ دائرية.** البريف اقترح
 * دوائر، وهذا نقضٌ له بسبب: الشخص في هذا التطبيق **محتوىً كالعمل** منذ
 * `CastRail` — نفس النسبة ونفس الزوايا ونفس أيقونة الفراغ. دوائرُ هنا
 * تعني لغةً بصريةً ثانيةً لنفس النوع من المحتوى، وثانيةً في مكانٍ واحد
 * تعني ثالثةً بعد شهر. والقاعدة الثالثة في `00` صريحة: مصنعٌ ثانٍ خلل.
 *
 * والسطر تحت الاسم هو الميزة: «شاهدتَ له ٧ أعمال» يجعل الرفّ يشبه ذوقك
 * لا قائمة متابعاتٍ عشوائية — ويغيب عند الصفر، لأن «٠ أعمال» خبرٌ سيّئ
 * عن لا شيء.
 */
export function ArtistsGrid({ artists, t }: { artists: ArtistShelfItem[]; t: Dict }) {
  return (
    <div className={posterGrid}>
      {artists.map((a) => (
        <PosterCard
          key={a.person_id}
          href={`/person/${a.person_id}`}
          title={a.name ?? "—"}
          posterPath={a.profile_path}
          posterSize="w185"
          fallbackIcon="people"
          note={a.watchedWorks > 0 ? t.artistWorksWatched(a.watchedWorks) : undefined}
        />
      ))}
    </div>
  );
}
