"use client";

import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./Icon";
import { type Density } from "@/lib/density";

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
}) {
  /** عرضُ الملصق المصغَّر — ثلثُ الحقيقيّ تقريباً، فالفرقُ يبقى مرئيّاً */
  const posterW =
    density === "compact" ? 30 : density === "large" ? 46 : 37;

  return (
    <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
      <h2 className="text-sm font-bold mb-3">{title}</h2>

      <div
        className="rounded-2xl border border-border bg-[color:var(--background)] p-3 overflow-hidden"
        aria-hidden
      >
        {kind === "profile" && (
          <div
            className="h-10 -mx-3 -mt-3 mb-1"
            style={{
              background:
                "linear-gradient(120deg, var(--glow-a), transparent 55%), var(--surface-2)",
            }}
          />
        )}

        <div className="flex items-center gap-2">
          <span
            className="block rounded-full p-[2px] shrink-0"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Avatar src={avatarUrl} name={name} size={26} alt="" />
          </span>
          <span className="min-w-0 truncate text-[12px]">
            {kind === "home" ? (
              <>
                <span className="text-muted">{greeting} </span>
                <span className="font-bold">{name}</span>
              </>
            ) : (
              <span className="font-bold">{name}</span>
            )}
          </span>
        </div>

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
