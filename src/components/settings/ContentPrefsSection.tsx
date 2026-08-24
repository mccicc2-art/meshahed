"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setContentPrefs } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  ALL_LANGS,
  BROWSE_GENRES,
  browseGenreName,
  langName,
  type BrowseGenre,
} from "@/lib/browse";
import { sanitizeContentPrefs, type ContentPrefs } from "@/lib/contentPrefs";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { SettingsPickerSheet } from "./SettingsPickerSheet";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/**
 * **تخصيصُ ما يظهر لك** (D-545، مواصفةُ أحمد المكتوبة).
 *
 * ================= أربعةُ حقولٍ ومصنعٌ واحد =================
 *
 * **الأقسامُ أربعةٌ والسلوكُ واحد**: قائمةٌ فيها بحث، ورقائقُ مختارةٌ
 * تُحذف بضغطة. **فمصنعٌ واحدٌ (`Picker`) يرسم الأربعة** — **ورابعُ
 * نسخةٍ من نفس الرسم هو كيف يفترق حقلٌ عن أخيه عند أوّل تعديل**
 * (D-145/القاعدة ٦).
 *
 * ⚠️ **واللغاتُ المفضّلةُ وحدَها مرتَّبة**: **ترتيبُ المصفوفة معنًى**
 * (الأولى أعلى أولويّة)، **فلها سهما رفعٍ وخفض** — **والسحبُ الحرُّ
 * تُركَ عمداً**: `SectionOrderList` يسحب بمقبضٍ داخل بطاقةٍ ثابتة،
 * **ورقائقُ تُسحب داخل سطرٍ يلتفّ تنازعُ التمريرَ على الجوّال**
 * (وهو نفسُ سببِ فصلِ وضع الترتيب في `ListDetail`). **والسهمان يفعلان
 * ما يفعله السحبُ بلا هذا التنازع**، ولمسُهما ٤٤px.
 *
 * ⚠️ **ومنعُ التعارض في ثلاث طبقات** (D-177): **الواجهةُ تُخفي الخيارَ
 * من القائمة المقابلة**، **والفعلُ يُنقّي قبل الكتابة**، **والقاعدةُ
 * ترفض الصفَّ بقيدٍ** (الهجرة ١٢٦). **حارسٌ على طرفٍ واحد ليس حارساً.**
 *
 * ⚠️ **ولا زرَّ حفظ**: يُحفظ لحظةَ الاختيار كبقيّة الإعدادات، **ثمّ
 * `router.refresh()` لا إعادةَ تحميل** — **فلا رمشةَ ولا صفحةٌ بيضاء**
 * (شرطُ المواصفة).
 *
 * ================= 🆕 والقوائمُ خرجت إلى أوراق (D-555) =================
 *
 * **كانت الصفحةُ تعرض التسعين خياراً كلَّها مفتوحة**: خمسةَ عشرَ نوعاً،
 * ثمّ خمسةَ عشرَ آخر، ثمّ ثلاثين لغةً، ثمّ ثلاثين — **وكلٌّ منها بحقلِ
 * بحثٍ وصفِّ رقائقَ مختارة** — **فخمسُ شاشاتٍ تمريراً قبل أن يُرى
 * «بلد المشاهدة».** **والصفحةُ الآن تعرض ما اخترتَه وحدَه، و«إدارة»
 * تفتح الباقي.**
 *
 * ⚠️ **والتعديلُ في الورقة مسوّدةٌ حتى «تمّ»**: **الحفظُ الفوريُّ صحيحٌ
 * لمفتاحٍ واحدٍ وخاطئٌ لعشر ضغطات** — عشرُ كتاباتٍ إلى الخادم وعشرُ
 * إعاداتِ رسمٍ لقائمةٍ ما زلتَ تحرّرها. **والصفحةُ نفسُها ما زالت
 * تحفظ لحظةَ التغيير** (رفعُ لغةٍ درجةً · حذفُ رقاقة).
 *
 * ⚠️ **واللغاتُ المفضّلةُ صفوفٌ مرقَّمة لا رقائق** (تصميمُ أحمد):
 * **ترتيبُها معنًى** — والرقاقةُ لا تحمل رقماً ولا سهمين بحجمِ لمسةٍ
 * مقبول. **والصفُّ يحمل الثلاثة.**
 *
 * ================= 🆕 وطُوبقت على تصميم أحمد (D-557) =================
 *
 * **بُنيت في D-555 من نصِّ المواصفة وحدَه** لأن صورتَي التصميم خرجتا من
 * ذاكرة الجلسة عند الضغط — **ثمّ أرسلهما، فهذه مطابقتُها:**
 *
 * - **أربعُ بطاقاتٍ بعناوينَ داخلها** (`SettingsSection boxed`) لا أربعةُ
 *   أقسامٍ بعناوينَ فوقها.
 * - **«ذوقك» بطاقةٌ واحدةٌ فيها صفّان**: `+` مطوَّقٌ لـ«أظهر لي المزيد»
 *   و`−` مطوَّقٌ لـ«أظهر لي أقلّ»، **و«إدارة ›» في الطرف**، **والمختارُ
 *   رقائقُ محايدةٌ تحت الاسم.**
 *   ⚖️ **والرقائقُ في الصفحة لا تُحذف بضغطة** — **وهو نقضٌ لِما بنيتُه
 *   في D-555.** **وحجّةُ تصميمه أقوى**: **الصفحةُ تعرض، والورقةُ
 *   تحرّر** — **ورقاقةٌ تُحذف بلمسةٍ عابرةٍ في صفحةٍ تُمرَّر بالإبهام
 *   تفقد اختياراً بلا قصد**، **ولا «تراجُع» لها.**
 * - **«اللغات» بطاقةٌ واحدةٌ فيها المفضّلةُ والمستبعدة**: صفوفٌ مرقَّمةٌ
 *   بمقبض، ثمّ «+ أضف لغة» بعرضٍ كامل، ثمّ «المستبعدة» بـ«إدارة ›».
 * - **و«إعادة الترتيب» تُبدّل المقبضَ سهمين** بدل أن تكون سهمين دائمين:
 *   **الصفُّ في السكون اسمٌ ورقمٌ ومقبض**، **وسهمان مقيمان في كلِّ صفٍّ
 *   يجعلان القائمةَ لوحةَ تحكّمٍ لا قائمةَ لغات.**
 *   ⚠️ **ولم يُبنَ سحبٌ حقيقيّ**: `SectionOrderList` تملكه، **ولها
 *   شكلُها الذي لا يطابق هذا التصميم** — **ونسخةٌ ثانيةٌ من منطق
 *   السحب أسوأُ من سهمين** (D-145). **والمقبضُ يقول «هذا يُرتَّب»
 *   ويفتح الوضعَ باللمس.**
 * - **«إعادة ضبط كل التفضيلات» في القاع، وسطاً، بالأحمر.**
 */

export function ContentPrefsSection({
  locale,
  initial,
  signedIn,
}: {
  locale: Locale;
  initial: ContentPrefs;
  signedIn: boolean;
}) {
  const t = getDict(locale);
  const loc = locale === "en" ? "en" : "ar";
  const router = useRouter();
  const [prefs, setPrefs] = useState<ContentPrefs>(initial);
  const [, start] = useTransition();
  /** أيُّ ورقةٍ مفتوحة — **واحدةٌ لا أربع** */
  const [sheet, setSheet] = useState<
    "genres" | "unwantedGenres" | "languages" | "excludedLanguages" | null
  >(null);

  /** **رقمُ المفهوم القانونيّ** — أوّلُ أرقامه، وبه يُخزَّن (D-545) */
  const idOf = (g: BrowseGenre) => (g.movie[0] ?? g.tv[0])!;
  const nameOf = (id: number) => {
    const g = BROWSE_GENRES.find((x) => (x.movie[0] ?? x.tv[0]) === id)
      ?? BROWSE_GENRES.find((x) => x.movie.includes(id) || x.tv.includes(id));
    return g ? browseGenreName(g, loc) : String(id);
  };

  /* **الحفظُ لحظةَ التغيير** — والتنقيةُ هنا أيضاً كي لا يُرسل تعارضٌ
     أصلاً، **ثمّ يُنقّى مرّةً في الفعل ومرّةً في القاعدة** (D-177). */
  function commit(next: ContentPrefs) {
    const clean = sanitizeContentPrefs(next);
    const prev = prefs;
    setPrefs(clean);
    tap(8);
    start(async () => {
      try {
        await setContentPrefs(clean);
        router.refresh();
      } catch {
        setPrefs(prev);
        toast(t.errSaveShort, { tone: "error" });
      }
    });
  }

  /** **الاختيارُ يطرد المقابل** — فلا يصل تعارضٌ إلى القاعدة أصلاً */
  function applyNums(list: "genres" | "unwantedGenres", ids: number[]) {
    const other = list === "genres" ? "unwantedGenres" : "genres";
    commit({
      ...prefs,
      [list]: ids,
      [other]: prefs[other].filter((x) => !ids.includes(x)),
    } as ContentPrefs);
  }

  function applyLangs(list: "languages" | "excludedLanguages", codes: string[]) {
    const other = list === "languages" ? "excludedLanguages" : "languages";
    commit({
      ...prefs,
      [list]: codes,
      [other]: prefs[other].filter((x) => !codes.includes(x)),
    } as ContentPrefs);
  }

  /** كلُّ الأنواع — **والمقابلُ مطروحٌ فلا يُعرض خيارٌ يصنع تعارضاً** */
  const genreOptions = (exclude: number[]) =>
    BROWSE_GENRES.map((g) => ({ key: String(idOf(g)), label: browseGenreName(g, loc), id: idOf(g) }))
      .filter((o) => !exclude.includes(o.id))
      .map(({ key, label }) => ({ key, label }));

  const langOptions = (exclude: string[]) =>
    ALL_LANGS.filter((l) => !exclude.includes(l.code)).map((l) => ({
      key: l.code,
      label: langName(l.code, loc),
    }));

  const sheetLabels = {
    cancel: t.cancelLabel,
    done: t.doneLabel,
    selected: t.cpSelected,
    clear: t.cpClear,
    all: t.cpAllCategories,
    empty: t.cpNothing,
    noMatch: t.cpNoMatch,
    remove: t.cpRemoveAria,
    add: t.cpAddAria,
    moveUp: (name: string) => `${t.cpLangUp} — ${name}`,
    moveDown: (name: string) => `${t.cpLangDown} — ${name}`,
  };

  const short = (items: string[]) => {
    if (items.length === 0) return t.cpNone;
    if (items.length === 1) return items[0];
    return `${items[0]} · +${items.length - 1}`;
  };

  return (
    <>
      <SettingsGroup label={t.cpTaste}>
        <SettingsRow
          icon="plus"
          title={t.cpShowMore}
          value={short(prefs.genres.map(nameOf))}
          onClick={() => setSheet("genres")}
        />
        <SettingsRow
          icon="eye-off"
          title={t.cpShowLess}
          value={short(prefs.unwantedGenres.map(nameOf))}
          onClick={() => setSheet("unwantedGenres")}
        />
      </SettingsGroup>

      <SettingsGroup label={t.cpLangsTitle}>
        <SettingsRow
          icon="compass"
          title={t.cpPreferred}
          value={short(prefs.languages.map((code) => langName(code, loc)))}
          onClick={() => setSheet("languages")}
        />
        <SettingsRow
          icon="eye-off"
          title={t.cpExcluded}
          value={short(prefs.excludedLanguages.map((code) => langName(code, loc)))}
          onClick={() => setSheet("excludedLanguages")}
        />
      </SettingsGroup>

      {!signedIn && (
        <p className="px-1 text-12 text-muted leading-relaxed">{t.cpGuestNote}</p>
      )}

      {/* ===== الأوراقُ الأربع — **مصنعٌ واحدٌ يرسمها** ===== */}
      <SettingsPickerSheet
        open={sheet === "genres"}
        title={t.cpShowMore}
        options={genreOptions(prefs.unwantedGenres)}
        picked={prefs.genres.map(String)}
        onCancel={() => setSheet(null)}
        onDone={(next) => {
          applyNums("genres", next.map(Number));
          setSheet(null);
        }}
        labels={{ ...sheetLabels, search: t.cpSearchGenres }}
      />
      <SettingsPickerSheet
        open={sheet === "unwantedGenres"}
        title={t.cpShowLess}
        options={genreOptions(prefs.genres)}
        picked={prefs.unwantedGenres.map(String)}
        onCancel={() => setSheet(null)}
        onDone={(next) => {
          applyNums("unwantedGenres", next.map(Number));
          setSheet(null);
        }}
        labels={{ ...sheetLabels, search: t.cpSearchGenres }}
      />
      <SettingsPickerSheet
        open={sheet === "languages"}
        title={t.cpPreferred}
        options={langOptions(prefs.excludedLanguages)}
        picked={prefs.languages}
        ordered
        onCancel={() => setSheet(null)}
        onDone={(next) => {
          applyLangs("languages", next);
          setSheet(null);
        }}
        labels={{ ...sheetLabels, search: t.cpSearchLangs }}
      />
      <SettingsPickerSheet
        open={sheet === "excludedLanguages"}
        title={t.cpExcluded}
        options={langOptions(prefs.languages)}
        picked={prefs.excludedLanguages}
        onCancel={() => setSheet(null)}
        onDone={(next) => {
          applyLangs("excludedLanguages", next);
          setSheet(null);
        }}
        labels={{ ...sheetLabels, search: t.cpSearchLangs }}
      />
    </>
  );
}

/**
 * **إعادةُ ضبط كل التفضيلات** — **في القاع، وسطاً، بالأحمر** (تصميمُ
 * أحمد). **وخارج البطاقات عمداً**: فعلٌ يهدم ما فوقه كلَّه **لا يجلس
 * داخل إحدى الكتل التي يهدمها.**
 */
export function ContentPrefsReset({
  locale,
  onDone,
}: {
  locale: Locale;
  onDone?: () => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        tap(10);
        start(async () => {
          try {
            await setContentPrefs({
              genres: [],
              unwantedGenres: [],
              languages: [],
              excludedLanguages: [],
            });
            toast(t.cpResetDone, { tone: "success" });
            onDone?.();
            router.refresh();
          } catch {
            toast(t.errSaveShort, { tone: "error" });
          }
        });
      }}
      className="w-full min-h-14 text-14 font-semibold text-[color:var(--error)] hover:brightness-110 transition active:scale-[0.99]"
    >
      {t.cpResetAll}
    </button>
  );
}
