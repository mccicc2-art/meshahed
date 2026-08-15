import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { dirOf } from "@/lib/dir";
import type { PeopleLeaderRow, PeopleTopReviewRow, PeopleWatchingRow } from "@/lib/data";
import { PersonName } from "./PersonRow";
import { Icon } from "./Icon";

/**
 * **أقسامُ تبويب «الناس»** (D-263 · الهجرة ٨١) — ثلاثةُ مكوّنات في ملفٍّ
 * واحد لأنها **قسمٌ واحدٌ بثلاث نوافذ**: تتشارك عنوانَ القسم وحشوَه
 * وسطرَ الشخص، **ونسخُ الوصفة في ثلاثة ملفّات هو كيف تفترق الأسطح**
 * (قاعدة ٦).
 *
 * ================= ⚠️ عددٌ صريح لا نقاطٌ موزونة =================
 *
 * **قرارُ أحمد بسؤالٍ صريح.** لوحتاه كانتا تعرضان «٢٤٥ نقطة» — **ولا
 * نقاطَ في Loopz ولا عمودَ لها**. والبديلان كانا معادلةً (مشاركة=٥ ·
 * ردّ=٢ · إعجاب=١) **أو العددَ الحقيقيَّ كما هو، واختار العدد**.
 *
 * **ولهذا الرقمُ هنا يُكتب مرّتين:** مجموعاً كبيراً على الطرف،
 * **ومفصَّلاً تحت الاسم** (٢ مشاركة · ١ رأي · ٥ إعجاب). **فمن شكّ في
 * الرقم جمع مكوّناته بنفسه** — و**رقمٌ لا يستطيع أحدٌ مراجعته يُفقِد
 * الثقةَ ببقيّة الصفحة** (D-219).
 *
 * ================= ولا قسمَ فارغاً يُرسم =================
 *
 * كلُّ مكوّنٍ هنا يعيد `null` حين لا صفَّ له. **وعنوانُ قسمٍ فوق فراغٍ
 * يُقرأ عطلاً** (D-181)، **وأربعةُ عناوينَ فوق أربعة فراغاتٍ تُقرأ
 * تطبيقاً ميّتاً** — والصفحةُ تُعلن فراغَها مرّةً واحدة في `page.tsx`.
 */

/** **وصفةُ القسم واحدة** — عنوانٌ وفاصلٌ علويّ كـ`PeopleToFollow` المدمج */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="mt-6 pt-5 border-t border-[color:var(--divider)] first:mt-0 first:pt-0 first:border-t-0"
    >
      <h2 className="text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * **لوحةُ النشاط — قسمان من نداءٍ واحد** (D-198).
 *
 * `mode="top"` يسأل عن **حجم** النافذة، و`mode="rising"` عن **الفرق**
 * بينها وبين التي قبلها. **والدالّةُ ترجع النافذتين معاً فالواجهةُ تطرح**
 * — ونداءان لرقمٍ واحد هو ما تمنعه D-198.
 *
 * ⚠️ **والفرزُ هنا لا في SQL**: الدالّةُ ترتّب بالمجموع، **والصاعدُ قد
 * يكون العاشرَ مجموعاً وهو الأوّل فرقاً** — فلو قُصّت القائمةُ في القاعدة
 * بخمسة لصار القسمُ الثاني نسخةً من الأوّل بترتيبٍ آخر.
 */
export function PeopleLeaderboard({
  rows,
  locale,
  mode,
  limit = 5,
}: {
  rows: PeopleLeaderRow[];
  locale: Locale;
  mode: "top" | "rising";
  limit?: number;
}) {
  const t = getDict(locale);

  /* **ومن لم يصعد لا يظهر في «الصاعدين»**: فرقٌ صفرٌ أو سالبٌ ليس
     صعوداً، **و«+٠» على وجهٍ في قسمٍ عنوانُه «صاعدون» يكذب** (D-216). */
  const list =
    mode === "top"
      ? [...rows].sort((a, b) => b.total - a.total).slice(0, limit)
      : rows
          .map((r) => ({ r, delta: r.total - r.prevTotal }))
          .filter((x) => x.delta > 0)
          .sort((a, b) => b.delta - a.delta)
          .slice(0, limit)
          .map((x) => x.r);

  if (!list.length) return null;

  return (
    <Section title={mode === "top" ? t.peopleBoardTop : t.peopleBoardRising}>
      <ul className="mt-2 divide-y divide-[color:var(--divider)]">
        {list.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <PersonName
              person={p}
              t={t}
              size={36}
              /* **التفصيلُ تحت الاسم هو ما يجعل الرقمَ قابلاً للمراجعة** */
              sub={t.peopleBoardBreakdown(p.posts, p.reviews, p.likesIn)}
            />
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-accent">
              {mode === "top"
                ? t.peopleBoardActions(p.total)
                : t.peopleBoardDelta(p.total - p.prevTotal)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * **أعلى تعليقٍ حصل على إعجابات** — صفٌّ واحدٌ لا قائمة.
 *
 * **والبطاقةُ بابٌ إلى `/review`** حيث الردودُ والإعجاب، **ولا نسخةَ
 * ثانية من شريط الأفعال هنا**: قسمٌ يعرض شيئاً واحداً لا يحتاج أدواتِ
 * خطّ (D-224). **والنجمةُ تبقى لأن الصفَّ رأيٌ** — بخلاف بطاقة الغرفة
 * التي أُسقطت نجمتُها لأنها مكانٌ لا حكم (D-257).
 */
export function TopReviewCard({
  row,
  locale,
}: {
  row: PeopleTopReviewRow | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  if (!row) return null;

  const poster = posterUrl(row.posterPath, "w185");
  const href = `/review/${row.mediaType}/${row.tmdbId}/${row.id}`;
  const title = row.title?.trim();

  return (
    <Section title={t.peopleBoardTopReview}>
      <div className="mt-2 flex gap-3.5 p-3.5 rounded-2xl bg-surface border border-border">
        {/* **الملصقُ في البداية** — هويّةُ البطاقة كما في بطاقة الغرفة (D-257) */}
        <Link
          href={row.mediaType === "tv" ? `/show/${row.tmdbId}` : `/movie/${row.tmdbId}`}
          prefetch={false}
          className="relative w-14 h-20 shrink-0 self-start rounded-xl overflow-hidden bg-surface-2 border border-border"
        >
          {poster ? (
            <Image src={poster} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={row.mediaType === "tv" ? "tv" : "film"} size={16} />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <PersonName person={row} t={t} size={28} sub={title || undefined} />
            {row.rating > 0 && (
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-accent">
                ★{row.rating}
              </span>
            )}
          </div>

          {/* **والنصُّ مقصوصٌ لا مطويّ**: القسمُ يعِد بتعليقٍ واحدٍ يُقرأ
              بنظرة، **وبابُه مفتوحٌ لمن أراد بقيّته.** */}
          <Link href={href} prefetch={false} className="block mt-2">
            <p
              dir={dirOf(row.review)}
              className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3"
            >
              {row.review}
            </p>
          </Link>

          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            <Icon name="heart-filled" size={13} />
            <span className="tabular-nums">{t.peopleBoardLikes(row.likes)}</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

/**
 * **ما أضافه الأعضاء إلى مكتباتهم** — **لا «ماذا يشاهدون الآن»**.
 *
 * لوحةُ أحمد كتبت «الأعضاء يشاهدون الآن»، **ولا حضورَ لحظيّاً عندنا**
 * فلا نعلمه. **والذي نعلمه ما أُضيف إلى المكتبة للتوّ** — **فالجملةُ
 * تتبع البيانات لا العكس** (D-216). **وشخصٌ واحدٌ لكلِّ عملٍ في SQL**،
 * فمن أضاف عشرةً لا يملأ القسمَ وحده.
 */
export function PeopleWatching({
  rows,
  locale,
}: {
  rows: PeopleWatchingRow[];
  locale: Locale;
}) {
  const t = getDict(locale);
  if (!rows.length) return null;

  return (
    <Section title={t.peopleBoardWatching}>
      {/* **عمودان على الواسع وواحدٌ على الهاتف**: البطاقةُ سطران من نصّ
          بجانب ملصق، **وعمودان منها على ٦٨٠px يقرآن قائمةً لا شبكة.** */}
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {rows.map((r) => {
          const poster = posterUrl(r.posterPath, "w185");
          const title = r.title?.trim();
          return (
            <li key={`${r.id}-${r.mediaType}-${r.tmdbId}`}>
              <div className="flex gap-3 p-2.5 rounded-xl bg-surface border border-border">
                <Link
                  href={r.mediaType === "tv" ? `/show/${r.tmdbId}` : `/movie/${r.tmdbId}`}
                  prefetch={false}
                  className="relative w-11 h-16 shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border"
                >
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="44px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  {title && (
                    <p
                      dir={dirOf(title)}
                      className="text-[13px] font-semibold leading-snug line-clamp-2"
                    >
                      {title}
                    </p>
                  )}
                  <div className="mt-1">
                    <PersonName
                      person={r}
                      t={t}
                      size={20}
                      sub={t.peopleBoardAdded(timeAgo(r.addedAt, t))}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
