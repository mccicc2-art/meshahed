import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, qk, write, ApiError } from "../api";
import { useApp } from "../state";
import { Button, Text, TopBar, type ToastTone } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { PAGE_PAD } from "../home/Section";
import { Chip } from "../library/Chip";
import { Segmented } from "../library/ToolsSheet";
import { ListCard } from "../library/ListCard";
import { SwitchPill } from "../settings/ui";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { MIN_QUERY, useDebounced } from "../search/useSearch";
import { useHomeDoor } from "../homeDoor";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { ruleTypes, toggleRuleType, type SmartType } from "@/core/smartListKeys";
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
  type NewListAxis,
  type NewListOpt,
  type NewListSource,
  type NewListTab,
} from "@/core/newList";
import type { CatalogPickerPayload, SmartRuleBody, CreateListFullBody, ListAddItemsBody, ListDetailPayload, PickerPayload, SmartListBody, SmartPreviewBody, SmartPreviewResult } from "../contracts";

/**
 * ====== 🆕 T450 — «قائمة جديدة» أصليّاً — نسخةُ `NewListFlow` (الويب) ======
 *
 * أحمد ١٩ نوفمبر: «تعب يقعد يكتب عمل عمل» ثمّ «هل نترك الانبثاق ذا وندخل على صفحة» — **شاشةٌ لا ورقة**: الاختيارُ عشراتُ
 * ملصقات، والورقةُ مسقوفةُ الطول. **المفرداتُ من النواة** (`core/newList` — الرقائقُ وخياراتُها والتصفية) فما يُرسم هنا هو
 * ما يُرسم في الويب بالترتيب نفسِه، **والكتابةُ فوق دوالّ الويب** (`create-full` · `add-items` · `smart` · `smart-catalog`).
 *
 * - **«قائمة»**: الخطوةُ الأولى الملصقاتُ من مكتبتك (نداءٌ واحد `lists/picker` وتصفيةٌ في الجهاز) والبحثُ في الكتالوج
 *   كلِّه من «اكتشف»؛ والثانيةُ التفاصيلُ ومعاينةُ البطاقة نفسِها (`ListCard`) — **بلا ألوان غلاف** (D-848).
 * - **«قائمة ذكيّة»** مجّانيّة للجميع (أحمد: «القوائم الذكية ابغاها تسير بدون اشتراك»)، ومعاينتُها `smart-preview` الذي
 *   يقرأ القارئَ نفسَه الذي تُفتح به القائمةُ بعد إنشائها.
 * - **`from="library"`** يقيّد الشاشةَ بمكتبتك (بلا «للمشاهدة» ولا بحثِ كتالوج)، و**`addTo`** يفتح الخطوةَ الأولى وحدَها
 *   لقائمةٍ قائمة («أضف أعمالاً»).
 */
type Pick = { id: number; kind: "tv" | "movie"; title: string; poster_path: string | null };
type Kind = "regular" | "ranked" | "watch_order";
const keyOf = (x: { id: number; kind: string }) => `${x.kind}-${x.id}`;
const COLS = 3;
const GAP = 10;

export function NewListScreen({
  from,
  initialTab,
  addId,
  editId = null,
}: {
  from: "discover" | "library";
  initialTab: NewListTab;
  addId: string | null;
  /** 🆕 T454 — تعديلُ شرطِ قائمةٍ ذكيّةٍ قائمة (أحمد «أ»): «قائمة ذكيّة» وحدَها، مملوءةً بشرطها، وزرُّها «حدّث القائمة» */
  editId?: string | null;
}) {
  const { t, tokens, locale } = useApp();
  const ar = locale !== "en";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  /* التعديلُ يقرأ مصدرَ الشرط من صفِّ القائمة (كالويب) لا من الرابط — وحتى يصل فمن الرابط */
  const targetId = addId ?? editId;
  const target = useQuery({
    queryKey: qk.list(targetId ?? ""),
    queryFn: async () => (await api<ListDetailPayload>(`/api/v1/lists/${targetId}`)).data,
    enabled: !!targetId,
    staleTime: 60_000,
  });
  const library = editId && target.data?.smart_source ? target.data.smart_source === "library" : from === "library";
  const [tab, setTab] = useState<NewListTab>(editId ? "smart" : addId ? "list" : initialTab);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  const toastHost = useRef<ToastHostRef>(null);
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);
  const fail = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      say(typeof msg === "string" ? msg : t.apiInternal);
    },
    [t, say],
  );

  const home = useHomeDoor();
  const back = useCallback(() => {
    if (tab === "list" && step === 2) return setStep(1);
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router, tab, step]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  /* ===== البيانات ===== */
  const picker = useQuery({
    queryKey: ["lists:picker"] as const,
    queryFn: async () => (await api<PickerPayload>("/api/v1/lists/picker")).data,
    staleTime: 60_000,
  });
  /* اسمُ القائمة التي يُضاف إليها أو يُعدَّل شرطُها: `target` أعلاه — مفتاحُ صفحة القائمة نفسُه، فلا نداءَ إن كانت مفتوحةً تحتنا */

  /* ===== الخطوةُ الأولى ===== */
  const [selected, setSelected] = useState<Map<string, Pick>>(new Map());
  const [source, setSource] = useState<NewListSource>(library ? "recent" : "pop");
  const [filters, setFilters] = useState<Partial<Record<NewListAxis, string>>>({});
  const [open, setOpen] = useState<NewListAxis | null>(null);
  const [q, setQ] = useState("");
  const term = useDebounced(q);
  const searching = term.trim().length >= MIN_QUERY;
  /* 🆕 T454 — «اكتشف» يقرأ الكتالوجَ كلَّه (أحمد: «ف اكتشف كل شيء يظهر»): الأشهر · الأعلى تقييماً · الأحدث، والبحثُ
     كلُّه — بالفلاتر نفسِها في الخادم (`lists/catalog`، قارئُ الويب نفسُه). «من مكتبتي» والمكتبةُ تُصفّى في الجهاز */
  /* الكتالوجُ يُسأل في خطوة الاختيار وحدَها — لا من «قائمة ذكيّة» ولا من التعديل */
  const catalog = !library && !editId && tab === "list" && (isCatalogSource(source) || searching);
  const axes = catalog ? PICK_AXES_CATALOG : PICK_AXES;
  const [n, setN] = useState(40);
  const catalogQs = new URLSearchParams({
    src: isCatalogSource(source) ? source : "pop",
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.g ? { g: filters.g } : {}),
    ...(filters.era ? { era: filters.era } : {}),
    ...(filters.rate ? { rate: filters.rate } : {}),
    ...(searching ? { q: term.trim() } : {}),
    n: String(n),
  }).toString();
  const remote = useQuery({
    queryKey: ["lists:catalog", catalogQs] as const,
    queryFn: async () => (await api<CatalogPickerPayload>(`/api/v1/lists/catalog?${catalogQs}`)).data,
    enabled: catalog,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const grid: Pick[] = useMemo(() => {
    if (catalog) return (remote.data?.items ?? []).map((x) => ({ id: x.id, kind: x.kind, title: x.title, poster_path: x.poster_path }));
    return filterPicker(picker.data?.items ?? [], { source, filters, term: searching ? term : "" }).map((x) => ({
      id: x.id,
      kind: x.kind,
      title: x.title,
      poster_path: x.poster_path,
    }));
  }, [catalog, remote.data, picker.data, source, filters, term, searching]);

  const toggle = useCallback((p: Pick) => {
    haptic.pick();
    setSelected((prev) => {
      const next = new Map(prev);
      const k = keyOf(p);
      if (next.has(k)) next.delete(k);
      else next.set(k, p);
      return next;
    });
  }, []);
  const picks = [...selected.values()];
  const bodyItems = picks.map((p) => ({ tmdbId: p.id, mediaType: p.kind, title: p.title, posterPath: p.poster_path }));

  /* ===== الخطوةُ الثانية ===== */
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [kind, setKind] = useState<Kind>("regular");
  const [isPublic, setPublic] = useState(false);
  const [playlist, setPlaylist] = useState(false);
  const [invite, setInvite] = useState(false);

  const createList = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const r = await write<{ id: string }>("/api/v1/lists/create-full", {
        name: clean,
        subtitle: subtitle.trim() || null,
        isPublic,
        kind,
        playlist,
        items: bodyItems,
      } satisfies CreateListFullBody);
      haptic.success();
      router.replace({ pathname: "/list/[id]", params: { id: r.id, from, ...(invite ? { invite: "1" } : {}) } });
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const addPicked = async () => {
    if (!addId || !picks.length || busy) return;
    setBusy(true);
    try {
      await write<{ added: number }>("/api/v1/lists/add-items", { listId: addId, items: bodyItems } satisfies ListAddItemsBody);
      haptic.success();
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/list/[id]", params: { id: addId, from } });
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  /* ===== القائمةُ الذكيّة ===== */
  const [rule, setRule] = useState<Record<string, string>>({ type: "movie" });
  /* 🆕 T454 — التعديلُ يبدأ من الشرط المخزَّن مرّةً حين يصل (`smart_rule` لصاحبها وحدَه) */
  const seeded = useRef(false);
  const storedRule = editId ? target.data?.smart_rule : null;
  useEffect(() => {
    if (seeded.current || !storedRule) return;
    seeded.current = true;
    setRule(storedRule);
  }, [storedRule]);
  const [smartOpen, setSmartOpen] = useState<NewListAxis | null>(null);
  const [smartName, setSmartName] = useState("");
  const ruleKey = useDebounced(JSON.stringify(rule), 350);
  const hasRule = ruleHasLimit(rule);
  const preview = useQuery({
    queryKey: ["lists:smart-preview", library ? "library" : "catalog", ruleKey] as const,
    queryFn: async () =>
      (
        await api<SmartPreviewResult>("/api/v1/lists/smart-preview", {
          method: "POST",
          body: { rule: JSON.parse(ruleKey) as Record<string, string>, source: library ? "library" : "catalog" } satisfies SmartPreviewBody,
        })
      ).data,
    enabled: tab === "smart" && ruleHasLimit(JSON.parse(ruleKey) as Record<string, string>),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const updateRule = async () => {
    if (!editId || !hasRule || busy) return;
    setBusy(true);
    try {
      await write<{ ok: boolean }>("/api/v1/lists/smart-rule", { listId: editId, rule, full: true } satisfies SmartRuleBody);
      haptic.success();
      say(t.smartListUpdated, "success");
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/list/[id]", params: { id: editId, from } });
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const createSmart = async () => {
    const clean = smartName.trim();
    if (!clean || !hasRule || busy) return;
    setBusy(true);
    try {
      const r = await write<{ id: string | null }>(library ? "/api/v1/lists/smart" : "/api/v1/lists/smart-catalog", { name: clean, rule } satisfies SmartListBody);
      haptic.success();
      if (r.id) router.replace({ pathname: "/list/[id]", params: { id: r.id, from } });
      else back();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  /* ===== الخيارات (النواة) ===== */
  const optsOf = axisOptions(t, ar, { tab, library, curType: tab === "smart" ? rule.type : filters.type });
  const labels = axisLabels(t);

  const tileW = Math.floor((width - PAGE_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const field = {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface2,
    paddingHorizontal: 12,
    fontSize: 16,
    color: tokens.fg,
    textAlign: (ar ? "right" : "left") as "right" | "left",
  };
  const trayPad = insets.bottom + 12;

  const title = editId ? t.nlEditTitle : addId ? (target.data ? t.nlAddTo(target.data.name) : t.listAddTitles) : t.listNewGroup;
  const header = (
    <View style={{ paddingTop: insets.top }}>
      <TopBar
        title={title}
        onBack={back}
        onBackLong={home}
        backLabel={t.closeLabel}
        end={!addId && tab === "list" ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{t.nlStep(step)}</Text> : undefined}
      />
      {!addId && !editId ? (
        <View style={{ paddingHorizontal: PAGE_PAD }}>
          <Segmented
            items={[
              { id: "list", label: t.nlTabList },
              { id: "smart", label: t.smartListLabel },
            ]}
            value={tab}
            onChange={(v) => {
              setTab(v as NewListTab);
              setStep(1);
            }}
          />
        </View>
      ) : null}
    </View>
  );

  /* ---------- قائمة · الخطوة الثانية ---------- */
  if (tab === "list" && step === 2) {
    const kinds: { k: Kind; label: string; hint: string }[] = [
      { k: "regular", label: t.listTypeRegular, hint: t.listTypeRegularHint },
      { k: "ranked", label: t.listTypeRanked, hint: t.listTypeRankedHint },
      { k: "watch_order", label: t.listTypeWatch, hint: t.listTypeWatchHint },
    ];
    const switchRow = (label: string, hint: string, on: boolean, flip: () => void, last?: boolean) => (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        onPress={flip}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={15} weight="600">{label}</Text>
          <Text size={12} muted style={{ marginTop: 2, lineHeight: 17 }}>{hint}</Text>
        </View>
        <SwitchPill checked={on} />
      </Pressable>
    );
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        {header}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: PAGE_PAD, gap: 18, paddingBottom: trayPad + 80 }}>
          <ListCard
            card={{
              id: "preview",
              name: name.trim() || t.listNamePlaceholder,
              owner: null,
              owner_avatar: null,
              countText: `${t.listCount(picks.length)} · ${isPublic ? t.nlPublic : t.listPrivate}`,
              posters: picks.map((p) => p.poster_path).filter((x): x is string => !!x).slice(0, 3),
              cover: null,
              stats: null,
              playlist: null,
            }}
            onPress={() => {}}
          />
          <View style={{ gap: 6 }}>
            <Text size={13} muted>{t.nlName}</Text>
            <TextInput maxFontSizeMultiplier={SYSTEM_FONT_CAP} value={name} onChangeText={setName} maxLength={60} placeholder={t.listNamePlaceholder} placeholderTextColor={tokens.muted} style={field} />
          </View>
          <View style={{ gap: 6 }}>
            <Text size={13} muted>{t.nlDesc}</Text>
            <TextInput maxFontSizeMultiplier={SYSTEM_FONT_CAP} value={subtitle} onChangeText={setSubtitle} maxLength={120} placeholder={t.nlDescPh} placeholderTextColor={tokens.muted} style={field} />
          </View>
          <View style={{ gap: 8 }}>
            <Text size={13} muted>{t.listType}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {kinds.map((x) => (
                <Chip key={x.k} label={x.label} size="md" active={kind === x.k} onPress={() => setKind(x.k)} />
              ))}
            </View>
            <Text size={12} muted style={{ lineHeight: 17 }}>{kinds.find((x) => x.k === kind)?.hint}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.border }}>
            {switchRow(t.nlPublic, t.nlPublicHint, isPublic, () => setPublic((v) => !v))}
            {switchRow(t.nlPlaylist, t.nlPlaylistHint, playlist, () => setPlaylist((v) => !v))}
            {switchRow(t.nlInvite, t.nlInviteHint, invite, () => setInvite((v) => !v), true)}
          </View>
        </ScrollView>
        <View style={{ position: "absolute", start: 0, end: 0, bottom: 0, backgroundColor: tokens.bg, borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: trayPad, flexDirection: "row", gap: 10 }}>
          <Button label={t.nlBack} variant="ghost" onPress={() => setStep(1)} />
          <View style={{ flex: 1 }}>
            <Button label={t.nlCreateList} busy={busy} disabled={!name.trim()} onPress={() => void createList()} />
          </View>
        </View>
        <ToastHost hostRef={toastHost} bottom={trayPad + 72} />
      </View>
    );
  }

  /* ---------- قائمة ذكيّة ---------- */
  if (tab === "smart") {
    const smartAxes = library ? SMART_AXES_LIBRARY : SMART_AXES_CATALOG;
    const items = preview.data?.items ?? [];
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        {header}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 14, gap: 12, paddingBottom: trayPad + 80 }}>
          <Text size={13} muted style={{ lineHeight: 19 }}>{library ? t.nlSmartHintLibrary : t.nlSmartHint}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {/* 🆕 T454 — الأنواعُ تُجمع (أحمد «٢ أ»): كلُّ رقاقةٍ تُشعل وتُطفئ، وآخرُ نوعٍ لا يُطفأ (`toggleRuleType`) */}
            {optsOf.type.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                size="md"
                active={ruleTypes(rule.type).includes(o.value as SmartType)}
                onPress={() => setRule((r) => withType(r, toggleRuleType(r.type, o.value as SmartType)))}
              />
            ))}
          </View>
          <AxisRow axes={smartAxes} optsOf={optsOf} labels={labels} hideText={(v) => hideChipText(t, v)} values={rule} openAxis={smartOpen} onOpen={setSmartOpen} onPick={(a, v) => setRule((r) => withAxis(r, a, v))} />
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, marginTop: 8, paddingTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <Text size={15} weight="700">{t.nlPreview}</Text>
              {hasRule && preview.data ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{t.listCount(preview.data.count)}</Text> : null}
            </View>
            {!hasRule ? (
              <Text size={13} muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.nlPreviewPick}</Text>
            ) : preview.isError && !preview.data ? (
              <View style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
                <Text size={13} muted>{t.apiInternal}</Text>
                <Button label={t.errorRetry} variant="ghost" onPress={() => void preview.refetch()} />
              </View>
            ) : preview.data && items.length === 0 && !preview.isFetching ? (
              <Text size={13} muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.nlPreviewEmpty}</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, opacity: preview.isPlaceholderData || preview.isFetching ? 0.6 : 1 }}>
                {preview.data
                  ? items.map((p) => <Tile key={keyOf(p)} pick={p} w={tileW} />)
                  : Array.from({ length: 6 }, (_, i) => <View key={i} style={{ width: tileW, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: tokens.surface2 }} />)}
              </View>
            )}
          </View>
        </ScrollView>
        <View style={{ position: "absolute", start: 0, end: 0, bottom: 0, backgroundColor: tokens.bg, borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: trayPad, flexDirection: "row", alignItems: "center", gap: 10 }}>
          {editId ? (
            /* التعديلُ للشرط وحدَه — الاسمُ يُعدَّل من «عدّل القائمة» في صفحتها كسائر القوائم */
            <>
              <Text size={14} weight="600" numberOfLines={1} autoDir style={{ flex: 1 }}>{target.data?.name ?? ""}</Text>
              <Button label={t.nlUpdateRule} busy={busy} disabled={!hasRule || !seeded.current} onPress={() => void updateRule()} />
            </>
          ) : (
            <>
              <TextInput
                maxFontSizeMultiplier={SYSTEM_FONT_CAP}
                value={smartName}
                onChangeText={setSmartName}
                onSubmitEditing={() => void createSmart()}
                maxLength={60}
                placeholder={t.nlSmartNamePh}
                placeholderTextColor={tokens.muted}
                returnKeyType="done"
                style={[field, { flex: 1 }]}
              />
              <Button label={t.nlCreateSmart} busy={busy} disabled={!hasRule || !smartName.trim()} onPress={() => void createSmart()} />
            </>
          )}
        </View>
        <ToastHost hostRef={toastHost} bottom={trayPad + 72} />
      </View>
    );
  }

  /* ---------- قائمة · الخطوة الأولى ---------- */
  const sources = newListSources(library);
  const heading = searching ? t.nlSrcSearch : sourceLabel(t, source);
  const controls = (
    <View style={{ gap: 10, paddingTop: 14, paddingBottom: 12 }}>
      <View style={{ justifyContent: "center" }}>
        <View pointerEvents="none" style={{ position: "absolute", start: 14, zIndex: 1 }}>
          <Icon name="search" size={18} color={tokens.muted} />
        </View>
        <TextInput
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setN(40);
            /* البحثُ من «اكتشف» يذهب إلى الكتالوج بفلاتره — «تقييمي» لا يُرى هناك */
            if (!library && v.trim().length >= MIN_QUERY) setFilters((f) => withAxis(f, "my", ""));
          }}
          placeholder={library ? t.nlSearchLibrary : t.nlSearchAll}
          placeholderTextColor={tokens.muted}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={[field, { paddingStart: 40 }]}
        />
      </View>
      {!searching ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -PAGE_PAD }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>
          {sources.map((s) => (
            <Chip
              key={s}
              label={sourceLabel(t, s)}
              active={source === s}
              onPress={() => {
                setSource(s);
                setN(40);
                /* «تقييمي» لمكتبتك و«التقييم» العامّ للكتالوج — ما لا يُرى لا يبقى مختاراً */
                setFilters((f) => withAxis(f, isCatalogSource(s) ? "my" : "rate", ""));
              }}
            />
          ))}
        </ScrollView>
      ) : null}
      <AxisRow
        axes={axes}
        optsOf={optsOf}
        labels={labels}
        values={filters}
        openAxis={open}
        onOpen={setOpen}
        onPick={(a, v) => {
          setFilters((f) => (a === "type" ? withType(f, v) : withAxis(f, a, v)));
          setN(40);
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
        <Icon name="sparkle-star" size={14} color={tokens.accent} />
        <Text size={15} weight="700">{heading}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {header}
      <FlatList
        data={catalog ? grid : picker.data ? grid : []}
        keyExtractor={keyOf}
        numColumns={COLS}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={controls}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP, paddingBottom: trayPad + 84 }}
        initialNumToRender={18}
        windowSize={7}
        renderItem={({ item }) => <Tile pick={item} w={tileW} selected={selected.has(keyOf(item))} onToggle={() => toggle(item)} />}
        ListFooterComponent={
          catalog && remote.data?.more && !remote.isFetching ? (
            <View style={{ alignItems: "center", paddingTop: 16 }}>
              <Button label={t.showMore} variant="ghost" onPress={() => setN((x) => Math.min(120, x + 40))} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          catalog ? (
            remote.isError && !remote.data ? (
              <View style={{ alignItems: "center", gap: 12, paddingVertical: 40 }}>
                <Text muted>{t.apiInternal}</Text>
                <Button label={t.errorRetry} variant="ghost" onPress={() => void remote.refetch()} />
              </View>
            ) : !remote.data || remote.isFetching ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                {Array.from({ length: 9 }, (_, i) => (
                  <View key={i} style={{ width: tileW, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: tokens.surface2 }} />
                ))}
              </View>
            ) : (
              <Text size={13} muted style={{ textAlign: "center", paddingVertical: 48 }}>{t.nlPreviewEmpty}</Text>
            )
          ) : !picker.data ? (
            picker.isError ? (
              <View style={{ alignItems: "center", gap: 12, paddingVertical: 40 }}>
                <Text muted>{t.apiInternal}</Text>
                <Button label={t.errorRetry} variant="ghost" onPress={() => void picker.refetch()} />
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                {Array.from({ length: 9 }, (_, i) => (
                  <View key={i} style={{ width: tileW, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: tokens.surface2 }} />
                ))}
              </View>
            )
          ) : (
            <Text size={13} muted style={{ textAlign: "center", paddingVertical: 48 }}>{t.nlEmptyMine}</Text>
          )
        }
      />
      <View style={{ position: "absolute", start: 0, end: 0, bottom: 0, backgroundColor: tokens.bg, borderTopWidth: 1, borderTopColor: tokens.border, paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: trayPad, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {picks.slice(-5).map((p) => {
            const uri = posterFor(p.poster_path, 32);
            return (
              <Pressable key={keyOf(p)} onPress={() => toggle(p)} accessibilityLabel={p.title} style={{ width: 32, height: 48, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2 }}>
                {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text size={13} muted numberOfLines={1} style={{ flex: 1, fontVariant: ["tabular-nums"] }}>{t.listCount(picks.length)}</Text>
        {addId ? (
          <Button label={t.nlAddN(t.listCount(picks.length))} busy={busy} disabled={!picks.length} onPress={() => void addPicked()} />
        ) : (
          <Button label={t.nlNext} onPress={() => setStep(2)} />
        )}
      </View>
      <ToastHost hostRef={toastHost} bottom={trayPad + 72} />
    </View>
  );
}

/** رقائقُ بسهم، ولوحُ خياراتِ المفتوحة منها تحت صفّها — واحدةٌ مفتوحةٌ في كلِّ مرّة (وصفةُ الويب) */
function AxisRow({
  axes,
  optsOf,
  labels,
  hideText,
  values,
  openAxis,
  onOpen,
  onPick,
}: {
  axes: NewListAxis[];
  optsOf: Record<NewListAxis, NewListOpt[]>;
  labels: Record<NewListAxis, string>;
  /** «إخفاء: ما شاهدته» — قيمةُ «إخفاء» وحدَها تُقرأ عكسَها */
  hideText?: (v: string | undefined) => string;
  values: Partial<Record<string, string>>;
  openAxis: NewListAxis | null;
  onOpen: (a: NewListAxis | null) => void;
  onPick: (a: NewListAxis, v: string) => void;
}) {
  const { tokens } = useApp();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {axes.map((a) => {
          const v = values[a];
          const isOpen = openAxis === a;
          return (
            <Chip
              key={a}
              label={a === "hide" && hideText ? hideText(v) : chipText(optsOf[a], labels[a], v)}
              active={!!v}
              onPress={() => onOpen(isOpen ? null : a)}
              trailing={<View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}><Icon name="chevron-down" size={12} color={v ? tokens.onAccent : tokens.muted} /></View>}
            />
          );
        })}
      </View>
      {openAxis && axes.includes(openAxis) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
          {optsOf[openAxis].map((o) => (
            <Chip
              key={o.value || "any"}
              label={o.label}
              active={(values[openAxis] ?? "") === o.value}
              onPress={() => {
                onPick(openAxis, o.value);
                onOpen(null);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** ملصقٌ في الشبكة — بعلامة اختيارٍ حين `onToggle`، وللمعاينة بلا علامة */
function Tile({ pick, w, selected = false, onToggle }: { pick: Pick; w: number; selected?: boolean; onToggle?: () => void }) {
  const { tokens } = useApp();
  const uri = posterFor(pick.poster_path, w);
  const body = (
    <>
      <View style={{ width: w, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? tokens.accent : tokens.border, alignItems: "center", justifyContent: "center" }}>
        {uri ? <Image source={{ uri }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={pick.kind === "tv" ? "tv" : "film"} size={22} color={tokens.muted} />}
        {onToggle ? (
          <View style={{ position: "absolute", top: 6, end: 6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: selected ? tokens.accent : "rgba(0,0,0,0.55)", borderWidth: selected ? 0 : 1.5, borderColor: "rgba(255,255,255,0.85)" }}>
            {selected ? <Icon name="check-line" size={14} color={tokens.onAccent} /> : null}
          </View>
        ) : null}
      </View>
      <Text size={12} weight="500" numberOfLines={1} autoDir style={{ marginTop: 6, width: w }}>{pick.title}</Text>
    </>
  );
  return onToggle ? (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={pick.title}>
      {body}
    </Pressable>
  ) : (
    <View>{body}</View>
  );
}
