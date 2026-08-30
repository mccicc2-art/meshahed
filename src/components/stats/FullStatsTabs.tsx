import Link from "next/link";
import Image from "next/image";
import { Icon, type IconName } from "@/components/Icon";
import { posterUrl, profileUrl } from "@/lib/media";
import { num, type Locale } from "@/lib/i18n";
import { hm, primeLabel } from "@/lib/statsFormat";
import type { PeriodStats } from "@/lib/periodStats";

/**
 * ============ الإحصائيات الكاملة — التبويباتُ الأربعة (D-799) ============
 *
 * **الصورُ هي المرجعُ النهائيّ** بنصِّ أحمد، **ولا إعادةَ تفسيرٍ للتصميم.**
 *
 * 🔑 **وكلُّ رقمٍ هنا من `buildPeriodStats`** — **مصدرٌ واحدٌ لهذه
 * التبويبات ولصفحة «تقريرك»** (شرطُه المكتوب): **إذا كان الإجمالي
 * 12h 48m في التقرير بقي نفسَه في التبويبات الأربعة للمدّة ذاتها.**
 *
 * 🔴 **وثلاثةُ أقسامٍ في الصور لا تُرسم — ولا تُختلق**:
 * **الأجهزة** و**الخدماتُ المرتبطة** — **لا يملك Loopz عنهما بياناً
 * واحداً اليوم**، **ونصُّ شرطه**: «لا تستخدم أرقاماً تجريبيّةً ثابتة» و
 * «لا يظهر إلّا عند وجود ربطٍ حقيقيّ… لا تستنتج المنصّة من TMDB».
 * **و«قارن مع الأصدقاء» و«ذكّرني» و«فلترة» أزرارٌ لأفعالٍ لم تُبنَ** —
 * **وزرٌّ يَعِد بما لا يُسلِّمه أسوأُ من غيابه** (D-217). **تعود كلُّها
 * يومَ تُبنى، ومكانُها محفوظٌ في الصورة.**
 */

const CHART_H = 132;

/* ══════════════════════ OVERVIEW ══════════════════════ */

export function OverviewTab({ s, locale }: { s: PeriodStats; locale: Locale }) {
  const ar = locale !== "en";
  return (
    <div className="space-y-8">
      <TileRow
        items={[
          { icon: "clock", value: hm(s.minutes, locale), label: ar ? "وقت المشاهدة" : "Watch time" },
          { icon: "trending", value: hm(s.dailyAvgMin, locale), label: ar ? "المعدّل اليومي" : "Daily average" },
          { icon: "play", value: num(s.episodes, locale), label: ar ? "حلقات" : "Episodes" },
          { icon: "film", value: num(s.movies, locale), label: ar ? "أفلام" : "Movies" },
        ]}
      />

      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-20 font-bold">{ar ? "اتجاه وقت المشاهدة" : "Watch-time trend"}</h2>
          {s.deltaPct !== null && (
            <span
              className="text-14 font-bold tabular-nums"
              dir="ltr"
              style={{ color: s.deltaPct >= 0 ? "#3DBE6B" : "#E5484D" }}
            >
              {s.deltaPct >= 0 ? "+" : ""}
              {num(s.deltaPct, locale)}%
            </span>
          )}
        </div>
        <TrendChart s={s} ar={ar} />
      </section>

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "توزيع المحتوى" : "Content breakdown"}</h2>
        <ul className="space-y-3">
          {s.mix.map((m) => (
            <li key={m.key} className="flex items-center gap-3">
              <Icon name={mixIcon(m.key)} size={18} className="text-muted shrink-0" />
              <span className="text-14 basis-[22%] max-w-[6rem] shrink-0 leading-tight">
                {mixLabel(m.key, ar)}
              </span>
              <span className="relative flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                <span
                  aria-hidden
                  className="absolute inset-y-0 start-0 rounded-full"
                  style={{ width: `${m.pct}%`, background: mixColor(m.key) }}
                />
              </span>
              <span className="text-14 tabular-nums shrink-0 w-16 text-end">{hm(m.minutes, locale)}</span>
              <span className="text-14 font-bold tabular-nums shrink-0 w-10 text-end text-accent">
                {num(m.pct, locale)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "الإكمال" : "Completion"}</h2>
        <div className="flex items-center gap-5">
          <Ring pct={s.completionPct} locale={locale} label={ar ? "نسبة الإكمال" : "Completion rate"} />
          <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
            <MiniStat icon="check" value={num(s.status.completed, locale)} label={ar ? "مكتملة" : "Completed"} />
            <MiniStat icon="play" value={num(s.status.inProgress, locale)} label={ar ? "قيد المشاهدة" : "In progress"} />
            <MiniStat icon="repeat" value={num(s.status.rewatched, locale)} label={ar ? "أُعيدت" : "Rewatched"} />
          </div>
        </div>
      </section>

      <TopTitles s={s} locale={locale} ar={ar} />
      <FooterActions ar={ar} />
    </div>
  );
}

/* ══════════════════════ CONTENT ══════════════════════ */

export function ContentTab({ s, locale }: { s: PeriodStats; locale: Locale }) {
  const ar = locale !== "en";
  return (
    <div className="space-y-8">
      <TileRow
        items={[
          { icon: "tv", value: num(s.titles, locale), label: ar ? "أعمال" : "Titles" },
          { icon: "play", value: num(s.episodes, locale), label: ar ? "حلقات" : "Episodes" },
          { icon: "film", value: num(s.movies, locale), label: ar ? "أفلام" : "Movies" },
          { icon: "check", value: num(s.status.completed, locale), label: ar ? "مكتملة" : "Completed" },
        ]}
      />

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "تركيبة المحتوى" : "Content mix"}</h2>
        <div className="flex items-center gap-5">
          <Donut mix={s.mix} total={hm(s.minutes, locale)} label={ar ? "الإجمالي" : "Total"} />
          <ul className="flex-1 space-y-2.5 min-w-0">
            {s.mix.map((m) => (
              <li key={m.key} className="flex items-center gap-2.5 text-14">
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: mixColor(m.key) }}
                />
                <span className="truncate min-w-0 flex-1">{mixLabel(m.key, ar)}</span>
                <span className="tabular-nums font-bold shrink-0">{num(m.pct, locale)}%</span>
                <span className="tabular-nums text-muted shrink-0">· {hm(m.minutes, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "حالة المشاهدة" : "Watch status"}</h2>
        <div className="grid grid-cols-4 gap-2">
          <MiniStat icon="play" value={num(s.status.started, locale)} label={ar ? "بدأتها" : "Started"} />
          <MiniStat icon="check" value={num(s.status.completed, locale)} label={ar ? "مكتملة" : "Completed"} />
          <MiniStat icon="hourglass" value={num(s.status.inProgress, locale)} label={ar ? "جارية" : "In progress"} />
          <MiniStat icon="repeat" value={num(s.status.rewatched, locale)} label={ar ? "أُعيدت" : "Rewatched"} />
        </div>
      </section>

      <TopTitles s={s} locale={locale} ar={ar} />

      {s.releaseYears.length > 0 && (
        <section>
          <h2 className="text-20 font-bold mb-3">{ar ? "سنوات الإصدار" : "Release years"}</h2>
          <ul className="space-y-2.5">
            {s.releaseYears.map((d) => (
              <li key={d.decade} className="flex items-center gap-3">
                <span className="text-14 w-14 shrink-0 tabular-nums" dir="ltr">
                  {d.decade}s
                </span>
                <span className="relative flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 start-0 rounded-full bg-accent"
                    style={{ width: `${d.pct}%` }}
                  />
                </span>
                <span className="text-14 tabular-nums text-muted shrink-0 w-10 text-end">
                  {num(d.pct, locale)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FooterActions ar={ar} />
    </div>
  );
}

/* ══════════════════════ TASTE ══════════════════════ */

export function TasteTab({ s, locale }: { s: PeriodStats; locale: Locale }) {
  const ar = locale !== "en";
  if (s.taste.thin) {
    return (
      <p className="text-sm text-muted text-center py-16 px-6 leading-relaxed">
        {ar
          ? "واصل المشاهدة لتتكوّن بصمة ذوقك — لا نعرض استنتاجاً على بياناتٍ قليلة."
          : "Keep watching to build your taste profile — we do not draw conclusions from too little data."}
      </p>
    );
  }
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-20 font-bold mb-2">{ar ? "بصمة ذوقك" : "Your taste fingerprint"}</h2>
        <Radar axes={s.taste.radar} />
      </section>

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "أعلى الأنواع" : "Top genres"}</h2>
        <ul className="space-y-2.5">
          {s.taste.genres.map((g, i) => (
            <li key={g.slug} className="flex items-center gap-3">
              {/* 🔴 **والاسمُ يلتفّ ولا يُبتر** (D-801، وحكمُ D-787 نفسُه):
                  «Action & Adv…» و«Sci-Fi & Fant…» أسماءٌ مقطوعةٌ في عرضٍ
                  ثابتٍ ٩٦ بكسل — **واسمُ نوعٍ لا يُقرأ آخرُه لا يُعرَّف
                  عمّا يعدّه.** فالخانةُ نسبةٌ من السطر، **والالتفافُ سطرين
                  أصدقُ من نقاطٍ ثلاث.** */}
              <span className="text-14 basis-[38%] max-w-[9.5rem] shrink-0 leading-tight">
                {g.name}
              </span>
              <span className="relative flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                <span
                  aria-hidden
                  className="absolute inset-y-0 start-0 rounded-full bg-accent"
                  style={{ width: `${g.pct}%`, opacity: i === 0 ? 1 : 0.75 }}
                />
              </span>
              <span
                className={`text-14 tabular-nums shrink-0 w-10 text-end ${i === 0 ? "text-accent font-bold" : "text-muted"}`}
              >
                {num(g.pct, locale)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-x-5 gap-y-6">
        <PctList title={ar ? "اللغات" : "Languages"} rows={s.taste.languages} locale={locale} />
        <PctList title={ar ? "الدول" : "Countries"} rows={s.taste.countries} locale={locale} />
      </div>

      {s.taste.shift.length > 0 && (
        <section>
          <h2 className="text-20 font-bold mb-3">{ar ? "انزياح الذوق" : "Taste shift"}</h2>
          <ul className="space-y-2.5">
            {s.taste.shift.map((x) => (
              <li key={x.label} className="flex items-center gap-2.5 text-14">
                <Icon
                  name={x.delta > 0 ? "trending" : "chevron-down"}
                  size={16}
                  className={x.delta > 0 ? "text-accent" : "text-muted"}
                />
                <span className="tabular-nums font-bold" dir="ltr">
                  {x.delta > 0 ? "+" : ""}
                  {num(x.delta, locale)}%
                </span>
                <span className="text-muted truncate">{x.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.taste.artists.length > 0 && (
        <section>
          <h2 className="text-20 font-bold mb-3">{ar ? "وجوهك" : "Your artists"}</h2>
          <ul className="flex gap-5">
            {s.taste.artists.map((a) => (
              <li key={a.name} className="flex-1 min-w-0 text-center">
                <span className="relative block w-16 h-16 mx-auto rounded-full overflow-hidden bg-surface-2">
                  {a.photo ? (
                    <Image src={profileUrl(a.photo, "w185")!} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                      <Icon name="people" size={20} />
                    </span>
                  )}
                </span>
                <span className="block text-12 mt-2 truncate">{a.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FooterActions ar={ar} />
    </div>
  );
}

/* ══════════════════════ HABITS ══════════════════════ */

const BAND_LABELS: Record<string, [string, string]> = {
  morning: ["الصباح", "Morning"],
  afternoon: ["الظهيرة", "Afternoon"],
  evening: ["المساء", "Evening"],
  night: ["آخر الليل", "Late night"],
};

export function HabitsTab({ s, locale }: { s: PeriodStats; locale: Locale }) {
  const ar = locale !== "en";

  if (s.habits.timedRows === 0) {
    return (
      <p className="text-sm text-muted text-center py-16 px-6 leading-relaxed">
        {ar
          ? "لا ساعات مشاهدة في هذه المدّة — الأعمال التي أرّختها بتاريخ عرضها لا تحمل ساعة، وعاداتُ الساعة تُبنى من التعليم وقت المشاهدة."
          : "No watch hours in this period — titles you dated to their air date carry no time of day, and hour habits are built from marking as you watch."}
      </p>
    );
  }

  const peak = Math.max(1, ...s.habits.heat.flat());
  const dayFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    weekday: "short",
    timeZone: "UTC",
  });
  const dayNames = [0, 1, 2, 3, 4, 5, 6].map((d) =>
    dayFmt.format(new Date(Date.UTC(2026, 1, 1 + d))),
  );

  return (
    <div className="space-y-8">
      <section>
        <p className="text-14 text-muted">{ar ? "إيقاعك" : "Your rhythm"}</p>
        <h2 className="text-[34px] leading-tight font-bold mt-1">{rhythmLabel(s.habits.rhythm, ar)}</h2>
        {s.habits.primeHours && (
          <p className="text-14 text-muted mt-1">
            {ar ? "أنشط ما تكون عند " : "Most active around "}
            <span dir="ltr">{primeLabel(s.habits.primeHours)}</span>
          </p>
        )}
      </section>

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "خريطة المشاهدة" : "Viewing heatmap"}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 min-w-[300px]">
            <thead>
              <tr>
                <th className="w-16" />
                {dayNames.map((d) => (
                  <th key={d} className="text-12 font-normal text-muted pb-1">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.habits.heat.map((band, bi) => (
                <tr key={bi}>
                  <th className="text-12 font-normal text-muted text-start pe-2 whitespace-nowrap">
                    {ar ? BAND_LABELS[bandKey(bi)][0] : BAND_LABELS[bandKey(bi)][1]}
                  </th>
                  {band.map((v, di) => (
                    <td key={di}>
                      <span
                        className="block h-7 rounded-md"
                        style={{
                          background:
                            v === 0
                              ? "var(--surface-2)"
                              : `color-mix(in srgb, var(--accent) ${Math.max(12, Math.round((v / peak) * 100))}%, var(--surface-2))`,
                        }}
                        aria-label={`${v} min`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <MiniStat icon="play" value={num(s.habits.sessions, locale)} label={ar ? "جلسات" : "Sessions"} />
        <MiniStat icon="clock" value={hm(s.habits.avgSessionMin, locale)} label={ar ? "المتوسط" : "Average"} />
        <MiniStat icon="trending" value={hm(s.habits.longestSessionMin, locale)} label={ar ? "الأطول" : "Longest"} />
        <MiniStat icon="check" value={num(s.streak, locale)} label={ar ? "أيام متتالية" : "Day streak"} />
      </div>

      <section>
        <h2 className="text-20 font-bold mb-3">{ar ? "أوقات اليوم" : "Time of day"}</h2>
        <div className="flex rounded-lg overflow-hidden h-9">
          {s.habits.timeOfDay.map((b) => (
            <span
              key={b.key}
              className="grid place-items-center text-12 font-bold min-w-0"
              style={{
                flex: `${Math.max(1, b.pct)} 0 0`,
                background:
                  b.pct === Math.max(...s.habits.timeOfDay.map((x) => x.pct))
                    ? "var(--accent)"
                    : "var(--surface-2)",
                color:
                  b.pct === Math.max(...s.habits.timeOfDay.map((x) => x.pct))
                    ? "var(--on-accent)"
                    : "var(--muted)",
              }}
            >
              {b.pct >= 8 ? `${num(b.pct, locale)}%` : ""}
            </span>
          ))}
        </div>
        <div className="flex mt-1.5">
          {s.habits.timeOfDay.map((b) => (
            <span
              key={b.key}
              className="text-12 text-muted text-center truncate min-w-0"
              style={{ flex: `${Math.max(1, b.pct)} 0 0` }}
            >
              {ar ? BAND_LABELS[b.key][0] : BAND_LABELS[b.key][1]}
            </span>
          ))}
        </div>
      </section>

      <FooterActions ar={ar} />
    </div>
  );
}

/* ══════════════════════ قِطعٌ مشتركة ══════════════════════ */

function bandKey(i: number): "morning" | "afternoon" | "evening" | "night" {
  return (["morning", "afternoon", "evening", "night"] as const)[i];
}

function rhythmLabel(r: PeriodStats["habits"]["rhythm"], ar: boolean): string {
  if (r === "weekend") return ar ? "مشاهد نهاية الأسبوع" : "Weekend watcher";
  if (r === "night") return ar ? "مشاهد الليل" : "Night watcher";
  if (r === "binge") return ar ? "مشاهد متواصل" : "Binge watcher";
  if (r === "steady") return ar ? "مشاهد منتظم" : "Steady watcher";
  return ar ? "لم يتّضح بعد" : "Not clear yet";
}

function mixIcon(k: "shows" | "movies" | "anime"): IconName {
  return k === "movies" ? "film" : k === "anime" ? "sparkles" : "tv";
}
function mixLabel(k: "shows" | "movies" | "anime", ar: boolean): string {
  if (k === "movies") return ar ? "أفلام" : "Movies";
  if (k === "anime") return ar ? "أنمي" : "Anime";
  return ar ? "مسلسلات" : "Shows";
}
function mixColor(k: "shows" | "movies" | "anime"): string {
  return k === "shows" ? "var(--accent)" : k === "movies" ? "#EDEDED" : "#8A8A8A";
}

function TileRow({
  items,
}: {
  items: { icon: IconName; value: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-3">
      {/* 🔴 **والاسمُ تحت الرقم يلتفّ ولا يُبتر** (D-801، وحكمُ D-787):
          «My ratin…» هو الشكوى بعينِها التي رفعها أحمد في الرئيسيّة —
          **وخانةٌ يُقطع اسمُها تفقد ما يعرّف رقمَها.** **والرقمُ وحدَه
          يبقى سطراً واحداً** فلا يكسر الشبكةَ عرضاً. */}
      {items.map((x) => (
        <div key={x.label} className="min-w-0">
          <Icon name={x.icon} size={18} className="text-accent" />
          <p className="text-24 font-bold leading-none mt-2 tabular-nums truncate">{x.value}</p>
          <p className="text-12 text-muted mt-1.5 leading-tight">{x.label}</p>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div className="text-center min-w-0">
      <Icon name={icon} size={16} className="text-accent mx-auto" />
      <p className="text-20 font-bold leading-none mt-1.5 tabular-nums truncate">{value}</p>
      <p className="text-12 text-muted mt-1 leading-tight">{label}</p>
    </div>
  );
}

function Ring({ pct, locale, label }: { pct: number; locale: Locale; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0 w-[104px] h-[104px]">
      <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="block text-24 font-bold leading-none tabular-nums" dir="ltr">
            {num(pct, locale)}%
          </span>
          <span className="block text-12 text-muted mt-1 px-2 leading-tight">{label}</span>
        </span>
      </span>
    </div>
  );
}

function Donut({
  mix,
  total,
  label,
}: {
  mix: PeriodStats["mix"];
  total: string;
  label: string;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  /* **الإزاحاتُ تُحسب قبل الرسم لا داخله**: متغيّرٌ يتراكم داخل `map`
     أثناء الرسم يخالف قاعدةَ الثبات في React — **ويعطي شكلاً مختلفاً في
     رسمةٍ ثانية.** */
  const arcs = mix.reduce<{ key: string; len: number; offset: number }[]>((out, m) => {
    const prev = out[out.length - 1];
    const offset = prev ? prev.offset + prev.len : 0;
    out.push({ key: m.key, len: (c * m.pct) / 100, offset });
    return out;
  }, []);
  return (
    <div className="relative shrink-0 w-[132px] h-[132px]">
      <svg viewBox="0 0 132 132" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx="66"
            cy="66"
            r={r}
            fill="none"
            stroke={mixColor(a.key as "shows" | "movies" | "anime")}
            strokeWidth="10"
            strokeDasharray={`${a.len} ${c - a.len}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="block text-20 font-bold leading-none tabular-nums">{total}</span>
          <span className="block text-12 text-muted mt-1">{label}</span>
        </span>
      </span>
    </div>
  );
}

function TrendChart({ s, ar }: { s: PeriodStats; ar: boolean }) {
  const peak = Math.max(1, ...s.buckets.map((b) => Math.max(b.minutes, b.prevMinutes)));
  const w = 320;
  const step = s.buckets.length > 1 ? w / (s.buckets.length - 1) : w;
  const y = (v: number) => CHART_H - 10 - (v / peak) * (CHART_H - 26);
  const path = (key: "minutes" | "prevMinutes") =>
    s.buckets.map((b, i) => `${i === 0 ? "M" : "L"}${i * step},${y(b[key])}`).join(" ");
  const hasPrev = s.buckets.some((b) => b.prevMinutes > 0);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${CHART_H}`} className="w-full" style={{ height: CHART_H }} aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            x2={w}
            y1={10 + i * ((CHART_H - 36) / 3)}
            y2={10 + i * ((CHART_H - 36) / 3)}
            stroke="var(--divider)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}
        {hasPrev && (
          <path d={path("prevMinutes")} fill="none" stroke="#7A7A7A" strokeWidth="2" strokeLinejoin="round" />
        )}
        <path d={path("minutes")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {s.buckets.map((b, i) => (
          <circle key={i} cx={i * step} cy={y(b.minutes)} r="3" fill="var(--accent)" />
        ))}
      </svg>
      <div className="flex">
        {s.buckets.map((b, i) => (
          <span key={i} className="flex-1 min-w-0 text-12 text-muted text-center truncate">
            {/* **واثنا عشر شهراً في صفٍّ واحدٍ لا تُقرأ على هاتف** (D-801):
                «أغسطس» تحتاج أربعين بكسلاً ولها سبعةٌ وعشرون. */}
            {s.buckets.length <= 8 || i % 3 === 0 ? b.label : ""}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2 text-12 text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 h-0.5 bg-accent" />
          {ar ? "هذه المدّة" : "This period"}
        </span>
        {hasPrev && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-4 h-0.5" style={{ background: "#7A7A7A" }} />
            {ar ? "المدّة السابقة" : "Last period"}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 🔴 **البصمةُ الخماسيّة** (D-801 — بعد قراءة الصفحة الحيّة):
 *
 * **الأسماءُ عند رؤوسها لا تحتها**: كانت الخمسةُ سطرين مكدّسين أسفل
 * الرسم — **ورادارٌ لا يُعرف أيُّ ضلعٍ لأيّ اسمٍ رسمٌ زخرفيٌّ لا قراءة**،
 * وهو خلافُ الصورة التي سلّمها أحمد. **والأسماءُ عناصرُ HTML لا `text`
 * في الـSVG**: تلتفّ سطرين حين تطول («شخصيّات عميقة»)، **وتكبر مع تفضيل
 * حجم الخطّ عند القارئ** — **و`font-size` داخل SVG لا يعرف `--fs`.**
 *
 * ⚖️ **والجذرُ لا النسبةُ المستقيمة**: المحاورُ منسوبةٌ إلى أعلاها،
 * **فذوقٌ ثلثاه نوعٌ واحدٌ يسحق الأربعةَ الباقيةَ إلى نقطةٍ في المركز**
 * — **وشكلٌ منهارٌ يُقرأ عطلاً لا ذوقاً.** **والعينُ تقرأ المساحةَ لا
 * نصفَ القطر**، والمساحةُ تنمو بمربّعه، **فجذرُ النسبة يجعل ما تراه
 * العينُ متناسباً مع القيمة** — وهي القاعدةُ المعروفة في هذا الرسم لا
 * تجميلٌ للرقم. **والقاعُ ١٢٪ حتى يبقى للشكل ضلعٌ يُرى.**
 */
function Radar({ axes }: { axes: PeriodStats["taste"]["radar"] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 66;
  const at = (i: number, dist: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist] as const;
  };
  const pt = (i: number, v: number) => at(i, (v / 100) * r);
  const plotted = (score: number) => Math.max(12, Math.round(Math.sqrt(score / 100) * 100));
  const shape = axes.map((a, i) => pt(i, plotted(a.score)).join(",")).join(" ");
  return (
    <div className="relative mx-auto" style={{ maxWidth: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" aria-hidden>
        {[0.33, 0.66, 1].map((k) => (
          <polygon
            key={k}
            points={axes.map((_, i) => pt(i, k * 100).join(",")).join(" ")}
            fill="none"
            stroke="var(--divider)"
            strokeWidth="1"
            strokeDasharray={k === 1 ? undefined : "2 3"}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          return <line key={a.key} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--divider)" strokeWidth="1" />;
        })}
        <polygon points={shape} fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="2" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, plotted(a.score));
          return <circle key={a.key} cx={x} cy={y} r="3.5" fill="var(--accent)" />;
        })}
      </svg>
      {axes.map((a, i) => {
        const [x, y] = at(i, r + 22);
        return (
          <span
            key={a.key}
            className="absolute text-12 text-muted text-center leading-tight"
            style={{
              left: `${(x / size) * 100}%`,
              top: `${(y / size) * 100}%`,
              width: 74,
              transform: "translate(-50%, -50%)",
            }}
          >
            {a.label}
          </span>
        );
      })}
    </div>
  );
}

function PctList({
  title,
  rows,
  locale,
}: {
  title: string;
  rows: { code: string; name: string; pct: number }[];
  locale: Locale;
}) {
  if (!rows.length) return null;
  return (
    <section className="min-w-0">
      <h2 className="text-20 font-bold mb-3">{title}</h2>
      <ul className="space-y-2.5">
        {rows.map((x, i) => (
          <li key={x.code} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-14 truncate min-w-0 flex-1">{x.name}</span>
              <span className="text-12 tabular-nums text-muted shrink-0">{num(x.pct, locale)}%</span>
            </div>
            <span className="relative block h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1">
              <span
                aria-hidden
                className="absolute inset-y-0 start-0 rounded-full"
                style={{ width: `${x.pct}%`, background: i === 0 ? "var(--accent)" : "#8A8A8A" }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopTitles({ s, locale, ar }: { s: PeriodStats; locale: Locale; ar: boolean }) {
  if (!s.topTitles.length) return null;
  return (
    <section>
      <h2 className="text-20 font-bold mb-3">{ar ? "أعلى الأعمال" : "Top titles"}</h2>
      <ul className="space-y-3">
        {s.topTitles.slice(0, 5).map((x, i) => (
          <li key={x.key}>
            <Link
              href={`/${x.mediaType === "tv" ? "show" : "movie"}/${x.tmdbId}`}
              prefetch={false}
              className="flex items-center gap-3 group"
            >
              <span className="text-14 text-muted tabular-nums w-3 shrink-0">{num(i + 1, locale)}</span>
              <span className="relative block w-12 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-surface-2">
                {x.poster ? (
                  <Image src={posterUrl(x.poster, "w185")!} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                    <Icon name={x.mediaType === "tv" ? "tv" : "film"} size={14} />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-15 font-bold truncate group-hover:text-accent transition-colors">
                  {x.title}
                </span>
                <span className="block text-12 text-muted mt-0.5">
                  {hm(x.minutes, locale)}
                  {x.episodes > 0 && ` · ${num(x.episodes, locale)} ${ar ? "حلقة" : "episodes"}`}
                </span>
              </span>
              <span aria-hidden dir="ltr" className="text-muted shrink-0">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** **فعلان لا خمسة** — ولا زرَّ لفعلٍ لم يُبنَ (D-217) */
function FooterActions({ ar }: { ar: boolean }) {
  return (
    <div className="flex items-center justify-center gap-8 pt-2 pb-4">
      <Link
        href="/profile/settings/privacy"
        className="flex flex-col items-center gap-1.5 text-12 text-muted hover:text-foreground transition"
      >
        <Icon name="download" size={18} className="text-accent" />
        {ar ? "تصدير بياناتك" : "Export data"}
      </Link>
      <Link
        href="/stats"
        className="flex flex-col items-center gap-1.5 text-12 text-muted hover:text-foreground transition"
      >
        <Icon name="chart" size={18} className="text-accent" />
        {ar ? "الإحصائيات" : "Stats"}
      </Link>
    </div>
  );
}
