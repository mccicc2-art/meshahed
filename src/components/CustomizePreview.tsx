"use client";

/* eslint-disable @next/next/no-img-element */

import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./Icon";
import { type Density } from "@/core/density";

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
}) {
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

      <div
        className="rounded-2xl bg-[color:var(--background)] p-3 pt-9 overflow-hidden"
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
                  <Icon name="mail" size={11} />
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
    </section>
  );
}
