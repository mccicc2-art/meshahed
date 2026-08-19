"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createList } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

/**
 * نموذجُ «قائمة جديدة» — **مكوّنٌ واحد لبابين** (D-177، نمط D-054).
 *
 * كان يعيش داخل `ListManager` وحده. ولمّا طلب أحمد أن يفتح رمزُ الأدوات في
 * المكتبة «فلاتر الترتيب **وإنشاء قائمة**»، صار له بابٌ ثانٍ — **فانتُزع
 * ولم يُنسخ**. ونسخُه كان سيعني **نسختين من تحصينات D-168 الأربعة**
 * تنحرفان عند أوّل إصلاح، وهو حرفياً ما تمنعه D-145.
 *
 * وكلُّ ما في D-168 محفوظٌ هنا كما هو — وهو المهمّ في هذا الملفّ:
 *  ١) الفعل على `pointerdown` مع `preventDefault`، فلا تُغلق لوحةُ
 *     المفاتيح ولا تنزاح الصفحة فتضيع الضغطة على الجوال.
 *  ٢) `onClick` باقٍ للوحة المفاتيح، **وختمٌ زمنيّ يمنع التنفيذ مرّتين**.
 *  ٣) الزرُّ لا يُعطَّل وهو فارغ — يقول «اكتب اسم القائمة أوّلاً».
 *  ٤) الاسم يُقرأ من الـDOM أوّلاً لا من الحالة وحدها.
 *  ٥) وتوستٌ صريح بزرّ «افتح» — دليلٌ مرئيّ أن الفعل وقع.
 */
export function NewListForm({
  locale,
  /** يُنادى بعد نجاح الإنشاء — الورقة تُغلق نفسها به */
  onCreated,
  collapsed = false,
}: {
  locale: Locale;
  onCreated?: () => void;
  /**
   * 🆕 **زرٌّ يفتح النموذجَ بدل حقلٍ دائمٍ فوق القوائم** (D-443، المرحلة
   * ٥: «إزالة حقل الإنشاء الكبير الدائم، واستخدام زر Create list»).
   *
   * **والحقلُ الدائم كان يقول «اكتب» لمن جاء ليقرأ**: تبويبُ القوائم
   * يُفتح لتُفتح قائمة، **والإنشاءُ فعلٌ يقع مرّةً في الشهر** — **وأداةٌ
   * تُرى ولا تُستعمل الآن تزاحم ما يُستعمل** (D-138).
   * **ولا نموذجٌ ثانٍ**: هو هو، **والذي أُضيف بابُه** — وتحصيناتُ D-168
   * الخمسةُ فوقه كما هي.
   * ⚠️ **وبابُ ورقة الأدوات يبقى مفتوحاً** (`collapsed = false`): من فتح
   * ورقةً اسمُها «قائمة جديدة» لا يُطلب منه ضغطةٌ ثانية.
   */
  collapsed?: boolean;}) {
  const t = getDict(locale);
  const router = useRouter();
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const subRef = useRef<HTMLInputElement>(null);
  const firedAt = useRef(0);

  function add() {
    const clean = (nameRef.current?.value ?? name).trim();
    const sub = subRef.current?.value ?? subtitle;
    if (!clean) {
      setError(t.listNameRequired);
      nameRef.current?.focus();
      return;
    }
    setError(null);
    tap([12, 30]);
    start(async () => {
      try {
        const id = await createList(clean, false, sub);
        setName("");
        setSubtitle("");
        if (nameRef.current) nameRef.current.value = "";
        toast(t.listMadeToast(clean), {
          action: id
            ? { label: t.openListAction, run: () => router.push(`/lists/${id}`) }
            : undefined,
        });
        router.refresh();
        onCreated?.();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function fire() {
    const now = performance.now();
    if (now - firedAt.current < 700) return;
    firedAt.current = now;
    add();
  }

  if (collapsed && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          tap(6);
          setOpen(true);
        }}
        className={buttonClass({ size: "sm" })}
      >
        + {t.listNewGroup}
      </button>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fire()}
          maxLength={60}
          placeholder={t.listNamePlaceholder}
          className="flex-1 min-w-0 min-h-11 rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
        />
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            fire();
          }}
          onClick={fire}
          disabled={pending}
          className={buttonClass({ className: "shrink-0 min-h-11" })}
        >
          {t.listCreate}
        </button>
      </div>

      {/* الوصف يظهر بعد أن يبدأ الاسم لا قبله: حقلان فارغان لكل قائمةٍ
          سريعة ضريبةٌ على الحالة الشائعة */}
      {name.trim() && (
        <input
          ref={subRef}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fire()}
          maxLength={120}
          placeholder={t.listSubtitlePlaceholder}
          aria-label={t.listSubtitleLabel}
          className="acc-in mt-2 w-full rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base font-normal text-muted outline-none focus:border-accent focus:text-foreground transition"
        />
      )}

      {error && (
        <Alert inline className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
