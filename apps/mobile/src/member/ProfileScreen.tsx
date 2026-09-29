import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, Share, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, write } from "../api";
import { useApp } from "../state";
import { Button, Text, Toast } from "../ui";
import { Icon, iconOr } from "../icons";
import { radius } from "../theme";
import { CONFIG } from "../config";
import { haptic } from "../haptics";
import { shell, type NativeRoot } from "../shell";
import { stackAboveRoots } from "../nativeStack";
import { span, afterPaint } from "../perfMarks";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { HomeCover, StatsCard, type StatCell } from "../home/HomeHeader";
import { FollowsSheet } from "../home/FollowsSheet";
import { PosterCard, type CardItem } from "../library/PosterCard";
import { ListCard } from "../library/ListCard";
import { Sheet } from "../library/Sheet";
import { Chip } from "../library/Chip";
import { openProfile } from "./open";
import { displayNameOf } from "@/core/people";
import { num } from "@/core/i18n";
import { profileSectionMeta, profileTabMeta } from "@/core/profilePrefs";
import { profileUrl } from "@/core/media";
import { browseGenreName, groupByGenre } from "@/core/browse";
import { SCOPES, clock, dayKey, episodeOf, groupDays, keep, label as scopeLabel, shiftDay, verbOf, type ActivityItem, type Scope } from "@/core/activityDays";
import type {
  ProfileActivity,
  ProfileList,
  ProfilePayload,
  ProfileReview,
  ProfileSectionKey,
  ProfileShow,
  ProfileTabKey,
  ProfileTitle,
} from "@/core/contracts/profile";
import type { FollowUserResult } from "@/core/communityActs";

/**
 * ====== ملفُّ الشخص أصليّاً — Phase 11-N · N1 (٢٩ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «ابدا خطة ملف الشخص اصلية»** — كان أكثرَ بابٍ ويبيٍّ يُضغط في التطبيق (كلُّ صورة شخص). **الحمولةُ ما تقرؤه
 * صفحةُ `/u/{username}` حرفاً** (`GET /api/v1/profile/{username}` فوق `lib/profileCore.ts` — N0)، **والشاشةُ ترسم ولا تصوغ**.
 *
 * 🔑 **الرأسُ رأسُ الرئيسيّة** كما في الويب («صفحة المستخدم بهيئة الرئيسية نفسها»): الغلافُ (`HomeCover`) · الصورةُ والاسمُ
 * والشارات · صفُّ «متابِع/يتابع» · بطاقةُ الأرقام (`StatsCard` — مكوّنٌ واحدٌ للاثنين). **مكانُ أدوات المالك زرُّ المتابعة.**
 * 🔑 **التبويباتُ الخمسة بترتيب صاحبها وما أخفاه** (من الخادم) — **بالضغط كما في الويب** (`PageTabs` روابطُ لا سحب)، والشريطُ
 * يلتصق أعلى الشاشة عند التمرير.
 * 🔑 **حجمُ الملصق حجمُ القارئ** (قرارُ أحمد ٢٩ سبتمبر: «بحجمك انت») — `viewer.density`؛ الترتيبُ والإخفاءُ لصاحب الملفّ.
 * 🔑 **لا ويبَ إلّا ما لم يُنقل**: الأعمالُ والقوائمُ وملفّاتُ الناس أصليّة؛ «الإحصاءات» بابٌ ويبيٌّ حتى N4 — يظهر فوق الشاشة
 * طبقةً (K3b) فتبقى هذه تحتها كما تُركت.
 * ⏭️ **N2**: قائمةُ ⋯ (رسالة · بلاغ · حظر) وقلوبُ المراجعات وردودُها · **N3**: أدواتُ المالك (الترتيب · راية المحفوظات).
 */
const HEADER_H = 56;
const PAGE_PAD = 16;
const GAP = 10;
const DENSITY_W = { compact: 96, comfortable: 118, large: 148 } as const;
/* ألوانُ النصّ فوق الغلاف — قيمُ `HomeGreeting` نفسُها */
const ART_MUTED = "rgba(255,255,255,0.7)";
const ART_SHADOW = { textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 };

export const profileKey = (username: string) => [`profile:${username.toLowerCase()}`] as const;

type Grid = "shows" | "movies" | "anime";

export function ProfileScreen({ username, from }: { username: string; from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const nav = useNavigationContainerRef();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const key = profileKey(username);

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api<ProfilePayload>(`/api/v1/profile/${encodeURIComponent(username)}`)).data,
    staleTime: 60_000,
  });
  const d = q.data ?? null;

  /* `profile.open`: من التركيب إلى أوّل رسمٍ فيه حمولة — `cached` يفصل الكاشَ عن الشبكة (نهجُ «المجتمع») */
  const [endOpen] = useState(() => span("profile.open", { cached: qc.getQueryData(key) ? 1 : 0 }));
  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    afterPaint(() => endOpen());
  }, [d, endOpen]);

  const [tab, setTab] = useState<ProfileTabKey | null>(null);
  const shown = d?.tabs ?? [];
  const active: ProfileTabKey | null = tab && shown.includes(tab) ? tab : (shown[0] ?? null);
  const [follows, setFollows] = useState<"followers" | "following" | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [ranks, setRanks] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(h);
  }, [toast]);

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

  /* الأبواب — الأصليُّ دفعٌ بـ`from` من فتح الملفّ، والويبيُّ (الإحصاءات حتى N4) طبقةٌ فوق الشاشة (K3b) */
  const fromOut = from;
  const openTitle = useCallback(
    (kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: fromOut } }),
    [router, fromOut],
  );
  const openList = useCallback((id: string) => router.push({ pathname: "/list/[id]", params: { id, from: fromOut } }), [router, fromOut]);
  const openPerson = useCallback((id: number) => router.push({ pathname: "/person/[id]", params: { id: String(id), from: fromOut } }), [router, fromOut]);
  const openMember = useCallback((name: string) => openProfile(router, name, fromOut), [router, fromOut]);
  const openWeb = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      void shell
        .open(path, fromOut === "web" ? undefined : { returnTo: fromOut, resume: stackAboveRoots(nav.getRootState()) })
        .then((layered) => {
          setLeaving(false);
          if (layered) return;
          if (router.canDismiss()) router.dismissAll();
          else router.replace("/web");
        });
    },
    [leaving, fromOut, nav, router],
  );
  const share = useCallback(() => {
    if (!d?.person.username) return;
    const url = `${CONFIG.apiBase}/u/${d.person.username}`;
    void Share.share({ message: url, url }).catch(() => {});
  }, [d]);

  /* المتابعةُ — `POST /api/v1/community/follow` نفسُه (M2)، تفاؤليّةً في كاش الملفّ؛ الحسابُ الخاصُّ يعيد «طلبتَ» */
  const follow = useMutation({
    mutationFn: async (on: boolean) => (d ? write<FollowUserResult>("/api/v1/community/follow", { user_id: d.person.id, on }) : null),
    onMutate: (on) => {
      haptic.pick();
      qc.setQueryData<ProfilePayload>(key, (p) => (p ? { ...p, relation: { ...p.relation, following: on && !p.person.is_private, requested: on && p.person.is_private } } : p));
    },
    onSuccess: (r) => {
      if (!r) return;
      qc.setQueryData<ProfilePayload>(key, (p) =>
        p
          ? {
              ...p,
              relation: { ...p.relation, following: r.state === "following", requested: r.state === "requested" },
              counts: { ...p.counts, followers: Math.max(0, p.counts.followers + (r.state === "following" && !p.relation.following ? 1 : 0)) },
            }
          : p,
      );
      if (r.state === "requested") setToast(t.followRequestSent);
      /* المتابعةُ تفتح المحتوى (أو تغلقه) — الحمولةُ من الخادم لا تخمين */
      void q.refetch();
    },
    onError: (e) => {
      const k = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[k];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
      void q.refetch();
    },
  });

  const posterW = DENSITY_W[d?.viewer.density ?? "comfortable"];
  const onArt = !!d?.person.cover_url;
  const name = d ? displayNameOf(d.person, t.anonymousUser) : "";

  const stats: StatCell[] = useMemo(() => {
    if (!d || !d.display.stats || d.locked) return [];
    const cells: StatCell[] = [
      { key: "shows", icon: "tv", value: num(d.counts.shows, locale), label: t.shortShows, href: "#shows" },
      { key: "movies", icon: "film", value: num(d.counts.movies, locale), label: t.shortMovies, href: "#movies" },
    ];
    if (d.counts.anime > 0) cells.push({ key: "anime", icon: "sparkles", value: num(d.counts.anime, locale), label: t.discoverTabAnime, href: "#anime" });
    if (d.display.stats_link && d.person.username) cells.push({ key: "stats", icon: "chart", value: "", label: t.statsPageTitle, href: `/u/${d.person.username}/stats` });
    return cells;
  }, [d, t, locale]);
  const onStat = useCallback((href: string) => (href.startsWith("#") ? setGrid(href.slice(1) as Grid) : openWeb(href)), [openWeb]);

  const tabMeta = profileTabMeta(t);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {d ? <HomeCover url={d.person.cover_url} pos={d.person.cover_pos} /> : null}
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <RoundBtn icon="back" label={t.closeLabel} onPress={back} onArt={!!d?.person.cover_url} />
        <View style={{ flex: 1 }} />
        {d?.person.username ? <RoundBtn icon="share" label={t.shareLinkLabel} onPress={share} onArt={!!d.person.cover_url} /> : null}
        {d?.viewer.is_me ? <RoundBtn icon="settings" label={t.headerSettings} onPress={() => router.push("/settings")} onArt={!!d.person.cover_url} /> : null}
      </View>

      {!d ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{q.error instanceof ApiError && q.error.status === 404 ? t.userNotFound : t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: tokens.surface2 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ height: 20, width: "55%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
                <View style={{ height: 12, width: "35%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
              </View>
            </View>
            <View style={{ height: 60, borderRadius: 16, backgroundColor: tokens.surface2 }} />
          </View>
        )
      ) : (
        <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {/* ——— الرأس ——— */}
          <View>
            <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 2, borderColor: tokens.bg, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                {!d.person.hide_name && d.person.avatar_url ? (
                  <Image source={{ uri: d.person.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition={{ top: `${d.person.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" />
                ) : (
                  <Icon name="people" size={24} color={tokens.muted} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {/* D-1134 — فوق الغلاف أبيضُ بظلٍّ كتحيّة الرئيسيّة (`HomeGreeting.onArt`) — يصحّ في «النهاري» أيضاً */}
                  <Text size={20} weight="700" color={onArt ? "#fff" : tokens.fg} numberOfLines={1} style={[{ flexShrink: 1, lineHeight: 24 }, onArt ? ART_SHADOW : null]}>{name}</Text>
                  {d.person.hide_name ? null : <IdentityBadges flags={identityFlags(d.person)} nameSize={20} />}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {d.person.username && !d.person.hide_name ? <Text size={12} color={onArt ? ART_MUTED : tokens.muted} numberOfLines={1} style={{ flexShrink: 1 }}>@{d.person.username}</Text> : null}
                  {/* القفلُ كالويب (`FollowCountButton.locked`): العددُ يُرى والورقةُ لا تُفتح */}
                  <CountBtn icon="people" value={d.counts.followers} label={t.followersLabel} locked={d.person.hide_follow_lists} onArt={onArt} onPress={() => setFollows("followers")} />
                  <CountBtn icon="heart" value={d.counts.following} label={t.followingLabel} locked={d.person.hide_follow_lists} onArt={onArt} onPress={() => setFollows("following")} />
                </View>
              </View>
              {d.viewer.is_me || !d.viewer.signed_in || d.person.system ? null : (
                <Button
                  size="sm"
                  variant={d.relation.following || d.relation.requested ? "ghost" : "primary"}
                  label={d.relation.following ? t.followingUser : d.relation.requested ? t.followRequested : t.followUser}
                  busy={follow.isPending}
                  onPress={() => follow.mutate(!(d.relation.following || d.relation.requested))}
                />
              )}
            </View>
            {d.person.bio ? <Text size={13} style={{ paddingHorizontal: PAGE_PAD, marginTop: 10, lineHeight: 19 }}>{d.person.bio}</Text> : null}
            <Facts d={d} onRanks={() => setRanks(true)} />
            <StatsCard stats={stats} onStat={onStat} />

            {d.locked ? (
              <View style={{ margin: PAGE_PAD, marginTop: 20, padding: 20, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, alignItems: "center", gap: 8 }}>
                <Icon name="shield" size={24} color={tokens.muted} />
                <Text size={15} weight="700">{t.privateCoverTitle}</Text>
                <Text size={13} muted style={{ textAlign: "center" }}>{t.privateCoverHint}</Text>
              </View>
            ) : null}
          </View>

          {/* ——— شريطُ التبويبات (يلتصق) ——— */}
          <View style={{ backgroundColor: tokens.bg }}>
            {!d.locked && shown.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 18 }} style={{ borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 14 }}>
                {shown.map((k) => {
                  const on = k === active;
                  const count = k === "activity" ? d.activity.length : k === "reviews" ? d.reviews.length : k === "lists" ? d.lists.public.length + d.lists.saved.length : null;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        if (on) return;
                        haptic.pick();
                        setTab(k);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}
                    >
                      <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{tabMeta[k].label}</Text>
                      {count ? <Text size={11} color={tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{num(count, locale)}</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>

          {/* ——— جسمُ التبويب ——— */}
          {d.locked ? null : shown.length === 0 ? (
            <Text muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.profileNoTabs}</Text>
          ) : active === "favorites" ? (
            <Favorites d={d} posterW={posterW} onTitle={openTitle} />
          ) : active === "overview" ? (
            <Overview d={d} posterW={posterW} onTitle={openTitle} onList={openList} onPerson={openPerson} />
          ) : active === "activity" ? (
            <ActivityPane rows={d.activity} onTitle={openTitle} />
          ) : active === "reviews" ? (
            <ReviewsPane rows={d.reviews} onTitle={openTitle} />
          ) : active === "lists" ? (
            <ListsPane d={d} onList={openList} onMember={openMember} />
          ) : null}
        </ScrollView>
      )}

      {follows && d ? (
        <FollowsSheet
          dir={follows}
          userId={d.viewer.is_me ? undefined : d.person.id}
          onClose={() => setFollows(null)}
          onOpen={(u) => (u.toLowerCase() === username.toLowerCase() ? undefined : openMember(u))}
        />
      ) : null}
      {grid && d ? <GridSheet d={d} which={grid} posterW={posterW} width={width} onClose={() => setGrid(null)} onTitle={(k, id) => { setGrid(null); openTitle(k, id); }} /> : null}
      {ranks && d ? <RanksSheet d={d} onClose={() => setRanks(false)} /> : null}
      {toast ? <Toast text={toast} bottom={insets.bottom + 16} /> : null}
    </View>
  );
}

/* ——————————————————— أجزاءُ الرأس ——————————————————— */

function RoundBtn({ icon, label, onPress, onArt }: { icon: "back" | "share" | "settings"; label: string; onPress: () => void; onArt: boolean }) {
  const { tokens } = useApp();
  const fg = onArt ? "#fff" : tokens.fg;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      {icon === "back" ? (
        <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
      ) : (
        <Icon name={icon} size={20} color={fg} />
      )}
    </Pressable>
  );
}

function CountBtn({ icon, value, label, locked, onArt, onPress }: { icon: "people" | "heart"; value: number; label: string; locked: boolean; onArt: boolean; onPress: () => void }) {
  const { tokens, locale } = useApp();
  const c = onArt ? ART_MUTED : tokens.muted;
  return (
    <Pressable onPress={onPress} disabled={locked} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Icon name={icon} size={12} color={c} />
      <Text size={12} weight="600" color={c} style={{ fontVariant: ["tabular-nums"] }}>{num(value, locale)}</Text>
    </Pressable>
  );
}

/** سطرُ الحقائق: مراتبُه الأسبوعيّة (بابٌ لورقتها) · حسابُ X الموثَّق · «عضو منذ» لمشترك Plus — كالويب */
function Facts({ d, onRanks }: { d: ProfilePayload; onRanks: () => void }) {
  const { t, tokens, locale } = useApp();
  const since = d.person.joined_at
    ? t.memberSince(new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { month: "long", year: "numeric" }).format(new Date(d.person.joined_at)))
    : null;
  if (!d.weekly_ranks.length && !d.person.x && !since) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingHorizontal: PAGE_PAD, marginTop: 10 }}>
      {d.weekly_ranks.length ? (
        <Pressable onPress={onRanks} accessibilityRole="button" accessibilityLabel={t.weeklyRanksTimes(d.weekly_ranks.length)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: tokens.accent }}>
          <Icon name="star" size={11} color={tokens.accent} />
          <Text size={11} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{num(d.weekly_ranks.length, locale)}</Text>
        </Pressable>
      ) : null}
      {d.person.x ? (
        <View accessibilityLabel={t.xVerifiedTip} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text size={12} weight="700">𝕏</Text>
          <Text size={12} muted>@{d.person.x.handle}</Text>
        </View>
      ) : null}
      {since ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="calendar" size={12} color={tokens.muted} />
          <Text size={12} muted>{since}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RanksSheet({ d, onClose }: { d: ProfilePayload; onClose: () => void }) {
  const { t, tokens, locale } = useApp();
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <Sheet title={t.weeklyRanksTitle} onClose={onClose}>
      <Text size={12} muted style={{ marginBottom: 8 }}>{t.weeklyRanksHint}</Text>
      {d.weekly_ranks.map((r, i) => (
        <View key={r.week} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
          <Text size={13}>{t.weeklyRanksWeek(fmt.format(new Date(`${r.week}T00:00:00Z`)))}</Text>
          <Text size={13} weight="700" color={tokens.accent}>{t.weeklyRankOrd(r.rank)}</Text>
        </View>
      ))}
    </Sheet>
  );
}

/* ——————————————————— التبويبات ——————————————————— */

const asItem = (x: ProfileTitle | ProfileShow): CardItem => ({
  key: `${x.media_type}-${x.tmdb_id}`,
  kind: x.media_type,
  id: x.tmdb_id,
  title: x.title,
  posterPath: x.poster_path,
  /* تقدّمُ صاحب الملفّ على ملصقه (`PosterCard.progress` في الويب) — الخيطُ خيطُه لا القارئ */
  progress: "progress" in x ? x.progress : 0,
  completed: "progress" in x ? x.progress >= 100 : false,
  dropped: false,
});

function SectionHead({ icon, label }: { icon: string; label: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginTop: 22, marginBottom: 10 }}>
      <Icon name={iconOr(icon, "list")} size={16} color={tokens.accent} />
      <Text size={17} weight="700">{label}</Text>
    </View>
  );
}

function Rail({ items, posterW, onTitle }: { items: (ProfileTitle | ProfileShow)[]; posterW: number; onTitle: (k: "tv" | "movie", id: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
      {items.map((x) => (
        <PosterCard key={`${x.media_type}-${x.tmdb_id}`} item={asItem(x)} width={posterW} onPress={(it) => onTitle(it.kind, it.id)} />
      ))}
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return <Text muted style={{ textAlign: "center", paddingVertical: 40, paddingHorizontal: PAGE_PAD }}>{text}</Text>;
}

/** المفضّلة: مسلسلاتُه وأفلامُه بترتيبه (`favorites.order` — D-564) ثمّ الأنمي يذيّلهما (D-941) */
function Favorites({ d, posterW, onTitle }: { d: ProfilePayload; posterW: number; onTitle: (k: "tv" | "movie", id: number) => void }) {
  const { t } = useApp();
  const f = d.favorites;
  if (!f.shows.length && !f.movies.length && !f.anime.length) return <Empty text={t.profileEmptyFavorites} />;
  const rows: { key: string; icon: string; label: string; items: ProfileTitle[] }[] = [
    ...f.order.map((k) => (k === "shows" ? { key: k, icon: "tv", label: t.shortShows, items: f.shows } : { key: k, icon: "film", label: t.shortMovies, items: f.movies })),
    { key: "anime", icon: "sparkles", label: t.discoverTabAnime, items: f.anime },
  ];
  return (
    <View>
      {rows.filter((r) => r.items.length).map((r) => (
        <View key={r.key}>
          <SectionHead icon={r.icon} label={r.label} />
          <Rail items={r.items} posterW={posterW} onTitle={onTitle} />
        </View>
      ))}
    </View>
  );
}

/** نظرةٌ عامّة: أقسامُه بترتيبه (`sections` — D-581)، وسقفُ البطاقات في الصفّ تفضيلُه (`display.cards` — D-152) */
function Overview({
  d,
  posterW,
  onTitle,
  onList,
  onPerson,
}: {
  d: ProfilePayload;
  posterW: number;
  onTitle: (k: "tv" | "movie", id: number) => void;
  onList: (id: string) => void;
  onPerson: (id: number) => void;
}) {
  const { t, tokens } = useApp();
  const meta = profileSectionMeta(t);
  const cap = <T,>(xs: T[]) => (d.display.cards == null ? xs : xs.slice(0, d.display.cards));
  const o = d.overview;
  const body = (s: ProfileSectionKey): React.ReactNode => {
    switch (s) {
      case "shows":
        return o.shows.length ? <Rail items={cap(o.shows)} posterW={posterW} onTitle={onTitle} /> : null;
      case "movies":
        return o.movies.length ? <Rail items={cap(o.movies)} posterW={posterW} onTitle={onTitle} /> : null;
      case "anime":
        return o.anime.length ? <Rail items={cap(o.anime)} posterW={posterW} onTitle={onTitle} /> : null;
      case "artists":
        return o.artists.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 14 }}>
            {cap(o.artists).map((a) => {
              const img = profileUrl(a.profile_path, "w185");
              return (
                <Pressable key={a.person_id} onPress={() => onPerson(a.person_id)} accessibilityRole="link" style={{ width: 78, alignItems: "center", gap: 6 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={24} color={tokens.muted} />}
                  </View>
                  <Text size={11} numberOfLines={2} style={{ textAlign: "center" }}>{a.name ?? ""}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null;
      case "lists":
        return o.lists.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
            {cap(o.lists).map((l) => (
              <View key={l.id} style={{ width: 280 }}>
                <ListCard card={listCardOf(l, t)} onPress={() => onList(l.id)} />
              </View>
            ))}
          </ScrollView>
        ) : null;
      case "ratings":
        return o.ratings.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
            {cap(o.ratings).map((r) => (
              <View key={`${r.media_type}-${r.tmdb_id}`} style={{ width: posterW }}>
                <PosterCard
                  item={{ key: `${r.media_type}-${r.tmdb_id}`, kind: r.media_type, id: r.tmdb_id, title: r.title ?? "", posterPath: r.poster_path, progress: 0, completed: false, dropped: false }}
                  width={posterW}
                  onPress={(it) => onTitle(it.kind, it.id)}
                />
                {r.rating != null ? <RatingPill value={r.rating} /> : null}
              </View>
            ))}
          </ScrollView>
        ) : null;
    }
  };
  const blocks = d.sections.map((s) => ({ s, node: body(s) })).filter((b) => b.node);
  if (!blocks.length) return <Empty text={t.profileEmptyOverview} />;
  return (
    <View>
      {blocks.map(({ s, node }) => (
        <View key={s}>
          <SectionHead icon={meta[s].icon} label={s === "ratings" ? t.profileTopRated : meta[s].label} />
          {node}
        </View>
      ))}
    </View>
  );
}

function RatingPill({ value }: { value: number }) {
  const { tokens, locale } = useApp();
  return (
    <View style={{ position: "absolute", top: 6, start: 6, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: tokens.accent }}>
      <Icon name="star" size={10} color={tokens.onAccent} />
      <Text size={11} weight="700" color={tokens.onAccent} style={{ fontVariant: ["tabular-nums"] }}>{num(value, locale)}</Text>
    </View>
  );
}

const listCardOf = (l: ProfileList, t: ReturnType<typeof useApp>["t"]) => ({
  id: l.id,
  name: l.name,
  owner: l.owner,
  owner_avatar: l.owner_avatar,
  countText: t.listCount(l.item_count),
  posters: l.posters,
  cover: null,
  stats: { saves: l.saves, reviews: l.reviews, rating: l.rating },
  playlist: null,
});

/** النشاط — شاشةُ `/activity` بقواعدها (`core/activityDays` — الويبُ يقرأ الملفَّ نفسَه): الرقاقات · حصيلةُ الأسبوع · الأيّام */
function ActivityPane({ rows, onTitle }: { rows: ProfileActivity[]; onTitle: (k: "tv" | "movie", id: number) => void }) {
  const { t, tokens, locale } = useApp();
  const [scope, setScope] = useState<Scope>("all");
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
      })),
    [rows],
  );
  const matching = items.filter((it) => keep(it, scope));
  const today = dayKey(new Date().toISOString(), true);
  const weekCount = matching.filter((it) => dayKey(it.at, true) >= shiftDay(today, -6)).length;
  const days = groupDays(matching, true, t, locale, today);
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SCOPES.map((s) => (
          <Chip key={s} label={scopeLabel(s, t)} active={scope === s} onPress={() => (s === scope ? undefined : (haptic.pick(), setScope(s)))} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 10 }}>
        <Text size={13} muted>{t.activityThisWeek}</Text>
        <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>{t.activityCount(weekCount)}</Text>
      </View>
      {days.length === 0 ? (
        <Empty text={t.profileEmptyActivity} />
      ) : (
        days.map((day) => (
          <View key={day.key} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <Text size={15} weight="700">{day.label}</Text>
              <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(day.rows.length, locale)}</Text>
            </View>
            <View style={{ borderStartWidth: 1, borderStartColor: tokens.divider, marginStart: 6, paddingStart: 14 }}>
              {day.rows.map((r) => {
                const ep = episodeOf(r, t);
                return (
                  <Pressable key={r.id} onPress={() => onTitle(r.mediaType, r.tmdbId)} accessibilityRole="link" style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ position: "absolute", start: -19, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: tokens.divider, backgroundColor: tokens.bg }} />
                    <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                      {r.poster ? <Image source={{ uri: r.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text size={14} numberOfLines={1}>
                        <Text size={14} muted>{verbOf(r, t)} </Text>
                        <Text size={14} weight="700">{r.title}</Text>
                        {ep ? <Text size={14} muted> · {ep}</Text> : null}
                        {r.kind === "list" && r.listName ? <Text size={14} muted> {t.actVerbTo} {r.listName}</Text> : null}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        {r.rating != null ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Icon name="star" size={12} color={tokens.accent} />
                            <Text size={12} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(r.rating, locale)}</Text>
                          </View>
                        ) : null}
                        <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{clock(r.at, locale, true)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/** المراجعات: الأحدثُ أوّلاً، والتقييمُ بلا متنٍ صفٌّ أيضاً (D-583)؛ الحرقُ مغطّى حتى يُكشف. قلوبُها تُرى — والضغطُ في N2 */
function ReviewsPane({ rows, onTitle }: { rows: ProfileReview[]; onTitle: (k: "tv" | "movie", id: number) => void }) {
  const { t, tokens, locale } = useApp();
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  if (!rows.length) return <Empty text={t.profileEmptyReviews} />;
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 6 }}>
      {rows.map((r, i) => {
        const k = `${r.media_type}-${r.tmdb_id}`;
        const hidden = r.has_spoiler && !shown.has(k);
        return (
          <View key={k} style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Pressable onPress={() => onTitle(r.media_type, r.tmdb_id)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{r.title ?? ""}</Text>
                {r.rating != null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Icon name="star" size={12} color={tokens.accent} />
                    <Text size={12} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{num(r.rating, locale)}</Text>
                  </View>
                ) : null}
              </Pressable>
              {r.review ? (
                hidden ? (
                  <Pressable onPress={() => setShown((s) => new Set(s).add(k))} accessibilityRole="button" style={{ padding: 10, borderRadius: radius.control, backgroundColor: tokens.surface2 }}>
                    <Text size={12} muted>{`${t.spoilerMark} · ${t.spoilerShow}`}</Text>
                  </Pressable>
                ) : (
                  <Text size={13} style={{ lineHeight: 19 }}>{r.review}</Text>
                )
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="heart" size={13} color={r.liked_by_me ? tokens.accent : tokens.muted} />
                {r.likes > 0 ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(r.likes, locale)}</Text> : null}
              </View>
            </View>
            <PosterCard
              item={{ key: k, kind: r.media_type, id: r.tmdb_id, title: r.title ?? "", posterPath: r.poster_path, progress: r.mine.progress, completed: r.mine.watched, dropped: r.mine.dropped }}
              width={64}
              marquee={false}
              onPress={(it) => onTitle(it.kind, it.id)}
            />
          </View>
        );
      })}
    </View>
  );
}

/** القوائم: المعلنةُ ثمّ المحفوظة (رايتُها لصاحبها — D-594؛ فراغُها يُسقط قسمَها) */
function ListsPane({ d, onList, onMember }: { d: ProfilePayload; onList: (id: string) => void; onMember: (name: string) => void }) {
  const { t } = useApp();
  void onMember;
  const { public: pub, saved } = d.lists;
  if (!pub.length && !saved.length) return <Empty text={t.profileEmptyLists} />;
  const block = (label: string, icon: string, ls: ProfileList[]) =>
    ls.length ? (
      <View>
        <SectionHead icon={icon} label={label} />
        <View style={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
          {ls.map((l) => (
            <ListCard key={l.id} card={listCardOf(l, t)} onPress={() => onList(l.id)} />
          ))}
        </View>
      </View>
    ) : null;
  return (
    <View>
      {block(t.profileListsRail, "list", pub)}
      {block(t.savedListsSection, "bookmark", saved)}
    </View>
  );
}

/** ورقةُ خانةِ الأرقام: الصفُّ كاملاً مجمَّعاً بالتصنيف كالويب (`ProfileStatSheet` · D-645 — أبجديٌّ داخل التصنيف) */
function GridSheet({
  d,
  which,
  posterW,
  width,
  onClose,
  onTitle,
}: {
  d: ProfilePayload;
  which: Grid;
  posterW: number;
  width: number;
  onClose: () => void;
  onTitle: (k: "tv" | "movie", id: number) => void;
}) {
  const { t, locale } = useApp();
  const rows: (ProfileTitle | ProfileShow)[] = which === "shows" ? d.overview.shows : which === "movies" ? d.overview.movies : d.overview.anime;
  const collator = useMemo(() => new Intl.Collator(locale === "ar" ? "ar" : "en", { sensitivity: "base", numeric: true }), [locale]);
  const sortKey = (s: string) => s.trim().replace(/^(the|a|an)\s+/i, "");
  const byTitle = (a: ProfileTitle, b: ProfileTitle) => collator.compare(sortKey(a.title), sortKey(b.title));
  const groups = groupByGenre(rows, (r) => r.genres, byTitle);
  const cols = Math.max(3, Math.floor((width - PAGE_PAD * 2 + GAP) / (posterW + GAP)));
  const w = Math.floor((width - PAGE_PAD * 2 - GAP * (cols - 1)) / cols);
  const title = which === "shows" ? t.shortShows : which === "movies" ? t.shortMovies : t.discoverTabAnime;
  const gridOf = (xs: (ProfileTitle | ProfileShow)[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
      {xs.map((x) => (
        <PosterCard key={`${x.media_type}-${x.tmdb_id}`} item={asItem(x)} width={w} marquee={false} onPress={(it) => onTitle(it.kind, it.id)} />
      ))}
    </View>
  );
  return (
    <Sheet title={`${title} · ${num(rows.length, locale)}`} onClose={onClose}>
      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
        {groups.length <= 1
          ? gridOf([...rows].sort(byTitle))
          : groups.map((g) => (
              <View key={g.genre?.slug ?? "other"} style={{ marginBottom: 16 }}>
                <Text size={14} weight="700" muted style={{ marginBottom: 8 }}>{g.genre ? browseGenreName(g.genre, locale) : t.genreOther}</Text>
                {gridOf(g.rows)}
              </View>
            ))}
      </ScrollView>
    </Sheet>
  );
}
