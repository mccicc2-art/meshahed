import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qk, write } from "../api";
import { useApp } from "../state";
import { Button, Text, Toast } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { RailCard, RAIL_CARD_W, type LibMark } from "../discover/RailCard";
import { profileUrl } from "@/core/media";
import { formatDate } from "@/core/when";
import type { FollowArtistBody, LibraryPayload, ListFromPersonBody, ListFromPersonResult, PersonPayload, PersonWork, UnfollowArtistBody } from "../contracts";

/**
 * ====== صفحةُ الشخص أصليّةً — Phase 11-E · E1 (D-983، ١٥ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «نبيها كلّها أصليّة بالكامل»** — كانت السلسلةُ فيلم → ممثّل → عمل آخر تبدأ
 * أصليّةً (D-956) وتنتقل إلى الويب من أوّل ممثّل ولا تعود. الآن الممثّلُ شاشةٌ أصليّة،
 * وأعمالُه تفتح `TitleScreen` الأصليّة — **المكدّسُ كلُّه أصليّ.**
 *
 * 🔑 **الوصفةُ وصفةُ `src/app/person/[id]/page.tsx` حرفاً** (القاعدة ٣): ترويسةٌ بعمودين
 * (الصورةُ إلى جانب الحقائق لا فوقها — الصفحةُ تُفتح لتُقرأ)، المتابعةُ أوّلاً ثمّ «أضِف
 * أعماله إلى قائمة»، النبذةُ بـ«المزيد» (وتنبيهُ الإنجليزيّة حين تكون بديلاً)، ثمّ الأعمالُ
 * بتبويباتٍ أربع (الكلّ · أفلام · مسلسلات · برامج) بأعدادها — **والتقسيمُ من الخادم**
 * (`group`) لا من هنا.
 *
 * 🔑 **البطاقاتُ بطاقاتُ «اكتشف»** (`RailCard`) في شبكةٍ من ثلاثة: خيطُ المكتبة نفسُه تحت كلِّ
 * ملصق، والضغطُ يفتح `TitleScreen` بـ`from` الشاشة التي بدأت السلسلة.
 *
 * 🔑 **لا بابَ ويبيّاً في الشاشة**: «أضِف أعماله إلى قائمة» فعلٌ واحدٌ في الويب أيضاً
 * (`createListFromPerson`) لا ورقة — فصار `POST /api/v1/lists/from-person` والتوستُ نفسُه.
 * الويبُ يبقى بديلَ الحارس فقط (D-974).
 */
const HEADER_H = 64;
const PAGE_PAD = 16;
const GRID_GAP = 10;
const BIO_LINES = 5;

type WorksTab = "all" | "movie" | "tv" | "show";

export function PersonScreen({ id, from }: { id: number; from: "library" | "discover" | "search" }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<WorksTab>("all");
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const q = useQuery({
    queryKey: qk.person(id),
    queryFn: async () => (await api<PersonPayload>(`/api/v1/person/${id}`)).data,
    staleTime: 5 * 60_000,
  });
  const d = q.data;
  /* خيطُ المكتبة تحت الملصقات — الاستعلامُ نفسُه الذي تقرؤه «اكتشف» (كاشٌ مشترك) */
  const lib = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
    staleTime: 5 * 60_000,
  });
  const marks = useMemo(() => {
    /* حسابُ الخيط حسابُ «اكتشف» حرفاً (`DiscoverScreen.marks`) */
    const m = new Map<string, LibMark>();
    for (const x of lib.data?.items ?? []) {
      const aired = x.aired;
      const watched = Math.min(x.watched, aired || Infinity);
      const done = x.status === "completed";
      const progress = x.kind === "tv" ? (aired > 0 ? Math.round((watched / aired) * 100) : 0) : done ? 100 : 0;
      m.set(`${x.kind}-${x.id}`, { saved: x.status === "unstarted", progress, completed: done, dropped: x.status === "dropped" });
    }
    return m;
  }, [lib.data]);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(h);
  }, [toast]);

  const fail = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
      void q.refetch();
    },
    [t, q],
  );

  /* المتابعةُ تفاؤليّةً في كاش الصفحة — كصفحة العمل (`patchMe`) */
  const follow = useMutation({
    mutationFn: async (want: boolean) => {
      if (!d) return;
      if (want) await write<unknown>("/api/v1/track/follow-artist", { personId: id, name: d.name, profilePath: d.profile_path } satisfies FollowArtistBody);
      else await write<unknown>("/api/v1/track/unfollow-artist", { personId: id } satisfies UnfollowArtistBody);
    },
    onMutate: (want) => qc.setQueryData<PersonPayload>(qk.person(id), (prev) => (prev ? { ...prev, me: { following: want } } : prev)),
    onError: fail,
  });

  /* «أضِف أعماله إلى قائمة» — فعلٌ واحد لا ورقة (`AddWorksToList`): أصليٌّ بالردّ نفسِه */
  const toList = useMutation({
    mutationFn: async () => write<ListFromPersonResult>("/api/v1/lists/from-person", { personId: id } satisfies ListFromPersonBody),
    onSuccess: (res) => setToast(res.created ? t.listMadeToast(res.name) : res.added > 0 ? t.listGrewToast(res.added) : t.listHadAllToast),
    onError: fail,
  });
  const openTitle = useCallback((w: PersonWork) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: w.kind, id: String(w.id), from } }), [router, from]);
  /* فشلُ التحميل: «ابحث» كما في الصفحة — أصليٌّ منذ Phase 11-G (يحلّ محلَّ هذه الشاشة فلا تبقى صفحةٌ ساقطةٌ في المكدّس) */
  const openSearch = useCallback(() => router.replace("/search"), [router]);

  const works = useMemo(() => (d ? (tab === "all" ? d.works : d.works.filter((w) => w.group === tab)) : []), [d, tab]);
  const counts = useMemo(() => {
    const c = { all: 0, movie: 0, tv: 0, show: 0 };
    for (const w of d?.works ?? []) {
      c.all++;
      c[w.group]++;
    }
    return c;
  }, [d]);
  const photo = profileUrl(d?.profile_path ?? null, "h632");
  const facts = d
    ? ([d.department, d.birthday ? lifeSpan(d, t) : null, d.place_of_birth].filter(Boolean) as string[])
    : [];
  /* شبكةُ ثلاثة أعمدة بعرض بطاقة الصفّ — لا عرضَ ثانياً للملصق (القاعدة ٣) */
  const cols = Math.max(2, Math.floor((width - PAGE_PAD * 2 + GRID_GAP) / (RAIL_CARD_W + GRID_GAP)));

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
        <Text size={15} weight="700" numberOfLines={1}>{d?.name ?? ""}</Text>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
          <Chevron color={tokens.fg} />
        </Pressable>
      </View>

      {!d ? (
        q.isError ? (
          <View style={{ padding: PAGE_PAD, alignItems: "center", gap: 12, paddingTop: 48 }}>
            <Text muted>{t.personLoadFailed}</Text>
            <Button label={t.navSearch} variant="ghost" onPress={openSearch} />
          </View>
        ) : (
          <View style={{ padding: PAGE_PAD, flexDirection: "row", gap: 16 }}>
            <View style={{ width: 112, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: tokens.surface2 }} />
            <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
              <View style={{ height: 24, width: "70%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
              <View style={{ height: 14, width: "50%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
              <View style={{ height: 14, width: "60%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
            </View>
          </View>
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: PAGE_PAD, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {/* الترويسةُ بعمودين — `w-28` الصورة، والحقائقُ إلى جانبها */}
          <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
            <View style={{ width: 112, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
              {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Icon name="people" size={30} color={tokens.muted} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingTop: 4, gap: 4 }}>
              <Text size={22} weight="700" numberOfLines={2} style={{ lineHeight: 28 }}>{d.name}</Text>
              {facts.map((f) => (
                <Text key={f} size={12} muted>{f}</Text>
              ))}
              <Button
                style={{ marginTop: 12 }}
                label={d.me.following ? t.followingUser : t.followUser}
                variant={d.me.following ? "ghost" : "primary"}
                busy={follow.isPending}
                onPress={() => follow.mutate(!d.me.following)}
              />
              <Button style={{ marginTop: 8 }} label={t.worksToListBtn} variant="ghost" busy={toList.isPending} onPress={() => toList.mutate()} />
            </View>
          </View>

          {d.biography ? (
            <View style={{ marginTop: 28, gap: 10 }}>
              <SectionTitle icon="info" label={t.personBioTitle} tokens={tokens} />
              {d.biography_is_fallback ? (
                <View style={{ borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 10 }}>
                  <Text size={12} muted>{t.personBioEnglishOnly}</Text>
                </View>
              ) : null}
              <Text size={14} style={{ lineHeight: 22, writingDirection: d.biography_is_fallback ? "ltr" : undefined }} numberOfLines={more ? undefined : BIO_LINES}>{d.biography}</Text>
              {d.biography.length > 280 ? (
                <Pressable onPress={() => setMore((v) => !v)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
                  <Text size={13} weight="600" color={tokens.accent}>{more ? t.showLess : t.showMore}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={{ marginTop: 32 }}>
            <SectionTitle icon="play" label={t.personWorksTitle} tokens={tokens} />
            {counts.all === 0 ? (
              <Text size={13} muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.personNoWorks}</Text>
            ) : (
              <>
                {/* segmented — التبويبات الأربع بأعدادها كما في الصفحة */}
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 12, marginBottom: 12 }}>
                  {(["all", "movie", "tv", "show"] as const).map((k) => {
                    const on = tab === k;
                    const label = k === "all" ? t.browseAll : k === "movie" ? t.shortMovies : k === "tv" ? t.shortShows : t.personTabPrograms;
                    return (
                      <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
                        <Text size={13} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted} numberOfLines={1}>{label}</Text>
                        <Text size={11} color={on ? tokens.fg : tokens.muted} style={{ opacity: 0.75 }}>{String(counts[k])}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text size={12} muted style={{ marginBottom: 12 }}>{t.personWorksCount(works.length)}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, justifyContent: cols > 2 ? "flex-start" : "space-between" }}>
                  {works.map((w) => (
                    <RailCard
                      key={`${w.kind}-${w.id}`}
                      card={{ kind: w.kind, id: w.id, title: w.title, poster_path: w.poster_path, year: w.year || null, vote_average: 0, imdb_rating: null, date: null }}
                      rank={null}
                      lib={marks.get(`${w.kind}-${w.id}`) ?? null}
                      onPress={() => openTitle(w)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
      {toast ? <Toast text={toast} bottom={insets.bottom + 16} /> : null}
    </View>
  );
}

function SectionTitle({ icon, label, tokens }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; tokens: ReturnType<typeof useApp>["tokens"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon name={icon} size={16} color={tokens.accent} />
      <Text size={17} weight="700">{label}</Text>
    </View>
  );
}

/** سطرُ الميلاد ومعه العمر أو سنةُ الوفاة — `lifeSpan` الصفحة حرفاً (من مات لا يكبر) */
function lifeSpan(p: { birthday: string | null; deathday: string | null }, t: ReturnType<typeof useApp>["t"]): string {
  if (!p.birthday) return "";
  const born = formatDate(p.birthday, t);
  const end = p.deathday ? new Date(p.deathday) : new Date();
  const start = new Date(p.birthday);
  let age = end.getUTCFullYear() - start.getUTCFullYear();
  const m = end.getUTCMonth() - start.getUTCMonth();
  if (m < 0 || (m === 0 && end.getUTCDate() < start.getUTCDate())) age--;
  if (p.deathday) return `${born} — ${formatDate(p.deathday, t)} (${t.personAgeAtDeath(age)})`;
  return `${born} · ${t.personAge(age)}`;
}

function Chevron({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
    </View>
  );
}
