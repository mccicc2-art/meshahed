"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createList } from "@/lib/actions";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import type { UserList } from "@/lib/data";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { ShareListSheet } from "./ShareListSheet";

/**
 * إدارة القوائم.
 *
 * كل قائمة بطاقةٌ كاملة: ترويسةٌ (الاسم + العدد + سهمُ الدخول) ثم
 * صفُّ ملصقاتٍ أفقيٌّ يُظهر محتواها لمحةً واحدة — البطاقة كلها رابطٌ إلى
 * صفحة القائمة، فالضغط في أي مكانٍ يفتحها. لا زرَّ حذفٍ هنا: التسمية
 * والنوع والترتيب والحذف بابُها الوحيد قائمةُ خيارات صفحة القائمة —
 * «بابٌ واحدٌ لكل فعل» بدل بابين متباعدين.
 *
 * الحدّ لونُ خلفية الثيم لا رماديٌّ ثابت: صلبٌ بلا تدرّج، أسود في الداكن
 * يطابق هوية التطبيق، وفاتحٌ في `daylight` — فلا يكسر الثيم الفاتح.
 */
export function ListManager({ lists, locale }: { lists: UserList[]; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /* المشاركة من صفحة القوائم نفسها (طلب المالك): زرٌّ على البطاقة يفتح
     نفس ورقة مشاركة صفحة القائمة — مكوّنٌ واحد لا نسختان */
  const [shareFor, setShareFor] = useState<UserList | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const subRef = useRef<HTMLInputElement>(null);
  /* ختمُ آخر إطلاق: الزرّ يعمل على `pointerdown` **و** `click` معاً (انظر
     `fire` أدناه)، وبعض المتصفّحات ترسل الاثنين — فلا يُنشأ اسمٌ مرّتين */
  const firedAt = useRef(0);

  function add() {
    /* الاسم من الحقل نفسه أوّلاً لا من الحالة (D-168): إن أخفق مسارُ
       إدخالٍ ما في إطلاق `onChange` عند React — لوحةُ مفاتيح، تصحيحٌ
       تلقائيّ، ملءٌ تلقائيّ — تبقى قيمة الـDOM هي الصحيحة. */
    const clean = (nameRef.current?.value ?? name).trim();
    const sub = subRef.current?.value ?? subtitle;
    if (!clean) {
      /* لا يُترك الزرّ معطّلاً ثم لا شيء يحدث: يقول سببه ويعيد التركيز.
         زرٌّ معطّل على الجوال (`disabled:pointer-events-none`) لا يُلمس
         أصلاً، فيبدو التطبيق مكسوراً بلا رسالة. */
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
        /* توستٌ صريح: لو تأخّر `router.refresh()` أو لم يُعِد الرسم على
           جهازٍ ما، يبقى للمستخدم دليلٌ أن الفعل وقع — وبابٌ إليه. */
        toast(t.listMadeToast(clean), {
          action: id ? { label: t.openListAction, run: () => router.push(`/lists/${id}`) } : undefined,
        });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  /**
   * إطلاقُ الإنشاء — **على `pointerdown` لا على `click` وحده (D-168).**
   *
   * **بلاغ أحمد:** «حتى في التطبيق لا تستطيع إنشاء لستة» — يعمل على
   * سطح المكتب ولا يعمل على الجوال ولا على التطبيق المثبَّت.
   *
   * **والفرق بين الجهازين هو لوحة المفاتيح:** الحقل مركَّز واللوحة
   * مفتوحة، فلمسُ الزرّ يُطلق `blur` أوّلاً ← تُغلق اللوحة ← **تتمدّد
   * الشاشة المرئية وتنزاح الصفحة** ← وعند `touchend` لم يعد الإصبع فوق
   * الزرّ، **فلا يُطلق `click` إطلاقاً**. بالفأرة لا لوحةَ ولا انزياح،
   * فيعمل دائماً — وهذا بالضبط ما جعله «غير قابل للتكرار» في الفحص.
   *
   * `preventDefault` على `pointerdown` يمنع نزع التركيز أصلاً، فلا تُغلق
   * اللوحة ولا تنزاح الصفحة. و`onClick` يبقى للوحة المفاتيح ولأي متصفّحٍ
   * لا يرسل `pointerdown` — والختم يمنع التنفيذ مرّتين.
   */
  function fire() {
    const now = performance.now();
    if (now - firedAt.current < 700) return;
    firedAt.current = now;
    add();
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex gap-2">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fire()}
            maxLength={60}
            placeholder={t.listNamePlaceholder}
            /* `min-h-11` — أربعةٌ وأربعون بكسلاً، أدنى هدفِ لمسٍ يصيبه
               الإبهام (نفس قاعدة نقاط صفحة القائمة) */
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
            سريعة ضريبةٌ على الحالة الشائعة، وإظهاره عند أول حرفٍ يجعله
            متاحاً لحظة الإنشاء لمن يريده بلا أن يعترض طريق من لا يريده */}
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
      </div>

      {error && (
        <Alert inline className="mb-4">
          {error}
        </Alert>
      )}

      {lists.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((l) => {
            const posters = (l.posters ?? [])
              .map((p) => posterUrl(p, "w185"))
              .filter(Boolean) as string[];
            // عدّاد ديناميكي حسب المحتوى الفعلي؛ وقبل تشغيل SQL يسقط إلى العدّ الكلّي
            const hasBreakdown =
              typeof l.shows_count === "number" || typeof l.movies_count === "number";
            const countLine = hasBreakdown
              ? t.listContentCount(l.shows_count ?? 0, l.movies_count ?? 0)
              : t.listCount(l.item_count);
            return (
              <li
                key={l.id}
                className="group max-w-full rounded-2xl border border-[color:var(--background)] bg-surface p-2.5 hover:bg-surface-2 transition"
              >
                {/* ترويسةٌ: الاسم رابطٌ + زرّ مشاركة (زرٌّ حقيقيّ خارج الرابط،
                    فلا عنصرٌ تفاعليّ داخل آخر) + سهم الدخول */}
                <div className="flex items-center gap-1">
                  <Link href={`/lists/${l.id}`} className="min-w-0 flex-1 py-0.5">
                    <span className="block text-[15px] font-bold truncate">{l.name}</span>
                    {countLine && (
                      <span className="block text-[12px] text-muted truncate mt-0.5">
                        {countLine}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShareFor(l)}
                    aria-label={t.listShare}
                    title={t.listShare}
                    className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent hover:bg-surface-2 active:scale-95 transition"
                  >
                    <Icon name="share" size={16} />
                  </button>
                  <Link
                    href={`/lists/${l.id}`}
                    aria-label={l.name}
                    className="shrink-0 grid place-items-center w-7 h-7"
                  >
                    {/* سهمٌ أفقيٌّ من chevron الموجود: ينقلب تلقائياً في RTL */}
                    <Icon
                      name="chevron-down"
                      size={16}
                      className="text-muted -rotate-90 rtl:rotate-90"
                    />
                  </Link>
                </div>

                {/* صفُّ الملصقات: رابطٌ إلى القائمة، يمرّر أفقياً عند الفيض */}
                <Link href={`/lists/${l.id}`} className="block">
                  {posters.length > 0 ? (
                    <div className="mt-2 -mx-2.5 px-2.5 scroll-px-2.5 overflow-x-auto overscroll-x-contain snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="flex gap-2 w-max pb-0.5">
                        {posters.map((url, i) => (
                          <span
                            key={i}
                            className="relative shrink-0 snap-start w-16 h-24 rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]"
                          >
                            <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="grid place-items-center w-16 h-24 rounded-lg border border-dashed border-[color:var(--background)] text-muted">
                        <Icon name="list" size={16} />
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {shareFor && (
        <ShareListSheet
          listId={shareFor.id}
          name={shareFor.name}
          isPublic={shareFor.is_public}
          locale={locale}
          onClose={() => setShareFor(null)}
          onChanged={() => {
            // بعد جعلها معلنة: حدّث البطاقة محلياً كي تعرض الورقة أزرار
            // المشاركة، وأنعش الصفحة لتتبدّل الشارة
            setShareFor((s) => (s ? { ...s, is_public: true } : s));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
