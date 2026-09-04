"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { Dropdown, dropdownItem, dropdownDivider } from "./ui/Dropdown";
import { buttonClass } from "./ui/Button";
import { sheetMenuItem, sheetMenuDivider, coverBareControl, HEADER_ICON } from "./ui/controls";
import dynamic from "next/dynamic";
/* الورقةُ تُحمَّل عند أوّل فتحٍ لا مع الصفحة (نمطُ TitleSearchSheet في
   الشريط السفليّ): لا تُرسم إلا بضغطةٍ، فشحنُها مع أوّل رسمةٍ ثمنٌ بلا
   قارئ — و`ssr: false` لأن لا HTML لها قبل الضغطة. */
const StartConversationSheet = dynamic(() => import("./StartConversationSheet").then((m) => m.StartConversationSheet), { ssr: false });
import { BlockConfirmSheet } from "./BlockConfirmSheet";
import { reportUser, requestOrFollowUser, unfollowUser } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";
import type { PersonLite } from "@/lib/data";

/**
 * قائمة «المزيد» في ملفّ شخصٍ آخر — رسالة / بلاغ / حظر.
 *
 * كانت شكوى المالك: «مافيه خيار أقدر أعطيه بلوك». الحظر فعلٌ نادر
 * فلا يستحقّ زرّاً ظاهراً بجانب المتابعة؛ يستحقّ باباً — نقاطٌ ثلاث
 * تفتح ورقةً سفلية على نمط قائمة صفحة العمل (DetailTopBar) نفسه.
 *
 * ثلاثة صفوف لا أربعة: «إضافة» التي طلبها المالك موجودة أصلاً زرَّ
 * متابعةٍ بجانب النقاط — تكرارها هنا يخلق حالتين للفعل الواحد قد
 * تتعارضان على الشاشة نفسها، والزرّ الظاهر أولى من صفٍّ مطويّ.
 *
 * «رسالة» تحترم D-051: للمتبادلَين تفتح ورقة بدء المحادثة (عملٌ ثم
 * إرسال)، ولغيرهم توستُ تلميحٍ لا صفٌّ مخفيّ — الخيار الظاهر المعطَّل
 * بتفسيرٍ خيرٌ من خيارٍ يظهر ويختفي بلا سبب مرئيّ.
 *
 * والحظر بورقة تأكيدٍ كالبلاغ (استثناء D-047 نفسه): فعلٌ يمسّ طرفاً
 * آخر ولا يُتراجع عنه بضغطة — رفعُ الحظر لا يعيد المتابعة المفكوكة.
 */
export function ProfileMenu({
  person,
  mutual,
  follow,
  variant = "cover",
  system = false,
  messageButton = false,
  locale,
}: {
  person: PersonLite;
  /** متابعةٌ متبادلة؟ — بوّاب خيار «رسالة» (D-051) */
  mutual: boolean;
  /**
   * **صفُّ المتابعة داخل القائمة** (D-225) — يُمرَّر حيث **لا زرَّ متابعة
   * بجانب النقاط**، أي في صفوف خطّ النشاط.
   *
   * **وهذا ليس نقضاً لقاعدة هذا المكوّن بل تطبيقٌ لها:** «الإضافة ليست في
   * القائمة **لأنها الزرّ بجانبها**» — فحيث لا زرَّ بجانبها، القائمةُ هي
   * بيتُها. **وحالتان للفعل الواحد على شاشةٍ واحدة لا تقعان** لأن الصفَّ
   * لا يظهر إلا حين يغيب الزرّ.
   */
  follow?: { following: boolean };
  /**
   * شكلُ زرّ النقاط: `cover` قرصٌ زجاجيٌّ فوق صورةِ غلاف (الأصل)،
   * و`plain` رمزٌ عارٍ في صفٍّ من نصّ. **الورقةُ نفسُها في الحالتين** —
   * والمختلفُ المقبضُ وحده (D-224، نفسُ حجّة `QuickAdd`).
   */
  variant?: "cover" | "plain";
  /**
   * **حسابُ نظامٍ لا إنسانَ خلفه** (D-252 — حساب Loopz): تسقط «رسالة»
   * (الرسالةُ تشترط متابعةً متبادلة **ولا أحدَ خلف الحساب يقبلها** —
   * وخيارٌ يعد بما لا يقع يكذب، D-217) وتسقط «بلاغ» (**البلاغُ يذهب
   * إلينا نحن** — والشكوى من المحتوى بابُها بلاغُ النشرة نفسِها).
   * **وتبقى المتابعةُ والحظر** — بنصّ أحمد: «متابعة وبلوك مثله مثل أي
   * حساب». **والمكوّنُ واحدٌ بصفوفٍ مرشَّحة لا توأمٌ له** (D-145).
   */
  system?: boolean;
  /**
   * 🆕 **زرُّ «رسالة» ظاهرٌ بجانب النقاط** (D-438، خطّةُ أحمد: «Following
   * وMessage وShare»).
   *
   * **ولا مكوّنٌ ثانٍ ولا ورقةٌ ثانية**: الورقةُ (`StartConversationSheet`)
   * وحارسُها (المتابعةُ المتبادلة، D-051) **يسكنان هنا أصلاً** — **وزرٌّ
   * خارجيٌّ كان سيعيد كتابة الحارس والتوست ثم يفترقان عند أوّل تعديل**
   * (القاعدة ٦). **فالمقبضُ يُضاف، والفعلُ في مكانه.**
   */
  messageButton?: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [following, setFollowing] = useState(follow?.following ?? false);
  const [report, setReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [message, setMessage] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [pending, start] = useTransition();

  function openMessage() {
    setMenu(false);
    if (!mutual) {
      toast(t.msgNeedsMutual, { tone: "info" });
      return;
    }
    setMessage(true);
  }

  /** متابعةٌ تفاؤلية بارتداد — نفسُ عقد `FollowUserButton` بلا زرِّه */
  function flipFollow() {
    setMenu(false);
    const was = following;
    tap(was ? 6 : [10, 24]);
    setFollowing(!was);
    start(async () => {
      try {
        if (was) await unfollowUser(person.id);
        else {
          const r = await requestOrFollowUser(person.id);
          /* حسابٌ خاصّ: الفعلُ يُرجع «طلبتَ» لا «أتابعه» — **والتوست هو
             من يقول الفرق**، فلا حالةَ ثالثة في صفٍّ داخل قائمة */
          if (r === "requested") {
            setFollowing(false);
            toast(t.followRequested, { tone: "info" });
          }
        }
      } catch (e) {
        setFollowing(was);
        flashError((e as Error).message);
      }
    });
  }

  function sendReport() {
    setReport(false);
    setReported(true);
    tap(10);
    start(async () => {
      try {
        await reportUser({ targetId: person.id, reason });
        toast(t.reportDone, { tone: "info" });
      } catch (e) {
        flashError((e as Error).message);
        setReported(false);
      }
    });
  }

  /* **صفوفُ القائمة تُكتب مرّةً وتُعرض في وعاءين** (D-226): الورقةُ فوق
     صورة الغلاف، والمنسدلةُ في صفٍّ من نصّ — **والمحتوى واحد**، فلا
     تُنسخ أربعةُ صفوفٍ بأفعالها لأن الوعاء اختلف. */
  const rows = (itemClass: string, dividerClass: string) => (
    <>
      {follow && (
        <button
          onClick={flipFollow}
          disabled={pending}
          role="menuitem"
          className={itemClass}
        >
          <Icon
            name={following ? "person-check" : "people"}
            size={18}
            className={following ? "text-accent" : "text-muted"}
          />
          {following ? t.following : t.follow}
        </button>
      )}

      {!system && (
        <button onClick={openMessage} role="menuitem" className={itemClass}>
          <Icon name="comment" size={18} className={mutual ? "text-accent" : "text-muted"} />
          <span className={mutual ? "" : "text-muted"}>{t.msgUserOption}</span>
        </button>
      )}

      <div className={dividerClass} />

      {!system && (
        <button
          onClick={() => {
            setMenu(false);
            if (!reported) setReport(true);
          }}
          disabled={pending}
          role="menuitem"
          className={itemClass}
        >
          <Icon name="shield" size={18} className="text-muted" />
          {reported ? t.reportDone : t.reportUserOption}
        </button>
      )}

      <button
        onClick={() => {
          setMenu(false);
          setConfirmBlock(true);
        }}
        disabled={pending}
        role="menuitem"
        className={itemClass}
      >
        <Icon name="close" size={18} className="text-[color:var(--error)]" />
        <span className="text-[color:var(--error)]">{t.blockOption}</span>
      </button>
    </>
  );

  return (
    <>
      {/* **وعاءان لقائمةٍ واحدة** (D-226): فوق صورةِ غلافٍ ورقةٌ سفلية —
          **قرارٌ يستحقّ أن يوقف الصفحة** ومقبضُه بعيدٌ عن أسفل الإبهام؛
          وفي صفّ خطّ النشاط منسدلةٌ ملتصقةٌ بنقاطها **لأن الصفوف كثيرة
          وورقةٌ تغطّي الشاشة لكل صفٍّ فيها ثقلٌ لا يستحقّه خيارٌ سريع**.
          ⚠️ **ودَينٌ يُعلَن:** شكلان لقائمةٍ واحدة رائحةُ عائلةٍ ثانية —
          **يُوحَّدان على المنسدلة بعد فحصها حيّاً في صفحة الملفّ**، ولم
          يُفعل في هذه الدفعة لأن ترويسة الغلاف لها سياقُ تكديسٍ خاصّ
          يُقاس ولا يُفترض. */}
      {/* ⚠️ **`inline-flex` لا `inline-block`، ومعها `align-middle`**
          (بلاغُ أحمد: «الثلاث نقاط ما هي على نفس سطر التاريخ، كأنها
          طالعة فوق شوي»). **والعلّةُ في صندوق السطر لا في الحشو**:
          العنصرُ السطريّ يجلس على خطّ القاعدة، **فيحجز الصندوقُ فراغَ
          النوازل تحته** فيصير أطولَ من الزرّ — و`items-center` توسّط
          الصندوقَ الأطول فيعلو الزرُّ عن النصّ بمقدار ذلك الفراغ.
          **`inline-flex` تُلغي صندوقَ السطر، و`align-middle` تُلغي
          الجلوسَ على خطّ القاعدة.** */}
      {/* 🆕 **والمقبضُ الظاهر أوّلاً** (D-438) — ويغيب عن حساب النظام
          كما تغيب صفُّه في القائمة. */}
      {messageButton && !system && (
        <button
          type="button"
          onClick={openMessage}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 h-9 text-12 font-bold transition hover:border-accent/50 active:scale-95"
        >
          <Icon name="comment" size={15} className={mutual ? "text-accent" : "text-muted"} />
          {t.msgUserOption}
        </button>
      )}

      {variant === "plain" ? (
        <span className="relative inline-flex items-center align-middle">
          <button
            onClick={() => {
              tap(6);
              setMenu((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t.profileMenuAria}
            title={t.profileMenuAria}
            /* **هدفُ لمسٍ ٣٢px بهامشٍ سالبٍ رأسيّ أكبر** (D-230): الزرُّ كان يمدّ
               سطرَ الترويسة إلى ٢٤px **فينفتح فراغٌ بين الاسم واسم العمل**
               (بلاغُ أحمد: «خلّ اسم الفلم قريباً من الاسم شويّة»).
               **والحلّ لا يُنقص الهدف**: يبقى ٣٢×٣٢ ملموساً ويُسحب رأسياً
               فلا يُملي ارتفاعَ السطر — نفسُ حيلة `LikeButton` في D-222. */
            className="w-8 h-8 -mx-1 -my-2 rounded-full grid place-items-center text-muted hover:text-foreground active:scale-90 transition"
          >
            <Icon name="dots" size={16} />
          </button>
          <Dropdown open={menu} onClose={() => setMenu(false)}>
            {rows(dropdownItem, dropdownDivider)}
          </Dropdown>
        </span>
      ) : (
        <button
          onClick={() => {
            tap(6);
            setMenu(true);
          }}
          aria-label={t.profileMenuAria}
          title={t.profileMenuAria}
          /* ⚖️ 🆕 **٤٤ لا ٤٠** (D-561): **هو الحدُّ الأدنى للمسِ الإصبع**
             (D-033/D-168)، **وهو مقاسُ `BackButton` في الزاوية المقابلة
             ومقاسُ قرصِ المشاركة بجانبه** — **وثلاثةُ أقراصٍ في صفٍّ
             واحدٍ بمقاسين تُقرأ رتبتين وهي رتبةٌ واحدة.** */
          /* 🆕 ⚖️ **والقرصُ سقط** (D-643، بحكمه: «الدوائر شيلها») —
             **ونقضٌ لسطرِ D-561 أعلاه لا لحجّته**: كان يقول «ثلاثةُ
             أقراصٍ بمقاسين تُقرأ رتبتين»، **والعلاجُ اليوم توحيدُها
             عاريةً لا توحيدُها بقرص** — **والرتبةُ ما زالت واحدة.**
             والمرئيُّ ٢٤ وهدفُ اللمس ٤٤ بـ`before` (D-033). */
          className={coverBareControl}
        >
          <Icon name="dots" size={HEADER_ICON} strokeWidth={2.5} />
        </button>
      )}

      {/* الورقةُ لوعاء الغلاف وحده */}
      <Sheet
        open={menu && variant === "cover"}
        onClose={() => setMenu(false)}
        closeLabel={t.closeLabel}
        variant="bottom"
        labelledBy="profile-menu-title"
      >
        <p id="profile-menu-title" className="text-center font-bold text-15 pt-5 pb-2">
          {t.moreMenuTitle}
        </p>
        {/* **المتابعة أوّلاً حين تكون هنا** — الأخفُّ أثراً في الصدر
            والأخطرُ في الذيل (D-145). والصفوفُ من `rows` نفسِها. */}
        <div className="pb-3">{rows(sheetMenuItem, sheetMenuDivider)}</div>
      </Sheet>

      {/* ورقة البلاغ — نمط ReportButton حرفياً: سببٌ اختياريّ ثم إرسال */}
      <Sheet
        open={report}
        onClose={() => setReport(false)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="report-user-title"
        className="p-5"
      >
        <>
          <p id="report-user-title" className="font-bold text-15 mb-1.5">
            {t.reportUserTitle}
          </p>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.reportUserBody}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            maxLength={300}
            rows={2}
            placeholder={t.reportReasonPlaceholder}
            aria-label={t.reportReasonPlaceholder}
            /* ١٦ بكسلاً (D-033) */
            className="w-full resize-none rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
          />
          <div className="flex items-center gap-2.5 mt-4">
            <button onClick={() => setReport(false)} className={buttonClass({ variant: "ghost", size: "md" })}>
              {t.cancelLabel}
            </button>
            <button onClick={sendReport} className={buttonClass({ variant: "danger", size: "md", className: "flex-1" })}>
              {t.reportSend}
            </button>
          </div>
        </>
      </Sheet>

      {/* ورقة تأكيد الحظر — المشتركة مع باب المحادثة */}
      {confirmBlock && (
        <BlockConfirmSheet
          targetId={person.id}
          locale={locale}
          onClose={() => setConfirmBlock(false)}
          /* الصفحة تُنعش: زرّ المتابعة يعود «تابِع» لأن الحظر فكّها */
          onBlocked={() => router.refresh()}
        />
      )}

      {message && (
        <StartConversationSheet person={person} locale={locale} onClose={() => setMessage(false)} />
      )}
    </>
  );
}
