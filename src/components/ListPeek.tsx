"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { sheetScroll } from "./ui/controls";
import { Icon } from "./Icon";

/**
 * معاينة القائمة المنبثقة — ضغطة بطاقة القائمة تعرضها كاملةً (طلب أحمد).
 *
 * البطاقة كانت باباً أعمى: المنسّقة لا تُفتح أصلاً، وقائمة المستخدم تنقلك
 * لصفحةٍ كاملة لمجرد الفضول. الغلاف هنا يلتقط الضغطة على جسد البطاقة —
 * وما كان داخلها من أزرارٍ وروابط (زرّ الحفظ) يمرّ لأصحابه: الضغطة التي
 * بدأت في `button` أو `a` ليست لنا.
 *
 * الجلبُ عند أول فتحٍ فقط ويُحفظ للثانية — عبر `/api/franchise?slug=`
 * للمنسّقة و`/api/list-peek?id=` لقوائم المستخدمين (شكلا ردٍّ متقاربان
 * يوحَّدان هنا إلى صفٍّ واحد).
 */

type PeekRow = {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  poster: string | null;
  watched?: boolean;
  /** سنة الفوز في قوائم الجوائز — تحلّ محلّ الرقم في صدر الصفّ
      (طلب أحمد: «التاريخ مكتوب يمين الفلم مرتبه بالأحدث») */
  awarded?: number;
};

export function ListPeekTrigger({
  kind,
  refId,
  title,
  labels,
  children,
}: {
  kind: "set" | "list";
  /** slug المجموعة المنسّقة أو uuid قائمة المستخدم */
  refId: string;
  title: string;
  labels: { close: string; openList: string; failed: string; watchedMark: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PeekRow[] | null>(null);
  const [err, setErr] = useState(false);

  async function load() {
    if (rows) return;
    try {
      const url =
        kind === "set"
          ? `/api/franchise?slug=${encodeURIComponent(refId)}`
          : `/api/list-peek?id=${encodeURIComponent(refId)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as {
        parts?: { id: number; mediaType?: "tv" | "movie"; title: string; poster: string | null; watched?: boolean; awarded?: number }[];
        items?: PeekRow[];
      };
      const list: PeekRow[] =
        json.items ??
        (json.parts ?? []).map((p) => ({
          id: p.id,
          // السلاسل أفلامٌ تاريخياً؛ مجموعات TOP 250 تصرّح بجهة كل عنصر
          mediaType: p.mediaType ?? ("movie" as const),
          title: p.title,
          poster: p.poster,
          watched: p.watched,
          awarded: p.awarded,
        }));
      setRows(list);
    } catch {
      setErr(true);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={title}
        className="cursor-pointer"
        onClick={(e) => {
          // ضغطةٌ بدأت في زرٍّ أو رابطٍ داخل البطاقة ليست لنا
          if ((e.target as HTMLElement).closest("button, a")) return;
          setOpen(true);
          void load();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
            void load();
          }
        }}
      >
        {children}
      </div>

      {/* بلا بوّابةٍ هنا (D-166): `Sheet` تُرسم في `document.body` منذ D-159 —
          وهذا اللفّ من ٨ أغسطس كان علاجَ العَرَض عند المستدعي قبل أن يُعرف
          السبب، فبقي بعد أن عولج السبب. */}
      {open && (
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={labels.close}
        labelledBy="list-peek-title"
      >
        <SheetHeader
          id="list-peek-title"
          title={title}
          closeLabel={labels.close}
          onClose={() => setOpen(false)}
        />
        <div className={`${sheetScroll} -mx-1 px-1 pb-2`}>
          {err ? (
            <p className="text-center text-muted py-10 text-sm">{labels.failed}</p>
          ) : rows === null ? (
            // هيكل بارتفاع صفوفٍ حقيقية — لا قفزة عند الوصول (D-046)
            <div className="space-y-2 py-1" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-[60px] rounded-lg bg-surface-2 animate-pulse" />
                  <div className="h-3.5 w-2/3 rounded bg-surface-2 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <ol className="space-y-1 py-1">
              {rows.map((r, i) => (
                <li key={`${r.mediaType}-${r.id}`}>
                  <Link
                    href={`/${r.mediaType === "tv" ? "show" : "movie"}/${r.id}`}
                    className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-surface-2 active:scale-[0.99] transition"
                    onClick={() => setOpen(false)}
                  >
                    {/* صدر الصفّ: الرقم للقوائم المرتّبة، و**سنة الفوز**
                        لقوائم الجوائز (طلب أحمد) — وهي في العربية على
                        اليمين حيث يبدأ السطر */}
                    <span
                      className={`shrink-0 text-center font-bold text-accent tabular-nums ${
                        r.awarded ? "w-10 text-[13px]" : "w-5 text-[12px]"
                      }`}
                      dir="ltr"
                    >
                      {r.awarded ?? i + 1}
                    </span>
                    <span className="relative w-10 h-[60px] shrink-0 rounded-lg overflow-hidden bg-surface-2">
                      {r.poster && (
                        <Image src={r.poster} alt="" fill sizes="40px" className="object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">
                      {r.title}
                    </span>
                    {r.watched && (
                      <span
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold"
                        style={{ color: "var(--success)" }}
                        aria-label={labels.watchedMark}
                      >
                        <Icon name="check" size={14} />
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {kind === "list" && (
            <Link
              href={`/lists/${refId}`}
              className="block text-center text-[13px] text-accent font-semibold py-3 hover:brightness-110 transition"
              onClick={() => setOpen(false)}
            >
              {labels.openList}
            </Link>
          )}
        </div>
      </Sheet>
      )}
    </>
  );
}
