import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { api, queryClient, write } from "../api";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { DragList } from "../library/DragList";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, Chevron, OptionRow, RowsSkeleton } from "./ui";
import { messageOf, useOpenWeb } from "./api";
import { WidgetPreview } from "./WidgetPreview";
import {
  effectiveWidgetConfig,
  widgetSizesFor,
  WIDGET_SECTION_KEYS,
  type WidgetLayoutConfig,
  type WidgetSectionKey,
  type WidgetSectionOpts,
  type WidgetSize,
} from "@/core/widgetLayout";
import { MAIN_LAYOUT, WIDGET_LAYOUTS_CAP } from "@/core/widgetFeedV2";
import type { WidgetLayoutEntry, WidgetPrefsBody, WidgetPrefsPayload, WidgetPrefsResult } from "@/core/contracts/widget";

/**
 * ====== «ودجت لوبز» — شاشةُ الودجت الواحد (خطّةُ v2، W28–W43) ======
 *
 * 🔑 **المعاينةُ مثبّتةٌ فوق والخياراتُ تمرّ تحتها** (وصفةُ «التخصيص» D-1322): كلُّ لمسةٍ تتغيّر في الصورة وأنت تنظر،
 * والمعاينةُ من المحرّك نفسِه الذي يرسم الودجت (`WidgetPreview`) — فما تراه هنا ما سيظهر على الشاشة.
 *
 * - **الترتيبُ بالسحب** (`DragList` — قرارُ أحمد «١أ» ١٤ أكتوبر)، والبحثُ مثبّتٌ أعلى الكبير فلا يُسحب (W31).
 * - **الآيفون تخطيطات** (W40 ب): «الرئيسي» هو الإعدادُ نفسُه، والبقيّةُ نسخٌ تختارها ورقةُ «تعديل الأداة».
 *   أندرويد إعدادٌ واحدٌ ينسخه كلُّ ودجتٍ يُضاف.
 * - **لوبز+** (W41): غيرُ المشترك يرى ما سيأخذه (أكمل المشاهدة) وبابَ الاشتراك — والإعدادُ المحفوظُ لا يُمسّ.
 * - **الحفظُ زرُّ الترويسة** كالتخصيص، والخادمُ يحكم بالبلس (`needsPlus` يفتح `/plus` لا يصمت).
 */
const KEY = ["me:widget-prefs"] as const;
const ROW = 64;
type Store = { config: WidgetLayoutConfig; layouts: WidgetLayoutEntry[] };

export function WidgetScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const ios = Platform.OS === "ios";
  const sizes = widgetSizesFor(ios ? "ios" : "android");

  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<WidgetPrefsPayload>("/api/v1/me/prefs/widget")).data, staleTime: 0 });
  const d = q.data;

  const [store, setStore] = useState<Store | null>(null);
  const [base, setBase] = useState("");
  const [active, setActive] = useState(MAIN_LAYOUT);
  /* يُعاد تركيبُ قائمة السحب حين يتبدّل ترتيبُها من خارجها (تبديلُ التخطيط) — لا عند كلِّ إفلات */
  const [nonce, setNonce] = useState(0);
  const [size, setSize] = useState<WidgetSize>("large");
  const [sheet, setSheet] = useState<WidgetSectionKey | "small" | null>(null);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (d && !store) {
      const s = { config: d.config, layouts: d.layouts };
      setStore(s);
      setBase(JSON.stringify(s));
    }
  }, [d, store]);

  const names: Record<WidgetSectionKey, string> = useMemo(
    () => ({
      search: t.widgetSecSearch,
      cont: t.widgetContinue,
      up: t.widgetComingUp,
      tonight: t.widgetTonight,
      friends: t.widgetFriends,
      tw: t.widgetSecToWatch,
      act: t.widgetActivity,
    }),
    [t],
  );

  const dirty = !!store && JSON.stringify(store) !== base;

  /* الإعدادُ الذي تعدّله الشاشة: «الرئيسي» هو `config`، وغيرُه نسختُه في التخطيطات */
  const cfg: WidgetLayoutConfig | null = !store ? null : active === MAIN_LAYOUT ? store.config : store.layouts.find((l) => l.id === active)?.config ?? store.config;
  const edit = (fn: (c: WidgetLayoutConfig) => WidgetLayoutConfig) =>
    setStore((s) => {
      if (!s) return s;
      if (active === MAIN_LAYOUT) {
        const config = fn(s.config);
        return { config, layouts: s.layouts.map((l) => (l.id === MAIN_LAYOUT ? { ...l, config } : l)) };
      }
      return { ...s, layouts: s.layouts.map((l) => (l.id === active ? { ...l, config: fn(l.config) } : l)) };
    });
  const setOpt = (k: WidgetSectionKey, patch: Partial<WidgetSectionOpts>) => edit((c) => ({ ...c, opts: { ...c.opts, [k]: { ...c.opts[k], ...patch } } }));

  async function save() {
    if (!store || !dirty || saving) return;
    setSaving(true);
    try {
      /* «الرئيسي» لا يُخزَّن تخطيطاً — هو `config` (لو خُزّن لتجمّد اسمُه بلغة يوم الحفظ) */
      const body: WidgetPrefsBody = { widget: { config: store.config, layouts: store.layouts.filter((l) => l.id !== MAIN_LAYOUT) } };
      const out = await write<WidgetPrefsResult>("/api/v1/me/prefs/widget", body);
      if (out.needsPlus) return openWeb("/plus");
      if (!out.ok) throw new Error("save");
      setBase(JSON.stringify(store));
      queryClient.setQueryData<WidgetPrefsPayload>(KEY, (p) => (p ? { ...p, ...store } : p));
      haptic.success();
      toast.current?.say(t.setSaved, undefined, undefined, "success");
    } catch (e) {
      toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.errSaveShort), undefined, undefined, "error");
    } finally {
      setSaving(false);
    }
  }

  const back = () => {
    if (dirty) return setAsk(true);
    if (router.canGoBack()) router.back();
  };

  if (!d || !store || !cfg) {
    return (
      <SettingsScreen title={t.widgetScreenTitle}>
        {q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={6} />}
      </SettingsScreen>
    );
  }

  const plus = d.plus;
  const sizeLabel: Record<WidgetSize, string> = { small: t.widgetSizeSmall, medium: t.widgetSizeMedium, large: t.widgetSizeLarge, xl: t.widgetSizeXl };
  const pinned = (
    <>
      <Segmented items={sizes.map((s) => ({ id: s, label: sizeLabel[s] }))} value={size} onChange={(v) => setSize(v as WidgetSize)} />
      <WidgetPreview config={effectiveWidgetConfig(cfg, plus)} size={size} names={names} maxHeight={size === "xl" ? 300 : 240} />
    </>
  );

  /* ───────── غيرُ المشترك: ما سيأخذه وبابُ الاشتراك (W41) ───────── */
  if (!plus) {
    return (
      <SettingsScreen title={t.widgetScreenTitle} pinned={pinned}>
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="lock" size={18} color={tokens.accent} />
            <Text size={15} weight="700">{d.lapsed ? t.widgetPlusLapsedTitle : t.widgetPlusLockedTitle}</Text>
          </View>
          <Text size={13} muted style={{ lineHeight: 20 }}>{d.lapsed ? t.widgetPlusLapsedSub : t.widgetPlusLockedSub}</Text>
          <Text size={13} muted style={{ lineHeight: 20 }}>{t.widgetPlusBody}</Text>
          <Button label={d.lapsed ? t.widgetRenew : t.widgetSubscribe} onPress={() => openWeb("/plus")} style={{ marginTop: 6 }} />
        </View>
        <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{ios ? t.widgetIosHow : t.widgetAndroidHow}</Text>
      </SettingsScreen>
    );
  }

  const optLabel = (k: WidgetSectionKey) => {
    const o = cfg.opts[k];
    if (k === "search") return o.view === "full" ? t.widgetFormFull : t.widgetFormCompact;
    return o.size === "small" ? t.widgetSizeSmall : t.widgetSizeFull;
  };
  const sectionRow = (k: WidgetSectionKey, sub: string) => (
    <Pressable onPress={() => setSheet(k)} accessibilityRole="button" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: ROW - 8 }}>
      <View style={{ flex: 1, minWidth: 0, opacity: cfg.on[k] ? 1 : 0.5 }}>
        <Text size={15} weight="600" numberOfLines={1}>{names[k]}</Text>
        <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{sub}</Text>
      </View>
      <Chip label={cfg.on[k] ? t.widgetShown : t.widgetHiddenChip} active={cfg.on[k]} onPress={() => { haptic.pick(); edit((c) => ({ ...c, on: { ...c.on, [k]: !c.on[k] } })); }} />
      <Chevron />
    </Pressable>
  );
  const dragKeys = cfg.order.filter((k) => k !== "search");
  const smallName = cfg.smallPick === "first" ? t.widgetFirstSection : names[cfg.smallPick];

  const addLayout = () => {
    if (store.layouts.length >= WIDGET_LAYOUTS_CAP) return;
    const id = `l${Date.now().toString(36)}`;
    const n = store.layouts.length + 1;
    haptic.pick();
    setStore({ ...store, layouts: [...store.layouts, { id, name: t.widgetLayoutN(n), config: cfg }] });
    setActive(id);
    setNonce((x) => x + 1);
  };

  const saveAction = (
    <Pressable onPress={() => void save()} disabled={!dirty || saving} hitSlop={10} accessibilityRole="button" style={{ height: 44, justifyContent: "center", paddingHorizontal: 4 }}>
      <Text size={14} weight="700" color={dirty && !saving ? tokens.accent : tokens.muted}>{saving ? t.saving : t.setSave}</Text>
    </Pressable>
  );

  const overlay = ask ? (
    <Sheet title={t.setUnsavedTitle} placement="center" onClose={() => setAsk(false)}>
      <Text size={14} muted style={{ lineHeight: 21 }}>{t.setUnsavedBody}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <Button label={t.setKeepEditing} variant="ghost" style={{ flex: 1 }} onPress={() => setAsk(false)} />
        <Button label={t.setDiscard} variant="danger" style={{ flex: 1 }} onPress={() => { setAsk(false); if (router.canGoBack()) router.back(); }} />
      </View>
    </Sheet>
  ) : sheet === "small" ? (
    <Sheet title={t.widgetSmallShows} onClose={() => setSheet(null)}>
      {(["first", ...WIDGET_SECTION_KEYS.filter((k) => k !== "search")] as const).map((k) => (
        <OptionRow key={k} selected={cfg.smallPick === k} title={k === "first" ? t.widgetFirstSection : names[k]} onSelect={() => edit((c) => ({ ...c, smallPick: k }))} />
      ))}
    </Sheet>
  ) : sheet ? (
    <SectionSheet k={sheet} name={names[sheet]} opts={cfg.opts[sheet]} onPatch={(p) => setOpt(sheet, p)} onClose={() => setSheet(null)} />
  ) : null;

  return (
    <SettingsScreen title={t.widgetScreenTitle} toast={toast} onBack={back} action={saveAction} pinned={pinned} overlay={overlay}>
      {ios ? (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetLayoutsTitle}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {store.layouts.map((l) => (
              <Chip
                key={l.id}
                label={l.name}
                active={l.id === active}
                onPress={() => { if (l.id === active) return; haptic.pick(); setActive(l.id); setNonce((x) => x + 1); }}
                /* D-993 — ضغطةٌ مطوّلةٌ تحذف (والرئيسيُّ لا يُحذف) */
                onLongPress={l.id === MAIN_LAYOUT ? undefined : () => {
                  haptic.pick();
                  setStore({ ...store, layouts: store.layouts.filter((x) => x.id !== l.id) });
                  if (active === l.id) { setActive(MAIN_LAYOUT); setNonce((x) => x + 1); }
                }}
              />
            ))}
            {store.layouts.length < WIDGET_LAYOUTS_CAP ? <Chip label={`+ ${t.widgetNewLayout}`} active={false} onPress={addLayout} /> : null}
          </View>
        </View>
      ) : null}

      <View>
        <Text size={12} weight="600" muted style={{ paddingHorizontal: 4, marginBottom: 6 }}>{t.widgetSectionsTitle}</Text>
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface, overflow: "hidden", paddingVertical: 4 }}>
          {/* البحثُ مثبّتٌ أعلى الكبير (W31) — صفٌّ بلا مقبض بعرض صفوف السحب نفسِها */}
          <View style={{ height: ROW, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
            {sectionRow("search", `${t.widgetPinnedTop} · ${optLabel("search")}`)}
            <View style={{ width: 44 }} />
          </View>
          <View style={{ height: 1, backgroundColor: tokens.divider, marginHorizontal: 12 }} />
          <DragList
            key={`${active}:${nonce}`}
            keys={dragKeys}
            rowHeight={ROW}
            onOrder={(keys) => edit((c) => ({ ...c, order: ["search", ...(keys as WidgetSectionKey[])] }))}
            renderRow={(k) => sectionRow(k as WidgetSectionKey, optLabel(k as WidgetSectionKey))}
            handleLabel={(k) => names[k as WidgetSectionKey]}
          />
        </View>
        <Text size={12} muted style={{ paddingHorizontal: 4, marginTop: 6 }}>{t.widgetDragHint}</Text>
      </View>

      <Group>
        <Row icon="image" title={t.widgetSmallShows} value={smallName} onPress={() => setSheet("small")} />
      </Group>

      <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{ios ? t.widgetIosHow : t.widgetAndroidHow}</Text>
    </SettingsScreen>
  );
}

/** ورقةُ القسم — عائلتا التحكّم وحدَهما (مقطّعٌ ورقاقة، القاعدة ٣): ما يملكه كلُّ قسمٍ من الخطّة لا أكثر */
function SectionSheet({ k, name, opts, onPatch, onClose }: { k: WidgetSectionKey; name: string; opts: WidgetSectionOpts; onPatch: (p: Partial<WidgetSectionOpts>) => void; onClose: () => void }) {
  const { t } = useApp();
  const block = (label: string, node: React.ReactNode, hint?: string) => (
    <View style={{ gap: 8 }}>
      <Text size={13} weight="600" muted>{label}</Text>
      {node}
      {hint ? <Text size={12} muted style={{ lineHeight: 18 }}>{hint}</Text> : null}
    </View>
  );
  const seg = (items: { id: string; label: string }[], value: string, onChange: (v: string) => void) => <Segmented items={items} value={value} onChange={(v) => { haptic.pick(); onChange(v); }} />;
  const list = k === "up" || k === "friends" || k === "tw" || k === "act";
  const small = opts.size === "small";

  return (
    <Sheet title={name} onClose={onClose}>
      <View style={{ gap: 18, paddingBottom: 8 }}>
        {k === "search" ? (
          <>
            {block(t.widgetSearchForm, seg([{ id: "compact", label: t.widgetFormCompact }, { id: "full", label: t.widgetFormFull }], opts.view === "full" ? "full" : "compact", (v) => onPatch({ view: v })))}
            {/* W31 — الرائجُ اليوم يظهر في الشكل الكامل وحدَه، فخيارُه معه */}
            {opts.view === "full"
              ? block(t.widgetTrendView, seg([{ id: "list", label: t.widgetList }, { id: "posters", label: t.widgetPosters }], opts.trend ?? "list", (v) => onPatch({ trend: v as "list" | "posters" })))
              : null}
          </>
        ) : (
          block(
            t.widgetSecSize,
            seg([{ id: "full", label: t.widgetSizeFull }, { id: "small", label: t.widgetSizeHalf }], opts.size, (v) => onPatch({ size: v as WidgetSectionOpts["size"] })),
            t.widgetPairHint,
          )
        )}
        {k === "tonight" ? (
          <>
            {block(t.widgetTonightFull, seg([{ id: "wide", label: t.widgetWide }, { id: "poster", label: t.widgetPosterDetails }], opts.view === "poster" ? "poster" : "wide", (v) => onPatch({ view: v })))}
            {block(t.widgetTonightSmall, seg([{ id: "poster", label: t.widgetPoster }, { id: "list", label: t.widgetList }], opts.small ?? "poster", (v) => onPatch({ small: v as "poster" | "list" })))}
          </>
        ) : null}
        {list && !small && k !== "act"
          ? block(t.widgetView, seg([{ id: "list", label: t.widgetList }, { id: "posters", label: t.widgetPosters }], opts.view === "posters" ? "posters" : "list", (v) => onPatch({ view: v })))
          : null}
        {list && !small && opts.view !== "posters"
          ? block(t.widgetCount, seg([{ id: "2", label: t.widgetTwo }, { id: "3", label: t.widgetThree }], String(opts.count), (v) => onPatch({ count: v === "3" ? 3 : 2 })))
          : null}
        {list && small ? <Text size={12} muted style={{ lineHeight: 18 }}>{t.widgetFixedSmall}</Text> : null}
      </View>
    </Sheet>
  );
}
