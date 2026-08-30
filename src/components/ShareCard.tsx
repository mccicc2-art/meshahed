"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { actionRowClass, ActionRowBody } from "./ui/ActionRow";

/**
 * زرّ مشاركة بطاقة الإحصاءات.
 *
 * على الجوال تُشارَك الصورة نفسها عبر واجهة المشاركة الأصلية — لا رابطاً
 * يطلب من المستلم تسجيل دخول. وعلى المتصفّحات التي لا تدعمها تُنزَّل الصورة،
 * وهذا هو المسار الآمن دائماً: التوليد على الخادم والصورة ملفٌّ عادي بعده.
 */
/**
 * 🆕 **وجهان لبابٍ واحد** (D-493): البطاقةُ الكاملةُ بمعاينتها، **ورمزٌ
 * وحدَه** لترويسةٍ لا تتّسع لبطاقة (`/stats` بعد إعادة تصميمها).
 * **ولا زرَّ مشاركةٍ ثانٍ يُكتب**: نفسُ الدالّة ونفسُ حالة الانشغال
 * ونفسُ رسالة الفشل — **ولو نُسخ الزرُّ لافترقا عند أوّل تعديل**
 * (القاعدة ٦).
 *
 * 🆕 **وبطاقةٌ ثانيةٌ خلف الزرِّ نفسِه** (D-810): `kind="report"` يشارك
 * **صورةَ تقريرِ المدّة** لا بطاقةَ «كلِّ الأوقات».
 *
 * ⚖️ **ولمَ وسيطٌ لا مكوّنٌ ثانٍ**: **الفعلُ واحد** — جلبٌ، ثمّ
 * `navigator.share` وإلّا تنزيل، ثمّ حالةُ انشغالٍ ورسالةُ فشل —
 * **والمختلفُ حرفان في الرابط.** **وزرٌّ ثانٍ ينسخ ذلك يفترق عند أوّل
 * إصلاح** (القاعدة ٦، وهي علّةُ `icon` نفسُها في D-493).
 *
 * 🔴 **وهذا يسدّ دَينَ D-217 المكتوبَ في رأس `/reports`**: **رمزُ
 * المشاركة في ترويسة «تقريرك» كان يشارك بطاقةَ إحصائيّاتِ كلِّ
 * الأوقات** — **صفحةٌ اسمُها «تقريرك · أغسطس» تُخرج صورةً لا تعرف
 * أغسطس.** **واسمٌ يَعِد بما لا يُسلَّم.**
 */
export function ShareCard({
  locale,
  icon = false,
  row = false,
  kind = "stats",
  period,
}: {
  locale: Locale;
  icon?: boolean;
  /** 🆕 **وجهٌ ثالث** (D-810): **صفُّ بابٍ في ذيل صفحة**، بوصفة `ActionRow` */
  row?: boolean;
  kind?: "stats" | "report";
  /** مدّةُ التقرير — `week`/`month`/`year`، وتُهمَل في `stats` */
  period?: string;
}) {
  const t = getDict(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const src =
    kind === "report"
      ? `/api/share?kind=report${period ? `&p=${period}` : ""}`
      : "/api/share";

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], kind === "report" ? "loopz-report.png" : "loopz.png", {
        type: "image/png",
      });

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Loopz" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = kind === "report" ? "loopz-report.png" : "loopz.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setError(t.shareFailed);
    } finally {
      setBusy(false);
    }
  }

  /* 🆕 **وصفُّ الذيل** (D-810): **جارُ «الإحصائيات الكاملة» بشكله
     نفسِه** — **وبابان في ذيلٍ واحدٍ بشكلين يُقرآن رتبتين** (القاعدة ٣).
     ⚠️ **وبلا سهم**: **السهمُ يَعِد بصفحةٍ تُفتح، وهذا يفعل في مكانه**
     (D-217 في أصغر صوره). */
  if (row) {
    return (
      <button type="button" onClick={share} disabled={busy} className={actionRowClass}>
        <ActionRowBody
          icon="share"
          title={t.shareReportTitle}
          sub={error ?? (busy ? t.shareBusy : t.shareReportSub)}
          arrow={false}
        />
      </button>
    );
  }

  if (icon) {
    return (
      <button
        type="button"
        onClick={share}
        disabled={busy}
        aria-label={t.shareBtn}
        title={error ?? t.shareBtn}
        className="grid place-items-center w-11 h-11 rounded-full text-foreground hover:text-accent active:scale-95 transition disabled:opacity-50"
      >
        <Icon name="share" size={20} />
      </button>
    );
  }

  return (
    <div
      className="rounded-3xl p-[1.5px]"
      style={{
        background:
          "var(--gradient-brand)",
      }}
    >
      <div className="rounded-[calc(1.5rem-1.5px)] bg-[color:var(--background)] p-3 sm:p-4">
        {/* معاينة حيّة: الصورة نفسها التي ستُشارَك، مولّدةً من الخادم */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={t.shareTitle}
          loading="lazy"
          className="w-full rounded-xl border border-border bg-surface-2"
          style={{ aspectRatio: "1200 / 630" }}
        />

        <div className="flex items-center gap-3 mt-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t.shareTitle}</span>
            <span className="block text-12 text-muted mt-0.5">
              {error ?? t.shareSub}
            </span>
          </span>
          <button
            onClick={share}
            disabled={busy}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            <Icon name="share" size={16} />
            {t.shareBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
