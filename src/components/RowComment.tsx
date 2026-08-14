"use client";

import { useState } from "react";
import { addReviewReply } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { Composer } from "./Composer";

/**
 * **ذيلُ صفّ التعليق — و«تعليق» يفتح صندوقاً في مكانه لا صفحةً جديدة**
 * (D-227، طلبُ أحمد: «إذا ضغطت كومنت، في نفس المكان يطلع كذا، ما يودّيني
 * صفحة الريفيو»).
 *
 * **والمكسبُ ليس لمسةً موفَّرة بل نيّةً محفوظة:** من قرأ رأياً وأراد أن
 * يردّ **كانت رحلتُه تخرجه من الخطّ فيفقد موضعه فيه** — فيعود أو لا يعود.
 * **والردُّ الذي لا يقطع القراءة هو ما يجعل الخطّ حواراً** (نفسُ حجّة
 * `QuickAdd` في D-205 حرفاً، وقد ثبتت هناك).
 *
 * **ولماذا يبتلع الذيلَ كلَّه بدل زرٍّ وحده:** الصندوقُ يحتاج عرضَ الصفّ،
 * **والشريطُ الذي يسكنه المقبض موزَّعٌ بعرضٍ مسقوف** — فحالةُ الفتح تخصّ
 * الاثنين معاً. **وحالةٌ واحدة في مكوّنٍ واحد** خيرٌ من رفعها إلى الصفّ
 * وتمريرها إلى قطعتين.
 *
 * **ولا صندوقَ ثانياً:** `Composer` هو صندوقُ الردّ في غرفة الكلام نفسُه،
 * خرج إلى ملفّه في هذه الدفعة (D-227).
 *
 * ⚠️ **وصفُّ الخبر لا يأخذ هذا** — عمداً: `addReviewReply` تردّ على **رأيِ
 * إنسان**، **ولا إنسانَ في خبرِنا**. فيبقى بابَ غرفةٍ تُفتح، **حيث الفعلُ
 * المتاح كتابةُ رأيٍ في العمل لا الردُّ على أحد** — وفعلان مختلفان لا
 * يُخفيان تحت زرٍّ واحد (D-224).
 *
 * ⚠️ **والردُّ لا يظهر في الخطّ بعد إرساله**، فالخطُّ يعرض التعليقات لا
 * الردود. **فالتوستُ هو الإيصال** — و«أُرسِل» أصدقُ من صفٍّ يُدسّ في مكانٍ
 * لا يخصّه، **وأصدقُ من صمتٍ يجعل الكاتب يرسل مرّتين.**
 */
export function RowComment({
  reviewUserId,
  tmdbId,
  mediaType,
  label,
  locale,
  before,
  after,
}: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  label: string;
  locale: Locale;
  /** ما يسبق المقبضَ في الشريط (الإعجاب) */
  before?: React.ReactNode;
  /** ما يليه (الإحصاء · الحفظ · المشاركة) */
  after?: React.ReactNode;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  function send(body: string) {
    void (async () => {
      try {
        await addReviewReply({ reviewUserId, tmdbId, mediaType, body });
        setOpen(false);
        toast(t.replySentToast);
      } catch (e) {
        flashError((e as Error).message);
      }
    })();
  }

  return (
    <>
      {/* **نفسُ شريط `RowFooter`** (D-232): بعرض العمود كلِّه وبهامشٍ
          سالبٍ متماثل، فأوّلُ رمزٍ فوق حافة الوجه وآخرُه تحت النقاط.
          **والسقفُ ٢٦٠px حُذف** — شريطٌ مسقوفٌ في عمودٍ عريض لا يحاذي
          شيئاً. ⚠️ **والسلسلةُ مكرَّرةٌ هنا وفي `RowFooter`** لأن هذا
          المكوّن يملك حالةَ الفتح ولا يستطيع أن يلفّ نفسه بذاك — **دَينٌ
          يُوحَّد يوم يُنقل الشريطُ إلى وصفةٍ في `controls.ts`.** */}
      <div className="pt-2 -mx-0.5 flex items-center justify-between">
        {before}
        <button
          type="button"
          onClick={() => {
            tap(6);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={label}
          title={label}
          className={`inline-flex items-center rounded-full px-2.5 py-1.5 transition ${
            open ? "text-accent" : "text-muted hover:text-accent"
          }`}
        >
          <Icon name="comment" size={15} />
        </button>
        {after}
      </div>
      {open && (
        <Composer locale={locale} onCancel={() => setOpen(false)} onSend={send} />
      )}
    </>
  );
}
