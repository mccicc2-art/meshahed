"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./Icon";
import { type Density } from "@/core/density";
import { chipClass } from "./ui/controls";

/**
 * المعاينةُ الحيّة في شاشة التخصيص (D-441).
 *
 * **طلبُ أحمد: «Live Preview حقيقي يتحدّث مع التغييرات».** **والمهمّ في
 * الجملة كلمةُ «حقيقي»**: المعاينةُ تقرأ **حالةَ الشاشة نفسَها** —
 * الترتيبَ والمخفيَّ والخاناتِ والكثافة — **فتتبدّل مع الإصبع قبل الحفظ**،
 * ولا تنتظر رحلةَ خادم.
 *
 * ⚠️ **وهي رسمٌ لا نسخةٌ من الصفحة**: **لا تُستدعى فيها `PosterCard` ولا
 * تُجلب صورة** — **معاينةٌ تطلب TMDB لترسم مصغَّراً تدفع ثمنَ صفحةٍ
 * كاملةٍ في شاشة إعدادات.** **والذي يجب أن يَصدُق فيها ثلاثةٌ فقط**:
 * **ما يظهر · بأيّ ترتيب · وبأيّ عرض** — **وهي الأسئلةُ الثلاثة التي
 * تجيبها هذه الشاشة**، وما عداها زينةٌ تَعِد بدقّةٍ لا تملكها.
 *
 * **ومقياسُ الملصق يتبع الكثافة فعلاً** (`--poster-w` مقسوماً على ثلاثة)
 * — **فالفرقُ بين «مضغوط» و«كبير» يُرى لا يُقرأ.**
 */
export function CustomizePreview({
  kind,
  title,
  name,
  avatarUrl,
  rows,
  stats,
  showStats,
  density,
  greeting,
  username,
  bio,
  coverUrl,
  coverPos,
  avatarPos,
  counters,
  labels,
  showVisits = false,
  deviceLabels,
}: {
  kind: "home" | "profile";
  /** عنوانُ الكتلة — «معاينة حيّة» */
  title: string;
  name: string;
  avatarUrl: string | null;
  /** الأقسامُ الظاهرةُ بترتيبها */
  rows: { key: string; icon: IconName; label: string }[];
  /** خاناتُ بطاقة الأرقام بترتيبها — الرئيسيةُ وحدَها تمرّرها */
  stats?: { key: string; icon: IconName; label: string }[];
  showStats: boolean;
  density: Density;
  /** سطرُ الترحيب في الرئيسية — يُمرَّر جاهزاً فلا يُحسب هنا */
  greeting?: string;
  /* ===== 🆕 وجهُ الملفّ كما في تصميم أحمد (D-465) =====
     **وكلُّها بياناتٌ تملكها الصفحةُ أصلاً أو عدّادان رخيصان** —
     **ولا صورةَ تُجلب من TMDB ولا خطُّ نشاطٍ يُقرأ**، فحجّةُ D-441 قائمة. */
  username?: string | null;
  bio?: string | null;
  coverUrl?: string | null;
  coverPos?: number;
  avatarPos?: number;
  /** أرقامُ السطر — **حقيقيّةٌ لأنها عدّاتٌ رخيصة** */
  counters?: { followers: number; following: number; visits: number };
  /** نصوصُ السطر بلغة الواجهة */
  labels?: {
    followers: string;
    following: string;
    visits: string;
    follow: string;
  };
  showVisits?: boolean;
  /**
   * 🆕 R262 — **معاينةٌ بجهازين على الحاسوب** (اختيارُ أحمد «ب»، ١٨ نوفمبر: «اللي بيرتب الرئيسية والملف فالحاسب بشوف شيء مختلف
   * عن اللي عنده»): الترتيبُ واحدٌ للجهازين، فالمعاينةُ تبدأ على «كمبيوتر» ترسم رئيسيّةَ الحاسوب (شريطُ الأسبوع وشبكاتٌ عريضة)
   * أو ملفَّه (غلافٌ أقصر والأرقامُ بجانب الاسم)، و«جوال» يعيد رسمَ الجوّال بإطاره. **على الجوّال لا مبدِّلَ** والمعاينةُ كما كانت.
   */
  deviceLabels?: { phone: string; desk: string; note: string };
}) {
  const [device, setDevice] = useState<"desk" | "phone">("desk");
  const deskOn = !!deviceLabels && device === "desk";
  /** عرضُ الملصق المصغَّر — ثلثُ الحقيقيّ تقريباً، فالفرقُ يبقى مرئيّاً */
  const posterW =
    density === "compact" ? 30 : density === "large" ? 46 : 37;

  return (
    /* 🆕 **التسميةُ داخل البطاقة لا فوقها** (D-465، تصميمُ أحمد):
       **عنوانٌ في سطرٍ مستقلٍّ فوق صندوقٍ يشبه شاشةً يجعلهما شيئين** —
       **والكلمةُ على حافّة المعاينة تقول «هذه معاينة» بلا سطرٍ إضافيّ.** */
    <section className="relative rounded-2xl border border-border bg-surface overflow-hidden">
      <span className="absolute top-2.5 start-3 z-10 flex items-center gap-1.5 text-12 font-semibold text-foreground/90 drop-shadow">
        <Icon name="grid" size={13} />
        {title}
      </span>

      {deviceLabels ? (
        <span role="radiogroup" aria-label={title} className="absolute top-2 end-3 z-10 hidden items-center gap-1.5 desk:inline-flex">
          {(["phone", "desk"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={device === d}
              onClick={() => setDevice(d)}
              className={chipClass(device === d, "sm", "inline-flex items-center gap-1.5")}
            >
              <Icon name={d === "phone" ? "phone" : "tv"} size={13} />
              {d === "phone" ? deviceLabels.phone : deviceLabels.desk}
            </button>
          ))}
        </span>
      ) : null}

      {deskOn ? (
        <DeskPreview
          kind={kind}
          name={name}
          avatarUrl={avatarUrl}
          rows={rows}
          stats={stats}
          showStats={showStats}
          greeting={greeting}
          username={username}
          bio={bio}
          coverUrl={coverUrl}
          coverPos={coverPos}
          avatarPos={avatarPos}
        />
      ) : null}

      <div
        className={`rounded-2xl bg-[color:var(--background)] p-3 pt-9 overflow-hidden ${
          deskOn
            ? "desk:hidden"
            : deviceLabels
              ? "desk:mx-auto desk:my-3 desk:mt-12 desk:max-w-[300px] desk:rounded-[22px] desk:border desk:border-border desk:pt-3"
              : ""
        }`}
        aria-hidden
      >
        {kind === "profile" ? (
          <>
            {/* الغلافُ صورتُك أنت لا صورةٌ تُجلب — **مجّانيّة** */}
            <div className="relative h-20 -mx-3 -mt-3 bg-surface-2 overflow-hidden">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `50% ${coverPos ?? 30}%` }}
                />
              ) : (
                <span
                  className="block w-full h-full"
                  style={{
                    background:
                      "linear-gradient(120deg, var(--glow-a), transparent 55%), var(--surface-2)",
                  }}
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] to-transparent" />
            </div>

            <div className="relative -mt-7 flex items-end gap-2.5">
              <span
                className="block rounded-full p-[2px] shrink-0"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Avatar
                  src={avatarUrl}
                  name={name}
                  size={44}
                  alt=""
                  posY={avatarPos ?? 50}
                  className="ring-2 ring-[color:var(--background)]"
                />
              </span>
              <span className="min-w-0 flex-1 pb-0.5">
                <span className="block text-12 font-bold truncate">{name}</span>
                {username && (
                  <span className="block text-[10px] text-muted truncate" dir="ltr">
                    @{username}
                  </span>
                )}
              </span>
              {/* الفعلان كما يراهما الزائر — **رسمٌ لا زرّان يعملان** */}
              <span className="shrink-0 flex items-center gap-1.5 pb-0.5">
                <span className="rounded-full border border-border px-2 py-[3px] text-[10px] text-muted">
                  {labels?.follow}
                </span>
                <span className="grid place-items-center w-[22px] h-[22px] rounded-full border border-border text-muted">
                  <Icon name="chat" size={11} />
                </span>
              </span>
            </div>

            {bio && (
              <p className="mt-1.5 text-[10px] text-muted line-clamp-1" dir="auto">
                {bio}
              </p>
            )}

            {counters && labels && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
                <span>
                  <b className="text-foreground tabular-nums">{counters.followers}</b>{" "}
                  {labels.followers}
                </span>
                <span aria-hidden>·</span>
                <span>
                  <b className="text-foreground tabular-nums">{counters.following}</b>{" "}
                  {labels.following}
                </span>
                {showVisits && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      <b className="text-foreground tabular-nums">{counters.visits}</b>{" "}
                      {labels.visits}
                    </span>
                  </>
                )}
                {/* 🗑️ **ورقاقةُ المستوى سقطت من المعاينة** (D-807) —
                    **ومعاينةٌ تعرض ما لا يوجد أسوأُ من معاينةٍ ناقصة.**
                    ⚠️ **والدَّينُ المعلَنُ ١٥ في `05` مات معها**:
                    «رقاقةُ المستوى بلا رقم» **لم تعد ديناً، صارت
                    لا شيء.** */}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="block rounded-full p-[2px] shrink-0"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Avatar src={avatarUrl} name={name} size={26} alt="" />
            </span>
            <span className="min-w-0 truncate text-12">
              <span className="text-muted">{greeting} </span>
              <span className="font-bold">{name}</span>
            </span>
          </div>
        )}

        {showStats && stats && stats.length > 0 && (
          <div
            className="mt-2 grid rounded-xl border border-border bg-surface"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}
          >
            {stats.map((s, i) => (
              <span
                key={s.key}
                className={`flex items-center justify-center gap-1 py-1.5 ${
                  i > 0 ? "border-s border-[color:var(--divider)]" : ""
                }`}
              >
                <Icon name={s.icon} size={11} style={{ color: "var(--accent)" }} />
                <span className="text-[9px] text-muted truncate">{s.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5 space-y-2.5">
          {rows.length === 0 ? (
            <span className="block h-10 rounded-lg border border-dashed border-border" />
          ) : (
            rows.map((r) => (
              <span key={r.key} className="block">
                <span className="flex items-center gap-1.5 mb-1">
                  <Icon name={r.icon} size={11} style={{ color: "var(--accent)" }} />
                  <span className="text-[10px] font-bold truncate">{r.label}</span>
                </span>
                <span className="flex gap-1.5">
                  {[0, 1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className="block shrink-0 rounded-md bg-surface-2 border border-border"
                      style={{ width: posterW, height: Math.round(posterW * 1.5) }}
                    />
                  ))}
                </span>
              </span>
            ))
          )}
        </div>
      </div>
      {deviceLabels ? (
        <p className="hidden items-center gap-1.5 px-3 pb-3 text-12 text-muted desk:flex">
          <Icon name="info" size={13} className="shrink-0" />
          {deviceLabels.note}
        </p>
      ) : null}
    </section>
  );
}

/**
 * 🆕 R262 — **رسمُ الحاسوب في المعاينة** — مخطّطٌ لا صور (كمعاينة الجوّال، D-441: لا جلبَ من TMDB): الرئيسيّةُ أقسامُها بترتيب
 * صاحبها بعرض الصفحة — «أسبوعك» شريطٌ بيومٍ ممتلئٍ عريض، «أكمل المشاهدة» ثلاثُ بطاقاتٍ عريضة، والباقي ستّةُ ملصقات؛ والملفُّ
 * غلافٌ أقصر والأرقامُ بجانب الاسم والرفوفُ ثمانيةً — ما تعرضه الصفحتان على الحاسوب (R260/R262).
 */
function DeskPreview({
  kind,
  name,
  avatarUrl,
  rows,
  stats,
  showStats,
  greeting,
  username,
  bio,
  coverUrl,
  coverPos,
  avatarPos,
}: {
  kind: "home" | "profile";
  name: string;
  avatarUrl: string | null;
  rows: { key: string; icon: IconName; label: string }[];
  stats?: { key: string; icon: IconName; label: string }[];
  showStats: boolean;
  greeting?: string;
  username?: string | null;
  bio?: string | null;
  coverUrl?: string | null;
  coverPos?: number;
  avatarPos?: number;
}) {
  const box = "block rounded-md border border-border bg-surface-2";
  const cols = kind === "profile" ? 8 : 6;
  return (
    <div className="hidden overflow-hidden rounded-2xl bg-[color:var(--background)] p-4 pt-12 desk:block" aria-hidden>
      {kind === "profile" ? (
        <>
          <div className="relative -mx-4 -mt-12 h-24 overflow-hidden bg-surface-2">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `50% ${coverPos ?? 30}%` }} />
            ) : null}
            <span className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] to-transparent" />
          </div>
          <div className="relative -mt-8 flex items-end gap-3">
            <Avatar src={avatarUrl} name={name} size={52} alt="" posY={avatarPos ?? 50} className="shrink-0 ring-2 ring-[color:var(--background)]" />
            <span className="min-w-0 flex-1 pb-1">
              <span className="block truncate text-[13px] font-bold">{name}</span>
              {username ? (
                <span className="block truncate text-[10px] text-muted" dir="ltr">
                  @{username}
                </span>
              ) : null}
              {bio ? (
                <span className="block truncate text-[10px] text-muted" dir="auto">
                  {bio}
                </span>
              ) : null}
            </span>
            {showStats ? (
              <span className="mb-1 grid w-56 shrink-0 grid-cols-4 rounded-lg border border-border">
                {(["tv", "film", "torii", "chart"] as IconName[]).map((ic, i) => (
                  <span key={ic} className={`flex justify-center py-1.5 ${i > 0 ? "border-s border-[color:var(--divider)]" : ""}`}>
                    <Icon name={ic} size={11} style={{ color: "var(--accent)" }} />
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Avatar src={avatarUrl} name={name} size={26} alt="" />
          <span className="min-w-0 flex-1 truncate text-12">
            <span className="text-muted">{greeting} </span>
            <span className="font-bold">{name}</span>
          </span>
          {showStats && stats
            ? stats.map((s) => (
                <span key={s.key} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1">
                  <Icon name={s.icon} size={11} style={{ color: "var(--accent)" }} />
                  <span className="text-[9px] text-muted">{s.label}</span>
                </span>
              ))
            : null}
        </div>
      )}

      <div className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <span className="block h-10 rounded-lg border border-dashed border-border" />
        ) : (
          rows.map((r) => (
            <span key={r.key} className="block">
              <span className="mb-1 flex items-center gap-1.5">
                <Icon name={r.icon} size={11} style={{ color: "var(--accent)" }} />
                <span className="truncate text-[10px] font-bold">{r.label}</span>
              </span>
              {kind === "home" && r.key === "week" ? (
                <span className="flex h-10 gap-1">
                  {Array.from({ length: 14 }, (_, n) =>
                    n === 3 ? (
                      <span key={n} className="block w-[72px] shrink-0 rounded-md border border-accent-2/60 bg-surface-2" />
                    ) : (
                      <span key={n} className={`${box} flex-1 ${n === 0 ? "!border-accent/60" : "opacity-70"}`} />
                    ),
                  )}
                </span>
              ) : kind === "home" && r.key === "continue" ? (
                <span className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((n) => (
                    <span key={n} className={`${box} aspect-video`} />
                  ))}
                </span>
              ) : (
                <span className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                  {Array.from({ length: cols }, (_, n) => (
                    <span key={n} className={`${box} aspect-[2/3]`} />
                  ))}
                </span>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
