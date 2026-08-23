"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, syncThemeCookie } from "@/lib/actions";
import { THEMES, themeName } from "@/lib/themes";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { Icon } from "../Icon";

/**
 * الثيم — **شبكةٌ عمودان، وصحٌّ لا حلقة** (D-555، مواصفةُ أحمد).
 *
 * ================= ثلاثةٌ تبدّلت =================
 *
 * **١) الحلقةُ سقطت.** كانت `ring-2 ring-accent/40` **فوق حدٍّ أصفرَ
 * أصلاً** — **أربعةُ بكسلاتٍ صفراءُ حول المربّع** — **وهي بعينها «حلقاتٌ
 * صفراءُ سميكة» في قائمة الممنوعات.** **والآن حدٌّ بلونِ الهويّة وصحٌّ
 * في زاوية الاسم**: إشارتان دقيقتان بدل هالة.
 *
 * **٢) الحفظُ صار لحظيّاً.** كان الثيمُ ينتظر «حفظ التغييرات» **بينما
 * اللغةُ وحجمُ الخطّ يُطبَّقان لحظةَ الضغط في الصفحة نفسها** —
 * **قاعدتان لحفظِ إعدادٍ في شاشةٍ واحدة**، والمستخدمُ لا يعلم أيَّهما
 * تحكم هذا الصفّ. **والقاعدةُ الآن واحدةٌ: خيارٌ واحدٌ يُطبَّق فوراً،
 * وصفحةُ حقولٍ تنتظر شريطَ الحفظ.**
 *
 * **٣) رسالةُ «✓ تم الحفظ» المقيمةُ سقطت** — **رشّةٌ تقول ثمّ تمضي**
 * (شرطُ المواصفة: «لا رسالة نجاح دائمة»).
 *
 * ⚠️ **ولا فعلَ خادمٍ جديد**: `updateProfile` و`syncThemeCookie`
 * **هما اللذان كان يستدعيهما الزرُّ القديم** — **والذي تبدّل لحظةُ
 * النداء لا النداء** (شرطُ «لا تغيّر منطق حفظ التفضيلات»).
 *
 * ⚠️ **والحقولُ الأخرى تُمرَّر كما جاءت**: `updateProfile` يكتب
 * `nickname` و`avatar_url` في **كلِّ** نداء — **وحذفُها يمحو الاسمَ
 * والصورةَ عند تبديل ثيم** (تحذيرُ `ProfileForm` بنصّه).
 */
export function ThemeSection({
  locale,
  initialTheme,
  carry,
}: {
  locale: Locale;
  initialTheme: string;
  /** ما يجب أن يُعاد كتابتُه كما هو مع كلِّ نداء — انظر التحذير أعلاه */
  carry: {
    nickname: string;
    bio: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    coverPos: number;
    avatarPos: number;
    favoriteGenres: number[];
  };
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [pending, start] = useTransition();

  function pick(id: string) {
    if (id === theme || pending) return;
    const prev = theme;
    setTheme(id);
    tap(8);
    start(async () => {
      try {
        await updateProfile({ ...carry, theme: id });
        /* الكوكي هو ما يقرأه `layout` قبل أوّل بكسل — **وبلا مزامنته
           يعود الثيمُ القديمَ عند أوّل تحميلٍ كامل** */
        await syncThemeCookie(id);
        router.refresh();
      } catch {
        setTheme(prev);
        toast(t.errSaveShort, { tone: "error" });
      }
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={t.themeSection}
      className={`grid grid-cols-2 gap-2.5 ${pending ? "opacity-70" : ""}`}
    >
      {THEMES.map((th) => {
        const on = th.id === theme;
        return (
          <button
            key={th.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(th.id)}
            className={`rounded-xl border overflow-hidden text-start transition active:scale-[0.98] ${
              on ? "border-accent" : "border-border hover:border-accent/50"
            }`}
          >
            {/* شريطُ الألوان هو المعاينة — **واسمُ الثيم وحدَه لا يقول
                شيئاً لمن لم يجرّبه** */}
            <span
              className="block h-10 w-full"
              style={{
                background: `linear-gradient(120deg, ${th.vars.accent} 0%, ${th.vars.accent} 38%, ${th.vars["accent-2"]} 38%, ${th.vars["accent-2"]} 62%, ${th.vars.surface} 62%, ${th.vars.background} 100%)`,
              }}
            />
            <span className="flex items-center gap-1.5 px-3 min-h-11 text-12 font-semibold bg-surface-2">
              <span className="min-w-0 flex-1 truncate">{themeName(th, locale)}</span>
              <span className="shrink-0 w-4 grid place-items-center">
                {on && <Icon name="check" size={16} className="text-accent" />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
