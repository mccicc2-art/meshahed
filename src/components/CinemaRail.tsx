"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { PosterRail, RailItem, seeAllClass } from "./PosterRail";
import { OneTimeHint } from "./OneTimeHint";
import { Dropdown, DropdownRow } from "./ui/Dropdown";
import { RailScroll } from "./RailScroll";
import { chipClass } from "./ui/controls";
import type { CinemaOrigin } from "@/core/contracts/discover";

/** ملصقٌ رسمه الخادم (`CinemaSection`) ومعه ما يُصفّى به هنا */
export type CinemaSlot = { id: number; origin: CinemaOrigin; node: ReactNode };

/**
 * ====== قسمُ السينما — نصفُه العميل (T512) ======
 *
 * تصميمُ أحمد ٢٢ نوفمبر بقراراته: **مكانٌ واحدٌ بحالتين** — العنوانُ بفشاره وسهمٍ ثقيلٍ بابُ قائمةٍ صغيرة
 * («الآن في السينما · قريباً» بعدّهما)، **ويفتح دائماً على «الآن»**؛ وسطرُ «في السعودية» برقاقات المنشأ
 * «الكل · عربي · أجنبي» في طرفه المقابل. **ولا اسمَ صالة** حتى نحصل على إذنها. وتلميحٌ مرّةً في كلِّ مكان
 * («١ ب»): الرئيسيّةُ و«اكتشف» كلٌّ بمفتاحه.
 *
 * 🔑 **الرأسُ رأسُ `PosterRail` نفسُه** (القاعدة ٣): العنوانُ يمرّ بابَه (`titleDoor`) و«الكلّ» بابَه (`seeAllDoor`) والجسمُ
 * `bare` — فلا رأسَ ثانٍ يُنسخ ولا مقاسَ عنوانٍ ثالث.
 *
 * 🔑 **الفشارُ بارتفاع حروف العنوان** («المسافة خل اعلاه واسفله متساوي مع اعلى الكلمة و اسفلها»): الحرفُ الكبير ≈ ٠٫٧ من
 * مقاس الخطّ والكيسُ يملأ ٠٫٧٩ من مربّعه ⇒ المربّعُ ٠٫٨٨ من ٢٢ = ١٩px، ومركزُه على مركز السطر (Poppins). **ولونُه لونُ
 * رموز الأقسام** (`text-muted`) لا لونٌ خاصّ — والسهمُ بالأحمر الذهبيّ لأنه البابُ الذي يُضغط.
 */
export function CinemaRail({
  now,
  soon,
  place,
  hintAfter,
  labels,
}: {
  now: CinemaSlot[];
  soon: CinemaSlot[];
  place: "home" | "discover";
  /** «لا تلميحتان معاً» (D-1273): تلميحُ السينما بعد تلميح المكان القائم (`after`، D-1549) */
  hintAfter: string;
  labels: {
    now: string;
    soon: string;
    inSaudi: string;
    all: string;
    /** بابُ «الكلّ» في رأس القسم — «الكل» في الرئيسيّة و«الكل ←» في «اكتشف» كجيرانه (D-624) */
    seeAll: string;
    arabic: string;
    foreign: string;
    switchLabel: string;
    hint: string;
    close: string;
    empty: string;
    prev: string;
    next: string;
  };
}) {
  const [mode, setMode] = useState<"now" | "soon">("now");
  const [origin, setOrigin] = useState<"all" | CinemaOrigin>("all");
  const [open, setOpen] = useState(false);
  const list = mode === "soon" ? soon : now;
  const count = (o: "all" | CinemaOrigin) => (o === "all" ? list.length : list.filter((c) => c.origin === o).length);
  const shown = origin === "all" ? list : list.filter((c) => c.origin === origin);
  const pick = (m: "now" | "soon") => {
    setMode(m);
    setOrigin("all");
    setOpen(false);
  };

  /* القائمةُ المنسدلةُ الواحدة (`Dropdown`): تبتلع النقرةَ خارجها فلا تفتح الملصقَ تحتها، وتُغلق بـEscape (مراجعةُ T512) */
  const option = (m: "now" | "soon") => (
    <DropdownRow
      key={m}
      icon={m === "now" ? "popcorn" : "calendar"}
      label={m === "now" ? labels.now : labels.soon}
      active={mode === m}
      onClick={() => pick(m)}
      trail={
        <>
          <span className="text-12 text-muted tabular-nums">{(m === "now" ? now : soon).length}</span>
          <span className="w-4 shrink-0">{mode === m ? <Icon name="check" size={16} className="text-accent" /> : null}</span>
        </>
      }
    />
  );

  const title = mode === "soon" ? labels.soon : labels.now;
  const titleDoor = (
    <span className="relative inline-flex min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${title} — ${labels.switchLabel}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-w-0 items-center gap-2 hover:text-accent transition"
      >
        <Icon name="popcorn" size={19} className="shrink-0 text-muted" />
        <span className="min-w-0 truncate">{title}</span>
        <Icon name="chevron-down" size={18} strokeWidth={2.8} className="shrink-0 text-accent" />
      </button>
      <Dropdown open={open} onClose={() => setOpen(false)} align="start" className="text-base font-normal">
        {option("now")}
        {option("soon")}
      </Dropdown>
    </span>
  );

  return (
    <PosterRail
      title={title}
      titleDoor={titleDoor}
      seeAllDoor={
        shown.length > 0 ? (
          <Link
            href={mode === "soon" ? "/discover/in-cinemas?m=movie&cs=soon" : "/discover/in-cinemas?m=movie"}
            prefetch={false}
            className={seeAllClass}
          >
            {labels.seeAll}
          </Link>
        ) : undefined
      }
      deskRail
      bare
    >
      {/* سطرُ «في السعودية» ورقاقاتُ المنشأ في طرفه المقابل — سطرٌ واحدٌ لا صفّان (طلبُ أحمد) */}
      <div className="mb-2 flex items-center gap-3">
        <p className="shrink-0 text-xs text-muted">{labels.inSaudi}</p>
        <div className="ms-auto flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", "arabic", "foreign"] as const).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={origin === o}
              onClick={() => setOrigin(o)}
              className={chipClass(origin === o, "sm")}
            >
              {o === "all" ? labels.all : o === "arabic" ? labels.arabic : labels.foreign}
              <span className="ms-1.5 tabular-nums opacity-60">{count(o)}</span>
            </button>
          ))}
        </div>
      </div>
      <OneTimeHint id={`cinema-switch-${place}`} text={labels.hint} closeLabel={labels.close} after={hintAfter} className="mb-2" />
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        <CinemaScroll key={`${mode}-${origin}`} labels={labels}>
          {shown.map((c) => (
            <RailItem key={c.id}>{c.node}</RailItem>
          ))}
        </CinemaScroll>
      )}
    </PosterRail>
  );
}

/** المفتاحُ يعيد الصفَّ إلى أوّله عند كلِّ تبديل — قائمةٌ جديدةٌ تبدأ من بدايتها لا من منتصف القديمة */
function CinemaScroll({ children, labels }: { children: ReactNode; labels: { prev: string; next: string } }) {
  return (
    <RailScroll prevLabel={labels.prev} nextLabel={labels.next} mouseDrag>
      {children}
    </RailScroll>
  );
}
