import Image from "next/image";
import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl } from "@/core/media";
import type { getCredits } from "@/lib/tmdb";
import { DetailTabDoor } from "./DetailTabs";
import { Icon } from "./Icon";

/**
 * 🆕 R257 — **بطاقةُ «طاقم العمل» في العمود الجانبيّ لصفحة العمل على الحاسوب** (أحمد ١٨ نوفمبر — «أ»، الصورة `title_aside`).
 *
 * العمودُ كان يحمل بطاقةَ الأفعال وحدها وتحتها فراغٌ بطول الحلقات. ستّةُ وجوهٍ — الأوائلُ في ترتيب TMDB — باسمٍ ودور، وكلُّ
 * وجهٍ بابُ صفحة الشخص؛ و«الكل» يفتح «معلومات» حيث الطاقمُ كاملاً (`CastRail`). والوعدُ نفسُه الذي تقرؤه «معلومات» —
 * لا نداءَ ثانٍ. والجوّالُ لا يراها (`desk:` في الصفحة) — طاقمُه في «معلومات» كما كان.
 */
export async function TitleCastCard({
  credits,
  locale,
}: {
  credits: Promise<Awaited<ReturnType<typeof getCredits>>>;
  locale: Locale;
}) {
  const t = getDict(locale);
  const { cast } = await credits;
  const top = cast.slice(0, 6);
  if (top.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-15 font-bold">{t.castTitle}</h2>
        {cast.length > top.length ? <DetailTabDoor tab="info" label={t.seeAll} /> : null}
      </div>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
        {top.map((p) => {
          const src = posterUrl(p.profile_path, "w185");
          return (
            <li key={p.id}>
              <Link href={`/person/${p.id}`} prefetch={false} className="group flex flex-col items-center text-center">
                <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-surface-2">
                  {src ? <Image src={src} alt="" fill sizes="64px" className="object-cover object-top" /> : <Icon name="people" size={22} className="text-muted" />}
                </span>
                <bdi className="mt-1.5 line-clamp-1 text-12 font-bold group-hover:text-accent transition">{p.name}</bdi>
                {p.character ? <bdi className="line-clamp-1 text-[11px] text-muted">{p.character}</bdi> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
