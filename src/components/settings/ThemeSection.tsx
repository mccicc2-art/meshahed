"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, syncThemeCookie } from "@/lib/actions";
import { THEMES, themeName } from "@/core/themes";
import { getDict, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { Icon } from "../Icon";
import { SettingsExpandRow } from "./SettingsExpandRow";
import { themeNeedsPlus } from "@/core/plan";
import { openPlusGate } from "@/lib/plusGate";

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
 * والصورةَ عند تبديل ثيم**. **التحذيرُ وُرّث عن `ProfileForm` وبقي
 * بعد حذفها** (D-214): **الحجّةُ في الفعل لا في الملفّ الذي حملها.**
 */
export function ThemeSection({
  locale,
  initialTheme,
  plus = false,
  carry,
}: {
  locale: Locale;
  initialTheme: string;
  /* 🆕 **الخطّة** (D-633): الملوّنةُ للبلس، **و`amber` و`daylight`
     للجميع** — الافتراضيُّ وإتاحةُ النهار (بموافقة أحمد على الإتاحة).
     **وافتراضٌ صامتٌ `false`** فلا ينكسر قارئٌ لا يمرّرها (D-028). */
  plus?: boolean;
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
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function pick(id: string) {
    /* ⚖️ **والقفلُ عند اللمس لا عند الرسم** (D-633): المربّعاتُ الملوّنةُ
       تبقى **مرئيّةً كاملةً** — من يرى ما يشتريه يشتريه، ومن يُمنع من
       الرؤية ينصرف. **والحارسُ الحقيقيُّ في الخادم** (`updateProfile`)،
       وهذا تجربةٌ تشرح لا سياجٌ يحمي. */
    if (!plus && themeNeedsPlus(id)) {
      tap(8);
      openPlusGate();
      return;
    }
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

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0];

  return (
    /* ⚖️ 🆕 **والورقةُ السفليّةُ صارت توسّعاً في المكان** (D-569، طلبُ
       أحمد) — الحجّةُ في `SettingsExpandRow`. **واللوحُ لا يُغلق عند
       الاختيار**: **الثيمُ يُطبَّق على الشاشة كلِّها لحظةَ اللمس**،
       **ولوحٌ يبقى مفتوحاً يسمح بتجريب الثاني والثالث بلا فتحٍ ثالث**
       — وهو ما لم تكن الورقةُ تسمح به. */
    <SettingsExpandRow
      icon="palette"
      title={t.themeSection}
      value={themeName(current, locale)}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div
        role="radiogroup"
        aria-label={t.themeSection}
        className={`grid grid-cols-2 gap-2.5 ${pending ? "opacity-70 pointer-events-none" : ""}`}
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
              className={`rounded-lg overflow-hidden text-start transition active:scale-[0.98] ${
                on ? "ring-1 ring-accent" : "bg-surface-2"
              }`}
            >
              <span
                className="block h-8 w-full"
                style={{
                  background: `linear-gradient(120deg, ${th.vars.accent} 0%, ${th.vars.accent} 38%, ${th.vars["accent-2"]} 38%, ${th.vars["accent-2"]} 62%, ${th.vars.surface} 62%, ${th.vars.background} 100%)`,
                }}
              />
              <span className="flex items-center gap-1.5 px-2.5 min-h-10 text-12 font-semibold">
                <span className="min-w-0 flex-1 truncate">{themeName(th, locale)}</span>
                {/* **الرمزُ يقول أيَّهما**: صحٌّ للمختار، ونجمةٌ لما يحتاج
                    بلس — **ولا يجتمعان** لأن المختارَ مملوكٌ بالضرورة. */}
                {on ? (
                  <Icon name="check" size={14} className="shrink-0 text-accent" />
                ) : !plus && themeNeedsPlus(th.id) ? (
                  <Icon
                    name="sparkle-star"
                    size={13}
                    className="shrink-0 text-accent/70"
                    aria-label={t.plusLocked}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsExpandRow>
  );
}
