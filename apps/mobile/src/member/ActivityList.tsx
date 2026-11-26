import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { Chip } from "../library/Chip";
import { Segmented } from "../library/ToolsSheet";
import { Sheet } from "../library/Sheet";
import { StatusPill } from "../settings/ui";
import { num } from "@/core/i18n";
import { SCOPES, clock, dayKey, dayLabel, episodeOf, groupWeeks, keep, label as scopeLabel, shiftDay, totalsLine, verbOf, weekIndexOf, type ActivityItem, type Scope, type WatchSource } from "@/core/activityDays";
import type { ProfileActivity } from "@/core/contracts/profile";
import { SIGNAL_SOURCE_NAME } from "@/core/contracts/stremio";
import { tabSwipeBlocksPress } from "../TabSlide";
import { WeekStrip } from "./WeekStrip";

/**
 * 🆕 D-1213 — **قائمةُ النشاط مكوّنٌ واحدٌ لشاشتين** (القاعدة ٣): تبويبُ «النشاط» في ملفّ الشخص (N1) وشاشةُ «النشاط»
 * الأصليّة (`/activity` — سجلُّك أنت). نُقلت من `ProfileScreen` بحرفها؛ الفرقُ الوحيد نصُّ الفراغ (لكلِّ شاشةٍ جملتُها).
 */
const PAGE_PAD = 16;

/** النشاط — شاشةُ `/activity` بقواعدها (`core/activityDays` — الويبُ يقرأ الملفَّ نفسَه): الرقاقات · حصيلةُ الأسبوع · الأيّام */
/**
 * 🆕 D-1504 — **سجلُّ المشاهدة** (تصميمُ «أ»، اختيارُ أحمد ٢٧ أكتوبر). ثلاثةُ أشياءَ تُضاف ولا يتغيّر غيرُها:
 * - `initialScope` — بابُ «سجلّ المشاهدة» في القائمة الجانبيّة يفتح الشاشةَ نفسَها على رقاقة «مشاهدة» (`/activity?scope=watch`)؛
 *   لا شاشةَ ثانية لسجلٍّ واحد (القاعدة ٣).
 * - على رقاقة «مشاهدة» يصير سطرُ «هذا الأسبوع» **ثلاثةَ أرقام**: حلقات · أفلام · ساعات — والصفُّ المدموجُ يكتب عددَ حلقاته.
 * - `onRemove` — **سجلُّك وحدَه**: ضغطةٌ مطوّلةٌ على صفِّ مشاهدةٍ تفتح الورقةَ الواحدة (`Sheet`) بـ«صفحة العمل» و«ما شفتها،
 *   احذفها من السجل» بتأكيدٍ في الوسط (وصفةُ `FeedMenu`، D-1448) — **لأن التسجيلَ التلقائيّ قادم، ومن يرى خطأً لا يقدر
 *   على تصحيحه يفقد الثقةَ بالسجلّ كلِّه**. ملفُّ غيرك بلا `onRemove` فلا ضغطةَ مطوّلة.
 */
export function ActivityList({
  rows,
  onTitle,
  onReview,
  emptyText,
  initialScope = "all",
  scope: scopeIn,
  onRemove,
  onMoveDay,
}: {
  rows: ProfileActivity[];
  onTitle: (k: "tv" | "movie", id: number) => void;
  /** 🆕 T525 — صفُّ «راجع» بنصّه يفتح المراجعةَ («٣أ»: سطران والضغطُ يفتحها)؛ غيابُه ⇒ صفحةُ العمل كما كانت */
  onReview?: (k: "tv" | "movie", id: number) => void;
  emptyText: string;
  initialScope?: Scope;
  /**
   * 🆕 T526 — **رقاقةٌ يملكها صاحبُ الشاشة**: سجلُّك (`MyActivityScreen`) يرسم الرقاقاتِ فوق `TabSlide` ولوحاً لكلِّ رقاقةٍ يُسحب إليه
   * («١أ»: «امكانية اللف بالايماء»)؛ فيمرّر رقاقةَ اللوح هنا ولا تُرسم الرقاقاتُ مرّةً ثانية. غيابُه ⇒ الرقاقاتُ هنا كما كانت (ملفُّ الشخص،
   * وسحبُه الأفقيُّ ملكُ تبويبات الملفّ).
   */
  scope?: Scope;
  /** يرجع `true` إن حُذف — والفشلُ يقوله صاحبُ الشاشة بنخبه ويُبقي الورقةَ مفتوحة لمحاولةٍ ثانية */
  onRemove?: (item: ActivityItem) => Promise<boolean>;
  /** 🆕 D-1505 — «غيّر يوم المشاهدة»: إزاحةُ أيّام (سالبةٌ إلى الماضي) — سجلُّك وحدَه، كـ`onRemove` */
  onMoveDay?: (item: ActivityItem, shiftDays: number) => Promise<boolean>;
}) {
  const { t, tokens, locale } = useApp();
  const [scopeOwn, setScope] = useState<Scope>(initialScope);
  const scope = scopeIn ?? scopeOwn;
  const [menu, setMenu] = useState<ActivityItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeMenu = () => {
    setMenu(null);
    setConfirm(false);
    setMoving(false);
  };
  /* 🆕 D-1505 — الأيّامُ السبعة الأخيرة: يومُ الصفِّ مختارٌ، والضغطُ على غيره يزيح بالفرق */
  const moveTo = async (key: string) => {
    if (!menu || !onMoveDay || busy) return;
    const from = dayKey(menu.at, true);
    const toDate = (k: string) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
    };
    const shift = Math.round((toDate(key) - toDate(from)) / 86_400_000);
    if (!shift) return;
    setBusy(true);
    try {
      if (await onMoveDay(menu, shift)) {
        haptic.pick();
        closeMenu();
      }
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!menu || !onRemove) return;
    setBusy(true);
    try {
      if (await onRemove(menu)) {
        haptic.pick();
        closeMenu();
      }
    } finally {
      setBusy(false);
    }
  };
  const items: ActivityItem[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        at: r.at,
        mediaType: r.media_type,
        tmdbId: r.tmdb_id,
        title: r.title,
        poster: r.poster,
        season: r.season,
        episode: r.episode,
        rating: r.rating,
        listName: r.list_name,
        runtime: r.runtime ?? null,
        source: r.source ?? null,
        review: r.review ?? null,
        spoiler: r.spoiler ?? false,
      })),
    [rows],
  );
  const matching = items.filter((it) => keep(it, scope));
  const today = dayKey(new Date().toISOString(), true);
  /* 🆕 «ت٢ ب» — شريطُ الأسبوع في «مشاهدة» و«الكلّ» («س٥أ») مكانَ بطاقة الحصيلة: الضغطُ على يومٍ يصفّي القائمة إليه */
  const strip = scope === "watch" || scope === "all";
  const watched = useMemo(() => items.filter((it) => it.kind === "watch"), [items]);
  const [stripWeek, setStripWeek] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const oldest = useMemo(() => watched.reduce((n, it) => Math.max(n, weekIndexOf(dayKey(it.at, true), today)), 0), [watched, today]);
  const shown = strip && day ? matching.filter((it) => dayKey(it.at, true) === day) : matching;
  /* 🆕 T526 — أسابيعُ بعناوينها وحصيلتها (`groupWeeks`) — أسابيعُ تقويميّةٌ من الأحد (ق٢أ) */
  const weeks = groupWeeks(shown, true, t, locale, today);
  /* سطرُ «افتح المراجعة» في نشاط الملفّ وحدَه («في اكتفتي الملف يبقى أ»)؛ سجلُّك يكتفي بأنّ الصفَّ يُضغط («١ب») */
  const openHint = !onRemove;
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: scopeIn ? 6 : 14 }}>
      {scopeIn ? null : (
        /* «ت٥أ» (أحمد ٢٦ نوفمبر): النطاقاتُ عائلةُ المقسّم بخطٍّ أصفر تتمرّر — لا كبسولات */
        <Segmented
          scroll
          items={SCOPES.map((s) => ({ id: s, label: scopeLabel(s, t) }))}
          value={scope}
          onChange={(v) => (v === scope ? undefined : (haptic.pick(), setScope(v as typeof scope)))}
        />
      )}
      {strip && watched.length ? (
        <WeekStrip items={watched} index={stripWeek} onIndex={setStripWeek} maxIndex={oldest} selected={day} onSelect={setDay} />
      ) : null}
      {strip && day ? (
        /* يومٌ مختار: القائمةُ يومُه وحدَه، و«كلّ الأسبوع» يعيدها */
        <Pressable onPress={() => (haptic.pick(), setDay(null))} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "flex-end", marginTop: 10 }}>
          <Text size={13} weight="700" color={tokens.accent}>{t.weekAll}</Text>
        </Pressable>
      ) : null}
      {weeks.length === 0 ? (
        <Text muted style={{ textAlign: "center", paddingVertical: 40, paddingHorizontal: PAGE_PAD }}>{emptyText}</Text>
      ) : (
        weeks.map((w) => (
          <View key={w.index} style={{ marginTop: 18 }}>
            {strip && day ? null : (
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
                <Text size={16} weight="800">{w.label}</Text>
                <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{totalsLine(w.totals, t)}</Text>
              </View>
            )}
            {w.days.map((day) => (
              <View key={day.key} style={{ marginTop: 12 }}>
                <Text size={13} weight="600" muted style={{ marginBottom: 2 }}>{day.label}</Text>
                {day.rows.map((r) => {
                  const ep = episodeOf(r, t);
                  /* «راجع» يقول ما كُتب، والضغطُ يفتح المراجعة نفسَها (T525 · «٣أ») */
                  const written = r.kind === "review" && (r.review || r.spoiler) ? true : false;
                  const menuable = !!onRemove && r.kind === "watch";
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        /* سحبةٌ بين اللوحين لا تفتح صفّاً (حارسُ `TabSlide` في أبواب الفتح) */
                        if (tabSwipeBlocksPress()) return;
                        if (written && onReview) onReview(r.mediaType, r.tmdbId);
                        else onTitle(r.mediaType, r.tmdbId);
                      }}
                      onLongPress={menuable ? () => (haptic.pick(), setMenu(r)) : undefined}
                      accessibilityRole="link"
                      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                      <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                        {r.poster ? <Image source={{ uri: r.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        {/* الفعلُ سطرٌ صغيرٌ فوق العنوان — وعلى «مشاهدة» يسقط: كلُّ صفٍّ هناك مشاهدة */}
                        {scope === "watch" ? null : <Text size={12} muted numberOfLines={1}>{verbOf(r, t)}{r.kind === "list" && r.listName ? ` ${t.actVerbTo} ${r.listName}` : ""}</Text>}
                        <Text size={15} weight="700" numberOfLines={1}>{r.title}</Text>
                        {/* 🆕 T526 «ج» — نصُّ المراجعة مكانَ السطر الثاني تحت العنوان، والنجمةُ والوقتُ بعده؛ والحرقُ يُقال ولا يُعرض */}
                        {r.kind === "review" && r.spoiler ? (
                          <Text size={12} muted>{t.spoilerMark}</Text>
                        ) : r.kind === "review" && r.review ? (
                          <Text autoDir size={13} numberOfLines={2} style={{ lineHeight: 19, opacity: 0.85 }}>{r.review}</Text>
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          {ep ? <StatusPill label={ep} color={tokens.fg} /> : null}
                          {r.rating != null ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Icon name="star" size={12} color={tokens.accent} />
                              <Text size={12} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(r.rating, locale)}</Text>
                            </View>
                          ) : null}
                          <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{clock(r.at, locale, true)}</Text>
                          {r.source ? <StatusPill label={sourceLabel(r.source, t)} color={r.source === "auto" ? tokens.accent : tokens.muted} /> : null}
                        </View>
                        {written && onReview && openHint && !r.spoiler ? <Text size={12} weight="700" color={tokens.accent}>{`${t.activityOpenReview} ›`}</Text> : null}
                      </View>
                      {/* زرُّ ⋯ ظاهرٌ على صفِّ المشاهدة في سجلّك — كانت الورقةُ خلف ضغطةٍ مطوّلةٍ لا يعرفها أحد (والمطوّلةُ باقية) */}
                      {menuable ? (
                        <Pressable onPress={() => (haptic.pick(), setMenu(r))} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.historyRowMenu} style={{ padding: 4 }}>
                          <Icon name="dots" size={18} color={tokens.muted} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))
      )}
      {menu && moving ? (
        <Sheet title={t.historyMoveDay} onClose={closeMenu} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 14 }}>{t.historyMoveDayHint}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, opacity: busy ? 0.6 : 1 }}>
            {Array.from({ length: 7 }, (_, i) => shiftDay(today, -i)).map((k, i) => (
              <Chip
                key={k}
                label={i === 0 ? t.diaryToday : i === 1 ? t.diaryYesterday : dayLabel(k, locale)}
                active={k === dayKey(menu.at, true)}
                onPress={() => void moveTo(k)}
              />
            ))}
          </View>
        </Sheet>
      ) : menu && confirm ? (
        <Sheet title={t.historyRemoveAction} onClose={closeMenu} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>{t.historyRemoveConfirm}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t.cancelLabel} variant="ghost" onPress={closeMenu} />
            <View style={{ flex: 1 }}>
              <Button label={t.historyRemoveAction} variant="danger" busy={busy} onPress={() => void remove()} />
            </View>
          </View>
        </Sheet>
      ) : menu ? (
        <Sheet title={menu.title} onClose={closeMenu}>
          <Pressable
            onPress={() => {
              const m = menu;
              closeMenu();
              onTitle(m.mediaType, m.tmdbId);
            }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name={menu.mediaType === "tv" ? "tv" : "film"} size={19} color={tokens.fg} />
            <Text size={14}>{t.postMenuOpenTitle(menu.title)}</Text>
          </Pressable>
          {onMoveDay ? (
            <Pressable onPress={() => setMoving(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="calendar" size={19} color={tokens.fg} />
              <Text size={14}>{t.historyMoveDay}</Text>
            </Pressable>
          ) : null}
          <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          <Pressable onPress={() => setConfirm(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="trash" size={19} color={tokens.error} />
            <Text size={14} color={tokens.error}>{t.historyRemove}</Text>
          </Pressable>
        </Sheet>
      ) : null}
    </View>
  );
}

/** 🆕 D-1505 — اسمُ المصدر في شارة الصفّ */
function sourceLabel(s: WatchSource, t: ReturnType<typeof useApp>["t"]): string {
  /* 🆕 هجرة ٢٣٥ — سيرفراتُ البيت أسماءُ منتجاتٍ لا تُترجم */
  if (s === "plex" || s === "jellyfin" || s === "emby" || s === "kodi" || s === "nuvio") return SIGNAL_SOURCE_NAME[s];
  /* 🆕 هجرة ٢٦٥ — مزامنةُ نتفليكس: اسمُ منتجٍ لا يُترجم */
  if (s === "netflix") return "Netflix";
  if (s === "osn") return "OSN+";
  /* 🆕 المهمّة ٥٦٧ — شاهد بلغة القارئ */
  if (s === "shahid") return t.shahidName;
  return s === "stremio" ? t.srcStremio : s === "widget" ? t.srcWidget : s === "import" ? t.srcImport : t.srcAuto;
}
