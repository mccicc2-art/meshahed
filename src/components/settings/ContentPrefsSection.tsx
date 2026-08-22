"use client";

import { useMemo, useState, useTransition } from "react";
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
import { normalizeSearch } from "@/lib/arabic";
import { sanitizeContentPrefs, type ContentPrefs } from "@/lib/contentPrefs";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { Icon } from "../Icon";
import { chipClass } from "../ui/controls";

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
 */

type Key = string;

/** رقاقةٌ مختارةٌ تُحذف بضغطة — **شكلٌ واحدٌ للحقول الأربعة** */
function PickedChip({
  label,
  onRemove,
  ariaLabel,
}: {
  label: string;
  onRemove: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className={chipClass(true, "sm", "gap-1.5 ps-2.5 pe-2")}
    >
      <span dir="auto">{label}</span>
      <Icon name="close" size={12} strokeWidth={2.4} />
    </button>
  );
}

function Picker({
  title,
  hint,
  searchLabel,
  emptyLabel,
  noMatchLabel,
  options,
  picked,
  onToggle,
  removeAria,
  addAria,
  ordered,
  orderLabels,
  onMove,
}: {
  title: string;
  hint: string;
  searchLabel: string;
  emptyLabel: string;
  noMatchLabel: string;
  /** كلُّ ما يمكن اختياره — **بعد طرح ما اختاره في الحقل المقابل** */
  options: { key: Key; label: string }[];
  picked: { key: Key; label: string }[];
  onToggle: (key: Key) => void;
  removeAria: (name: string) => string;
  addAria: (name: string) => string;
  /** **الترتيبُ معنًى؟** — للّغات المفضّلة وحدَها */
  ordered?: boolean;
  orderLabels?: { up: string; down: string };
  onMove?: (index: number, delta: -1 | 1) => void;
}) {
  const [q, setQ] = useState("");

  /* **البحثُ بالمطبِّع العربيّ** (D-350): من كتب «كوميدي» يجد
     «كوميدي»، ومن كتب «انمي» بلا همزة يجد ما فيه همزة. */
  const shown = useMemo(() => {
    const needle = normalizeSearch(q.trim());
    if (!needle) return options;
    return options.filter((o) => normalizeSearch(o.label).includes(needle));
  }, [q, options]);

  return (
    <div>
      <h3 className="text-14 font-bold">{title}</h3>
      <p className="text-12 text-muted leading-relaxed mt-0.5 mb-2.5">{hint}</p>

      {/* ===== المختار ===== */}
      {picked.length === 0 ? (
        <p className="text-12 text-muted mb-2.5">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {picked.map((p, i) => (
            <span key={p.key} className="inline-flex items-center gap-1">
              {ordered && onMove && orderLabels && (
                <span className="inline-flex">
                  <button
                    type="button"
                    onClick={() => onMove(i, -1)}
                    disabled={i === 0}
                    aria-label={`${orderLabels.up} — ${p.label}`}
                    className="grid place-items-center w-11 h-11 text-muted hover:text-foreground disabled:opacity-30 transition"
                  >
                    <Icon name="chevron-up" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(i, 1)}
                    disabled={i === picked.length - 1}
                    aria-label={`${orderLabels.down} — ${p.label}`}
                    className="grid place-items-center w-11 h-11 text-muted hover:text-foreground disabled:opacity-30 transition"
                  >
                    <Icon name="chevron-down" size={16} />
                  </button>
                </span>
              )}
              <PickedChip
                label={ordered ? `${i + 1}. ${p.label}` : p.label}
                ariaLabel={removeAria(p.label)}
                onRemove={() => onToggle(p.key)}
              />
            </span>
          ))}
        </div>
      )}

      {/* ===== البحث ثمّ القائمة ===== */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
        dir="auto"
        className="no-focus-ring w-full rounded-xl bg-surface-2 border border-border px-3 py-2 text-14 outline-none transition mb-2"
      />
      <div className="flex flex-wrap gap-2">
        {shown.length === 0 ? (
          <p className="text-12 text-muted">{noMatchLabel}</p>
        ) : (
          shown.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onToggle(o.key)}
              aria-label={addAria(o.label)}
              className={chipClass(false, "sm")}
            >
              <span dir="auto">{o.label}</span>
            </button>
          ))
        )}
      </div>
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
    setPrefs(clean);
    tap(8);
    start(async () => {
      try {
        await setContentPrefs(clean);
        router.refresh();
      } catch {
        setPrefs(prefs);
      }
    });
  }

  const toggleNum = (list: "genres" | "unwantedGenres", id: number) => {
    const has = prefs[list].includes(id);
    const next = { ...prefs, [list]: has ? prefs[list].filter((x) => x !== id) : [...prefs[list], id] };
    /* **الاختيارُ يطرد المقابل** — فلا يصل تعارضٌ إلى القاعدة أصلاً */
    if (!has) {
      const other = list === "genres" ? "unwantedGenres" : "genres";
      next[other] = prefs[other].filter((x) => x !== id);
    }
    commit(next);
  };

  const toggleLang = (list: "languages" | "excludedLanguages", code: string) => {
    const has = prefs[list].includes(code);
    const next = { ...prefs, [list]: has ? prefs[list].filter((x) => x !== code) : [...prefs[list], code] };
    if (!has) {
      const other = list === "languages" ? "excludedLanguages" : "languages";
      next[other] = prefs[other].filter((x) => x !== code);
    }
    commit(next);
  };

  const move = (i: number, delta: -1 | 1) => {
    const arr = [...prefs.languages];
    const j = i + delta;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit({ ...prefs, languages: arr });
  };

  const genreOptions = (exclude: number[], picked: number[]) =>
    BROWSE_GENRES.map((g) => ({ key: String(idOf(g)), label: browseGenreName(g, loc), id: idOf(g) }))
      .filter((o) => !picked.includes(o.id) && !exclude.includes(o.id))
      .map(({ key, label }) => ({ key, label }));

  const langOptions = (exclude: string[], picked: string[]) =>
    ALL_LANGS.filter((l) => !picked.includes(l.code) && !exclude.includes(l.code)).map((l) => ({
      key: l.code,
      label: langName(l.code, loc),
    }));

  return (
    <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5 space-y-6">
      <div>
        <h2 className="text-15 font-bold mb-1">{t.cpSection}</h2>
        <p className="text-12 text-muted leading-relaxed">{t.cpHint}</p>
        {!signedIn && <p className="text-12 text-muted leading-relaxed mt-1">{t.cpGuestNote}</p>}
      </div>

      <Picker
        title={t.cpLikedGenres}
        hint={t.cpLikedGenresHint}
        searchLabel={t.cpSearchGenres}
        emptyLabel={t.cpNothing}
        noMatchLabel={t.cpNoMatch}
        options={genreOptions(prefs.unwantedGenres, prefs.genres)}
        picked={prefs.genres.map((id) => ({ key: String(id), label: nameOf(id) }))}
        onToggle={(k) => toggleNum("genres", Number(k))}
        removeAria={t.cpRemoveAria}
        addAria={t.cpAddAria}
      />

      <Picker
        title={t.cpUnwantedGenres}
        hint={t.cpUnwantedGenresHint}
        searchLabel={t.cpSearchGenres}
        emptyLabel={t.cpNothing}
        noMatchLabel={t.cpNoMatch}
        options={genreOptions(prefs.genres, prefs.unwantedGenres)}
        picked={prefs.unwantedGenres.map((id) => ({ key: String(id), label: nameOf(id) }))}
        onToggle={(k) => toggleNum("unwantedGenres", Number(k))}
        removeAria={t.cpRemoveAria}
        addAria={t.cpAddAria}
      />

      <Picker
        title={t.cpLikedLangs}
        hint={t.cpLikedLangsHint}
        searchLabel={t.cpSearchLangs}
        emptyLabel={t.cpNothing}
        noMatchLabel={t.cpNoMatch}
        options={langOptions(prefs.excludedLanguages, prefs.languages)}
        picked={prefs.languages.map((c) => ({ key: c, label: langName(c, loc) }))}
        onToggle={(k) => toggleLang("languages", k)}
        removeAria={t.cpRemoveAria}
        addAria={t.cpAddAria}
        ordered
        orderLabels={{ up: t.cpLangUp, down: t.cpLangDown }}
        onMove={move}
      />

      <Picker
        title={t.cpExcludedLangs}
        hint={t.cpExcludedLangsHint}
        searchLabel={t.cpSearchLangs}
        emptyLabel={t.cpNothing}
        noMatchLabel={t.cpNoMatch}
        options={langOptions(prefs.languages, prefs.excludedLanguages)}
        picked={prefs.excludedLanguages.map((c) => ({ key: c, label: langName(c, loc) }))}
        onToggle={(k) => toggleLang("excludedLanguages", k)}
        removeAria={t.cpRemoveAria}
        addAria={t.cpAddAria}
      />

      {/* **زرُّ إعادة الضبط في الذيل** — فعلٌ هادمٌ لا يجلس فوق ما يهدم */}
      <button
        type="button"
        onClick={() => {
          commit({ genres: [], unwantedGenres: [], languages: [], excludedLanguages: [] });
          toast(t.cpResetDone, { tone: "success" });
        }}
        className="text-12 font-semibold text-muted hover:text-foreground transition"
      >
        {t.cpReset}
      </button>
    </section>
  );
}
