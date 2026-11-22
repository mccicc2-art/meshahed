"use client";

import { useState } from "react";
import { getDict, num, type Locale } from "@/core/i18n";
import { AUTO_ROLES, needsMedia, type AutoOptions, type AutoRole, type AutoTable, type KnownSource } from "@/core/importAuto";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { chipClass, segmentedItem, segmentedTrackFull, sheetScroll } from "./ui/controls";

/**
 * ====== 🆕 T500 — «هكذا فهمنا ملفّك» (مراجعةُ المستورد العامّ) ======
 *
 * أحمد ٢١ نوفمبر «1أ 2أ نفذ»: ملفٌّ من تطبيقٍ لا نعرفه تُخمَّن معاني أعمدته (`core/importAuto`) — **والتخمينُ الخاطئ يكتب في مكتبة
 * صاحبه**، فلا يُكتب شيءٌ قبل أن يرى ما فهمناه ويصحّحه. لكلِّ عمودٍ صفٌّ: اسمُه كما في الملفّ وقيمتان منه ومعناه رقاقة؛ الضغطُ يفتح
 * رقاقاتِ المعاني كلَّها، والمعنى لعمودٍ واحد (من أعطاه لعمودٍ ثانٍ نُزع من الأوّل). وفوقها سؤالان حين يلزمان: نوعُ الأعمال لملفٍّ لا
 * يقوله، ومعنى صفٍّ بلا حالة.
 * **عائلتا التحكّم وحدهما**: المقسّمُ (`segmentedItem`) للسؤالين والرقاقةُ (`chipClass`) للمعاني — والورقةُ ورقةُ الإعدادات بزرَّيها.
 * التطبيقُ يرسم الشاشةَ نفسَها من الوصفة نفسِها (`apps/mobile/src/settings/ImportAutoReview.tsx`).
 */
export function ImportAutoReview({
  locale,
  tables: initial,
  skipped,
  onCancel,
  onImport,
  onPickSource,
}: {
  locale: Locale;
  tables: AutoTable[];
  skipped: string[];
  onCancel: () => void;
  onImport: (tables: AutoTable[], opts: AutoOptions) => void;
  /** 🆕 T507 — «الملف من تطبيقٍ نعرفه؟»: ملفٌّ لم يتعرّف عليه الكاشفُ (TV Time بصيغته الأخيرة مثلاً) يُقرأ بقارئ تطبيقه */
  onPickSource?: (source: KnownSource) => void;
}) {
  const t = getDict(locale);
  const [tables, setTables] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [media, setMedia] = useState<AutoOptions["media"] | null>(null);
  const [status, setStatus] = useState<AutoOptions["status"]>("watched");
  const named = (x: AutoTable) => x.roles.some((r) => r === "title" || r === "show" || r === "imdb" || r === "tmdb" || r === "tvdb");
  const usable = tables.filter(named);
  const askMedia = usable.some(needsMedia);
  const ready = usable.length > 0 && (!askMedia || media != null);

  const setRole = (ti: number, col: number, role: AutoRole) =>
    setTables((all) =>
      all.map((x, i) =>
        i !== ti ? x : { ...x, roles: x.roles.map((r, c) => (c === col ? role : role !== "skip" && r === role ? "skip" : r)) },
      ),
    );

  const seg = <V extends string>(label: string, value: V | null, items: [V, string][], set: (v: V) => void) => (
    <div>
      <p className="text-12 font-semibold text-muted mb-1">{label}</p>
      <div role="tablist" aria-label={label} className={segmentedTrackFull}>
        {items.map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => set(v)} className={segmentedItem(value === v, "flex-1 basis-0 min-w-0")}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <SettingsBottomSheet
      open
      title={t.importAutoReviewTitle}
      onCancel={onCancel}
      onDone={() => ready && onImport(usable, { media: media ?? "movie", status })}
      cancelLabel={t.cancelLabel}
      doneLabel={t.importAutoGo}
      doneDisabled={!ready}
    >
      <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4`}>
        <p className="text-12 text-muted leading-relaxed">{t.importAutoReviewHint}</p>
        {askMedia && seg(t.importAutoMediaLabel, media, [["movie", t.importAutoMovies], ["tv", t.importAutoShows]], setMedia)}
        {seg(t.importAutoStatusLabel, status, [["watched", t.importAutoWatched], ["plan", t.importAutoPlan]], setStatus)}
        {askMedia && media == null && <p className="text-12 text-[color:var(--error)]">{t.importAutoNeedMedia}</p>}
        {/* 🆕 T507 — «المراجعة» لا يختارها التخمين أبداً؛ ومن اختارها يُقال له قبل الاستيراد إنها تظهر للناس */}
        {tables.some((x) => x.roles.includes("review")) && <p className="text-12 leading-relaxed text-muted">{t.importAutoReviewPublic}</p>}
        {onPickSource && (
          <div>
            <p className="text-12 font-semibold text-muted mb-1">{t.importAutoFromApp}</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["imdb", t.importImdbTitle],
                  ["mal", t.importMalTitle],
                  ["letterboxd", t.importLetterboxdTitle],
                  ["simkl", t.importSimklTitle],
                  ["bingers", t.importBingersTitle],
                  ["tvtime", t.importTvTimeTitle],
                ] as [KnownSource, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" onClick={() => onPickSource(id)} className={chipClass(false, "sm")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tables.map((x, ti) => (
          <section key={x.file} className="rounded-control border border-border bg-surface-2 overflow-hidden">
            <div className="flex items-baseline gap-2 px-3 py-2 border-b border-[color:var(--divider)]">
              <b dir="ltr" className="text-12 font-bold truncate min-w-0">{x.file}</b>
              <span className="ms-auto shrink-0 text-[11px] text-muted">{t.importAutoRows(num(x.rows.length, locale))}</span>
            </div>
            {!named(x) && <p className="px-3 pt-2 text-12 text-[color:var(--error)]">{t.importAutoNoName}</p>}
            <ul>
              {x.headers.map((h, col) => {
                const key = `${ti}:${col}`;
                const role = x.roles[col];
                const samples = x.rows.map((r) => r[col]).filter(Boolean).slice(0, 2);
                return (
                  <li key={key} className="border-b last:border-b-0 border-[color:var(--divider)]">
                    <button type="button" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start">
                      <span className="min-w-0 flex-1">
                        <span className="block text-14 font-semibold truncate">{h || "—"}</span>
                        <span className="block text-12 text-muted truncate">{samples.join(" · ") || "—"}</span>
                      </span>
                      <span className={chipClass(role !== "skip", "sm", "shrink-0")}>{t.importAutoRoles[role]}</span>
                    </button>
                    {open === key && (
                      <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                        {AUTO_ROLES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={role === r}
                            onClick={() => {
                              setRole(ti, col, r);
                              setOpen(null);
                            }}
                            className={chipClass(role === r, "sm")}
                          >
                            {t.importAutoRoles[r]}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {skipped.length > 0 && <p dir="auto" className="text-[11px] text-muted break-words">{t.importAutoSkipped(skipped.join(" · "))}</p>}
      </div>
    </SettingsBottomSheet>
  );
}
