import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useBootRoot } from "../bootRoot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, write } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text, Toast } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Chip } from "../library/Chip";
import { OneTimeHint } from "../library/OneTimeHint";
import { libraryQuery } from "../library/LibraryScreen";
import { navHeight } from "../BottomNav";
import { DockLink } from "../navDock";
import { haptic } from "../haptics";
import { nativeListId } from "../list/route";
import { profileHref } from "@/core/people";
import { ArtistRow, Divided, ListRow, MemberRow, RowsSkeleton, Tail, TitleRow } from "./SearchRows";
import { MIN_QUERY, refreshTrending, trendingShown, useDebounced, useSearch, useTrending } from "./useSearch";
import { afterPaint, coldStartVoid, span, tabLanded } from "../perfMarks";
import type { SearchScope, SearchStoryBody, SearchStoryItem, SearchStoryPayload } from "../contracts";
import { openProfile, profileHandleOf } from "../member/open";

/**
 * ====== شاشةُ البحث أصليّةً — Phase 11-G · G1–G3 (٢٢ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «نأجّل F6 .. نبي نحوّل البحث أصليّ».** كان تبويبُ البحث — واحداً من خمسة في الشريط —
 * الوحيدَ الذي يحمّل مستنداً ويبيّاً عند كلِّ ضغطة؛ الآن شاشةٌ أصليّةٌ تُدفع فوق `/web` كالمكتبة و«اكتشف».
 *
 * 🔑 **الوصفةُ وصفةُ `src/components/SearchScreen.tsx` حرفاً** (القاعدة ٣): حقلٌ واحدٌ بتركيزٍ فوريّ ومسحٍ
 * لا يُرسم على فراغ (D-222)، **خمسُ رقاقاتٍ** من العائلة الواحدة (D-948)، بابُ «ابحث بالوصف» فوق النتائج
 * دائماً (من لا يعرف الاسمَ لا يجده أسفلَ قائمةِ من يعرفونه — ومنذ D-1252 زرٌّ بجانب الحقل)، ثمّ الأقسامُ الأربعة — **قسمٌ فارغٌ لا يُرسم**
 * و«عرض الكل» لا يُرسم إلّا وخلفه مزيد. الحالاتُ الثلاث: ابدأ · هيكل · لا نتائج.
 *
 * 🔑 **الأبواب**: عملٌ ⇒ `TitleScreen` · فنّانٌ ⇒ `PersonScreen` · قائمةٌ ⇒ `ListScreen` — أصليّةٌ كلُّها
 * بـ`from: "search"` فيعود الرجوعُ إلى هنا. **والعضوُ وحدَه ويبيّ** (صفحةُ `/u/` لم تُنقل — بابٌ معلَن).
 *
 * 🔑 **لا ميزةَ ليست في الويب**: لا بحثاتٌ أخيرة — التكافؤُ أوّلاً، والإضافةُ قرارٌ لاحق.
 *
 * 🆕 ⚖️ **«رائج اليوم» قبل الكتابة — نقضٌ بكلمة أحمد لـ«لا رائج» أعلاه (٣ أكتوبر ٢٠٢٦)**: عشرةُ أعمالٍ
 * (أفلامٌ ومسلسلاتٌ وأنمي) تملأ الفراغَ الذي كان نصَّ «ابدأ»، بصفّ النتيجة نفسِه مرقَّماً، وفي الويب مثلُها.
 * 🆕 ⚖️ **ولا لوحةَ مفاتيحٍ عند الدخول** («أوّل ما أدخل يطلع الكيبورد .. ما أبغاه يطلع»): كانت تغطّي
 * القائمةَ فلا يُرى منها إلّا صفّان. الحقلُ يُركَّز بلمسه، **أو بضغطةٍ ثانيةٍ على «بحث» في الشريط السفليّ**
 * (اختيارُ أحمد بدل فقاعةٍ عائمة: لا عنصرَ جديداً ولا شيءَ يغطّي القائمة).
 */
const PAGE_PAD = 16;
const HEADER_H = 64;
const SCOPES: SearchScope[] = ["all", "titles", "artists", "members", "lists"];
const DESC_MIN = 8;
const DESC_MAX = 600;

export function SearchScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navH = navHeight(insets.bottom);
  const inputRef = useRef<TextInput>(null);

  /* K1 — `search.open`: البحثُ يُفتح على حقلٍ لا بيانات، فالمقياسُ من التركيب إلى أوّل رسم */
  useEffect(() => {
    coldStartVoid();
    afterPaint(span("search.open"));
  }, []);
  /* K3 — «وصلتُ» عند كلِّ ظهورٍ للتبويب الثابت */
  useFocusEffect(useCallback(() => tabLanded("search"), []));

  const [q, setQ] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const term = useDebounced(q);
  const search = useSearch(term, scope);
  const trend = useTrending();
  /* 🆕 D-1263 — **المعروضُ لا يتبدّل والتبويبُ ظاهر**: `shown` يأخذ القائمةَ حين لا شيءَ معروضاً، أو حين تصل
     والتبويبُ غيرُ ظاهر (الشاشةُ ثابتةٌ مركّبة فالتحديثُ لا يُرى). ما وصل وهو ظاهرٌ ينتظر المغادرة. والمغادرةُ
     تطلب التجديدَ إن مضت عشرُ دقائق — فالعودةُ تجد الجديدَ مرسوماً لا يتبدّل أمام العين. */
  const [shown, setShown] = useState(trend.data);
  const focused = useRef(false);
  const latest = useRef(trend.data);
  latest.current = trend.data;
  useEffect(() => {
    if (trend.data && (!focused.current || !shown?.length)) setShown(trend.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend.data]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      trendingShown(true);
      return () => {
        focused.current = false;
        trendingShown(false);
        if (latest.current) setShown(latest.current);
        refreshTrending();
      };
    }, []),
  );

  /* ================= وضعُ الوصف (G3) ================= */
  const [desc, setDesc] = useState(false);
  const [descText, setDescText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const story = useMutation({
    mutationFn: async (description: string) => write<SearchStoryPayload>("/api/v1/search/story", { description } satisfies SearchStoryBody),
    onError: (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
    },
  });
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(h);
  }, [toast]);

  /* 🆕 ضغطةٌ ثانيةٌ على «بحث» ⇒ اكتب. **إن كانت اللوحةُ ظاهرةً فلا شيء**؛ وإلّا `blur` ثمّ `focus`:
     أندرويد يُبقي التركيزَ على الحقل بعد إغلاق اللوحة بزرّ الرجوع، و`focus()` على حقلٍ مركَّزٍ لا يفتحها. */
  const focusField = useCallback(() => {
    if (Keyboard.isVisible()) return;
    const el = inputRef.current;
    if (!el) return;
    el.blur();
    requestAnimationFrame(() => el.focus());
  }, []);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  const { switchTo, bootBack } = useBootRoot();
  /* K3 — الرجوعُ للتبويب الظاهر وحدَه (الجذورُ مركَّبةٌ معاً) */
  useFocusEffect(
    useCallback(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      /* رجوعُ النظام في وضع الوصف يعود إلى البحث بالاسم — كزرّ «رجوع» أعلى النموذج في الويب */
      if (desc) {
        setDesc(false);
        return true;
      }
      /* D-1078 — جذرٌ وُلد من الإقلاع: إلى الرئيسيّة الأصليّة، لا يكشف رئيسيّةَ الويب تحته */
      if (bootBack("/search")) return true;
      back();
      return true;
    });
    return () => sub.remove();
    }, [back, desc, bootBack]),
  );

  /* الخروجُ إلى صفحةٍ ويبيّة — الشاشةُ تبقى حتى تصل (D-951) وتعود إليها (D-949/D-998) */
  const [leaving, setLeaving] = useState(false);
  const leaveTo = useCallback(
    (path: string) => {
      /* 🆕 11-N · N1 — ملفُّ الشخص أصليٌّ: رابطُه لا يفتح الويب (`member/open.ts`) */
      { const who = profileHandleOf(path); if (who) return openProfile(router, who, "search"); }
      if (leaving) return;
      const listId = nativeListId(path);
      if (listId) {
        router.push({ pathname: "/list/[id]", params: { id: listId, from: "search" } });
        return;
      }
      setLeaving(true);
      void shell.open(path, { returnTo: "search" }).then((layered) => {
        setLeaving(false);
        /* 🆕 K3b — ظهرت طبقةً ⇒ هذه الشاشةُ تبقى تحتها كما هي (لا نزعَ ولا بناء) */
        if (!layered) back();
      });
    },
    [leaving, back, router],
  );
  const openTitle = useCallback((kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: "search" } }), [router]);
  const openPerson = useCallback((id: number) => router.push({ pathname: "/person/[id]", params: { id: String(id), from: "search" } }), [router]);

  const data = search.data;
  const short = term.trim().length < MIN_QUERY;
  const nothing = !!data && !data.titles.length && !data.artists.length && !data.members.length && !data.lists.length;
  const seeAll = (s: Exclude<SearchScope, "all">) =>
    scope === "all" && data?.more[s]
      ? () => {
          haptic.pick();
          setScope(s);
        }
      : null;

  const runDesc = () => {
    const text = descText.trim();
    if (text.length < DESC_MIN) return;
    haptic.pick();
    story.mutate(text);
  };
  const descItems: SearchStoryItem[] | null = story.data ? story.data.items : null;
  /* 🆕 D-1259 — **تلميحُ النجمة لمرّةٍ واحدة**. المقروءُ في الحساب يصل مع `me:library` (D-954) — يُقرأ من
     الكاش **بلا نداء** (`enabled: false`): الرئيسيّةُ تسخّنه، وإن غاب فلا تلميح (أهونُ من تلميحٍ يعود). */
  const lib = useQuery({ ...libraryQuery, enabled: false });
  const hintDue = !!lib.data && !(lib.data.hints ?? []).includes("search-desc");

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      {/* `SettingsHeader title={t.navSearch} fallbackHref="/"` — الترويسةُ نفسُها التي ترسمها صفحاتُ الإعدادات */}
      <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
        <Text size={15} weight="700" numberOfLines={1}>{t.navSearch}</Text>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
          <Tail color={tokens.fg} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: PAGE_PAD, paddingBottom: navH + 24, gap: 16 }} showsVerticalScrollIndicator={false}>
        {desc ? (
          <>
            <Pressable onPress={() => setDesc(false)} hitSlop={8} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
              <View style={{ transform: [{ rotate: "90deg" }] }}>
                <Icon name="chevron-down" size={14} color={tokens.muted} />
              </View>
              <Text size={12} weight="600" muted>{t.aiSearchBack}</Text>
            </Pressable>
            {/* textarea ٣ أسطر: `rounded-xl bg-surface-2 border px-4 py-3 text-base` — ١٦ بكسلاً لا أصغر */}
            <TextInput
              value={descText}
              onChangeText={(v) => setDescText(v.slice(0, DESC_MAX))}
              placeholder={t.aiSearchPlaceholder}
              placeholderTextColor={tokens.muted}
              multiline
              autoFocus
              textAlignVertical="top"
              style={{ minHeight: 96, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: tokens.fg, textAlign: "left" }}
            />
            <Button label={story.isPending ? t.peopleSearching : t.aiSearchRun} busy={story.isPending} disabled={descText.trim().length < DESC_MIN} onPress={runDesc} />
            {story.isPending ? (
              <Text size={14} muted style={{ textAlign: "center", paddingVertical: 32 }}>{t.peopleSearching}</Text>
            ) : descItems === null ? (
              <Text size={12} muted style={{ textAlign: "center", paddingVertical: 32 }}>{t.aiSearchHint}</Text>
            ) : descItems.length === 0 ? (
              <Text size={14} muted style={{ textAlign: "center", paddingVertical: 32 }}>{t.aiSearchEmpty}</Text>
            ) : (
              <>
                {/* 🆕 D-1259 — المسارُ البديل (بلا نموذج) يُسمّى: نتائجُه أضعف، وعرضُها بلا كلمةٍ يُحسب على الذكاء */}
                {story.data?.fallback ? <Text size={12} muted>{t.aiSearchFallback}</Text> : null}
                <Divided>
                  {descItems.map((r) => (
                    <TitleRow key={`${r.mediaType}-${r.id}`} r={r} note={r.reason} onPress={() => openTitle(r.mediaType, r.id)} />
                  ))}
                </Divided>
              </>
            )}
          </>
        ) : (
          <>
            {/* الحقل: `rounded-xl bg-surface-2 border ps-10 pe-11 py-3 text-base` — ولا حدَّ ذهبيّاً عند التركيز (D-539) */}
            {/* ⚖️ 🆕 D-1252 — **بابُ «بحث بالوصف» زرٌّ بجانب الحقل** لا بطاقةٌ بسطرين تحت الرقاقات (أحمد: «أحسّه ماخذ
                مساحة كبيرة»، اختار «ب» من صورتين): صفٌّ كاملٌ عاد لـ«رائج اليوم». ما زال باباً لا رقاقة (D-534).
                الزرُّ بارتفاع الحقل (`stretch`) فيكبران معاً مع حجم الخطّ. ⚠️ نجمةٌ بلا كلمة: اسمُها لقارئ الشاشة،
                وتلميحُ المرّة الواحدة (`OneTimeHint`) تحتها منذ D-1259. */}
            <View style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}>
            <View style={{ position: "relative", justifyContent: "center", flex: 1, minWidth: 0 }}>
              <View pointerEvents="none" style={{ position: "absolute", start: 14, zIndex: 1 }}>
                <Icon name="search" size={18} color={tokens.muted} />
              </View>
              <TextInput
                ref={inputRef}
                value={q}
                onChangeText={setQ}
                placeholder={t.searchPlaceholder}
                placeholderTextColor={tokens.muted}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                style={{ minHeight: 48, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.md, paddingStart: 40, paddingEnd: 44, paddingVertical: 12, fontSize: 16, color: tokens.fg, textAlign: "left" }}
              />
              {/* المسحُ لا يُرسم على حقلٍ فارغ (D-222) — وهدفُ اللمس ٤٤ وإن كان الرمزُ ١٨ (D-033/D-168) */}
              {q ? (
                <Pressable
                  onPress={() => {
                    setQ("");
                    inputRef.current?.focus();
                  }}
                  accessibilityLabel={t.searchClear}
                  style={{ position: "absolute", end: 0, top: 0, bottom: 0, width: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <Icon name="close" size={18} color={tokens.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                haptic.pick();
                setDesc(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t.searchByDesc}
              style={({ pressed }) => ({ width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: pressed ? tokens.accent : tokens.border, backgroundColor: tokens.surface2 })}
            >
              <Icon name="sparkles" size={18} color={tokens.accent} />
            </Pressable>
            </View>

            {/* 🆕 D-1259 — يُعلن قراءتَه عند الإغلاق أو عند دخول وضع الوصف (هذا الفرعُ يُنزع حينها) */}
            {hintDue ? <OneTimeHint id="search-desc" text={t.hintSearchDesc} /> : null}

            {/* الرقاقاتُ الخمس — `chipRow`: تتمرّر أفقيّاً حتى حافّة الشاشة (`-mx-4 px-4`) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -PAGE_PAD }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8 }} keyboardShouldPersistTaps="handled">
              {SCOPES.map((s) => (
                <Chip
                  key={s}
                  size="md"
                  label={scopeLabel(s, t)}
                  active={scope === s}
                  onPress={() => {
                    if (s === scope) return;
                    haptic.pick();
                    setScope(s);
                  }}
                />
              ))}
            </ScrollView>

            {short ? (
              /* 🆕 الفراغُ قبل الكتابة = «رائج اليوم». الهيكلُ بإيقاع الصفّ ريثما تصل، ونصُّ «ابدأ» إن لم تصل */
              shown?.length ? (
                <Section title={t.searchTrendingToday} show seeAll={null} seeAllLabel={t.searchSeeAll}>
                  {shown.map((r, i) => (
                    <TitleRow key={`${r.mediaType}-${r.id}`} r={r} rank={i + 1} kind={r.anime ? t.animeBadge : undefined} onPress={() => openTitle(r.mediaType, r.id)} />
                  ))}
                </Section>
              ) : trend.isPending ? (
                <RowsSkeleton />
              ) : (
                <Text muted style={{ textAlign: "center", paddingVertical: 64 }}>{t.searchStart}</Text>
              )
            ) : search.isError ? (
              <Text muted style={{ textAlign: "center", paddingVertical: 64 }}>{search.error instanceof ApiError && search.error.error.code === "rate_limited" ? t.apiRateLimited : t.apiUpstream}</Text>
            ) : !data ? (
              <RowsSkeleton />
            ) : nothing ? (
              <Text muted style={{ textAlign: "center", paddingVertical: 64 }}>{t.searchNoResults}</Text>
            ) : (
              <View style={{ gap: 24, opacity: search.isPlaceholderData ? 0.6 : 1 }}>
                <Section title={t.searchModeTitles} show={data.titles.length > 0} seeAll={seeAll("titles")} seeAllLabel={t.searchSeeAll}>
                  {data.titles.map((r) => (
                    <TitleRow key={`${r.mediaType}-${r.id}`} r={r} onPress={() => openTitle(r.mediaType, r.id)} />
                  ))}
                </Section>
                <Section title={t.searchTabArtists} show={data.artists.length > 0} seeAll={seeAll("artists")} seeAllLabel={t.searchSeeAll}>
                  {data.artists.map((a) => (
                    <ArtistRow key={a.id} a={a} onPress={() => openPerson(a.id)} />
                  ))}
                </Section>
                <Section title={t.searchTabMembers} show={data.members.length > 0} seeAll={seeAll("members")} seeAllLabel={t.searchSeeAll}>
                  {data.members.map((m) => {
                    const href = profileHref(m);
                    return <MemberRow key={m.id} m={m} onPress={href ? () => leaveTo(href) : null} />;
                  })}
                </Section>
                <Section title={t.searchTabLists} show={data.lists.length > 0} seeAll={seeAll("lists")} seeAllLabel={t.searchSeeAll}>
                  {data.lists.map((l) => (
                    <ListRow key={l.id} l={l} onPress={() => leaveTo(`/lists/${l.id}`)} />
                  ))}
                </Section>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* D-1012 — الشريطُ الخماسيُّ أصليٌّ؛ «بحث» الخانةُ المضيئة. المكتبةُ و«اكتشف» تبديلٌ لا تكديس (نهجُ المكتبة) */}
      <DockLink
        k="search"
        locked={leaving}
        onGo={(k) => {
          /* 🆕 ضغطةٌ ثانيةٌ على الخانة المضيئة تفتح اللوحة (في وضع الوصف لا شيء: حقلُه مركَّزٌ أصلاً) */
          if (k === "search") {
            if (!desc) focusField();
            return;
          }
          if (k === "library") {
            switchTo("/library");
            return;
          }
          if (k === "news") {
            switchTo("/discover");
            return;
          }
          /* D-1074 — الرئيسيّةُ أصليّة (11-H): تبديلٌ بين الجذور كأخويها، لا رحلةٌ إلى `/` الويبيّة ثمّ ارتداد */
          if (k === "home") {
            switchTo("/home");
            return;
          }
          leaveTo("/people");
        }}
      />
      {toast ? <Toast text={toast} bottom={navH + 16} /> : null}
    </View>
  );
}

function scopeLabel(s: SearchScope, t: ReturnType<typeof useApp>["t"]): string {
  return s === "all" ? t.searchTabAll : s === "titles" ? t.searchModeTitles : s === "artists" ? t.searchTabArtists : s === "members" ? t.searchTabMembers : t.searchTabLists;
}

/**
 * قسمٌ من أقسام «الكل» — عنوانٌ و«عرض الكل» ثمّ صفوفُه. **وقسمٌ بلا صفٍّ لا يُرسم** (D-222)، **و«عرض الكل»
 * لا يُرسم إلّا وخلفه مزيد** — وعدٌ يفتح القائمةَ نفسَها كذبةٌ صغيرة.
 */
function Section({ title, show, seeAll, seeAllLabel, children }: { title: string; show: boolean; seeAll: (() => void) | null; seeAllLabel: string; children: React.ReactNode[] }) {
  const { tokens } = useApp();
  if (!show) return null;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Text size={15} weight="700">{title}</Text>
        {seeAll ? (
          <Pressable onPress={seeAll} hitSlop={8} accessibilityRole="button" style={{ marginStart: "auto" }}>
            <Text size={12} weight="700" color={tokens.accent}>{seeAllLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <Divided>{children}</Divided>
    </View>
  );
}
