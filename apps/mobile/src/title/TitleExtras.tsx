import React, { useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { radius } from "../theme";
import { posterUrl, profileUrl } from "@/core/media";
import { num } from "@/core/i18n";
import type { FavoriteBody, ListToggleItemBody, TitleExtrasPayload } from "../contracts";

/**
 * ====== ملحقاتُ صفحة العمل أصليّةً — Phase 11-D · D2 (D-956) ======
 *
 * ردٌّ ثانٍ (`/api/v1/title/{kind}/{id}/extras`) يلحق بالبطل: **سطرُ IMDb/RT/العمر**
 * (`HeroRatings`) و**نبضُ العمل** (`TitlePulse`) و**أين أشاهده** (`WatchChip` —
 * ورقةٌ بمجموعات اشتراك/مجّاني/إيجار/شراء وروابطِ المزوّدين؛ بلا رابطٍ ⇢ بحثٌ في
 * المزوّد) و**المفضّل** و**«إلى قائمة»** (`TitleActions`) و**الطاقم** (`CastRail` —
 * الوجهُ إلى `/person/:id` باباً) و**السلسلةُ والمشابهات** (`RelatedTitles` — دفعٌ إلى
 * شاشة العمل نفسِها). **لا يحبس البطلَ**: كلُّ قسمٍ يظهر حين يصل.
 */
export const extrasKey = (kind: "tv" | "movie", id: number) => ["title:extras", kind, id] as const;

export function useExtras(kind: "tv" | "movie", id: number) {
  return useQuery({
    queryKey: extrasKey(kind, id),
    queryFn: async () => (await api<TitleExtrasPayload>(`/api/v1/title/${kind}/${id}/extras`)).data,
    staleTime: 5 * 60_000,
  });
}

/** سطرُ التقييمات الخارجيّة + النبض — تحت الأنواع في البطل */
/** D-1020 — `compact`: IMDb وRT وحدَهما في سطر الترويسة (النبضُ يبقى في المجتمع) */
/**
 * 🆕 D-1030 — **نبضُ المجتمع قطعةٌ واحدة** (طلبُ أحمد بلقطتين: «حطّ تقييم المجتمع مثل ما هو ظاهر في
 * الويب فيو» — في طرف سطر الاسم): نجمةٌ بمتوسّط تقييمهم وعددُهم بين قوسين — شكلُ الويب
 * (`★ 9.0 (2)`) **بلا القلب** (حكمُ أحمد أدناه). كان مرسوماً داخل `RatingsLine` غيرِ المضغوط وحدَه، والترويسةُ
 * (المضغوطة) لا تراه. **استخراجٌ لا نسخ** (درسُ D-289): المكانان يقرآن هذا المكوّن. والبياناتُ `x.pulse`
 * في الردّ أصلاً. عملٌ بلا قلبٍ ولا تقييم لا يرسم شيئاً — صفرٌ بجانب قلبٍ إعلانُ فراغ.
 */
export function Pulse({ x, mine, onPress }: { x: TitleExtrasPayload | undefined; mine?: number | null; onPress?: () => void }) {
  const { t, tokens, locale } = useApp();
  const p = x?.pulse;
  /* 🆕 D-1034 — **النجمةُ بابُ التقييم الدائم** حين يُمرَّر `onPress` (الترويسة): صفُّ النجوم حُذف و«شاهدته»
     قلّاب، فلا بدّ من بابٍ للتعديل ولمن يقيّم في منتصف الموسم. فبلا مقيِّمين تُرسم **نجمةٌ مفرَّغةٌ خافتة**
     بدل الفراغ — بابٌ يختفي حين لا أحدَ قيّم بابٌ مكسور. وممتلئةٌ لمن قيّم. */
  if (onPress)
    return (
      <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.rateTitle} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.7 : 1 })}>
        <Icon name={p && p.votes > 0 || mine != null ? "star-filled" : "star"} size={p && p.votes > 0 ? 13 : 16} color={p && p.votes > 0 || mine != null ? tokens.accent : tokens.muted} />
        {p && p.votes > 0 ? (
          <>
            <Text size={12} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{p.avg.toFixed(1)}</Text>
            <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>({num(p.votes, locale)})</Text>
          </>
        ) : null}
      </Pressable>
    );
  /* ⚖️ حكمُ أحمد على المسودّة: «القلب شيله، بس تقييم المجتمع» — النجمةُ والمتوسّطُ والعددُ وحدَها.
     القلبُ عدّادُ إعجابٍ لا تقييم، ومكانُه تبويبُ المجتمع. فبلا مقيِّمين لا يُرسم شيء. */
  if (!p || p.votes === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {p.votes > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="star-filled" size={13} color={tokens.accent} />
          <Text size={12} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{p.avg.toFixed(1)}</Text>
          <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>({num(p.votes, locale)})</Text>
        </View>
      ) : null}
    </View>
  );
}

export function RatingsLine({ x, compact = false }: { x: TitleExtrasPayload | undefined; compact?: boolean }) {
  const { tokens } = useApp();
  if (!x) return null;
  const r = x.ratings;
  const p = x.pulse;
  if (!r && p.hearts === 0 && p.votes === 0) return null;
  if (compact && !r?.imdb && !r?.rt) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: compact ? 2 : 6 }}>
      {r?.imdb ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text size={9} weight="800" color="#F5C518">IMDb</Text>
          <Text size={13} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{r.imdb}</Text>
        </View>
      ) : null}
      {r?.rt ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text size={9} weight="800" color="#FA320A">RT</Text>
          <Text size={13} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{r.rt}</Text>
        </View>
      ) : null}
      {r?.rated ? (
        <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text size={10} weight="700" muted>{r.rated}</Text>
        </View>
      ) : null}
      {!compact ? <Pulse x={x} /> : null}
    </View>
  );
}

/** «أين أشاهده» — رقاقةٌ تفتح ورقةَ المزوّدين (نسخةُ `WatchChip`) */
/**
 * D-1020 — `icon`: صيغةُ الترويسة (أسفل يمين الصورة)؛ الضغطُ يفتح الورقةَ نفسَها.
 * D-1111 — صارت رقاقةَ شاشةٍ بكلمة بدل شعار المنصّة الأولى؛ ثمّ D-1119 — مربّعُ شاشةٍ بعدد منصّات الاشتراك.
 */
export function WatchWhere({ x, icon = false }: { x: TitleExtrasPayload | undefined; icon?: boolean }) {
  const { t, tokens, locale } = useApp();
  const [open, setOpen] = useState(false);
  if (!x?.watch) return null;
  const w = x.watch;
  const label = (k: "flatrate" | "free" | "rent" | "buy") =>
    locale === "en" ? { flatrate: "Subscription", free: "Free", rent: "Rent", buy: "Buy" }[k] : { flatrate: "اشتراك", free: "مجّاني", rent: "إيجار", buy: "شراء" }[k];
  const first = w.groups[0]?.providers.slice(0, 3) ?? [];
  return (
    <>
      {icon ? (
        /* D-1111 ⇒ 🆕 D-1119 — **مربّعُ شاشةٍ زجاجيٌّ بعدد المنصّات** (أحمد بدّل اختيارَه من «E» الرقاقة إلى
           «B»، ثمّ: «لا يحسب الإيجار والشراء — بس منصّات العرض الرسميّة باشتراك»). المربّعُ زجاجُ زرّي الرجوع
           والنقاط فوقه نفسُه (`rgba(0,0,0,.45)`) ومقاسُ الشعار القديم (٤٠ · D-1020) — لا شكلَ جديد في الترويسة.
           **الرقمُ عددُ منصّات الاشتراك وحدَها** — الإيجارُ والشراءُ متجرٌ لا «أين يُعرض»، ويبقيان في الورقة.
           🆕 D-1137 — **والرقمُ يظهر من واحد** (أحمد بلقطةٍ محوَّطة على The Pitt: «لأنّه منصّة وحدة ما يطلع رقم ..
           إذا منصّة وحدة خلّه يظهر رقم 1»): غيابُه عند الواحد كان يُقرأ «لا منصّة» لا «منصّةٌ واحدة» — ينقض ذيلَ D-1119.
           ويغيب عند الصفر وحده (لا اشتراك: إيجارٌ أو شراءٌ فقط). والورقةُ نفسُها تفتح. */
        (() => {
          const subs = w.groups.find((g) => g.key === "flatrate")?.providers.length ?? 0;
          return (
            <Pressable
              onPress={() => setOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={subs > 0 ? `${t.watchWhereTitle} · ${num(subs, locale)}` : t.watchWhereTitle}
              hitSlop={6}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.control, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
            >
              <Icon name="tv" size={20} color="#fff" />
              {subs > 0 ? (
                <View style={{ position: "absolute", top: -6, end: -6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: tokens.accent, borderWidth: 2, borderColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
                  <Text size={11} weight="700" color={tokens.bg} style={{ lineHeight: 13 }}>{num(subs, locale)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })()
      ) : (
      <Pressable onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingStart: 6, paddingEnd: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
        <View style={{ flexDirection: "row" }}>
          {first.map((p, i) => (
            <View key={p.id} style={{ width: 24, height: 24, borderRadius: 6, overflow: "hidden", marginStart: i ? -6 : 0, borderWidth: 1, borderColor: tokens.bg, backgroundColor: tokens.surface2 }}>
              {p.logo_path ? <Image source={{ uri: `https://image.tmdb.org/t/p/w92${p.logo_path}` }} style={{ width: "100%", height: "100%" }} /> : null}
            </View>
          ))}
        </View>
        <Text size={13} weight="600">{t.watchWhereTitle}</Text>
        <Icon name="chevron-down" size={12} color={tokens.muted} />
      </Pressable>
      )}
      {open ? (
        <Sheet title={t.watchWhereTitle} onClose={() => setOpen(false)}>
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              {w.groups.map((g) => (
                <View key={g.key} style={{ gap: 6 }}>
                  <Text size={12} weight="700" muted>{label(g.key)}</Text>
                  {g.providers.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => void Linking.openURL(p.link ?? `https://www.google.com/search?q=${encodeURIComponent(p.name)}`)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                        {p.logo_path ? <Image source={{ uri: `https://image.tmdb.org/t/p/w92${p.logo_path}` }} style={{ width: "100%", height: "100%" }} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text size={14} weight="600">{p.name}</Text>
                        {!p.link ? <Text size={11} muted>{t.provSearchIn(p.name)}</Text> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}
              <Text size={11} muted>{t.provJustwatch}</Text>
            </View>
          </ScrollView>
        </Sheet>
      ) : null}
    </>
  );
}

/** القلبُ في الترويسة — تفاؤلٌ ثمّ الحالةُ الحقيقيّة من الخادم */
export function FavoriteButton({ kind, id, name, posterPath, x }: { kind: "tv" | "movie"; id: number; name: string; posterPath: string | null; x: TitleExtrasPayload | undefined }) {
  const { t, tokens } = useApp();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => write<{ favorite: boolean }>("/api/v1/track/favorite", { tmdbId: id, mediaType: kind, title: name, posterPath } satisfies FavoriteBody),
    onMutate: () => qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) => (prev ? { ...prev, favorite: !prev.favorite } : prev)),
    onSuccess: (r) => qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) => (prev ? { ...prev, favorite: r.favorite } : prev)),
    onError: () => qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) => (prev ? { ...prev, favorite: !prev.favorite } : prev)),
  });
  if (!x) return null;
  return (
    <Pressable onPress={() => m.mutate()} hitSlop={10} accessibilityLabel={t.favAria} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
      <Icon name={x.favorite ? "heart-filled" : "heart"} size={20} color={x.favorite ? tokens.accent : tokens.fg} />
    </Pressable>
  );
}

/** «إلى قائمة» — ورقةٌ بقوائمي وعلاماتِ الاحتواء (نسخةُ ورقة `TitleActions`) */
/**
 * D-1014 — ورقةُ «إلى قائمة» وحدَها: صفُّ الأفعال الجديد يفتحها مباشرةً بلا زرٍّ وسيط،
 * و`AddToListButton` تبقى لمن ينادي الزرَّ (لا مستدعيَ لها في صفحة العمل بعد اليوم).
 */
export function ListSheet({ kind, id, name, posterPath, x, onNewList, onClose }: { kind: "tv" | "movie"; id: number; name: string; posterPath: string | null; x: TitleExtrasPayload | undefined; onNewList: () => void; onClose: () => void }) {
  const { t, tokens } = useApp();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ listId, add }: { listId: string; add: boolean }) =>
      write<{ done: true }>("/api/v1/lists/toggle-item", { listId, tmdbId: id, mediaType: kind, title: name, posterPath, add } satisfies ListToggleItemBody),
    onMutate: ({ listId, add }) =>
      qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) =>
        prev ? { ...prev, containing: add ? [...new Set([...prev.containing, listId])] : prev.containing.filter((v) => v !== listId) } : prev,
      ),
    onError: (_e, { listId, add }) =>
      qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) =>
        prev ? { ...prev, containing: add ? prev.containing.filter((v) => v !== listId) : [...prev.containing, listId] } : prev,
      ),
  });
  if (!x) return null;
  return (
    <Sheet title={t.listAddTo} onClose={onClose}>
      <View style={{ gap: 4 }}>
        {x.my_lists.length === 0 ? <Text size={13} muted>{t.listNoLists}</Text> : null}
        {x.my_lists.map((l) => {
          const on = x.containing.includes(l.id);
          return (
            <Pressable key={l.id} onPress={() => m.mutate({ listId: l.id, add: !on })} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                {on ? <Icon name="check-line" size={13} color={tokens.onAccent} /> : null}
              </View>
              <Text size={14} style={{ flex: 1 }} numberOfLines={1}>{l.name}</Text>
            </Pressable>
          );
        })}
        <Button label={t.listAddTo} variant="ghost" style={{ marginTop: 8 }} onPress={onNewList} />
      </View>
    </Sheet>
  );
}

export function AddToListButton({ kind, id, name, posterPath, x, onNewList }: { kind: "tv" | "movie"; id: number; name: string; posterPath: string | null; x: TitleExtrasPayload | undefined; onNewList: () => void }) {
  const { t, tokens } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: ({ listId, add }: { listId: string; add: boolean }) =>
      write<{ done: true }>("/api/v1/lists/toggle-item", { listId, tmdbId: id, mediaType: kind, title: name, posterPath, add } satisfies ListToggleItemBody),
    onMutate: ({ listId, add }) =>
      qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) =>
        prev ? { ...prev, containing: add ? [...new Set([...prev.containing, listId])] : prev.containing.filter((x) => x !== listId) } : prev,
      ),
    onError: (_e, { listId, add }) =>
      qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) =>
        prev ? { ...prev, containing: add ? prev.containing.filter((x) => x !== listId) : [...prev.containing, listId] } : prev,
      ),
  });
  if (!x) return null;
  const n = x.containing.length;
  return (
    <>
      <Button label={n ? `${t.listAddTo} · ${n}` : t.listAddTo} variant="ghost" onPress={() => setOpen(true)} />
      {open ? (
        <Sheet title={t.listAddTo} onClose={() => setOpen(false)}>
          <View style={{ gap: 4 }}>
            {x.my_lists.length === 0 ? <Text size={13} muted>{t.listNoLists}</Text> : null}
            {x.my_lists.map((l) => {
              const on = x.containing.includes(l.id);
              return (
                <Pressable key={l.id} onPress={() => m.mutate({ listId: l.id, add: !on })} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {on ? <Icon name="check-line" size={13} color={tokens.onAccent} /> : null}
                  </View>
                  <Text size={14} weight="600" style={{ flex: 1 }} numberOfLines={1}>{l.name}</Text>
                </Pressable>
              );
            })}
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <Chip label={t.listsTitle + " ↗"} active={false} leading={<Icon name="plus" size={12} color={tokens.muted} />} onPress={() => { setOpen(false); onNewList(); }} />
            </View>
          </View>
        </Sheet>
      ) : null}
    </>
  );
}

/** الطاقم — دوائرُ الوجوه، والوجهُ بابٌ إلى `/person/:id` */
export function CastRail({ x, onPerson }: { x: TitleExtrasPayload | undefined; onPerson: (id: number) => void }) {
  const { t, tokens } = useApp();
  if (!x || x.cast.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="people" size={14} color={tokens.accent} />
        <Text size={15} weight="700">{t.castTitle}</Text>
      </View>
      <FlatList
        horizontal
        data={x.cast}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPerson(item.id)} style={{ width: 84, alignItems: "center", gap: 6 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }}>
              {item.profile_path ? <Image source={{ uri: profileUrl(item.profile_path, "w185") ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            </View>
            <Text size={12} weight="600" numberOfLines={2} style={{ textAlign: "center", lineHeight: 15 }}>{item.name}</Text>
            {item.character ? <Text size={10} muted numberOfLines={1} style={{ textAlign: "center" }}>{item.character}</Text> : null}
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, marginHorizontal: -16, paddingHorizontal: 16 }}
        style={{ marginHorizontal: -16 }}
      />
    </View>
  );
}

/** السلسلةُ والمشابهات — ملصقاتٌ ١١٢ تدفع شاشةَ العمل نفسَها */
export function RelatedRails({ x, onOpen }: { x: TitleExtrasPayload | undefined; onOpen: (kind: "tv" | "movie", id: number) => void }) {
  const { t, tokens } = useApp();
  if (!x || (!x.collection && x.related.length === 0)) return null;
  const rail = (title: string, subtitle: string | null, items: { kind: "tv" | "movie"; id: number; title: string; poster_path: string | null; year: string | null }[]) => (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="sparkle-star" size={14} color={tokens.accent} />
        <Text size={15} weight="700" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
      </View>
      {subtitle ? <Text size={12} muted style={{ marginTop: -6 }}>{subtitle}</Text> : null}
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => `${i.kind}-${i.id}`}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item.kind, item.id)} style={{ width: 112 }}>
            <View style={{ width: 112, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }}>
              {item.poster_path ? <Image source={{ uri: posterUrl(item.poster_path, "w342") ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            </View>
            <Text size={12} weight="500" numberOfLines={2} style={{ marginTop: 6, lineHeight: 16 }}>{item.title}</Text>
            {item.year ? <Text size={11} muted>{item.year}</Text> : null}
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        style={{ marginHorizontal: -16 }}
      />
    </View>
  );
  return (
    <>
      {x.collection ? rail(t.relatedPartsTitle, x.collection.name, x.collection.parts.map((p) => ({ kind: "movie" as const, id: p.id, title: p.title, poster_path: p.poster_path, year: p.year }))) : null}
      {x.related.length ? rail(t.relatedTitlesTitle, null, x.related) : null}
    </>
  );
}
