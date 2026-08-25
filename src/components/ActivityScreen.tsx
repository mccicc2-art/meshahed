"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getDict, num, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { chipClass, chipRow } from "./ui/controls";
import { Icon } from "./Icon";
import { BackCrumb } from "./BackButton";

/**
 * **صفحةُ النشاط — ما فعلتَه أنت، يوماً بيوم** (D-537، تصميمُ أحمد
 * بلقطةٍ معلَّمة: «فلترة النشاط حسب النوع · عرضٌ زمنيٌّ مضغوطٌ بدلاً من
 * الكاردات الكبيرة · تجميعٌ واضحٌ حسب اليوم مع عدد الأنشطة»).
 *
 * ================= وهي بديلةُ اليوميات لا جارتُها =================
 *
 * **اليومياتُ كانت تعرض المشاهدةَ وحدَها** — والمشاهدةُ واحدةٌ من أربعةِ
 * أشياء تفعلها في Loopz. **وبابان يعرضان الرحلةَ نفسَها بشكلين هو ما
 * تمنعه القاعدة ٦** (وقرارُ أحمد: `‎/diary` يُحوَّل إلى هنا).
 *
 * ================= ولماذا التجميعُ في العميل =================
 *
 * **حدُّ اليوم يتبع ساعةَ القارئ لا ساعةَ الخادم** — واليومياتُ كانت
 * تقسم بتوقيت UTC، **فسهرةٌ بعد منتصف الليل تنقسم يومين** (عطلٌ معلَنٌ
 * في الأرشيف). **والخادمُ لا يعرف منطقةَ وقته** ولا عمودَ لها في
 * `profiles`.
 * **و`useSyncExternalStore` تحلّها بلا اختلافِ ترطيبٍ ولا تأثير**
 * (نمطُ `HomeGreeting`/D-434 حرفاً): **الخادمُ يقسم بـUTC، والمتصفّحُ
 * يعيد القسمةَ بساعته في أوّل ترطيب** — **ولا `useEffect` يكتب حالة.**
 *
 * ================= والصفُّ سطران لا بطاقة =================
 *
 * **ملصقٌ ٤٤ · فعلٌ واسمٌ · نجمةٌ ووقت.** **والكاردُ الكبير يعرض ستّةَ
 * أنشطةٍ في شاشة، والصفُّ يعرض عشرة** — **وسجلٌّ يُقرأ بالمسح لا
 * بالتصفّح** (حجّةُ D-232 نفسُها).
 */

export type ActivityKind = "watch" | "rate" | "review" | "list";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** لحظةُ الفعل — ISO من الخادم */
  at: string;
  mediaType: "tv" | "movie";
  tmdbId: number;
  title: string;
  /** رابطٌ جاهز — العميلُ لا يعرف قاعدةَ صور TMDB */
  poster: string | null;
  season?: number | null;
  episode?: number | null;
  rating?: number | null;
  listName?: string | null;
}

type Scope = "all" | "watch" | "rate" | "review" | "list";
const SCOPES: Scope[] = ["all", "watch", "rate", "review", "list"];

/* الساعةُ مصدرٌ خارجيٌّ عن React — ولا اشتراكَ لأنها لا تُبثّ */
const subscribeNever = () => () => {};
const localTrue = () => true;
const serverFalse = () => false;

export function ActivityScreen({
  items,
  locale,
  crumb = true,
}: {
  items: ActivityItem[];
  locale: Locale;
  /**
   * 🆕 **فتاتُ الرجوع اختياريّة** (D-586): الشاشةُ صارت تُرسم داخل
   * تبويبٍ في ملفّ المستخدم أيضاً — **وفتاتُ «المكتبة» داخل ملفِّ
   * شخصٍ كذبةُ موضع**، ورأسُ الصفحة هناك يملك زرَّ رجوعه.
   */
  crumb?: boolean;
}) {
  const t = getDict(locale);
  const [scope, setScope] = useState<Scope>("all");
  /** هل نحن في المتصفّح؟ **فتُقسَم الأيامُ بساعته لا بـUTC** */
  const local = useSyncExternalStore(subscribeNever, localTrue, serverFalse);

  const shown = items.filter((it) => keep(it, scope));

  /* **أسبوعٌ من الآن لا «الأسبوع الميلاديّ»**: القارئُ يسأل «كم فعلتُ
     مؤخّراً» لا «كم فعلتُ منذ الأحد» — **وسبعةُ أيامٍ جوابٌ ثابتٌ في
     كلِّ يومٍ من الأسبوع.** */
  const weekAgo = weekAgoIso(items);
  const weekCount = shown.filter((it) => it.at >= weekAgo).length;

  const days = groupDays(shown, local, t, locale);

  return (
    <div className="space-y-4">
      {crumb && <BackCrumb label={t.navLibrary} fallback="/library" />}

      <div className={chipRow}>
        <div className="flex items-center gap-2">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => {
                if (s === scope) return;
                tap(8);
                setScope(s);
              }}
              className={chipClass(scope === s)}
            >
              {label(s, t)}
            </button>
          ))}
        </div>
      </div>

      {/* **سطرُ الحصيلة** — يقول كم فعلتَ قبل أن تعدّ بعينك (D-374:
          والعدُّ يعدّ ما يعرضه جسمُه بشرطه نفسِه — فهو يتبع الرقاقة). */}
      <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[color:var(--divider)] text-14">
        <span className="text-muted">{t.activityThisWeek}</span>
        <span className="text-muted tabular-nums">{t.activityCount(weekCount)}</span>
      </div>

      {days.length === 0 ? (
        <p className="text-center text-muted py-16 px-5 leading-relaxed">{t.activityEmpty}</p>
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.key}>
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className="text-15 font-bold">{d.label}</h2>
                <span className="text-12 text-muted tabular-nums">
                  {num(d.rows.length, locale)}
                </span>
              </div>

              {/* **الخيطُ الرأسيُّ على حافّة البداية والنقطُ عليه** —
                  هو ما يقول «هذه لحظاتٌ متتابعة» (تصميمُ أحمد). */}
              <ol className="relative ms-1.5 ps-4 border-s border-[color:var(--divider)]">
                {d.rows.map((r) => (
                  <li key={r.id} className="relative py-2.5">
                    <span
                      aria-hidden
                      className="absolute -start-[21px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border border-[color:var(--divider)] bg-[color:var(--background)]"
                    />
                    <Row item={r} locale={locale} local={local} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type Dict = ReturnType<typeof getDict>;

function label(s: Scope, t: Dict): string {
  return s === "all"
    ? t.searchTabAll
    : s === "watch"
      ? t.activityTabWatched
      : s === "rate"
        ? t.activityTabRatings
        : s === "review"
          ? t.activityTabReviews
          : t.searchTabLists;
}

/**
 * **الرقاقةُ تسأل «ما نوعُ هذا الفعل؟»** — **و«تقييمات» تشمل الرأيَ ذا
 * النجمة**: من كتب رأياً وأعطى تسعةً **قيّم فعلاً**، **وإخفاؤه عن
 * رقاقة التقييمات كذبٌ صغير** (D-374). **و«آراء» وحدَها النصّ.**
 */
function keep(it: ActivityItem, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "rate") return it.rating != null && (it.kind === "rate" || it.kind === "review");
  return it.kind === scope;
}

/** سبعةُ أيامٍ قبل أحدثِ صفّ — **ولا `Date.now()` في مكوّن** (قاعدة) */
function weekAgoIso(items: ActivityItem[]): string {
  const newest = items[0]?.at;
  if (!newest) return "";
  const d = new Date(newest);
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

interface DayGroup {
  key: string;
  label: string;
  rows: ActivityItem[];
}

/**
 * **يومٌ لكلِّ مجموعة، وحلقاتُ المسلسل الواحد فيه صفٌّ واحد.**
 *
 * **والدمجُ هنا لا في الخادم** لأن حدَّ اليوم نفسَه يتبدّل بالترطيب —
 * **ودمجٌ محسوبٌ على يومٍ خاطئ يُخرج مدًى خاطئاً.**
 */
function groupDays(items: ActivityItem[], local: boolean, t: Dict, locale: Locale): DayGroup[] {
  const byDay = new Map<string, ActivityItem[]>();
  for (const it of items) {
    const key = dayKey(it.at, local);
    const list = byDay.get(key);
    if (list) list.push(it);
    else byDay.set(key, [it]);
  }

  const today = items.length ? dayKey(items[0].at, local) : "";
  const yesterday = shiftDay(today, -1);

  return [...byDay.entries()].map(([key, rows]) => ({
    key,
    label:
      key === today
        ? t.diaryToday
        : key === yesterday
          ? t.diaryYesterday
          : dayLabel(key, locale),
    rows: mergeEpisodes(rows, t),
  }));
}

/** مفتاحُ اليوم — بساعة القارئ بعد الترطيب، وبـUTC قبله */
function dayKey(iso: string, local: boolean): string {
  const d = new Date(iso);
  if (!local) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDay(key: string, by: number): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + by);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dayLabel(key: string, locale: Locale): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** حلقاتُ مسلسلٍ واحدٍ في يومٍ واحد → صفٌّ واحدٌ بمداه (وصفةُ اليوميات) */
function mergeEpisodes(rows: ActivityItem[], t: Dict): ActivityItem[] {
  const out: ActivityItem[] = [];
  const seen = new Map<number, number>();
  for (const r of rows) {
    if (r.kind !== "watch" || r.mediaType !== "tv" || r.episode == null) {
      out.push(r);
      continue;
    }
    const at = seen.get(r.tmdbId);
    if (at === undefined) {
      seen.set(r.tmdbId, out.length);
      out.push({ ...r });
      continue;
    }
    const head = out[at];
    const from = Math.min(head.episode ?? 0, r.episode);
    const to = Math.max(head.episode ?? 0, r.episode);
    /* **والموسمُ موسمُ الرأس** — ومن شاهد موسمين في يوم يرى مداً واحداً
       بموسم الأحدث؛ **وهو ما كانت تفعله اليومياتُ حرفاً.** */
    out[at] = {
      ...head,
      episode: to,
      season: head.season,
      listName: t.actEpisodeRange(head.season ?? 0, from, to),
    };
  }
  return out;
}

function Row({
  item,
  locale,
  local,
}: {
  item: ActivityItem;
  locale: Locale;
  local: boolean;
}) {
  const t = getDict(locale);
  const href = `/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`;
  const verb =
    item.kind === "watch"
      ? item.mediaType === "tv"
        ? t.actVerbFinished
        : t.actVerbWatched
      : item.kind === "rate"
        ? t.actVerbRated
        : item.kind === "review"
          ? t.actVerbReviewed
          : t.actVerbAdded;

  /* **مدى الحلقات يسكن `listName` بعد الدمج** — وإلّا فحلقةٌ واحدة */
  const ep =
    item.kind === "watch" && item.mediaType === "tv"
      ? (item.listName ?? (item.season != null && item.episode != null
          ? t.diaryEpisode(item.season, item.episode)
          : null))
      : null;

  return (
    <Link href={href} prefetch={false} className="flex items-center gap-3 group">
      <span className="relative shrink-0 w-11 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
        {item.poster ? (
          <Image src={item.poster} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
            <Icon name={item.mediaType === "tv" ? "tv" : "film"} size={14} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-14 leading-snug truncate">
          <span className="text-muted">{verb} </span>
          <span className="font-bold group-hover:text-accent transition-colors">{item.title}</span>
          {ep && <span className="text-muted"> · {ep}</span>}
          {item.kind === "list" && item.listName && (
            <>
              <span className="text-muted"> {t.actVerbTo} </span>
              <span className="text-muted">{item.listName}</span>
            </>
          )}
        </span>

        <span className="mt-0.5 flex items-center gap-2 text-12 text-muted">
          {item.rating != null && (
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <Icon name="star" size={12} style={{ color: "var(--accent)" }} />
              <span className="tabular-nums">{num(item.rating, locale)}</span>
            </span>
          )}
          <span className="tabular-nums" dir="ltr">
            {clock(item.at, locale, local)}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** الساعةُ بتوقيت القارئ بعد الترطيب — وبـUTC في أوّل رسمةِ خادم */
function clock(iso: string, locale: Locale, local: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: local ? undefined : "UTC",
  }).format(d);
}
