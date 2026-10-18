import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { refreshWidgets, ANDROID_WIDGET_LAYOUT, isAndroidWidgetLayout, emptySections, writtenFeed } from "../widget/feed";
import { sanitizeWidgetLook } from "@/core/widgetLook";
import { LoopzWidget, type AndroidPlaced, type IosPlaced } from "../../modules/loopz-widget";
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
 *   🆕 وفوقها «على شاشتك الآن»: كلُّ ودجتٍ بحجمه وتخطيطه، ولمستُه تفتح تخطيطَه (قرارُ أحمد «١ أ»، ١٤ أكتوبر).
 * - 🆕 **أندرويد: كلُّ ودجتٍ بإعداده** (W40، بلاغُ أحمد ١٤ أكتوبر «المفترض اقدر احط اكثر من ودجت واصمم كل وحده لحال»):
 *   القائمةُ أوّلاً — الودجتاتُ على الشاشة بمقاسها الحقيقيّ وصورتها المصغّرة — ولمسةُ ودجتٍ تفتح المحرّرَ له وحده
 *   (تخطيطٌ `aw-<رقمه>` يُخزَّن مع التخطيطات ولا يظهر في الآيفون). وما لم يُخصَّص يرسم «الإعداد الافتراضي».
 * - **لوبز+** (W41): غيرُ المشترك يرى ما سيأخذه (أكمل المشاهدة) وبابَ الاشتراك — والإعدادُ المحفوظُ لا يُمسّ.
 * - **الحفظُ زرُّ الترويسة** كالتخصيص، والخادمُ يحكم بالبلس (`needsPlus` يفتح `/plus` لا يصمت).
 */
const KEY = ["me:widget-prefs"] as const;
const ROW = 64;
type Store = { config: WidgetLayoutConfig; layouts: WidgetLayoutEntry[] };

/** شبكةُ كلِّ حجم (W28) — اسمٌ يعرفه الشخصُ من مشغِّله */
const GRID: Record<WidgetSize, string> = { small: "2×2", medium: "4×2", large: "4×4", xl: "4×6" };
/** حجمُ ودجتِ أندرويد من مقاسه الحقيقيّ — الحدودُ نفسُها في الرسّام (`W2Render.sizeOf`) */
function androidSize(p: AndroidPlaced): WidgetSize {
  if (p.w > 0 && p.w < 230) return "small";
  if (p.h < 260) return "medium";
  return p.h < 600 ? "large" : "xl";
}

export function WidgetScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const ios = Platform.OS === "ios";
  const sizes = widgetSizesFor(ios ? "ios" : "android");
  const params = useLocalSearchParams<{ widget?: string }>();

  /* 🆕 W40 — ما على الشاشة الآن: يُقرأ عند الفتح وكلَّ عودةٍ للتطبيق (بعد «أضف ودجت» أو حذفِ واحد) */
  const [placedA, setPlacedA] = useState<AndroidPlaced[] | null>(null);
  const [placedI, setPlacedI] = useState<IosPlaced[]>([]);
  useEffect(() => {
    const read = () => {
      try {
        const r = LoopzWidget?.installedWidgets?.();
        if (!r) return;
        if (ios) void Promise.resolve(r as Promise<IosPlaced[]>).then((x) => setPlacedI(Array.isArray(x) ? x : [])).catch(() => {});
        else setPlacedA(Array.isArray(r) ? (r as AndroidPlaced[]) : []);
      } catch {
        /* بناءٌ أقدمُ بلا الدالّة: لا قائمة */
      }
    };
    read();
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") read(); });
    return () => sub.remove();
  }, [ios]);
  /* أندرويد: الودجتُ الذي يُحرَّر الآن — `null` القائمة، `"default"` الإعدادُ الافتراضيّ، ورقمٌ لودجتٍ بعينه */
  const [editing, setEditing] = useState<number | "default" | null>(() => {
    const n = Number(params.widget);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<WidgetPrefsPayload>("/api/v1/me/prefs/widget")).data, staleTime: 0 });
  const d = q.data;

  const [store, setStore] = useState<Store | null>(null);
  const [base, setBase] = useState("");
  const [active, setActive] = useState(() => {
    const n = Number(params.widget);
    return !ios && Number.isInteger(n) && n > 0 ? ANDROID_WIDGET_LAYOUT(n) : MAIN_LAYOUT;
  });
  /* يُعاد تركيبُ قائمة السحب حين يتبدّل ترتيبُها من خارجها (تبديلُ التخطيط) — لا عند كلِّ إفلات */
  const [nonce, setNonce] = useState(0);
  const [size, setSize] = useState<WidgetSize>("large");
  /* الودجتُ المفتوحُ من رابطه (الضغطُ المطوّل أو «أضف ودجت»): حجمُه حين يُعرف مقاسُه */
  useEffect(() => {
    if (typeof editing !== "number" || !placedA) return;
    const p = placedA.find((x) => x.id === editing);
    if (p) setSize(androidSize(p));
  }, [editing, placedA]);
  const [sheet, setSheet] = useState<WidgetSectionKey | "small" | null>(null);
  /* 🆕 الأقسامُ الفاضيةُ الآن (من الخلاصة المكتوبة للودجت نفسِها) — المعاينةُ لا ترسمها كأنّها ستظهر */
  const empty = useMemo(() => {
    const f = writtenFeed();
    return f ? emptySections(f) : [];
  }, []);
  /* 🆕 شكلُ الودجت كما وصل في الخلاصة — المعاينةُ تحسم به كالودجت نفسِه */
  const look = useMemo(() => sanitizeWidgetLook(writtenFeed()?.v2?.look), []);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState(false);
  const [dragging, setDragging] = useState(false);

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
      /* 🆕 ودجتُ أندرويد لم يُخصَّص بعد: أوّلُ تعديلٍ يصنع تخطيطَه من الإعداد الافتراضيّ (فتحُه وحدَه لا يغيّر شيئاً) */
      if (!s.layouts.some((l) => l.id === active)) {
        return { ...s, layouts: [...s.layouts, { id: active, name: active, config: fn(s.config) }] };
      }
      return { ...s, layouts: s.layouts.map((l) => (l.id === active ? { ...l, config: fn(l.config) } : l)) };
    });
  const setOpt = (k: WidgetSectionKey, patch: Partial<WidgetSectionOpts>) => edit((c) => ({ ...c, opts: { ...c.opts, [k]: { ...c.opts[k], ...patch } } }));

  async function save() {
    if (!store || !dirty || saving) return;
    setSaving(true);
    try {
      /* «الرئيسي» لا يُخزَّن تخطيطاً — هو `config` (لو خُزّن لتجمّد اسمُه بلغة يوم الحفظ) */
      /* 🆕 تخطيطُ ودجتٍ أُزيل من الشاشة يسقط مع الحفظ — لا يتراكم حتى سقف التخطيطات */
      const live = new Set((placedA ?? []).map((p) => ANDROID_WIDGET_LAYOUT(p.id)));
      const keep = (l: WidgetLayoutEntry) => l.id !== MAIN_LAYOUT && (!isAndroidWidgetLayout(l.id) || !placedA || live.has(l.id));
      const body: WidgetPrefsBody = { widget: { config: store.config, layouts: store.layouts.filter(keep) } };
      const out = await write<WidgetPrefsResult>("/api/v1/me/prefs/widget", body);
      if (out.needsPlus) return openWeb("/plus");
      if (!out.ok) throw new Error("save");
      setBase(JSON.stringify(store));
      queryClient.setQueryData<WidgetPrefsPayload>(KEY, (p) => (p ? { ...p, ...store } : p));
      /* الودجتُ على الشاشة يرسم الإعدادَ الجديدَ الآن لا بعد الجلب التالي */
      void refreshWidgets(true);
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
    /* أندرويد: من محرّر ودجتٍ إلى القائمة، ومن القائمة خروج */
    if (!ios && editing !== null) {
      setEditing(null);
      setActive(MAIN_LAYOUT);
      return;
    }
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
      <WidgetPreview config={effectiveWidgetConfig(cfg, plus)} size={size} names={names} platform={ios ? "ios" : "android"} maxHeight={size === "xl" ? 300 : 240} empty={empty} look={look} />
    </>
  );

  /* ───────── غيرُ المشترك: الودجتُ شغّالٌ بالأساسيّ، والتخصيصُ بابُ الاشتراك (🆕 W49 — كان مقفولاً، W41) ───────── */
  if (!plus) {
    return (
      <SettingsScreen title={t.widgetScreenTitle} pinned={pinned}>
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="sparkle-star" size={18} color={tokens.accent} />
            <Text size={15} weight="700">{d.lapsed ? t.widgetPlusLapsedTitle : t.widgetCustomizePlusTitle}</Text>
          </View>
          <Text size={13} muted style={{ lineHeight: 20 }}>{d.lapsed ? t.widgetCustomizeLapsedSub : t.widgetCustomizePlusSub}</Text>
          <Button label={d.lapsed ? t.widgetRenew : t.widgetSubscribe} onPress={() => openWeb("/plus")} style={{ marginTop: 6 }} />
        </View>
        <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{ios ? t.widgetIosHow : t.widgetAndroidHow}</Text>
      </SettingsScreen>
    );
  }

  /* ───────── 🆕 W40 — «على شاشتك الآن» ───────── */
  const summary = (c: WidgetLayoutConfig) => {
    const on = c.order.filter((k) => c.on[k]);
    const head = on.slice(0, 3).map((k) => names[k]).join("، ");
    return on.length > 3 ? `${head} +${on.length - 3}` : head;
  };
  const configOf = (layoutId: string) => store.layouts.find((l) => l.id === layoutId)?.config ?? store.config;
  const placedCard = (key: string, title: string, sub: string, c: WidgetLayoutConfig, sz: WidgetSize, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={() => { haptic.pick(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: tokens.surface }}
    >
      <WidgetPreview thumb config={effectiveWidgetConfig(c, plus)} size={sz} names={names} platform={ios ? "ios" : "android"} maxHeight={sz === "small" ? 84 : 96} look={look} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text size={16} weight="700" numberOfLines={1}>{title}</Text>
        <Text size={12} muted numberOfLines={2}>{sub}</Text>
      </View>
      <Chevron />
    </Pressable>
  );
  const widgetTitle = (p: AndroidPlaced) => `${sizeLabel[androidSize(p)]} · ${GRID[androidSize(p)]}`;
  const openWidget = (p: AndroidPlaced | "default") => {
    if (p === "default") {
      setEditing("default");
      setActive(MAIN_LAYOUT);
      setSize("large");
    } else {
      setEditing(p.id);
      setActive(ANDROID_WIDGET_LAYOUT(p.id));
      setSize(androidSize(p));
    }
    setNonce((x) => x + 1);
  };
  const addWidget = () => {
    let ok = false;
    try {
      ok = LoopzWidget?.requestPin?.() === true;
    } catch {
      ok = false;
    }
    if (!ok) toast.current?.say(t.widgetAddUnsupported);
  };

  /* أندرويد: القائمةُ أوّلاً — ولمسةُ ودجتٍ تفتح المحرّرَ له وحده */
  if (!ios && editing === null) {
    const list = placedA ?? [];
    return (
      <SettingsScreen title={t.widgetScreenTitle} toast={toast} onBack={back}>
        <Text size={17} weight="700" style={{ paddingHorizontal: 4 }}>{list.length ? `${t.widgetOnScreen} · ${list.length}` : t.widgetOnScreen}</Text>
        {list.length === 0 ? <Text size={13} muted style={{ paddingHorizontal: 4 }}>{t.widgetNoneOnScreen}</Text> : null}
        <View style={{ gap: 10 }}>
          {list.map((p) => placedCard(String(p.id), widgetTitle(p), summary(configOf(ANDROID_WIDGET_LAYOUT(p.id))), configOf(ANDROID_WIDGET_LAYOUT(p.id)), androidSize(p), () => openWidget(p)))}
          {placedCard("default", t.widgetDefaultSetup, `${t.widgetDefaultSub} · ${summary(store.config)}`, store.config, "large", () => openWidget("default"))}
        </View>
        <Pressable
          onPress={addWidget}
          accessibilityRole="button"
          style={{ height: 56, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: tokens.divider, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Icon name="plus" size={18} color={tokens.accent} />
          <Text size={15} weight="700">{t.widgetAddToScreen}</Text>
        </Pressable>
        <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.widgetListHint}</Text>
      </SettingsScreen>
    );
  }
  const editorTitle =
    typeof editing === "number"
      ? (() => {
          const p = placedA?.find((x) => x.id === editing);
          return p ? widgetTitle(p) : t.widgetScreenTitle;
        })()
      : editing === "default"
        ? t.widgetDefaultSetup
        : t.widgetScreenTitle;

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
    const n = store.layouts.filter((l) => !isAndroidWidgetLayout(l.id)).length + 1;
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
        <Button
          label={t.setDiscard}
          variant="danger"
          style={{ flex: 1 }}
          onPress={() => {
            setAsk(false);
            if (!ios && editing !== null) {
              /* التعديلُ يُرمى ونعود للقائمة */
              setStore(JSON.parse(base) as Store);
              setEditing(null);
              setActive(MAIN_LAYOUT);
              return;
            }
            if (router.canGoBack()) router.back();
          }}
        />
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
    <SettingsScreen title={editorTitle} toast={toast} onBack={back} action={saveAction} pinned={pinned} overlay={overlay} gestures={{ locked: dragging }}>
      {ios && placedI.length ? (
        /* 🆕 W40 «١ أ» — ما على شاشتك بحجمه وتخطيطه؛ لمستُه تفتح تخطيطَه هنا */
        <View style={{ gap: 8 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetOnScreen}</Text>
          {placedI.map((p, i) => {
            const l = store.layouts.find((x) => x.id === p.layout) ?? store.layouts.find((x) => x.id === MAIN_LAYOUT);
            const fam: WidgetSize = p.family === "small" || p.family === "medium" || p.family === "large" ? p.family : "large";
            return placedCard(`${p.family}-${p.layout}-${i}`, sizeLabel[fam], t.widgetLayoutOf.replace("%s", l?.name ?? ""), l?.config ?? store.config, fam, () => {
              if (l && l.id !== active) {
                setActive(l.id);
                setNonce((x) => x + 1);
              }
              setSize(fam);
            });
          })}
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.widgetIosListHint}</Text>
        </View>
      ) : null}
      {ios ? (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetLayoutsTitle}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {store.layouts.filter((l) => !isAndroidWidgetLayout(l.id)).map((l) => (
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
            onDragChange={setDragging}
          />
        </View>
        <Text size={12} muted style={{ paddingHorizontal: 4, marginTop: 6 }}>{t.widgetDragHint}</Text>
      </View>

      <Group>
        <Row icon="image" title={t.widgetSmallShows} value={smallName} onPress={() => setSheet("small")} />
      </Group>

      <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{ios ? t.widgetIosHow : typeof editing === "number" ? t.widgetThisOnly : t.widgetAndroidHow}</Text>
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
        {k === "cont" ? (
          /* 🆕 W45 — أكملُ المشاهدة الصغير (نصفُ العرض والمربّع): صورةٌ افتراضاً (أحمد «١ أ») أو قائمة */
          block(t.widgetTonightSmall, seg([{ id: "image", label: t.widgetImage }, { id: "list", label: t.widgetList }], opts.small === "list" ? "list" : "image", (v) => onPatch({ small: v as "image" | "list" })))
        ) : null}
        {k === "tonight" ? (
          <>
            {block(t.widgetTonightFull, seg([{ id: "wide", label: t.widgetWide }, { id: "poster", label: t.widgetPosterDetails }], opts.view === "poster" ? "poster" : "wide", (v) => onPatch({ view: v })))}
            {block(t.widgetTonightSmall, seg([{ id: "poster", label: t.widgetPoster }, { id: "list", label: t.widgetList }], opts.small ?? "poster", (v) => onPatch({ small: v as "poster" | "list" })))}
          </>
        ) : null}
        {/* 🆕 W55 — القسمُ الصغيرُ يختار القائمةَ أو البوسترين أيضاً (كان `!small` يخفيه، والرسّامان يرسمانهما في النصف أصلاً) */}
        {list && k !== "act"
          ? block(t.widgetView, seg([{ id: "list", label: t.widgetList }, { id: "posters", label: t.widgetPosters }], opts.view === "posters" ? "posters" : "list", (v) => onPatch({ view: v })))
          : null}
        {list && !small && opts.view !== "posters"
          ? block(t.widgetCount, seg([{ id: "2", label: t.widgetTwo }, { id: "3", label: t.widgetThree }], String(opts.count), (v) => onPatch({ count: v === "3" ? 3 : 2 })))
          : null}
        {/* 🆕 W54 — بوستراتُ «أصدقاؤك» و«للمشاهدة» في الشكل الكامل: ٣ أو ٤ (٤ افتراضاً) تملأ العرض؛ النصفُ يبقى اثنين */}
        {(k === "friends" || k === "tw") && !small && opts.view === "posters"
          ? block(t.widgetPosterCount, seg([{ id: "3", label: t.widgetThree }, { id: "4", label: t.widgetFour }], String(opts.posters === 3 ? 3 : 4), (v) => onPatch({ posters: v === "3" ? 3 : 4 })))
          : null}
        {list && small ? <Text size={12} muted style={{ lineHeight: 18 }}>{t.widgetFixedSmall}</Text> : null}
      </View>
    </Sheet>
  );
}
