"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setThemeAccent } from "@/lib/actions";
import { ACCENTS, themeAccent } from "@/lib/themes";
import { getDict, type Locale } from "@/lib/i18n";
import { openPlusGate } from "@/lib/plusGate";
import { Icon } from "../Icon";
import { SettingsExpandRow } from "./SettingsExpandRow";
import { toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * ====== لونُ التمييز الشخصيّ — «لونُك أنت» (D-825) ======
 *
 * **حكمُ أحمد**: «اختيارُ ألوان الثيم حسب مزاجه، **والي يدخل حسابه يشوف
 * الألوان المختارة**».
 *
 * 🔑 **وصفٌّ ثانٍ تحت الثيم لا خانةٌ داخله** — **والفرقُ معنًى لا ترتيب**:
 * **الثيمُ يختار الأرضيّةَ والنصّ**، **واللونُ يركب فوق أيِّ ثيمٍ اخترتَه**
 * — **وخلطُهما في شبكةٍ واحدةٍ يجعل ٩×٨ مربّعاً يُختار منه بالحظّ.**
 *
 * 🔑 **والقفلُ عند اللمس لا عند الرسم** (D-633) — **نصُّ `ThemeSection`
 * حرفاً**: **الدوائرُ مرئيّةٌ كاملة**، **والحارسُ في `setThemeAccent`.**
 *
 * ⚠️ **و«لونُ الثيم» خيارٌ أوّلُ لا غيابُ خيار** (D-063): **صفٌّ من
 * ثمانيةٍ بلا بابِ رجوعٍ يحبس من جرّب** — **والدائرةُ الأولى هي العودة.**
 */
export function AccentSection({
  locale,
  initial,
  plus,
}: {
  locale: Locale;
  /** الرمزُ المخزَّن، أو `null` = لونُ الثيم */
  initial: string | null;
  plus: boolean;
}) {
  const t = getDict(locale);
  const ar = locale !== "en";
  const router = useRouter();
  const [accent, setAccent] = useState<string | null>(initial);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function pick(id: string | null) {
    if (id && !plus) {
      tap(8);
      openPlusGate();
      return;
    }
    if (id === accent || pending) return;
    const prev = accent;
    setAccent(id);
    tap(8);
    start(async () => {
      try {
        const res = await setThemeAccent(id);
        if (res?.needsPlus) {
          setAccent(prev);
          openPlusGate();
          return;
        }
        /* **والصفحةُ تُعاد** — **المتغيّراتُ في `<head>` من كوكيّ الخادم**
           (D-825)، **ولا تتبدّل بحالةِ عميلٍ وحدَها.** */
        router.refresh();
      } catch {
        setAccent(prev);
        toast(t.errSaveShort, { tone: "error" });
      }
    });
  }

  const current = themeAccent(accent);

  return (
    <SettingsExpandRow
      icon="palette"
      title={ar ? "لونُك" : "Your colour"}
      value={
        current
          ? ar
            ? current.ar
            : current.en
          : ar
            ? "لون الثيم"
            : "Theme colour"
      }
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <p className="text-12 text-muted mb-3 leading-relaxed">
        {ar
          ? "يركب فوق أيِّ ثيمٍ اخترتَه — ويراه من يفتح ملفَّك."
          : "Rides on whichever theme you picked — and visitors to your profile see it."}
      </p>

      <div
        role="radiogroup"
        aria-label={ar ? "لونُك" : "Your colour"}
        className={`flex flex-wrap gap-2.5 ${pending ? "opacity-70 pointer-events-none" : ""}`}
      >
        {/* **بابُ الرجوع أوّلاً** — ولونُه لونُ الثيم القائم نفسُه */}
        <button
          type="button"
          role="radio"
          aria-checked={accent === null}
          aria-label={ar ? "لون الثيم" : "Theme colour"}
          title={ar ? "لون الثيم" : "Theme colour"}
          onClick={() => pick(null)}
          className={`w-11 h-11 rounded-full grid place-items-center border-2 bg-surface-2 transition active:scale-95 ${
            accent === null ? "border-accent" : "border-transparent hover:border-border"
          }`}
        >
          <Icon name="repeat" size={16} className="text-muted" />
        </button>

        {ACCENTS.map((a) => {
          const on = a.id === accent;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={ar ? a.ar : a.en}
              title={ar ? a.ar : a.en}
              onClick={() => pick(a.id)}
              className={`relative w-11 h-11 rounded-full border-2 transition active:scale-95 ${
                on ? "border-accent" : "border-transparent hover:border-border"
              }`}
              style={{ backgroundImage: `linear-gradient(140deg, ${a.accent}, ${a.accent2})` }}
            >
              {/* **والنجمةُ تُرسم بلونِ نصِّ اللون نفسِه** — **لا بلون
                  التمييز الحاليّ** — **فرمزٌ فوق سطحٍ لا يُقرأ عليه
                  يختفي**، وهو السببُ الذي وُجد لأجله `onAccent`. */}
              {!plus && (
                <Icon
                  name="sparkle-star"
                  size={12}
                  className="absolute inset-0 m-auto"
                  style={{ color: a.onAccent }}
                />
              )}
            </button>
          );
        })}
      </div>
    </SettingsExpandRow>
  );
}
