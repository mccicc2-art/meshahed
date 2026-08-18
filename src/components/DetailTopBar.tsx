"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";
import type { MediaType } from "@/lib/media";
import { Icon } from "./Icon";
import { BackButton } from "./BackButton";
import { Sheet } from "./ui/Sheet";
import { sheetMenuItem } from "./ui/controls";
import { SendShareSheet } from "./SendShareSheet";
import { TitleArtSheet } from "./TitleArtSheet";
import { stopWatching } from "@/lib/actions";
import { coalescedRefresh } from "@/lib/refresh";
import { tap } from "@/lib/haptics";
import { toast as showToast, flashError } from "@/lib/toast";

/**
 * زرّان عائمان فوق خلفية صفحة العمل: رجوع وقائمة «المزيد».
 *
 * زجاجيان ودائريان كي يُقرآ فوق أي صورة مهما كان لونها، وبقطر لمس ٤٤
 * بكسلاً. «المزيد» صار قائمةً لا فعلاً واحداً: نسخ/مشاركة الرابط كما كان،
 * و«أرسِله لـ…» يفتح منتقي صديقٍ من المتابَعين المتبادلين (shares.sql).
 * أُبقيت مشاركة النظام لأنها الطريق خارج التطبيق، وأُضيف الإرسال الداخليّ
 * إلى جانبها لا بدلاً منها.
 */
export function DetailTopBar({
  title,
  locale,
  tmdbId,
  mediaType,
  posterPath,
  initialDropped = false,
  art = null,
}: {
  title: string;
  locale: Locale;
  tmdbId: number;
  mediaType: MediaType;
  posterPath: string | null;
  /** موقوفٌ مسبقاً — لعرض «تابع من جديد» بدل «أوقف المتابعة» */
  initialDropped?: boolean;
  /** غلافي المختار لهذا العمل إن وُجد (D-131) */
  art?: { poster_path: string | null; backdrop_path: string | null } | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [send, setSend] = useState(false);
  const [artOpen, setArt] = useState(false);
  const [dropped, setDropped] = useState(initialDropped);
  const [pending, start] = useTransition();

  /* «أوقف المتابعة» — نفس فعل البطاقة الحمراء: علامةٌ لا حذف. تفاؤليّة،
     وإن فشلت رجعت الحالة. الإيقاف يضيف العمل للمكتبة موقوفاً إن لم يكن فيها */
  function toggleStop() {
    if (pending) return;
    const next = !dropped;
    setMenu(false);
    setDropped(next);
    tap(next ? [12, 40] : 10);
    start(async () => {
      try {
        await stopWatching({ tmdbId, mediaType, stop: next, title, posterPath });
        showToast(next ? t.stoppedToast : t.resumedToast, { tone: "info" });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        setDropped(!next);
      }
    });
  }

  async function shareLink() {
    setMenu(false);
    // المسار من النافذة والنطاق من الثابت الرسمي (src/lib/site.ts)
    const url = siteUrl(window.location.pathname);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // أغلق المستخدم ورقة المشاركة — ليس خطأً
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(t.linkCopied);
    } catch {
      /* متصفّح بلا حافظة — لا رسالة تفيد هنا */
    }
  }

  /**
   * 🆕 **ونقاطُ «المزيد» عارية كأخيها** (D-412، طلبُ أحمد على لقطةٍ
   * محوَّطة: «الثلاث نقاط شيل منها الدائرة وخلّها فوق شوي تكون موازية
   * لسهم اليسار المقابل له»).
   *
   * **ونقضٌ لسطرٍ كتبتُه أمس بيدي** (D-406): قلتُ «والمزيد يبقى مطوَّقاً،
   * هو فعلٌ لا يعرفه العرف». **والحجّةُ كانت صحيحةً في الفراغ وخاطئةً على
   * الشاشة**: **زرّان في طرفَي صفٍّ واحد أحدُهما عارٍ والآخرُ مطوَّق
   * يُقرآن رتبتين مختلفتين** — **والصفُّ الواحد لغةٌ واحدة** (قاعدة ٣).
   * **والنقاطُ الثلاث عُرفٌ لا يقلّ رسوخاً عن سهم الرجوع** (D-150).
   *
   * ⚠️ **وهدفُ اللمس ٤٤ محفوظٌ بـ`before`** كما في `BackButton` حرفاً —
   * **المرئيُّ ٢٤ والملموسُ ٤٤** (D-281/D-033).
   */
  const btn =
    "relative w-6 h-6 grid place-items-center text-white " +
    "drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] active:scale-90 transition " +
    "before:content-[''] before:absolute before:-inset-[10px] before:rounded-full";

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-5">
        {/* 🆕 **سهمُ الرجوع بلا دائرة — في كلِّ مكان** (D-406، طلبُ أحمد
            بلقطتين: شطبَ المطوَّق وحوّط العاري: «زر الرجوع في أي مكان
            خليها مثل هذا بدون دائرة»).
            **وهذا تعميمُ D-288 لا نقضُه**: الحجّةُ كُتبت هناك كاملةً
            (الدائرةُ `black/35` **شفّافةٌ**، فعلى غلافٍ فاتح تصير رماديّةً
            والسهمُ داخلها رماديّ) — **وطُبِّقت على `TitleHero` وحدَها**،
            فبقيت صفحةُ العمل بالدائرة **شهراً**. **ووصفةٌ تُصلَح في
            سطحٍ وتُترك في أخيه هي D-145 بعينها.**
            🔴 **ولا نسخةَ ثانية من السهم**: `BackButton` هو صاحبُه منذ
            D-288 بهدفِ لمسه ٤٤ وظلِّه — **فاستُدعي، ولم يُنسخ صنفُه.**
            ⚠️ **و«المزيد» يبقى مطوَّقاً**: هو فعلٌ لا يعرفه العرف
            (D-217)، **والاستثناءُ لسهم الرجوع وحدَه.** */}
        <BackButton locale={locale} variant="bare" />

        <button
          onClick={() => setMenu(true)}
          aria-label={t.moreMenuTitle}
          title={t.moreMenuTitle}
          className={btn}
        >
          <Icon name="dots" size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* قائمة «المزيد» — ورقةٌ سفلية تلامس الإبهام على الجوال */}
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        closeLabel={t.closeLabel}
        variant="bottom"
        labelledBy="more-menu-title"
      >
        <p id="more-menu-title" className="text-center font-bold text-[15px] pt-5 pb-2">
          {t.moreMenuTitle}
        </p>
        <div className="pb-3">
          <button
            onClick={() => {
              setMenu(false);
              setSend(true);
            }}
            className={sheetMenuItem}
          >
            <Icon name="person-check" size={18} className="text-accent" />
            {t.shareSendTitle}
          </button>
          <button onClick={shareLink} className={sheetMenuItem}>
            <Icon name="share" size={18} className="text-muted" />
            {t.shareCopyLink}
          </button>
          {/* غلاف العمل (D-131): يسكن «المزيد» لا شريط الأفعال — تجميلٌ
              يُفعل مرّةً، والشريط لمِا يُفعل كل زيارة */}
          <button
            onClick={() => {
              setMenu(false);
              setArt(true);
            }}
            className={sheetMenuItem}
          >
            <Icon name="edit" size={18} className="text-muted" />
            {t.artTitle}
          </button>

          {/* فاصلٌ ثم «أوقف المتابعة» — نفس فعل البطاقة الحمراء (setDropped) */}
          <div className="h-px bg-[color:var(--divider)] mx-5 my-1" />
          <button onClick={toggleStop} disabled={pending} className={sheetMenuItem}>
            <Icon
              name="card"
              size={18}
              className={dropped ? "text-muted" : "text-[color:var(--error)]"}
            />
            <span className={dropped ? "" : "text-[color:var(--error)]"}>
              {dropped ? t.resumeWatching : t.stopWatching}
            </span>
          </button>
        </div>
      </Sheet>

      {send && (
        <SendShareSheet
          tmdbId={tmdbId}
          mediaType={mediaType}
          title={title}
          posterPath={posterPath}
          locale={locale}
          onClose={() => setSend(false)}
        />
      )}

      {artOpen && (
        <TitleArtSheet
          tmdbId={tmdbId}
          mediaType={mediaType}
          locale={locale}
          current={art}
          onClose={() => setArt(false)}
        />
      )}
    </>
  );
}
