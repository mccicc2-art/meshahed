"use client";

import { useState } from "react";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { sheetScroll } from "./ui/controls";
import { Icon } from "./Icon";
import { peopleFollowsOf } from "@/lib/actions";
import { PersonRowLink, PeopleListSkeleton } from "./PeopleFollowList";
import type { PersonLite } from "@/lib/data";

/**
 * منبثقا الملف العام (دفعة أحمد الثالثة):
 * - عدّادا المتابعة يضغطان فتُفتح ورقة الأسماء (تجلب عند أول فتح).
 * - خانة «للمشاهدة» في بطاقة الأرقام تضغط فتعرض ما بقي لصاحب الصفحة —
 *   العناصر تأتي مع الصفحة نفسها (محسوبة أصلاً لصفوفه) فلا طلب إضافي.
 */

export function FollowCountButton({
  targetId,
  dir,
  count,
  label,
  locked,
  labels,
  compact = false,
  className = "",
  sheetTitle,
}: {
  targetId: string;
  dir: "followers" | "following";
  count: number;
  label: string;
  /** صاحب الصفحة أقفل قائمتيه (هجرة 43) — العدد يبقى والباب يُقفل */
  locked: boolean;
  labels: { close: string; empty: string; anonymous: string };
  /**
   * 🆕 **رمزٌ ورقمٌ بلا كلمة** (D-572، طلبُ أحمد لترويسة الرئيسية:
   * «خلّها أيقونتين — المتابعين والمتابَعين — ومكتوب العدد، ونفس
   * النظام القديم: اضغط عليها تطلع صفحة منبثقة»).
   *
   * **وفي الملفّ تبقى الكلمةُ**: هناك سطرٌ كاملٌ تحت الاسم، **والكلمةُ
   * تقول أيَّ عدٍّ هذا بلا تخمين.** **وهنا صفٌّ فيه الاسمُ ومبدّلُ
   * العرض** — **وكلمتان في هذا الضيق تدفعان الاسمَ إلى القصّ.**
   *
   * ⚠️ **والمعنى لا يسقط بسقوط الكلمة**: `aria-label` يحمل «١٢
   * متابِعاً» كاملةً، **و`title` يقولها لمن حام** — **ورمزٌ عاريان
   * بلا اسمٍ لقارئ الشاشة عطلٌ لا اختصار** (D-138).
   */
  compact?: boolean;
  className?: string;
  /**
   * 🆕 **عنوانُ الورقة حين يكون `label` لاحقةَ عدٍّ لا اسماً** (D-572):
   * **«يتابع» تُقرأ صحيحةً بعد رقم** («٥ يتابع») **وتُقرأ خطأً عنواناً
   * لورقة.** **والغيابُ يعني أن اللاحقةَ تصلح عنواناً** (الإنجليزيّة
   * غالباً) فلا يتغيّر مستدعٍ قائم.
   */
  sheetTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<PersonLite[] | null>(null);

  /* ⚖️ 🆕 **الرمزُ سقط والألوانُ صارت رموزَ سمة** (D-561، تصميمُ أحمد:
     «13 Following · 12 Followers» **بلا أيقونةٍ ولا حدّ**).

     **والرمزُ كان يقول ما يقوله النصُّ بعده** — «متابِعون» بجانب رمز
     ناسٍ حشوٌ (D-138 من جهته المقابلة: **الرمزُ يُضاف حين يختصر لا حين
     يكرّر**). **والصفُّ صار عدّادَين متجاورَين، فرمزان متطابقان في سطرٍ
     واحدٍ ضجيجٌ خالص.**

     ⚠️ **و`text-white` كان عطلاً في السمة النهاريّة**: الصفُّ نزل من
     على الغلاف إلى خلفيّة الصفحة (D-547)، **فبقي أبيضَ على أبيضَ في
     `daylight`** — **ولونٌ مكتوبٌ بيده ينجو من كلِّ فحصٍ إلا فحصَ
     السمة الثانية.** */
  const body = compact ? (
    <>
      {/* **رمزان مختلفان لعدَّين مختلفَين** (D-572): **من أتابعهم شخصٌ
          عليه صحّ** — أنا فعلتُ ذلك — **ومن يتابعونني جماعة.**
          **ورمزان متطابقان لعدَّين متجاورين لا يقولان أيُّهما أيّ.** */}
      {/* 🆕 درجةٌ واحدةٌ فوق (D-614) — مع اسم صفِّ الرئيسية سواء */}
      <Icon name={dir === "followers" ? "people" : "person-check"} size={19} />
      <span className="font-bold tabular-nums">{count}</span>
    </>
  ) : (
    <>
      <span className="font-bold text-foreground tabular-nums">{count}</span>
      <span className="text-muted">{label}</span>
    </>
  );

  const cls = compact
    ? `shrink-0 inline-flex items-center gap-1 text-15 ${className}`
    : `shrink-0 flex items-center gap-1 hover:brightness-110 transition ${className}`;
  /** **المعنى في الوصف حين يغيب من النصّ** — `aria-label` لا زينة */
  const aria = compact ? `${count} ${label}` : undefined;

  if (locked) {
    return (
      <span className={cls} aria-label={aria} title={compact ? label : undefined}>
        {body}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${cls} hover:brightness-110 active:scale-95 transition`}
        aria-label={aria}
        title={compact ? label : undefined}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          if (!people) {
            void peopleFollowsOf(targetId, dir)
              .then(setPeople)
              .catch(() => setPeople([]));
          }
        }}
      >
        {body}
      </button>

      {/* بلا بوّابةٍ هنا (D-166): `Sheet` تُرسم في `document.body` منذ D-159 —
          وهذا اللفّ من ٨ أغسطس كان علاجَ العَرَض عند المستدعي قبل أن يُعرف
          السبب، فبقي بعد أن عولج السبب. */}
      {open && (
      <Sheet open={open} onClose={() => setOpen(false)} closeLabel={labels.close} labelledBy={`fp-${dir}`}>
        <SheetHeader id={`fp-${dir}`} title={sheetTitle ?? label} closeLabel={labels.close} onClose={() => setOpen(false)} />
        <div className={`${sheetScroll} pb-2`}>
          {/* ⚖️ 🆕 **والصفُّ والهيكلُ خرجا إلى مكانٍ يقرؤه اثنان**
              (D-565): صفحةُ المتابعات تعرض القائمةَ نفسَها،
              **ونسخُ صفٍّ بصورةٍ واسمٍ ومعرّف كان سيفترق عند أوّل
              تعديل** (القاعدة ٣/D-145). */}
          {people === null ? (
            <PeopleListSkeleton />
          ) : people.length === 0 ? (
            <p className="text-center text-muted py-10 text-sm">{labels.empty}</p>
          ) : (
            <ul className="space-y-1 py-1">
              {people.map((p) => (
                <li key={p.id}>
                  <PersonRowLink
                    person={p}
                    anonymous={labels.anonymous}
                    onNavigate={() => setOpen(false)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
      )}
    </>
  );
}

/* ✅ **و`ToWatchStat` حُذفت في جولة التنظيف** — فقدت قارئَها يوم صارت
   بطاقةُ الأرقام ثلاثَ خاناتٍ بتصميم أحمد (D-561)، **وحُذفت في رفعةٍ
   لاحقة لا مع آخر قارئٍ لها** (D-538/D-028). **ومعها نوعُ `ToWatchItem`**
   — **نوعٌ لا يصفُ شيئاً مرسوماً جثّةٌ تُقرأ عقداً قائماً.** */
