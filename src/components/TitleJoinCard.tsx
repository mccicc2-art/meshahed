"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { WRITE_REVIEW_EVENT } from "./TitleRatingsCard";

/**
 * **بطاقةُ «انضمّ إلى الحديث» — رأسُ تبويب المجتمع** (D-398، وأُعيد
 * تصميمُها في D-407 على لقطة أحمد).
 *
 * ================= لماذا فعلان لا صندوقٌ مفتوح =================
 *
 * **كان مؤلّفُ الرأي (`RatingBox`) يفتتح التبويبَ مبسوطاً**: عنوانٌ
 * ونجومٌ وحقلُ كتابةٍ وزرّان — **نصفُ الشاشة الأولى لفعلٍ يقوم به واحدٌ
 * من كلِّ عشرين زائراً**، ومن جاء ليقرأ يمرّ عليه أوّلاً. **وصفحةُ
 * العمل صفحةُ قراءةٍ قبل أن تكون صفحةَ كتابة.**
 *
 * ================= وشكلُها بعد D-407 =================
 *
 * **رمزٌ مطوَّقٌ ثم العنوان، ثم خطٌّ، ثم فعلان يقتسمان العرض** بفاصلٍ
 * رأسيّ. **والقسمةُ بالنصف مقصودة**: الفعلان **ندّان لا رئيسٌ وتابع** —
 * رأيٌ في العمل، وحديثٌ عنه — **فزرٌّ ممتلئٌ وآخرُ مفرَّغ كان يرتّبهما
 * ترتيباً لا نملك دليلَه.**
 *
 * 🔴 **وهي البابُ الوحيد إلى النقاش** (D-407، نصُّ أحمد: «النقاشات مو
 * لازم تكون هنا في الكوميونتي، يكفي الصندوق اللي فوق اللي يوصل لها»):
 * **صفوفُ النقاش خرجت من الخطّ** — **والخطُّ صار آراءَ الناس ونشراتِنا
 * وحدَها.**
 *
 * ⚠️ **والمؤلّفُ يُرسم على الخادم ويصل طفلاً**: هذا المكوّن لا يستورده —
 * **فحالةُ الفتح عميلٌ خفيف، ولا نسخةَ ثانية من `RatingBox`** (قاعدة ٦).
 */
export function TitleJoinCard({
  talkHref,
  title,
  locale,
  composer,
}: {
  talkHref: string;
  /** اسمُ العمل — عنوانُ ورقة الكتابة، كما تفعل بطاقةُ Letterboxd */
  title: string;
  locale: Locale;
  /** مؤلّفُ الرأي — يُرسم على الخادم ويُفتح هنا */
  composer: ReactNode;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  /* 🆕 **وقلمُ بطاقة التقييمات يفتح هذه الورقةَ نفسَها** (D-538):
     **مؤلّفٌ واحدٌ في الشاشة لا اثنان** (القاعدة ٦) — **والحدثُ على
     النافذة هو الوصلةُ لأن البطاقتين شقيقتان لا أمٌّ وابنة**، ورفعُ
     الحالة إلى تبويبٍ خادميٍّ فوقهما يجعله عميلاً كلَّه.
     **وسابقتُه `HelpTourRows`** التي تبثّ حدثاً ولا تركّب الجولة. */
  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener(WRITE_REVIEW_EVENT, onAsk);
    return () => window.removeEventListener(WRITE_REVIEW_EVENT, onAsk);
  }, []);

  const action =
    "flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-14 font-bold " +
    "text-foreground hover:text-accent active:scale-[0.98] transition";

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* ⚖️ 🆕 **والصفُّ الأعلى صار بارتفاع الأسفل** (D-538، تصميمُ
          أحمد: «تقليل ارتفاع صف Join the conversation ليطابق الصف
          السفلي»). **كان ٥٧px والصفُّ تحته ٤٢** — **وصفّان في بطاقةٍ
          واحدةٍ بارتفاعين يُقرآن رأساً وذيلاً لا صفّين** — **والرمزُ
          المطوَّقُ ٣٦px هو ما كان يفرضهما.** 📏 **وقِيس بعد أوّل محاولة:
          ٤٨ مقابل ٤١ — أقربَ ولم يستوِ** — **فالطوقُ ٢٤ والحشوُ `py-2`
          والعنوانُ ١٤ كأخويه تحته**، فيستوي الصفّان. */}
      <div className="flex items-center gap-2.5 px-4 py-2">
        <span
          aria-hidden
          className="shrink-0 size-6 rounded-full border border-[color:var(--divider)] grid place-items-center text-accent"
        >
          <Icon name="comment" size={13} />
        </span>
        <h3 className="min-w-0 font-bold text-14">{t.communityJoin}</h3>
      </div>

      <div className="h-px bg-[color:var(--divider)] mx-4" />

      <div className="flex items-stretch">
        <button type="button" aria-expanded={open} onClick={() => { tap(10); setOpen((v) => !v); }} className={action}>
          <Icon name="star" size={15} className="shrink-0 text-accent" />
          <span className="truncate">{t.communityWriteReview}</span>
        </button>
        {/* **فاصلٌ رأسيٌّ مقصوصٌ من طرفيه** — نفسُ وصفةِ فاصل المقسّم */}
        <span aria-hidden className="my-2 w-px bg-[color:var(--divider)]" />
        <Link href={talkHref} className={action}>
          <Icon name="comment" size={15} className="shrink-0 text-accent" />
          <span className="truncate">{t.communityStartTalk}</span>
        </Link>
      </div>

      {/* 🔴 🆕 **والمؤلّفُ صار ورقةً لا طيّةً في البطاقة** (D-411، حكمُ
          أحمد على تجربتنا مقابل Letterboxd): **كان يُفتح تحت البطاقة
          داخل تبويبٍ داخل صفحة** — **فيدفعه لوحُ المفاتيح خارجَ النظر
          ويكتب المرءُ في نافذةٍ من ثلاثة أسطر.** **والورقةُ العلويّة هي
          ما تستعمله كتابةُ النقاش أصلاً** (`TalkCompose`) — **فلا عائلةَ
          ثالثة، والسطحان صارا واحداً.**
          ⚠️ **وحالةُ المسودّة تُفقد بالإغلاق**: `Sheet` يُزيل محتواه —
          **وهو ما كان `hidden` يشتريه.** **والثمنُ مقبولٌ لأن الحفظَ
          صار على بُعد زرٍّ ملتصقٍ بالقاع لا مدفونٍ تحت اللوح** — ومن
          أغلق الورقة أغلقها قاصداً. */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={t.closeLabel}
        variant="top"
        labelledBy="write-review-title"
      >
        <div className="flex flex-col min-h-0 p-3.5 sm:p-4">
          <p id="write-review-title" className="font-bold text-15 mb-2.5 px-1 truncate">
            {title}
          </p>
          {composer}
        </div>
      </Sheet>
    </div>
  );
}
