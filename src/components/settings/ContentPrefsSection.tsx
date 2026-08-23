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
import { Icon } from "../Icon";
import { SettingsSection } from "./SettingsSection";
import { SettingsPickerSheet } from "./SettingsPickerSheet";

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

/** رقاقةُ عرضٍ — **تقول ما اخترتَ ولا تُحرّره** (تصميمُ D-557) */
function ShownChip({ label }: { label: string }) {
  return (
    <span
      dir="auto"
      className="inline-flex items-center max-w-full truncate rounded-control border border-border bg-surface-2 px-2.5 py-1.5 text-12 font-semibold"
    >
      {label}
    </span>
  );
}

/**
 * صفُّ ذوقٍ — **رمزٌ مطوَّقٌ واسمٌ و«إدارة»، والمختارُ تحته.**
 *
 * **ومصنعٌ واحدٌ للصفّين** (المزيد والأقلّ): **نسختان من نفس الرسم
 * تفترقان عند أوّل تعديل** (D-145).
 */
function TasteRow({
  sign,
  title,
  manageLabel,
  emptyLabel,
  picked,
  onManage,
}: {
  sign: "plus" | "minus";
  title: string;
  manageLabel: string;
  emptyLabel: string;
  picked: string[];
  onManage: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      {/* **الطوقُ يحمل المعنى قبل الكلمة**: `+` بلونِ الهويّة لِما
          يُزاد، و`−` رماديٌّ لِما يُنقَص — **ولا أحمرَ**، فالإنقاصُ
          ليس خطأً ولا حذفاً. */}
      <span
        aria-hidden
        className={`shrink-0 grid place-items-center w-8 h-8 rounded-full border ${
          sign === "plus"
            ? "border-accent text-accent"
            : "border-[color:var(--border)] text-muted"
        }`}
      >
        <Icon name={sign === "plus" ? "plus" : "check-line"} size={16} strokeWidth={2.4} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-15 font-bold" dir="auto">
          {title}
        </span>
        {picked.length === 0 ? (
          <span className="block text-13 text-muted mt-1">{emptyLabel}</span>
        ) : (
          <span className="flex flex-wrap gap-2 mt-2">
            {picked.map((label) => (
              <ShownChip key={label} label={label} />
            ))}
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={onManage}
        className="shrink-0 inline-flex items-center gap-0.5 h-11 -my-1.5 -me-1 ps-2 text-14 font-bold text-accent hover:brightness-110 transition active:scale-95"
      >
        {manageLabel}
        <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90" />
      </button>
    </div>
  );
}

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
  /** وضعُ الترتيب — **المقبضُ يصير سهمين، و«إعادة ترتيب» تصير «تمّ»** */
  const [reordering, setReordering] = useState(false);

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

  const move = (i: number, delta: -1 | 1) => {
    const arr = [...prefs.languages];
    const j = i + delta;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit({ ...prefs, languages: arr });
  };

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
  };

  return (
    <>
      {/* ===== ١) ذوقك ===== */}
      <SettingsSection boxed label={t.cpTaste}>
        <div className="divide-y divide-[color:var(--divider)] -my-3">
          <TasteRow
            sign="plus"
            title={t.cpShowMore}
            manageLabel={t.manageLabel}
            emptyLabel={t.cpNoCategories}
            picked={prefs.genres.map(nameOf)}
            onManage={() => setSheet("genres")}
          />
          <TasteRow
            sign="minus"
            title={t.cpShowLess}
            manageLabel={t.manageLabel}
            emptyLabel={t.cpNoCategories}
            picked={prefs.unwantedGenres.map(nameOf)}
            onManage={() => setSheet("unwantedGenres")}
          />
        </div>
      </SettingsSection>

      {/* ===== ٢) اللغات ===== */}
      <SettingsSection boxed label={t.cpLangsTitle} hint={t.cpLangsHint}>
        <div className="flex items-center gap-2 mb-2.5">
          <h3 className="min-w-0 flex-1 text-15 font-semibold truncate">
            {t.cpPreferred}
          </h3>
          {prefs.languages.length > 1 && (
            <button
              type="button"
              onClick={() => {
                tap(6);
                setReordering((v) => !v);
              }}
              className="shrink-0 h-11 px-2 -me-2 text-14 font-bold text-accent hover:brightness-110 transition active:scale-95"
            >
              {reordering ? t.doneLabel : t.cpReorder}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {prefs.languages.map((code, i) => (
            <div
              key={code}
              className="flex items-center gap-3 min-h-14 pe-2 rounded-control border border-border bg-surface-2 overflow-hidden"
            >
              {/* **الرقمُ هو المعنى**: الأولى أعلى أولويّة (D-545) */}
              <span className="shrink-0 self-stretch grid place-items-center w-12 bg-[color:var(--surface)] text-14 font-bold">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-15 font-semibold truncate" dir="auto">
                {langName(code, loc)}
              </span>

              {reordering ? (
                <span className="shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`${t.cpLangUp} — ${langName(code, loc)}`}
                    className="grid place-items-center w-11 h-11 text-muted hover:text-foreground disabled:opacity-30 transition"
                  >
                    <Icon name="chevron-up" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === prefs.languages.length - 1}
                    aria-label={`${t.cpLangDown} — ${langName(code, loc)}`}
                    className="grid place-items-center w-11 h-11 text-muted hover:text-foreground disabled:opacity-30 transition"
                  >
                    <Icon name="chevron-down" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyLangs("languages", prefs.languages.filter((x) => x !== code))
                    }
                    aria-label={t.cpRemoveAria(langName(code, loc))}
                    className="grid place-items-center w-11 h-11 text-muted hover:text-[color:var(--error)] transition"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </span>
              ) : (
                /* **المقبضُ يقول «هذا يُرتَّب» ويفتح الوضعَ باللمس** —
                   **ورمزٌ لا يفعل شيئاً أسوأُ من رمزٍ غائب** (D-138) */
                <button
                  type="button"
                  onClick={() => {
                    tap(6);
                    setReordering(true);
                  }}
                  aria-label={t.cpReorder}
                  className="shrink-0 grid place-items-center w-11 h-11 text-muted hover:text-foreground transition"
                >
                  <Icon name="grip" size={18} />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setSheet("languages")}
            className="w-full inline-flex items-center justify-center gap-2 min-h-14 rounded-control border border-border text-14 font-bold text-accent hover:border-accent/50 transition active:scale-[0.99]"
          >
            <Icon name="plus" size={16} strokeWidth={2.4} />
            {t.cpAddLang}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-[color:var(--divider)]">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 text-15 font-semibold truncate">
              {t.cpExcluded}
            </h3>
            <button
              type="button"
              onClick={() => setSheet("excludedLanguages")}
              className="shrink-0 inline-flex items-center gap-0.5 h-11 -me-1 ps-2 text-14 font-bold text-accent hover:brightness-110 transition active:scale-95"
            >
              {t.manageLabel}
              <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90" />
            </button>
          </div>
          {prefs.excludedLanguages.length === 0 ? (
            <p className="text-13 text-muted">{t.cpNone}</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {prefs.excludedLanguages.map((c) => (
                <ShownChip key={c} label={langName(c, loc)} />
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

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
      className="w-full min-h-14 text-15 font-semibold text-[color:var(--error)] hover:brightness-110 transition active:scale-[0.99]"
    >
      {t.cpResetAll}
    </button>
  );
}
