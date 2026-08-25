"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { SettingsPickerPanel } from "./SettingsPickerPanel";
import { SettingsExpandRow } from "./SettingsExpandRow";
import { SettingsGroup } from "./SettingsGroup";

/**
 * **تخصيصُ ما يظهر لك** (D-545، مواصفةُ أحمد المكتوبة).
 *
 * ================= أربعةُ حقولٍ ومصنعٌ واحد =================
 *
 * **الأقسامُ أربعةٌ والسلوكُ واحد**: قائمةٌ فيها بحث، ورقائقُ مختارةٌ
 * تُحذف بضغطة. **فمصنعٌ واحدٌ (`SettingsPickerPanel`) يرسم الأربعة** —
 * **ورابعُ نسخةٍ من نفس الرسم هو كيف يفترق حقلٌ عن أخيه عند أوّل
 * تعديل** (D-145/القاعدة ٦).
 *
 * ⚠️ **واللغاتُ المفضّلةُ وحدَها مرتَّبة**: **ترتيبُ المصفوفة معنًى**
 * (الأولى أعلى أولويّة)، **فلها سهما رفعٍ وخفض** — **والسحبُ الحرُّ
 * تُركَ عمداً** (تنازعُ التمرير على الجوّال — حجّةُ `ListDetail`).
 *
 * ⚠️ **ومنعُ التعارض في ثلاث طبقات** (D-177): **الواجهةُ تُخفي الخيارَ
 * من القائمة المقابلة**، **والفعلُ يُنقّي قبل الكتابة**، **والقاعدةُ
 * ترفض الصفَّ بقيدٍ** (الهجرة ١٢٦). **حارسٌ على طرفٍ واحد ليس حارساً.**
 *
 * ================= 🆕 والأوراقُ صارت توسّعاً في المكان (D-590) =================
 *
 * **طلبُ أحمد بلقطتين**: صحٌّ على «حجم الواجهة» المتوسّع في مكانه،
 * وشطبٌ على ورقة «أظهر لي أقلّ» — **«كل الإعدادات خلّها مثل كذا: تضغط
 * وتنزل مكانها».**
 *
 * ⚖️ **وهو نقضٌ لشطر قاعدة D-569 بحكمه** («المتعدّدُ الذي يُبحث فيه
 * يبقى ورقةً») — **والصفوفُ الأربعةُ الآن تفتح لوحَها تحتها**:
 * الصفُّ فوق خياراته، **وقيمتُه في طرفه تتبدّل تحت عينك مع كلِّ
 * ضغطة** — وهو ما كانت الورقةُ تحجبه.
 *
 * ⚠️ **وسقوطُ المسوّدة لا يُسقط حجّتَها**: «عشرُ ضغطاتٍ عشرُ كتاباتٍ
 * إلى الخادم» (D-555) **ما زالت صحيحة** — **فالكتابةُ مؤجَّلةٌ لا
 * فوريّة**: كلُّ ضغطةٍ تُحدِّث الشاشةَ في لحظتها، **والخادمُ يُكتب
 * مرّةً واحدةً بعد سكونٍ قصير** (والطيُّ والمغادرةُ يدفعانها فوراً).
 * **فعينُ أحمد ترى كلَّ ضغطة، والخادمُ يرى حصيلتَها.**
 */

/** سكونُ الكتابة — ضغطاتٌ متتابعةٌ تُجمع في كتابةٍ واحدة */
const COMMIT_QUIET_MS = 800;

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
  /** أيُّ لوحٍ مفتوح — **واحدٌ لا أربعة**، والفتحُ يطوي أخاه */
  const [open, setOpen] = useState<
    "genres" | "unwantedGenres" | "languages" | "excludedLanguages" | null
  >(null);

  /* ===== الكتابةُ المؤجَّلة — انظر رأسَ الملفّ =====
     `latest` ما تراه العين، و`saved` ما أكّده الخادم — **والفشلُ يعيد
     الشاشةَ إلى المؤكَّد** لا إلى ما قبل الضغطة الأخيرة وحدَها. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<ContentPrefs>(initial);
  const saved = useRef<ContentPrefs>(initial);

  function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = latest.current;
    if (next === saved.current) return;
    start(async () => {
      try {
        await setContentPrefs(next);
        saved.current = next;
        router.refresh();
      } catch {
        latest.current = saved.current;
        setPrefs(saved.current);
        toast(t.errSaveShort, { tone: "error" });
      }
    });
  }

  function commit(next: ContentPrefs) {
    const clean = sanitizeContentPrefs(next);
    setPrefs(clean);
    latest.current = clean;
    tap(6);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, COMMIT_QUIET_MS);
  }

  /* مغادرةُ الصفحة قبل السكون — تُدفع الكتابةُ المعلَّقة، ولو بلا
     انتظارِ ردٍّ: أفضلُ جهدٍ خيرٌ من ضياعِ الاختيار. */
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (latest.current !== saved.current) {
          void setContentPrefs(latest.current).catch(() => {});
        }
      }
    };
  }, []);

  function togglePanel(
    key: "genres" | "unwantedGenres" | "languages" | "excludedLanguages",
  ) {
    /* الطيُّ أو الانتقالُ للوحٍ آخر يدفع المعلَّق — فلا كتابةَ تتأخّر
       أكثرَ من عمرِ اللوح الذي وُلدت فيه */
    flush();
    setOpen((v) => (v === key ? null : key));
  }

  /** **رقمُ المفهوم القانونيّ** — أوّلُ أرقامه، وبه يُخزَّن (D-545) */
  const idOf = (g: BrowseGenre) => (g.movie[0] ?? g.tv[0])!;
  const nameOf = (id: number) => {
    const g = BROWSE_GENRES.find((x) => (x.movie[0] ?? x.tv[0]) === id)
      ?? BROWSE_GENRES.find((x) => x.movie.includes(id) || x.tv.includes(id));
    return g ? browseGenreName(g, loc) : String(id);
  };

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

  const panelLabels = {
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
        <SettingsExpandRow
          icon="plus"
          title={t.cpShowMore}
          value={short(prefs.genres.map(nameOf))}
          open={open === "genres"}
          onToggle={() => togglePanel("genres")}
        >
          <SettingsPickerPanel
            options={genreOptions(prefs.unwantedGenres)}
            value={prefs.genres.map(String)}
            onChange={(next) => applyNums("genres", next.map(Number))}
            labels={{ ...panelLabels, search: t.cpSearchGenres }}
          />
        </SettingsExpandRow>
        <SettingsExpandRow
          icon="eye-off"
          title={t.cpShowLess}
          value={short(prefs.unwantedGenres.map(nameOf))}
          open={open === "unwantedGenres"}
          onToggle={() => togglePanel("unwantedGenres")}
        >
          <SettingsPickerPanel
            options={genreOptions(prefs.genres)}
            value={prefs.unwantedGenres.map(String)}
            onChange={(next) => applyNums("unwantedGenres", next.map(Number))}
            labels={{ ...panelLabels, search: t.cpSearchGenres }}
          />
        </SettingsExpandRow>
      </SettingsGroup>

      <SettingsGroup label={t.cpLangsTitle}>
        <SettingsExpandRow
          icon="compass"
          title={t.cpPreferred}
          value={short(prefs.languages.map((code) => langName(code, loc)))}
          open={open === "languages"}
          onToggle={() => togglePanel("languages")}
        >
          <SettingsPickerPanel
            options={langOptions(prefs.excludedLanguages)}
            value={prefs.languages}
            ordered
            onChange={(next) => applyLangs("languages", next)}
            labels={{ ...panelLabels, search: t.cpSearchLangs }}
          />
        </SettingsExpandRow>
        <SettingsExpandRow
          icon="eye-off"
          title={t.cpExcluded}
          value={short(prefs.excludedLanguages.map((code) => langName(code, loc)))}
          open={open === "excludedLanguages"}
          onToggle={() => togglePanel("excludedLanguages")}
        >
          <SettingsPickerPanel
            options={langOptions(prefs.languages)}
            value={prefs.excludedLanguages}
            onChange={(next) => applyLangs("excludedLanguages", next)}
            labels={{ ...panelLabels, search: t.cpSearchLangs }}
          />
        </SettingsExpandRow>
      </SettingsGroup>

      {!signedIn && (
        <p className="px-1 text-12 text-muted leading-relaxed">{t.cpGuestNote}</p>
      )}
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
