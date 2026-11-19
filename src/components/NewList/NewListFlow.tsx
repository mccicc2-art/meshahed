"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getDict, type Locale } from "@/core/i18n";
import { ruleTypes, toggleRuleType, parseMix, defaultMix, stepMix, mixCan, formatMix, type SmartType } from "@/core/smartListKeys";
import { posterUrl, POSTER_INTRINSIC } from "@/core/media";
import {
  hideChipText,
  isCatalogSource,
  PICK_AXES_CATALOG,
  axisLabels,
  axisOptions,
  chipText,
  filterPicker,
  newListSources,
  PICK_AXES,
  ruleHasLimit,
  SMART_AXES_CATALOG,
  SMART_AXES_LIBRARY,
  sourceLabel,
  withAxis,
  withType,
  withTypeMix,
  type NewListAxis,
  type NewListOpt,
  type NewListSource,
  type NewListTab,
} from "@/core/newList";
import type { PickerItem } from "@/core/contracts/library";
import { Icon } from "@/components/Icon";
import { BackButton } from "@/components/BackButton";
import { buttonClass } from "@/components/ui/Button";
import { chipClass, segmentedTrackFull, segmentedItem } from "@/components/ui/controls";
import { ToggleRow } from "@/components/ui/SectionOrderList";
import { Stepper } from "@/components/ui/Stepper";
import { ListCardShell } from "@/components/PublicListsRail";
import { createListFull, createSmartList, previewSmartList, addItemsToList, updateSmartListRule } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";

/**
 * ====== 🆕 T450 — صفحةُ «قائمة جديدة» (الويب) ======
 *
 * أحمد ١٩ نوفمبر: «نبي قوائم ذكية ف اكتشف … موجوده ف تراكت» ثمّ «تعب يقعد يكتب عمل عمل» ثمّ «هل نترك الانبثاق ذا
 * وندخل على صفحة» — **صفحةٌ لا ورقة**: الاختيارُ عشراتُ ملصقاتٍ وبحثٌ وفلاتر، والورقةُ مسقوفةُ الطول.
 *
 * - **مفتاحٌ واحد** (`segmented` — عائلةُ التبويبات نفسُها): «قائمة | قائمة ذكيّة».
 * - **«قائمة» بخطوتين**: الملصقاتُ أوّلاً (لا الاسم — الاسمُ يُعرف بعد أن ترى ما جمعتَه)، ثمّ التفاصيل.
 * - **«قائمة ذكيّة»**: الشروطُ رقائقُ تنفتح خياراتُها تحت صفّها (D-1550 — وصفةُ ورقة فلاتر «اكتشف»)، ومعاينةٌ حيّة
 *   بالقارئ نفسِه الذي تُفتح به القائمةُ بعد إنشائها (`previewSmartList` ← `evaluateSmartRule`).
 * - **`from="library"`**: الصفحةُ نفسُها مقيّدةً بمكتبتك («خلها نفس الواجهة لاكن فقط يقدر من مكتبته») — بلا «للمشاهدة»
 *   (أحمد: «واتش ليست لا لانه ما شافها») ولا بحثٍ خارجها، والذكيّةُ بمفردات المكتبة.
 * - **`addTo`**: «أضف أعمالاً» في صفحة قائمةٍ قائمة يفتح الخطوةَ الأولى وحدَها، وزرُّها يضيف الدفعة.
 * - **لا ألوانَ للغلاف** (D-848 — حكمُ أحمد بحذفها): الغلافُ ملصقاتُ القائمة، ويُغيَّر بصورةٍ من صفحتها.
 */

type Tab = NewListTab;
type Source = NewListSource;
type Axis = NewListAxis;
type Opt = NewListOpt;
type Pick = { id: number; kind: "tv" | "movie"; title: string; poster_path: string | null };

const keyOf = (x: { id: number; kind: string }) => `${x.kind}-${x.id}`;
const PAGE = 60;

export function NewListFlow({
  locale,
  from,
  initialTab,
  addTo,
  editing = null,
  items,
}: {
  locale: Locale;
  from: "discover" | "library";
  initialTab: Tab;
  addTo: { id: string; name: string } | null;
  /** 🆕 T454 — تعديلُ شرطِ قائمةٍ ذكيّةٍ قائمة: «قائمة ذكيّة» وحدَها، مملوءةً بشرطها، وزرُّها «حدّث القائمة» */
  editing?: { id: string; name: string; rule: Record<string, string> } | null;
  items: PickerItem[];
}) {
  const t = getDict(locale);
  const ar = locale !== "en";
  const router = useRouter();
  const library = from === "library";
  const [tab, setTab] = useState<Tab>(addTo ? "list" : initialTab);
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, start] = useTransition();

  /* ===== الخطوةُ الأولى — الاختيار ===== */
  const [selected, setSelected] = useState<Map<string, Pick>>(new Map());
  const [source, setSource] = useState<Source>(library ? "recent" : "pop");
  const [filters, setFilters] = useState<Partial<Record<Axis, string>>>({});
  const [open, setOpen] = useState<Axis | null>(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  /* 🆕 T454 — الكتالوجُ بصفحاتٍ تكبر بـ«المزيد» (٤٠ ← ١٢٠) */
  const [n, setN] = useState(40);

  const term = q.trim();
  const searching = term.length >= 2;
  /* «اكتشف» يقرأ الكتالوجَ للأشهر والأعلى والأحدث وللبحث كلِّه؛ «من مكتبتي» والمكتبةُ تُصفّى في الجهاز */
  /* الكتالوجُ يُسأل في خطوة الاختيار وحدَها — لا من تبويب «قائمة ذكيّة» ولا من صفحة التعديل */
  const catalog = !library && !editing && tab === "list" && (isCatalogSource(source) || searching);
  const axes = catalog ? PICK_AXES_CATALOG : PICK_AXES;

  /* نتيجةُ الكتالوج **موسومةٌ بطلبها** (`key`): «يحمّل» = لا نتيجةَ لهذا الطلب بعدُ — مشتقٌّ لا حالةٌ تُقلب في أثر */
  const catalogKey = catalog
    ? JSON.stringify({ src: isCatalogSource(source) ? source : "pop", type: filters.type, g: filters.g, era: filters.era, rate: filters.rate, q: searching ? term : "", n })
    : "";
  const [remote, setRemote] = useState<{ key: string; items: Pick[]; more: boolean; failed?: true } | null>(null);
  const catalogLoading = catalog && remote?.key !== catalogKey;
  /* `fetch` إلى `GET /api/v1/lists/catalog` (مسارُ التطبيق نفسُه) لا فعلُ خادم: أفعالُ الخادم تصطفّ واحداً بعد واحد ولا
     تُلغى — وضغطاتُ الرقائق السريعة كانت تصفّ تقييماتٍ كاملةً لا يقرؤها أحد. `AbortController` يقطع ما سبق */
  useEffect(() => {
    if (!catalogKey) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const p = JSON.parse(catalogKey) as Record<string, string | number | undefined>;
        const qs = new URLSearchParams(
          Object.entries(p).filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== "").map(([k, v]) => [k, String(v)]),
        );
        const res = await fetch(`/api/v1/lists/catalog?${qs}`, { signal: ctrl.signal });
        /* غلافُ `/api/v1` على السلك `{ data, invalidates }` (نجاحٌ) أو `{ error }` — لا رايةَ `ok` فيه: حالةُ HTTP هي الحكم */
        const json = (await res.json()) as { data?: { items: Pick[]; more: boolean } };
        if (!res.ok || !json.data) throw new Error("catalog");
        setRemote({ key: catalogKey, items: json.data.items, more: json.data.more });
      } catch {
        if (!ctrl.signal.aborted) setRemote({ key: catalogKey, items: [], more: false, failed: true });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [catalogKey]);

  const listed = useMemo(
    () => filterPicker(items, { source, filters, term: searching ? term : "" }),
    [items, filters, source, term, searching],
  );

  const grid: Pick[] = useMemo(() => {
    if (catalog) return remote?.key === catalogKey ? remote.items : (remote?.items ?? []);
    return listed.map((x) => ({ id: x.id, kind: x.kind, title: x.title, poster_path: x.poster_path }));
  }, [catalog, catalogKey, remote, listed]);

  function toggle(p: Pick) {
    setSelected((prev) => {
      const next = new Map(prev);
      const k = keyOf(p);
      if (next.has(k)) next.delete(k);
      else next.set(k, p);
      return next;
    });
  }

  /* ===== الخطوةُ الثانية — التفاصيل ===== */
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [kind, setKind] = useState<"regular" | "ranked" | "watch_order">("regular");
  const [isPublic, setPublic] = useState(false);
  const [playlist, setPlaylist] = useState(false);
  const [invite, setInvite] = useState(false);

  const picks = [...selected.values()];

  function createList() {
    const clean = name.trim();
    if (!clean) return;
    start(async () => {
      try {
        const { id } = await createListFull({
          name: clean,
          subtitle: subtitle.trim() || null,
          isPublic,
          kind,
          playlist,
          items: picks.map((p) => ({ tmdbId: p.id, mediaType: p.kind, title: p.title, posterPath: p.poster_path })),
        });
        toast(t.listMadeToast(clean), { tone: "success" });
        router.push(`/lists/${id}${invite ? "?invite=1" : ""}`);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  function addPicked() {
    if (!addTo || !picks.length) return;
    start(async () => {
      try {
        const { added } = await addItemsToList(
          addTo.id,
          picks.map((p) => ({ tmdbId: p.id, mediaType: p.kind, title: p.title, posterPath: p.poster_path })),
        );
        toast(t.nlAdded(t.listCount(added)), { tone: "success" });
        router.push(`/lists/${addTo.id}`);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  /* ===== القائمةُ الذكيّة ===== */
  const [rule, setRule] = useState<Record<string, string>>(editing?.rule ?? { type: "movie" });
  const [smartOpen, setSmartOpen] = useState<Axis | null>(null);
  /* المعاينةُ **موسومةٌ بشرطها** (`key`): «يحمّل» = لا معاينةَ لهذا الشرط بعدُ — مشتقٌّ لا حالةٌ تُقلب في أثر */
  const [preview, setPreview] = useState<{ key: string; items: Pick[]; count: number; failed?: true } | null>(null);
  const [smartName, setSmartName] = useState("");
  const ruleKey = JSON.stringify(rule);
  const hasRule = ruleHasLimit(rule);
  const previewing = hasRule && preview?.key !== ruleKey;
  const seq = useRef(0);

  useEffect(() => {
    if (tab !== "smart" || !hasRule) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const r = await previewSmartList(JSON.parse(ruleKey), library ? "library" : "catalog");
        if (mine === seq.current)
          setPreview({ key: ruleKey, items: r.items.map((x) => ({ id: x.id, kind: x.kind, title: x.title, poster_path: x.poster_path })), count: r.count });
      } catch {
        if (mine === seq.current) setPreview({ key: ruleKey, items: [], count: 0, failed: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [ruleKey, tab, hasRule, library]);

  function updateRule() {
    if (!editing || !hasRule) return;
    start(async () => {
      try {
        await updateSmartListRule(editing.id, rule, true);
        toast(t.smartListUpdated, { tone: "success" });
        router.push(`/lists/${editing.id}`);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  function createSmart() {
    const clean = smartName.trim();
    if (!clean || !hasRule) return;
    start(async () => {
      try {
        const res = await createSmartList(clean, rule, library ? "library" : "catalog");
        toast(t.librarySmartCreated, { tone: "success" });
        if (res.id) router.push(`/lists/${res.id}`);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  /* ===== الخيارات — من النواة (`core/newList`) لا نسخةٌ هنا: شاشةُ التطبيق تقرأ القائمةَ نفسَها ===== */
  const optsOf = axisOptions(t, ar, { tab, library, curType: tab === "smart" ? rule.type : filters.type });
  const axisLabel = axisLabels(t);
  const typeOpts = optsOf.type;

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <BackButton locale={locale} />
      <h1 className="font-bold text-20 leading-tight truncate flex-1 min-w-0">{editing ? t.nlEditTitle : addTo ? t.nlAddTo(addTo.name) : t.listNewGroup}</h1>
      {!addTo && tab === "list" && <span dir="ltr" className="shrink-0 text-12 text-muted tabular-nums">{t.nlStep(step)}</span>}
    </div>
  );

  const segments = addTo || editing ? null : (
    <div className={`${segmentedTrackFull} mb-4`} role="tablist">
      {(["list", "smart"] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={tab === k}
          onClick={() => {
            setTab(k);
            setStep(1);
          }}
          className={segmentedItem(tab === k, "flex-1 inline-flex items-center justify-center gap-1.5")}
        >
          <Icon name={k === "list" ? "plus" : "sparkle-star"} size={15} className={k === "smart" ? "text-accent" : ""} />
          {k === "list" ? t.nlTabList : t.smartListLabel}
        </button>
      ))}
    </div>
  );

  /* ===== الرسم ===== */
  if (tab === "list" && step === 2) {
    const kinds = [
      { k: "regular" as const, label: t.listTypeRegular, hint: t.listTypeRegularHint },
      { k: "ranked" as const, label: t.listTypeRanked, hint: t.listTypeRankedHint },
      { k: "watch_order" as const, label: t.listTypeWatch, hint: t.listTypeWatchHint },
    ];
    return (
      <main className="px-4 sm:px-6 py-5 max-w-shell mx-auto pb-40">
        {header}
        <div className="max-w-xl space-y-5">
          <div className="rounded-2xl border border-border overflow-hidden">
            <ListCardShell
              name={name.trim() || t.listNamePlaceholder}
              countText={`${t.listCount(picks.length)} · ${isPublic ? t.nlPublic : t.listPrivate}`}
              posters={picks.slice(0, 3).map((p) => posterUrl(p.poster_path, "w185")).filter((u): u is string => !!u)}
            />
          </div>
          <label className="block">
            <span className="block text-13 text-muted mb-1.5">{t.nlName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
              placeholder={t.listNamePlaceholder}
              className="w-full min-h-11 rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
            />
          </label>
          <label className="block">
            <span className="block text-13 text-muted mb-1.5">{t.nlDesc}</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={120}
              placeholder={t.nlDescPh}
              className="w-full min-h-11 rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
            />
          </label>
          <div>
            <span className="block text-13 text-muted mb-1.5">{t.listType}</span>
            <div className="flex flex-wrap gap-2">
              {kinds.map((x) => (
                <button key={x.k} type="button" onClick={() => setKind(x.k)} className={chipClass(kind === x.k, "md")}>
                  {x.label}
                </button>
              ))}
            </div>
            <p className="text-12 text-muted mt-2">{kinds.find((x) => x.k === kind)?.hint}</p>
          </div>
          <div className="border-t border-border divide-y divide-[color:var(--divider)]">
            <ToggleRow label={t.nlPublic} hint={t.nlPublicHint} checked={isPublic} onChange={() => setPublic((v) => !v)} />
            <ToggleRow label={t.nlPlaylist} hint={t.nlPlaylistHint} checked={playlist} onChange={() => setPlaylist((v) => !v)} />
            <ToggleRow label={t.nlInvite} hint={t.nlInviteHint} checked={invite} onChange={() => setInvite((v) => !v)} />
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border">
          <div className="max-w-shell mx-auto px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-3">
            <button type="button" onClick={() => setStep(1)} className={buttonClass({ variant: "surface", size: "lg" })}>
              {t.nlBack}
            </button>
            <button
              type="button"
              onClick={createList}
              disabled={pending || !name.trim()}
              className={buttonClass({ size: "lg", className: "flex-1" })}
            >
              {t.nlCreateList}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (tab === "smart") {
    const smartAxes = library ? SMART_AXES_LIBRARY : SMART_AXES_CATALOG;
    /* 🆕 T454 — الأنواعُ رقائقُ تُجمع (أحمد «٢ أ»): كلُّ رقاقةٍ تُطفئ وتُشعل، وآخرُ نوعٍ لا يُطفأ (`toggleRuleType`) */
    const picked = ruleTypes(rule.type);
    return (
      <main className="px-4 sm:px-6 py-5 max-w-shell mx-auto pb-40">
        {header}
        {segments}
        <p className="text-13 text-muted mb-3">{library ? t.nlSmartHintLibrary : t.nlSmartHint}</p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {typeOpts.map((o) => {
              const on = picked.includes(o.value as SmartType);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRule((r) => withTypeMix(r, toggleRuleType(r.type, o.value as SmartType), !!editing))}
                  className={chipClass(on, "md")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {/* 🆕 T467 — **التوزيع** (أحمد «١ج»): عدّادٌ لكلّ نوعٍ مختار بخطوات ١٠٪، ولا يظهر لنوعٍ واحد. والقائمةُ القديمةُ
              بلا نسبة تبقى بالشعبيّة ويقول السطرُ ذلك — **والعدّادُ يعرض التساوي الذي ستبدأ منه أوّلُ لمسة** */}
          {picked.length > 1 &&
            (() => {
              const set = parseMix(rule.mix, picked);
              const mix = set ?? defaultMix(picked);
              const labelOf = (ty: SmartType) => typeOpts.find((o) => o.value === ty)?.label ?? ty;
              const step = (ty: SmartType, dir: 1 | -1) => setRule((r) => ({ ...r, mix: formatMix(stepMix(mix, picked, ty, dir), picked) }));
              return (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-12 font-semibold text-muted me-1">{t.nlMix}</span>
                    {picked.map((ty) => {
                      const can = mixCan(mix, picked, ty);
                      return (
                        <Stepper
                          key={ty}
                          label={t.nlMixShare(labelOf(ty), mix[ty] ?? 0)}
                          canDec={can.down}
                          canInc={can.up}
                          onDec={() => step(ty, -1)}
                          onInc={() => step(ty, 1)}
                          decLabel={t.nlMixLess(labelOf(ty))}
                          incLabel={t.nlMixMore(labelOf(ty))}
                        />
                      );
                    })}
                  </div>
                  {!set && <p className="text-12 text-muted mt-1.5">{t.nlMixUnset}</p>}
                </div>
              );
            })()}
          <AxisRow
            optsOf={optsOf}
            axisLabel={axisLabel}
            hideText={(v) => hideChipText(t, v)}
            axes={smartAxes}
            values={rule as Partial<Record<Axis, string>>}
            openAxis={smartOpen}
            onOpen={setSmartOpen}
            onPick={(a, v) => setRule((r) => withAxis(r, a, v))}
          />
        </div>
        <div className="border-t border-border mt-5 pt-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-15 font-bold">{t.nlPreview}</h2>
            {preview && !preview.failed && hasRule && <span className="text-12 text-muted tabular-nums">{t.listCount(preview.count)}</span>}
          </div>
          {!hasRule ? (
            <p className="text-13 text-muted py-10 text-center">{t.nlPreviewPick}</p>
          ) : preview && preview.items.length === 0 && !previewing ? (
            /* الفشلُ يُقال فشلاً لا «لا أعمال» — شرطٌ صحيحٌ لا يُتَّهم بخطأ الشبكة */
            <p className="text-13 text-muted py-10 text-center">{preview.failed ? t.apiInternal : t.nlPreviewEmpty}</p>
          ) : (
            <div className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 transition-opacity ${previewing ? "opacity-60" : ""}`}>
              {(preview?.items ?? []).map((p) => (
                <Tile key={keyOf(p)} pick={p} />
              ))}
              {!preview &&
                Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton aspect-[2/3] rounded-poster border border-border" />)}
            </div>
          )}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border">
          <div className="max-w-shell mx-auto px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2">
            {editing ? (
              /* التعديلُ للشرط وحدَه — الاسمُ يُعدَّل من «عدّل القائمة» في صفحتها كسائر القوائم */
              <>
                <span className="flex-1 min-w-0 truncate text-14 font-semibold" dir="auto">
                  {editing.name}
                </span>
                <button
                  type="button"
                  onClick={updateRule}
                  disabled={pending || !hasRule}
                  className={buttonClass({ size: "lg", className: "shrink-0" })}
                >
                  {t.nlUpdateRule}
                </button>
              </>
            ) : (
            <>
            <input
              value={smartName}
              onChange={(e) => setSmartName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSmart()}
              maxLength={60}
              placeholder={t.nlSmartNamePh}
              className="flex-1 min-w-0 min-h-11 rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
            />
            <button
              type="button"
              onClick={createSmart}
              disabled={pending || !hasRule || !smartName.trim()}
              className={buttonClass({ size: "lg", className: "shrink-0" })}
            >
              {t.nlCreateSmart}
            </button>
            </>
            )}
          </div>
        </div>
      </main>
    );
  }

  /* القائمةُ — الخطوةُ الأولى */
  const sources = newListSources(library).map((k) => ({ k, label: sourceLabel(t, k) }));
  const heading = searching ? t.nlSrcSearch : sources.find((s) => s.k === source)?.label ?? "";
  return (
    <main className="px-4 sm:px-6 py-5 max-w-shell mx-auto pb-40">
      {header}
      {segments}
      <div className="relative mb-3">
        <Icon name="search" size={18} className="absolute inset-y-0 start-3 my-auto text-muted pointer-events-none" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
            setN(40);
            /* البحثُ من «اكتشف» يذهب إلى الكتالوج بفلاتره — «تقييمي» لا يُرى هناك فلا يبقى مختاراً */
            if (!library && e.target.value.trim().length >= 2) setFilters((f) => withAxis(f, "my", ""));
          }}
          type="search"
          placeholder={library ? t.nlSearchLibrary : t.nlSearchAll}
          className="w-full min-h-11 rounded-control bg-surface-2 border border-border ps-10 pe-3 py-2.5 text-base outline-none focus:border-accent transition"
        />
      </div>
      {!searching && (
        <div className="flex flex-wrap gap-2 mb-2">
          {sources.map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => {
                setSource(s.k);
                setShown(PAGE);
                setN(40);
                /* المحوران يفترقان بالمصدر: «تقييمي» لمكتبتك و«التقييم» العامّ للكتالوج — ما لا يُرى لا يبقى مختاراً */
                setFilters((f) => withAxis(f, isCatalogSource(s.k) ? "my" : "rate", ""));
              }}
              className={chipClass(source === s.k, "sm")}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <AxisRow
        optsOf={optsOf}
        axisLabel={axisLabel}
        axes={axes}
        values={filters}
        openAxis={open}
        onOpen={setOpen}
        onPick={(a, v) => {
          setFilters((f) => (a === "type" ? withType(f, v) : withAxis(f, a, v)));
          setShown(PAGE);
          setN(40);
        }}
      />
      <h2 className="text-15 font-bold mt-5 mb-3 flex items-center gap-2">
        <Icon name="sparkle-star" size={15} className="text-accent" />
        {heading}
      </h2>
      {catalog && catalogLoading && grid.length === 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-poster border border-border" />
          ))}
        </div>
      ) : grid.length === 0 ? (
        <p className="text-13 text-muted py-12 text-center">
          {catalog && remote?.failed ? t.apiInternal : library || source === "mine" ? t.nlEmptyMine : t.nlPreviewEmpty}
        </p>
      ) : (
        <>
          <div className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 transition-opacity ${catalogLoading ? "opacity-60" : ""}`}>
            {(catalog ? grid : grid.slice(0, shown)).map((p) => (
              <Tile key={keyOf(p)} pick={p} selected={selected.has(keyOf(p))} onToggle={() => toggle(p)} />
            ))}
          </div>
          {(catalog ? !!remote?.more && !catalogLoading : grid.length > shown) && (
            <div className="text-center mt-5">
              <button
                type="button"
                onClick={() => (catalog ? setN((x) => Math.min(120, x + 40)) : setShown((x) => x + PAGE))}
                className={buttonClass({ variant: "surface" })}
              >
                {t.showMore}
              </button>
            </div>
          )}
        </>
      )}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border">
        <div className="max-w-shell mx-auto px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-3">
          <div className="flex gap-1 shrink-0">
            {picks.slice(-5).map((p) => (
              <button key={keyOf(p)} type="button" onClick={() => toggle(p)} aria-label={p.title} className="relative w-8 h-12 rounded-md overflow-hidden border border-border">
                {p.poster_path && <Image src={posterUrl(p.poster_path, "w185")!} alt="" {...POSTER_INTRINSIC.w185} className="absolute inset-0 w-full h-full object-cover" />}
              </button>
            ))}
          </div>
          <span className="text-13 text-muted flex-1 min-w-0 truncate tabular-nums">{t.listCount(picks.length)}</span>
          {addTo ? (
            <button type="button" onClick={addPicked} disabled={pending || !picks.length} className={buttonClass({ size: "lg", className: "shrink-0" })}>
              {t.nlAddN(t.listCount(picks.length))}
            </button>
          ) : (
            <button type="button" onClick={() => setStep(2)} className={buttonClass({ size: "lg", className: "shrink-0" })}>
              {t.nlNext}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/** رقاقةٌ بسهم: اسمُ المحور فارغاً، وقيمتُه حين يُختار — **والمختارةُ صفراء** (عائلةُ `chipClass` وحدَها) */
function AxisRow({
  axes,
  optsOf,
  axisLabel,
  hideText,
  values,
  openAxis,
  onOpen,
  onPick,
}: {
  axes: Axis[];
  optsOf: Record<Axis, Opt[]>;
  axisLabel: Record<Axis, string>;
  /** «إخفاء: ما شاهدته» — قيمةُ «إخفاء» وحدَها تُقرأ عكسَها */
  hideText?: (v: string | undefined) => string;
  values: Partial<Record<Axis, string>>;
  openAxis: Axis | null;
  onOpen: (a: Axis | null) => void;
  onPick: (a: Axis, v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {axes.map((a) => {
          const v = values[a];
          const on = !!v;
          const label = a === "hide" && hideText ? hideText(v) : chipText(optsOf[a], axisLabel[a], v);
          const isOpen = openAxis === a;
          return (
            <button
              key={a}
              type="button"
              aria-expanded={isOpen}
              onClick={() => onOpen(isOpen ? null : a)}
              className={chipClass(on, "sm", `inline-flex items-center gap-1 ${isOpen && !on ? "border-accent text-foreground" : ""}`)}
            >
              {label}
              <Icon name="chevron-down" size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          );
        })}
      </div>
      {openAxis && axes.includes(openAxis) && (
        <div className="rounded-control border border-border bg-surface p-3 flex flex-wrap gap-2">
          {optsOf[openAxis].map((o) => {
            const sel = (values[openAxis] ?? "") === o.value;
            return (
              <button
                key={o.value || "any"}
                type="button"
                onClick={() => {
                  onPick(openAxis, o.value);
                  onOpen(null);
                }}
                className={chipClass(sel, "sm")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** ملصقٌ في الشبكة — بعلامة اختيارٍ حين `onToggle`، وللمعاينة بلا علامة */
function Tile({ pick, selected = false, onToggle }: { pick: Pick; selected?: boolean; onToggle?: () => void }) {
  const url = posterUrl(pick.poster_path, "w342");
  const body = (
    <>
      <span
        className={`relative block aspect-[2/3] rounded-poster overflow-hidden bg-surface border ${
          selected ? "border-accent ring-2 ring-accent" : "border-border"
        }`}
      >
        {url ? (
          <Image src={url} alt={pick.title} {...POSTER_INTRINSIC.w342} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name={pick.kind === "tv" ? "tv" : "film"} size={24} />
          </span>
        )}
        {onToggle && (
          <span
            aria-hidden
            className={`absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full ${
              selected ? "bg-accent text-[color:var(--on-accent)]" : "bg-black/55 border-[1.5px] border-white/85"
            }`}
          >
            {selected && <Icon name="check-line" size={14} />}
          </span>
        )}
      </span>
      <span className="block text-12 font-medium leading-tight mt-1.5 truncate" dir="auto">
        {pick.title}
      </span>
    </>
  );
  return onToggle ? (
    <button type="button" onClick={onToggle} aria-pressed={selected} className="text-start">
      {body}
    </button>
  ) : (
    <div>{body}</div>
  );
}
