"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { sheetScroll } from "./ui/controls";
import { Icon, type IconName } from "./Icon";
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
}: {
  targetId: string;
  dir: "followers" | "following";
  count: number;
  label: string;
  /** صاحب الصفحة أقفل قائمتيه (هجرة 43) — العدد يبقى والباب يُقفل */
  locked: boolean;
  labels: { close: string; empty: string; anonymous: string };
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
  const body = (
    <>
      <span className="font-bold text-foreground tabular-nums">{count}</span>
      <span className="text-muted">{label}</span>
    </>
  );

  if (locked) {
    return <span className="shrink-0 flex items-center gap-1">{body}</span>;
  }

  return (
    <>
      <button
        type="button"
        className="shrink-0 flex items-center gap-1 hover:brightness-110 transition"
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
        <SheetHeader id={`fp-${dir}`} title={label} closeLabel={labels.close} onClose={() => setOpen(false)} />
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

export type ToWatchItem = {
  key: string;
  href: string;
  title: string;
  poster: string | null;
  /** «بقي N حلقة» للمسلسل — الفيلم بلا سطر ثانٍ */
  remainingLabel: string | null;
};

export function ToWatchStat({
  value,
  label,
  icon,
  color,
  items,
  divider = false,
  inline = false,
  labels,
}: {
  value: number;
  label: string;
  icon: IconName;
  color: string;
  items: ToWatchItem[];
  divider?: boolean;
  /**
   * 🆕 **مقبضٌ في سطرٍ لا خانةٌ في بطاقة** (D-438): الورقةُ نفسُها
   * ومحتواها نفسُه — **والذي تبدّل موضعُها**، فبطاقةُ الأرقام صارت
   * أربعَ خاناتٍ محدّدةً بخطّة أحمد (Shows · Movies · Ratings · Lists)
   * **وبابُ «وش باقي يتفرج» نزل إلى سطر العدّادات.**
   * **ولا نسخةٌ ثانيةٌ من الورقة** (القاعدة ٦) — **معامِلُ شكلٍ واحد.**
   */
  inline?: boolean;
  labels: { close: string; empty: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {inline ? (
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 text-muted hover:text-foreground transition"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Icon name={icon} size={14} style={{ color }} className="shrink-0" />
          <span className="font-bold text-foreground tabular-nums">{value}</span>
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          className="relative flex flex-col items-center justify-center px-1 py-2.5 w-full hover:bg-surface/60 rounded-xl transition"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          {divider && <span className="absolute inset-y-1 end-0 w-px bg-[color:var(--divider)]" aria-hidden />}
          <span className="flex items-center gap-2">
            <Icon name={icon} size={20} style={{ color }} className="shrink-0" />
            <span className="text-20 font-bold leading-none tabular-nums">{value}</span>
          </span>
          <span className="block text-12 text-muted mt-1.5 leading-[1.25]">{label}</span>
        </button>
      )}

      {/* بلا بوّابةٍ هنا (D-166): `Sheet` تُرسم في `document.body` منذ D-159 —
          وهذا اللفّ من ٨ أغسطس كان علاجَ العَرَض عند المستدعي قبل أن يُعرف
          السبب، فبقي بعد أن عولج السبب. */}
      {open && (
      <Sheet open={open} onClose={() => setOpen(false)} closeLabel={labels.close} labelledBy="towatch-peek">
        <SheetHeader id="towatch-peek" title={label} closeLabel={labels.close} onClose={() => setOpen(false)} />
        <div className={`${sheetScroll} pb-2`}>
          {items.length === 0 ? (
            <p className="text-center text-muted py-10 text-sm">{labels.empty}</p>
          ) : (
            <ul className="space-y-1 py-1">
              {items.map((x) => (
                <li key={x.key}>
                  <Link
                    href={x.href}
                    prefetch={false}
                    className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-surface-2 transition"
                    onClick={() => setOpen(false)}
                  >
                    <span className="relative w-10 h-[60px] shrink-0 rounded-lg overflow-hidden bg-surface-2">
                      {x.poster && <Image src={x.poster} alt="" fill sizes="40px" className="object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-14 font-semibold truncate">{x.title}</span>
                      {x.remainingLabel && (
                        <span className="block text-12 text-muted truncate">{x.remainingLabel}</span>
                      )}
                    </span>
                  </Link>
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
