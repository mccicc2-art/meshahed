"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { findGifs } from "@/lib/actions";
import type { GifHit } from "@/lib/gif";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";

/**
 * **ورقةُ اختيار GIF** (D-362، طلبُ أحمد: «خيار جنب الصور، سريع وبديل عن
 * الصور»).
 *
 * ================= ولا سطحَ جديد =================
 *
 * **ورقتُنا الواحدة منذ D-018** بحاجبها وقفلِ تمريرها ومصيدةِ تركيزها
 * وEscape — **والسؤال قبل «أيَّ منتقٍ أبني؟» هو «أيُّ سطحٍ عندي هو
 * ورقةٌ أصلاً؟»** (D-002/D-302). **وورقةٌ لأنها تحمل حقلَ بحثٍ ولوحةَ
 * مفاتيح** (حجّةُ `ListRateStar` حرفاً).
 *
 * ================= والبحثُ بعد سكونِ الإصبع =================
 *
 * **نداءٌ لكلِّ حرفٍ يُحرق به المفتاح** (D-006/D-164): ٣٥٠ms سكوناً قبل
 * السؤال، **والرائجُ جوابُ الحقل الفارغ** — **فورقةٌ تُفتح فارغةً ليست
 * باب بحثٍ، هي بابٌ مغلق** (D-181).
 *
 * ⚠️ **والمعرّفُ وحدَه يخرج من هنا** (D-362): `onPick(id)` — **ولا رابطَ
 * يعبر إلى الفعل ولا إلى القاعدة.**
 *
 * ⚠️ **و`<img>` عارٍ لا `next/image`**: نسبةٌ مجهولةٌ يملكها مزوّدٌ خارجيّ،
 * **وهو استثناءُ D-034 نفسُه المسجَّل لصور النقاش** (D-046/D-298).
 * **والنسبةُ تصل مع الصفّ فيُحجز مكانُها قبل الرسم** (D-046).
 */
export function GifPicker({
  open,
  onClose,
  onPick,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<GifHit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    /* **سكونُ الإصبع لا كلُّ حرف** — ومهلةٌ واحدةٌ تُلغى في التنظيف
       (D-278: مؤقّتٌ ينجو من صاحبه يفعل باسمه ما لا يريد) */
    const timer = setTimeout(() => {
      start(async () => {
        const hits = await findGifs(q).catch(() => [] as GifHit[]);
        if (!alive) return;
        setRows(hits);
        setLoaded(true);
      });
    }, q ? 350 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, open]);

  return (
    <Sheet
      open={open}
      variant="bottom"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="gif-pick-title"
    >
      <SheetHeader id="gif-pick-title" title={t.gifTitle} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="px-5 pb-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 60))}
          placeholder={t.gifSearch}
          aria-label={t.gifSearch}
          dir="auto"
          className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base outline-none focus:border-accent/60"
        />
        {/* **شبكةُ عمودين على الجوال وثلاثةٍ فوقه** — والملصقُ هنا صورةٌ
            عريضةٌ لا ملصقُ عمل، فلا `posterGrid` (D-002 بحدّها: وصفةٌ
            لمعنًى آخر ليست العائلةَ نفسَها). */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46svh] overflow-y-auto">
          {rows.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                tap(8);
                onPick(g.id);
                onClose();
              }}
              className="relative w-full overflow-hidden rounded-xl border border-border bg-surface-2 active:scale-95 transition"
              style={{ aspectRatio: String(g.ratio || 1) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.preview} alt={g.alt} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {/* **ولكلِّ فراغٍ نصُّه** (D-350): «لا نتيجة» غيرُ «الخدمةُ
            معطَّلة» — **وغيابُ المفتاح تعطيلٌ صامتٌ لا عطل** (D-077). */}
        {loaded && rows.length === 0 && (
          <p className="mt-4 text-[13px] text-muted text-center">{q ? t.gifNone : t.gifOff}</p>
        )}
        {!loaded && <p className="mt-4 text-[13px] text-muted text-center">{t.gifLoading}</p>}
        {/* **والإسنادُ شرطٌ تعاقديّ** كإسناد TMDB — **ومن يعطينا محتوًى
            يُذكر** (a01). */}
        <p className="mt-3 text-[10px] text-muted text-center">{t.gifCredit}</p>
      </div>
    </Sheet>
  );
}
