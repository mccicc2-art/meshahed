import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "./Sheet";
import { Chip } from "./Chip";
import { api, qk, write, ApiError } from "../api";
import { BROWSE_ERAS, BROWSE_GENRES, genreFitsType } from "@/core/browse";
import { LIBRARY_STATUSES, type LibraryStatus } from "@/core/libraryStatus";
import { MY_RATING_MIN } from "@/core/smartListKeys";
import { FILTER_NAME_MAX, sanitizeFilterName } from "@/core/savedFilters";
import type { ListDetailPayload, SmartListBody, SmartRuleBody } from "../contracts";

/**
 * ====== قائمةٌ ذكيّةٌ من مكتبتك — نسخةُ `LibrarySmartForm` (الويب، D-876/D-877) ======
 * (D-948 — البندُ الثالث: «نموذجُ الشروط»)
 *
 * 🔑 **المفرداتُ من النواة نفسِها** لا نسخةٌ ثانية: `BROWSE_GENRES` و`BROWSE_ERAS`
 * و`genreFitsType` و`LIBRARY_STATUSES` و`MY_RATING_MIN` و`sanitizeFilterName` —
 * **فصفُّ الأنواع هنا هو صفُّ الويب حرفاً**، وما يُضاف هناك يظهر هنا بلا
 * دفعة. والشرطُ يُبنى بالمفاتيح نفسِها (`type` · `wst` · `my` · `g` · `era`)
 * **ويُطهَّر في الخادم** (`sanitizeRule(…, "library")`) — **العميلُ يقترح
 * والخادمُ يقرّر.**
 *
 * الصفوفُ: النوعُ (أفلام · مسلسلات · أنمي — **يُرسم دائماً هنا** لأنّ تبويب
 * «قوائم» لا يقرّره، كما في `ListManager`) · الحالةُ (بلا «أشاهد» للأفلام) ·
 * تقييمي (`7+ 8+ 9+`) · النوعُ الفنّيُّ بحسب النوع · الحقبةُ بلا «القادم».
 * **ولا قائمةَ بلا شرطٍ غيرِ النوع** (`hasRule` — D-636)، ثمّ التسميةُ بحدِّ
 * `FILTER_NAME_MAX` ثمّ الحفظُ. **بلس** يحرسه الخادمُ ويردّ `needsPlus`.
 *
 * 🆕 Phase 11-G (G5) — **والورقةُ نفسُها تعدّل شرطاً قائماً** (`editing`، وصفةُ `LibrarySmartForm.editing` حرفاً):
 * الرقاقاتُ تُسبَق بالشرط الحاليّ، **والنوعُ مجمَّد** (تغييرُه يقلب القائمةَ كلَّها — الويبُ يجمّده أيضاً)، والزرُّ
 * «حدّث شرط …» يكتب `POST /api/v1/lists/smart-rule` ولا تسميةَ. يُقفل بابُ `/library?edit=<id>` الويبيّ في
 * التطبيق (كان في بطاقة القائمة وفي صفحتها). حين لا يصل الشرطُ مع `editing` (بطاقةُ المكتبة تعرف الاسمَ والمصدرَ
 * فقط) تقرؤه الورقةُ من `/api/v1/lists/<id>` — الاستعلامُ نفسُه الذي تملكه صفحةُ القائمة، فلا نداءَ إن كانت مفتوحة.
 */
export function SmartListSheet({
  onClose,
  onCreated,
  onNeedsPlus,
  onError,
  editing,
  onUpdated,
}: {
  onClose: () => void;
  onCreated: (id: string | null, name: string) => void;
  onNeedsPlus: () => void;
  onError: (e: unknown) => void;
  /** G5 — قائمةٌ ذكيّةٌ (مصدرُها المكتبة) يُعدَّل شرطُها؛ `rule` إن كان بيد المنادي وإلّا يُجلب */
  editing?: { id: string; name: string; rule?: Record<string, string> | null } | null;
  onUpdated?: (id: string) => void;
}) {
  const { t, tokens, locale } = useApp();
  const ar = locale !== "en";
  const [type, setType] = useState<"movie" | "tv" | "all" | null>(null);
  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [my, setMy] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [era, setEra] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  /* G5 — الشرطُ الحاليّ: من المنادي، وإلّا من صفحة القائمة (المفتاحُ نفسُه `list:<id>`) */
  const needRule = !!editing && editing.rule === undefined;
  const detail = useQuery({
    queryKey: qk.list(editing?.id ?? ""),
    queryFn: async () => (await api<ListDetailPayload>(`/api/v1/lists/${editing?.id}`)).data,
    enabled: needRule,
    staleTime: 60_000,
  });
  const current = editing ? (editing.rule !== undefined ? editing.rule : detail.data?.smart_rule) : undefined;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!editing || seeded || !current) return;
    const tp = current.type;
    setType(tp === "movie" || tp === "tv" || tp === "all" ? tp : null);
    setStatus((LIBRARY_STATUSES as readonly string[]).includes(current.wst ?? "") ? (current.wst as LibraryStatus) : null);
    setMy((MY_RATING_MIN as readonly string[]).includes(current.my ?? "") ? current.my : null);
    setGenre(current.g ?? null);
    setEra(current.era ?? null);
    setSeeded(true);
  }, [editing, current, seeded]);

  const genres = useMemo(() => (type ? BROWSE_GENRES.filter((g) => genreFitsType(g, type)) : []), [type]);

  const rule: Record<string, string> = type ? { type } : {};
  if (status) rule.wst = status;
  if (my) rule.my = my;
  if (genre) rule.g = genre;
  if (era) rule.era = era;
  const hasRule = !!type && Object.keys(rule).length > 1;

  const statusLabel: Record<LibraryStatus, string> = {
    unstarted: t.libStatusUnstarted,
    watching: t.libStatusWatching,
    completed: t.libStatusCompleted,
    dropped: t.libStatusDropped,
  };
  const toggle = <T,>(set: (v: T | null) => void, cur: T | null, v: T) => set(cur === v ? null : v);

  /* G5 — التحديث: الشرطُ نفسُه إلى `smart-rule`؛ الاسمُ لا يُمسّ (يُعدَّل من ورقة التحرير) */
  const update = async () => {
    if (!editing || busy) return;
    if (!hasRule) {
      setHint(t.librarySmartNeedsRule);
      return;
    }
    setBusy(true);
    try {
      const r = await write<{ ok: boolean; needsPlus?: true }>("/api/v1/lists/smart-rule", { listId: editing.id, rule } satisfies SmartRuleBody);
      if (r.needsPlus) {
        onNeedsPlus();
        return;
      }
      onUpdated?.(editing.id);
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error("apiInternal"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!hasRule) {
      setHint(t.librarySmartNeedsRule);
      return;
    }
    const clean = sanitizeFilterName(name);
    if (!clean || busy) return;
    setBusy(true);
    try {
      const r = await write<{ id: string | null; needsPlus?: true }>("/api/v1/lists/smart", { name: clean, rule } satisfies SmartListBody);
      if (r.needsPlus) {
        onNeedsPlus();
        return;
      }
      onCreated(r.id, clean);
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error("apiInternal"));
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, children: React.ReactNode) => (
    <View>
      <Text size={12} muted style={{ marginBottom: 6 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}>
        {children}
      </ScrollView>
    </View>
  );

  return (
    <Sheet title={editing ? editing.name : t.smartListLabel} onClose={onClose}>
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {editing && !current ? (
          <Text size={13} muted style={{ textAlign: "center", paddingVertical: 32 }}>{detail.isError ? t.apiInternal : t.loadingLabel}</Text>
        ) : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="sparkle-star" size={12} color={tokens.accent} />
            <Text size={12} weight="700" muted>{t.librarySmartGroup}</Text>
          </View>
          <Text size={12} muted style={{ marginTop: -8, lineHeight: 18 }}>{editing ? t.smartListEditHint(editing.name) : t.librarySmartHint}</Text>

          {/* G5 — النوعُ مجمَّدٌ عند التعديل (كالويب: `LibrarySmartForm` لا يرسم صفَّه حين `editing`) */}
          {editing ? null : row(
            t.librarySmartType,
            (
              [
                { v: "movie", label: t.shortMovies },
                { v: "tv", label: t.shortShows },
                { v: "all", label: t.discoverTabAnime },
              ] as const
            ).map((o) => <Chip key={o.v} label={o.label} active={type === o.v} onPress={() => toggle(setType, type, o.v)} />),
          )}
          {row(
            t.librarySmartStatus,
            LIBRARY_STATUSES.filter((s) => type !== "movie" || s !== "watching").map((s) => (
              <Chip key={s} label={statusLabel[s]} active={status === s} onPress={() => toggle(setStatus, status, s)} />
            )),
          )}
          {row(
            t.librarySmartMyRating,
            MY_RATING_MIN.map((n) => <Chip key={n} label={`${n}+`} active={my === n} onPress={() => toggle(setMy, my, n)} />),
          )}
          {genres.length > 0
            ? row(
                t.librarySmartGenre,
                genres.map((g) => <Chip key={g.slug} label={ar ? g.ar : g.en} active={genre === g.slug} onPress={() => toggle(setGenre, genre, g.slug)} />),
              )
            : null}
          {row(
            t.librarySmartEra,
            BROWSE_ERAS.filter((e) => !e.upcoming).map((e) => (
              <Chip key={e.slug} label={ar ? e.ar : e.en} active={era === e.slug} onPress={() => toggle(setEra, era, e.slug)} />
            )),
          )}

          {hint ? <Text size={12} color={tokens.error}>{hint}</Text> : null}

          {editing ? (
            <Button label={t.smartListUpdate(editing.name)} busy={busy} disabled={!hasRule} onPress={() => void update()} />
          ) : naming ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                autoFocus
                value={name}
                onChangeText={setName}
                onSubmitEditing={() => void submit()}
                maxLength={FILTER_NAME_MAX}
                placeholder={ar ? "سمِّ القائمة الذكيّة" : "Name this smart list"}
                placeholderTextColor={tokens.muted}
                returnKeyType="done"
                style={{ flex: 1, minHeight: 40, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 12, fontSize: 14, color: tokens.fg }}
              />
              <Button label={ar ? "حفظ" : "Save"} busy={busy} disabled={!sanitizeFilterName(name)} onPress={() => void submit()} />
            </View>
          ) : (
            <View style={{ alignItems: "flex-start" }}>
              <Chip
                label={t.smartListLabel}
                active={false}
                leading={<Icon name="sparkle-star" size={12} color={tokens.muted} />}
                onPress={() => {
                  if (hasRule) {
                    setHint(null);
                    setNaming(true);
                  } else setHint(t.librarySmartNeedsRule);
                }}
              />
            </View>
          )}
        </View>
        )}
      </ScrollView>
    </Sheet>
  );
}
