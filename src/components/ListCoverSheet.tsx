"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { sheetScroll } from "./ui/controls";
import { getDict, type Locale } from "@/lib/i18n";
import { posterUrl, backdropUrl } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { titleArtOptions, setListCover } from "@/lib/actions";
import type { ListItem } from "@/lib/data";

/**
 * منتقي غلاف القائمة (D-208) — «هذه القائمةُ بالوجه الذي أريده».
 *
 * **خطوتان لا واحدة، والسبب هو الطلب نفسه:** أحمد طلب غلافاً «من هيدرات
 * الأفلام التي ضمن اللستة» — فالمصدرُ أعمالُ القائمة. ولو عرضنا خلفيّةً
 * واحدةً لكل عمل مباشرةً لكلّفت القائمةُ ذات الخمسين عملاً **خمسين نداء
 * TMDB عند كل فتحة ورقة**. الخطوةُ الأولى تُرسم من بياناتٍ في يد الصفحة
 * أصلاً (ملصقاتُ العناصر، **صفرُ نداءات**)، والثانية تنادي مرّةً واحدة
 * للعمل المختار وحده — **وتعطي كلَّ خلفيّاته لا واحدة**.
 *
 * **ولا مكوّنَ ثانٍ للصور:** `titleArtOptions` هي نفسُها مصدرُ D-131،
 * بترتيبها بلغة المستخدم وسقفها المعلَن (١٢ خلفية). **والنصوصُ مشتركة**
 * (`artChoose` · `artSaved` · `artUseDefault`) — معنًى واحد بلغةٍ واحدة.
 *
 * **ولماذا الخلفيّات وحدها بلا تبويب ملصقات:** بطاقةُ القائمة أفقيّة،
 * **وملصقٌ ٢:٣ مقصوصٌ إلى ١٦:٩ يقع قصُّه على الوجه أو على الاسم** — وهو
 * بالضبط ما أسقط «الصورة الواحدة» في D-206. الخلفيةُ صُوّرت أفقيّةً أصلاً.
 */
export function ListCoverSheet({
  listId,
  items,
  current,
  locale,
  onClose,
}: {
  listId: string;
  /** أعمالُ القائمة — تُمرَّر من الصفحة، فلا استعلام في الورقة */
  items: ListItem[];
  /** الغلافُ الحالي إن وُجد، كي تُعلَّم صورتُه ويظهر «أعِد الأصل» */
  current: { tmdbId: number | null; mediaType: "tv" | "movie" | null; backdrop: string | null };
  locale: Locale;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cover, setCover] = useState<string | null>(current.backdrop ?? null);
  /* العملُ المفتوح — `null` يعني أننا في شبكة الأعمال */
  const [pick, setPick] = useState<{ id: number; type: "tv" | "movie"; title: string } | null>(
    null,
  );
  const [backdrops, setBackdrops] = useState<string[] | null>(null);

  useEffect(() => {
    if (!pick) return;
    let dead = false;
    titleArtOptions(pick.id, pick.type)
      .then((r) => !dead && setBackdrops(r.backdrops))
      .catch(() => !dead && setBackdrops([]));
    return () => {
      dead = true;
    };
  }, [pick]);

  function save(path: string | null, from: { id: number; type: "tv" | "movie" } | null) {
    setCover(path);
    start(async () => {
      try {
        await setListCover({
          listId,
          tmdbId: path ? (from?.id ?? null) : null,
          mediaType: path ? (from?.type ?? null) : null,
          backdropPath: path,
        });
        toast(path ? t.artSaved : t.artReset, { tone: "success" });
        coalescedRefresh(router);
      } catch (e) {
        /* الرجوعُ إلى ما كان: العلامةُ لا تكذب حين يفشل الحفظ */
        setCover(current.backdrop ?? null);
        flashError((e as Error).message);
      }
    });
  }

  /* عملٌ واحد لكل مفتاح: قائمةٌ فيها العمل مرّتين لا تكرّر بطاقته */
  const works = items.filter(
    (i, n) => items.findIndex((o) => o.tmdb_id === i.tmdb_id && o.media_type === i.media_type) === n,
  );

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-cover-title">
      <SheetHeader
        id="list-cover-title"
        title={t.listCover}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        <p className="text-xs text-muted mt-0.5">{pick ? pick.title : t.listCoverHint}</p>
      </SheetHeader>

      <div className={`${sheetScroll} px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        {/* صفُّ الأفعال: الرجوعُ إلى الأعمال، و«أعِد الأصل» حين يوجد غلاف —
            كلاهما زرٌّ ظاهرٌ لا فعلٌ مخفيّ (نمط D-131) */}
        {(pick || cover) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {pick && (
              <button
                type="button"
                onClick={() => {
                  tap(6);
                  setPick(null);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[12px] font-semibold text-muted hover:text-foreground transition"
              >
                <Icon
                  name="chevron-down"
                  size={14}
                  className="rotate-90 rtl:-rotate-90"
                />
                {t.listCoverBack}
              </button>
            )}
            {cover && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  tap(8);
                  save(null, null);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[12px] font-semibold text-muted hover:text-foreground transition disabled:opacity-50"
              >
                <Icon name="repeat" size={14} />
                {t.artUseDefault}
              </button>
            )}
          </div>
        )}

        {works.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">{t.listCoverEmpty}</p>
        ) : !pick ? (
          /* الخطوة الأولى: أعمالُ القائمة بملصقاتها — بيانٌ في اليد لا نداء */
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {works.map((w) => {
              const src = posterUrl(w.poster_path, "w185");
              const on = current.tmdbId === w.tmdb_id && current.mediaType === w.media_type;
              return (
                <li key={`${w.media_type}-${w.tmdb_id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      tap(8);
                      /* التفريغُ هنا لا في الأثر: صورُ العمل السابق تبقى
                         مرسومةً لحظةً لو انتظرنا الأثر — ولا setState داخل
                         أثرٍ (قاعدة react-hooks) */
                      setBackdrops(null);
                      setPick({ id: w.tmdb_id, type: w.media_type, title: w.title ?? "" });
                    }}
                    aria-label={w.title ?? t.listCoverPick}
                    className={`relative block w-full overflow-hidden rounded-xl border-2 transition ${
                      on && cover ? "border-accent" : "border-transparent hover:border-border"
                    }`}
                  >
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        width={185}
                        height={278}
                        sizes="120px"
                        loading="lazy"
                        className="w-full h-auto aspect-[2/3] object-cover bg-surface-2"
                      />
                    ) : (
                      <span className="grid place-items-center w-full aspect-[2/3] bg-surface-2 text-muted">
                        <Icon name="image" size={16} />
                      </span>
                    )}
                    {on && cover && (
                      <span className="absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full bg-accent text-[color:var(--on-accent)]">
                        <Icon name="check" size={13} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : backdrops === null ? (
          <p className="text-sm text-muted text-center py-10">{t.peopleSearching}</p>
        ) : backdrops.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">{t.artEmpty}</p>
        ) : (
          /* الخطوة الثانية: خلفيّاتُ العمل المختار — نداءٌ واحد */
          <ul className="grid grid-cols-2 gap-3">
            {backdrops.map((path) => {
              const on = cover === path;
              const src = backdropUrl(path, "w780");
              return (
                <li key={path}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      tap(8);
                      /* الضغطُ على المختار يلغيه — لا زرَّ ثالثاً لفعلٍ عكسيّ */
                      save(on ? null : path, on ? null : { id: pick.id, type: pick.type });
                    }}
                    aria-pressed={on}
                    aria-label={on ? t.artChosen : t.artChoose}
                    className={`relative block w-full overflow-hidden rounded-xl border-2 transition disabled:opacity-50 ${
                      on ? "border-accent" : "border-transparent hover:border-border"
                    }`}
                  >
                    {src && (
                      <Image
                        src={src}
                        alt=""
                        width={390}
                        height={219}
                        sizes="240px"
                        loading="lazy"
                        className="w-full h-auto aspect-video object-cover bg-surface-2"
                      />
                    )}
                    {on && (
                      <span className="absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full bg-accent text-[color:var(--on-accent)]">
                        <Icon name="check" size={13} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
