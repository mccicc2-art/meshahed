"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSmartList, updateSmartListRule } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { openPlusGate } from "@/lib/plusGate";
import { BROWSE_ERAS, BROWSE_GENRES, genreFitsType } from "@/lib/browse";
import { LIBRARY_STATUSES, type LibraryStatus } from "@/lib/libraryStatus";
import { MY_RATING_MIN, libraryTabToRuleType } from "@/lib/smartListKeys";
import { FILTER_NAME_MAX, sanitizeFilterName } from "@/lib/savedFilters";
import { buttonClass } from "./ui/Button";
import { chipClass, chipRow } from "./ui/controls";
import { Icon } from "./Icon";

/**
 * ====== قائمةٌ ذكيّةٌ من المكتبة — البابُ (D-876) ======
 *
 * **حكمُ أحمد**: «بابها ورقة أدوات المكتبة» — **فهي قسمٌ في تبويب «أدوات»
 * تحت «قائمة جديدة»**: **الشرطُ يُبنى حيث تُدار المكتبة**، **لا في ورقةِ
 * شروطٍ ثانيةٍ بلغةٍ ثانية** (D-145 — نفسُ حجّةِ بابِ اكتشف في D-823).
 *
 * 🔑 **والمحاورُ رقائقُ العائلة الواحدة** (القاعدة ٣): **حالةٌ · تقييمي ·
 * تصنيفٌ · حقبة** — **والنوعُ من تبويب المكتبة الحاليّ لا من رقاقة**:
 * **من فتح الورقةَ في «أفلامي» يصنع قائمةَ أفلام** (D-816: التبويبُ هو
 * القسم). **ولا لغةَ ولا بلد هنا**: **قائمتاهما طويلتان وورقةُ الأدوات
 * قصيرة** — **والمطهِّرُ يقبلهما** فتُبنى رقاقتاهما يومَ يُطلبا.
 *
 * **والتحريرُ الوصفةُ نفسُها التي في اكتشف** (D-875): **`editing` حاضرةٌ ⇒
 * الشرطُ مُسبَق والزرُّ «حدِّث «الاسم»»** — بابٌ واحدٌ بفعلين.
 *
 * 🔒 **وبلس** — **والحارسُ في الخادم وحدَه** (D-819/D-821): **لا علمَ
 * `plus` يُمرَّر هنا** لأن صفحةَ المكتبة لا تقرأ الملفَّ إلّا في تبويب
 * «القوائم» (D-128: الثقيلُ مشروطٌ بتبويبه) — **والخادمُ يردّ `needsPlus`
 * فتُفتح البوّابة**: **رحلةٌ واحدةٌ عند ضغطةٍ نادرة أرخصُ من ملفٍّ في كلِّ
 * فتحة.**
 */
export function LibrarySmartForm({
  locale,
  libraryTab = null,
  editing = null,
  onDone,
}: {
  locale: Locale;
  /**
   * تبويبُ المكتبة الحاليّ — **هو نوعُ الشرط** حين يكون له نوع.
   * 🆕 **وغيابُه (D-877: البابُ في تبويب «قوائمي»)** يرسم صفَّ النوع
   * رقائقَ أوّلاً — **فالمستخدمُ يختار نوعَه حيث لا تبويبَ يختاره عنه.**
   */
  libraryTab?: string | null;
  /** قائمةٌ يُعدَّل شرطُها — من `/library?edit=<id>` بعد أن حسمها الخادم */
  editing?: { id: string; name: string; rule: Record<string, string> } | null;
  onDone?: () => void;
}) {
  const t = getDict(locale);
  const ar = locale !== "en";
  const router = useRouter();
  const [, start] = useTransition();
  const [status, setStatus] = useState<LibraryStatus | null>(
    (editing?.rule.wst as LibraryStatus | undefined) ?? null,
  );
  const [my, setMy] = useState<string | null>(editing?.rule.my ?? null);
  const [genre, setGenre] = useState<string | null>(editing?.rule.g ?? null);
  const [era, setEra] = useState<string | null>(editing?.rule.era ?? null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [pickedType, setPickedType] = useState<"movie" | "tv" | "all" | null>(null);

  /* **النوعُ من التبويب إن كان له نوع، وإلّا من رقاقةٍ يختارها** (D-877):
     **كان المكوّنُ يعود `null` في تبويبٍ بلا نوع** — **وصار البابُ في
     «قوائمي» نفسِه**، فصفُّ النوع أوّلُ الصفوف. **والتحريرُ يثبّت نوعَه.** */
  const tabType = libraryTab ? libraryTabToRuleType(libraryTab) : null;
  const type = (editing?.rule.type as "movie" | "tv" | "all" | undefined) ?? tabType ?? pickedType;
  const genres = useMemo(
    () =>
      type
        ? BROWSE_GENRES.filter((g) => genreFitsType(g, type === "all" ? "all" : type === "tv" ? "tv" : "movie"))
        : [],
    [type],
  );

  const rule: Record<string, string> = type ? { type } : {};
  if (status) rule.wst = status;
  if (my) rule.my = my;
  if (genre) rule.g = genre;
  if (era) rule.era = era;
  /* **شرطٌ = نوعٌ + محورٌ واحدٌ على الأقلّ**: قائمةُ «كلُّ أفلامي» ليست
     ذكيّةً، هي تبويبُ الأفلام. */
  const hasRule = !!type && Object.keys(rule).length > 1;

  const statusLabel: Record<LibraryStatus, string> = {
    unstarted: t.libStatusUnstarted,
    watching: t.libStatusWatching,
    completed: t.libStatusCompleted,
    dropped: t.libStatusDropped,
  };

  function pick<T>(set: (v: T | null) => void, cur: T | null, v: T) {
    tap(8);
    set(cur === v ? null : v);
  }

  function submit() {
    if (!hasRule) {
      flashError(t.librarySmartNeedsRule);
      return;
    }
    start(async () => {
      try {
        if (editing) {
          const res = await updateSmartListRule(editing.id, rule);
          if (res.needsPlus) return openPlusGate();
          toast(t.smartListUpdated, { tone: "success" });
          onDone?.();
          router.push(`/lists/${editing.id}`);
          return;
        }
        const clean = sanitizeFilterName(name);
        if (!clean) return;
        const res = await createSmartList(clean, rule, "library");
        if (res.needsPlus) return openPlusGate();
        toast(t.librarySmartCreated, { tone: "success" });
        onDone?.();
        if (res.id) router.push(`/lists/${res.id}`);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const row = (label: string, children: React.ReactNode) => (
    <div>
      <span className="block text-12 text-muted mb-1.5">{label}</span>
      <div className={`${chipRow} flex items-center gap-2`}>{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <span className="block text-12 font-bold text-muted">
        <Icon name="sparkle-star" size={12} className="inline-block align-[-1px] me-1 text-accent" />
        {editing ? t.smartListEditHint(editing.name) : t.librarySmartGroup}
      </span>
      {!editing && <p className="text-12 text-muted -mt-2 leading-relaxed">{t.librarySmartHint}</p>}

      {/* 🆕 **صفُّ النوع حين لا تبويبَ يقرّره** (D-877) — **ولا يُرسم حيث
          يقرّره التبويب**: رقاقةٌ تكرّر ما يقوله التبويبُ فوقها ضجيج (D-138). */}
      {!editing && !tabType &&
        row(
          t.librarySmartType,
          (
            [
              { v: "movie", label: t.shortMovies },
              { v: "tv", label: t.shortShows },
              { v: "all", label: t.discoverTabAnime },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => pick(setPickedType, pickedType, o.v)}
              className={chipClass(pickedType === o.v, "sm", "shrink-0")}
            >
              {o.label}
            </button>
          )),
        )}

      {row(
        t.librarySmartStatus,
        LIBRARY_STATUSES.filter((s) => type !== "movie" || s !== "watching").map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pick(setStatus, status, s)}
            className={chipClass(status === s, "sm", "shrink-0")}
          >
            {statusLabel[s]}
          </button>
        )),
      )}
      {row(
        t.librarySmartMyRating,
        MY_RATING_MIN.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pick(setMy, my, n)}
            className={chipClass(my === n, "sm", "shrink-0")}
          >
            {`${n}+`}
          </button>
        )),
      )}
      {row(
        t.librarySmartGenre,
        genres.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => pick(setGenre, genre, g.slug)}
            className={chipClass(genre === g.slug, "sm", "shrink-0")}
          >
            {ar ? g.ar : g.en}
          </button>
        )),
      )}
      {row(
        t.librarySmartEra,
        /* **«القادم» لا معنى له في مكتبةٍ تملكها** — يسقط من الرقائق ويقبله المطهِّر */
        BROWSE_ERAS.filter((e) => !e.upcoming).map((e) => (
          <button
            key={e.slug}
            type="button"
            onClick={() => pick(setEra, era, e.slug)}
            className={chipClass(era === e.slug, "sm", "shrink-0")}
          >
            {ar ? e.ar : e.en}
          </button>
        )),
      )}

      {editing ? (
        <button
          type="button"
          onClick={submit}
          disabled={!hasRule}
          className={buttonClass({ size: "sm", className: "w-full" })}
        >
          {t.smartListUpdate(editing.name)}
        </button>
      ) : naming ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setNaming(false);
            }}
            maxLength={FILTER_NAME_MAX}
            placeholder={ar ? "سمِّ القائمة الذكيّة" : "Name this smart list"}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-14 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!sanitizeFilterName(name)}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            {ar ? "حفظ" : "Save"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (hasRule ? setNaming(true) : flashError(t.librarySmartNeedsRule))}
          className={chipClass(false, "sm", "inline-flex items-center gap-1.5")}
        >
          <Icon name="sparkle-star" size={12} />
          {t.smartListLabel}
        </button>
      )}
    </div>
  );
}
