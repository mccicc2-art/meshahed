import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, I18nManager, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GENRES } from "@/core/media";
import { cleanUsername, usernameIssue, USERNAME_MAX } from "@/core/username";
import type {
  WelcomeFinishBody,
  WelcomeFinishPayload,
  WelcomePayload,
  WelcomePeoplePayload,
  WelcomePerson,
  WelcomeProgress,
  WelcomeSeedItem,
  WelcomeUpTo,
  WelcomeUsernamePayload,
} from "@/core/contracts/welcome";
import { api, ApiError, filePart, postForm, queryClient } from "../api";
import { rootsBorn } from "../bootRoot";
import { Avatar } from "../community/CommunityCards";
import { haptic } from "../haptics";
import { Icon } from "../icons";
import { IdentityBadges } from "../IdentityBadges";
import { Chip } from "../library/Chip";
import { mark } from "../perfMarks";
import { posterFor } from "../poster";
import { session } from "../session";
import { Field, Group } from "../settings/ui";
import { messageOf } from "../settings/api";
import { shell } from "../shell";
import { useApp } from "../state";
import { radius, space } from "../theme";
import { Button, Loading, Text } from "../ui";
import { EpisodeSheet } from "./EpisodeSheet";

/**
 * ====== الترحيبُ أصليّاً (D-1347 · Phase 11-U · U1 المرحلة ٢ = 11-V · V2) ======
 *
 * 🔑 **ترجمةُ `Onboarding` (الويب) لا إعادةُ تصميمه** (D-1067): الخطواتُ الخمسُ نفسُها بترتيبها وأقفالها —
 *   ١ «هذا أنت» (مقفولة: اسمُ مستخدمٍ إجباريّ) · ٢ الأعمال (مقفولة: عملٌ واحدٌ على الأقلّ) ·
 *   ٣ «أين وصلت» · ٤ الأنواع · ٥ الأشخاص — والثلاثُ الأخيرة «تخطّي» فيها يتخطّى فعلاً (قرارا أحمد ٨ و١٧).
 * **ولا شيءَ يُكتب قبل آخر ضغطة**: `POST /api/v1/welcome/finish` يكتب بترتيب الويب وبأفعاله ثمّ يختم.
 *
 * 🔑 **لماذا أصليّ**: ترحيبُ الويب داخل التطبيق كان ينتهي على رئيسيّة الويب (تسجيلا أحمد ١٠ أكتوبر، وسببُه لم
 * يثبت). هنا الشاشةُ نفسُها ترفع الرئيسيّةَ الأصليّة بعد أن يقول الخادمُ «خُتم» — لا رسالةَ من صفحةٍ تُنتظر.
 *
 * 🆕 **ورقةُ المواسم والحلقات** (قرارُ أحمد ١٠ أكتوبر بصورةٍ موافَقٍ عليها): «بدأته» على مسلسلٍ يفتح `EpisodeSheet` —
 * يضغط آخرَ حلقةٍ شاهدها فيُعلَّم ما قبلها، أو «ما أتذكر — بدأته فقط».
 *
 * ⚖️ **بابُ الخروج الوحيد «بدّل الحساب»** (D-885/D-1341) — كما في الويب: لا شريطَ ولا تبويبَ فوق البوّابة.
 */
const STEPS = 5;
const ME = 1;
const PICK = 2;
const PROGRESS = 3;
const TASTE = 4;
const PEOPLE = 5;

const PAD = space.lg;
const GRID_GAP = space.md;
const COLS = 3;
const MAX_EDGE = 1920;
const KEY = ["welcome"] as const;

/**
 * الرمزُ قبل أوّل نداء: الشاشةُ تُرفع لحظةَ الدخول، والجلسةُ المملوكةُ ما زالت تُسكّ (`own.fresh` — نحو نصف ثانية).
 * `api()` لا ينتظر سكّاً في الطريق: يسأل الجسرَ (صفحةٌ تحت التسليم لا تجيب) ثمّ ينادي بلا رمز. ننتظر هنا وصولَ
 * الرمز — بمهلة: من لم يصله يمضي إلى `api()` بسلوكه المعتاد، والشاشةُ تعرض «حاول مجدداً» إن فشل.
 */
function tokenReady(ms: number): Promise<void> {
  if (session.has()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      off();
      resolve();
    };
    const timer = setTimeout(done, ms);
    const off = session.subscribe(() => {
      if (session.has()) done();
    });
  });
}

type NameState = WelcomeUsernamePayload["state"];
type NameCheck = NameState | "idle" | "checking";

export function WelcomeScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);

  /* 🩺 قياسٌ: كم بقيت الشاشةُ ومن أيِّ خطوةٍ أُنزلت — «أُنزلت في الخطوة ١ بعد ثانية» عطلٌ، «في ٥ بعد دقيقة» إتمام
     (`count` = الخطوة: مفاتيحُ القياس قائمةٌ مغلقةٌ في الخادم) */
  const stepRef = useRef(ME);
  useEffect(() => {
    const t0 = Date.now();
    mark("welcome.show", 0);
    return () => mark("welcome.hide", Date.now() - t0, { count: stepRef.current });
  }, []);

  const boot = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      await tokenReady(6000);
      return (await api<WelcomePayload>("/api/v1/welcome")).data;
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: 1,
  });
  const data = boot.data;

  const [step, setStep] = useState(ME);
  stepRef.current = step;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /* ===== «هذا أنت» ===== الحقولُ تُملأ مرّةً حين تصل الحمولة — وما كتبه بعدها لا يُمحى بجلبٍ ثانٍ */
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [genres, setGenres] = useState<number[]>([]);
  const filled = useRef(false);
  useEffect(() => {
    if (!data || filled.current) return;
    filled.current = true;
    setName(data.nickname);
    setPhoto(data.avatar_url);
    setHandle(data.username);
    setGenres(data.genres);
  }, [data]);
  const [verdict, setVerdict] = useState<{ name: string; state: NameState }>({ name: "", state: "unknown" });
  const [uploading, setUploading] = useState(false);
  const uploaded = useRef<string | null>(null);
  const cleanHandle = cleanUsername(handle);
  const tooShort = !!cleanHandle && usernameIssue(cleanHandle) === "short";
  /* الفحصُ وهو يكتب: الشكلُ محلّيّاً فوراً، والتوفّرُ بسؤالٍ مؤجَّلٍ ٣٥٠ م.ث (لا سؤالَ لكلِّ حرف). `alive` يُسقط
     جوابَ اسمٍ تجاوزه الكاتب. و`unknown` لا يقفل: الفهرسُ الفريدُ عند الحفظ هو القاضي. */
  useEffect(() => {
    if (!cleanHandle || tooShort) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<WelcomeUsernamePayload>(`/api/v1/welcome/username?u=${encodeURIComponent(cleanHandle)}`)
        .then((r) => {
          if (alive) setVerdict({ name: cleanHandle, state: r.data.state });
        })
        .catch(() => {
          if (alive) setVerdict({ name: cleanHandle, state: "unknown" });
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cleanHandle, tooShort]);
  const check: NameCheck = !cleanHandle ? "idle" : tooShort ? "short" : verdict.name === cleanHandle ? verdict.state : "checking";
  const handleOk = check === "free" || check === "unknown";

  /* الرفعُ بوصفة «تعديل الملف» الأصليّة حرفاً (D-1106): منتقي النظام ← تصغيرٌ ← `POST /me/profile/image`.
     الرابطُ يعود ولا يُكتب في الملفّ حتى «يالله نبدأ»؛ و`replaces` يحذف رفعةً سابقةً في هذه الجلسة لم تُحفظ. */
  const pickPhoto = useCallback(async () => {
    if (uploading) return;
    setError(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setUploading(true);
    try {
      const long = Math.max(a.width || 0, a.height || 0);
      const ctx = ImageManipulator.manipulate(a.uri);
      if (long > MAX_EDGE) ctx.resize(a.width >= a.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      const form = new FormData();
      form.append("kind", "avatar");
      if (uploaded.current) form.append("replaces", uploaded.current);
      form.append("file", filePart(img.uri, "avatar.jpg", "image/jpeg"));
      const out = await postForm<{ url: string }>("/api/v1/me/profile/image", form);
      uploaded.current = out.url;
      setPhoto(out.url);
      haptic.pick();
    } catch (e) {
      setError(e instanceof ApiError ? messageOf(e, t as unknown as Record<string, unknown>, t.errUpload) : t.errUpload);
    } finally {
      setUploading(false);
    }
  }, [uploading, t]);

  /* ===== الأعمال والتقدّم ===== */
  const seeds = useMemo(() => data?.seeds ?? [], [data]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<Record<number, WelcomeProgress>>({});
  const [upTo, setUpTo] = useState<Record<number, WelcomeUpTo>>({});
  const [sheet, setSheet] = useState<WelcomeSeedItem | null>(null);
  const chosen = useMemo(() => seeds.filter((s) => picked.has(s.id)), [seeds, picked]);

  const toggle = useCallback((id: number) => {
    haptic.pick();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setProg = useCallback((s: WelcomeSeedItem, key: WelcomeProgress) => {
    haptic.pick();
    setProgress((p) => ({ ...p, [s.id]: key }));
    /* «بدأته» على مسلسلٍ يفتح الورقة؛ غيرُها يمحو موضعاً اختير قبلُ — «ما بدأته» مع «وصلت إلى الحلقة ٥» تناقض */
    if (key === "some" && s.mediaType === "tv") setSheet(s);
    else
      setUpTo((u) => {
        if (!(s.id in u)) return u;
        const next = { ...u };
        delete next[s.id];
        return next;
      });
  }, []);

  /* ===== الأشخاص ===== يُطلبون عند الوصول للخطوة لا قبلها: البذرةُ ما اختاره في الخطوة الثانية (D-126) */
  const [people, setPeople] = useState<WelcomePerson[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [toFollow, setToFollow] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (step !== PEOPLE || peopleLoaded) return;
    let alive = true;
    api<WelcomePeoplePayload>("/api/v1/welcome/people", { method: "POST", body: { seeds: [...picked] } })
      .then((r) => {
        if (alive) setPeople(r.data.people);
      })
      /* الدالّةُ غائبة أو الشبكةُ سقطت؟ خطوةٌ فارغةٌ تُتخطّى، لا شاشةُ خطأ */
      .catch(() => {})
      .finally(() => {
        if (alive) setPeopleLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [step, peopleLoaded, picked]);

  const go = useCallback((next: number) => {
    setError(null);
    setStep(next);
    /* كلُّ خطوةٍ تبدأ من عنوانها — من نزل في شبكة الأعمال كان يهبط في منتصف الخطوة التالية */
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  /** «تخطّي» يتخطّى فعلاً: ما لم يُجب عنه يُحفظ فارغاً، لا ما كان ظاهراً على الشاشة */
  const skip = useCallback(() => {
    if (step === PROGRESS) {
      setProgress({});
      setUpTo({});
    }
    if (step === TASTE) setGenres([]);
    go(step + 1);
  }, [step, go]);

  /**
   * الخروجُ من البوّابة — بعد أن قال الخادمُ «خُتم» وحدَه. العلامةُ تُمحى و«أتمّ» تُحفظ لهذه الجلسة (حدثُ تنقّلٍ
   * متأخّرٌ لصفحة ترحيب الويب تحتنا لا يعيد كتابتَها)، الويبُ يُنقل عن `/welcome`، وكلُّ ما في الكاش قُرئ بحسابٍ
   * بلا مكتبةٍ فيُرمى — ثمّ الرئيسيّةُ الأصليّة كما يرفعها الإقلاع (`rootsBorn(true)`: رجوعُها يخرج من التطبيق).
   */
  const left = useRef(false);
  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    session.welcomeDone();
    shell.webReplace("/");
    void queryClient.invalidateQueries();
    if (router.canDismiss()) router.dismissAll();
    rootsBorn(true);
    router.push("/home");
  }, [router]);

  /* أتمّه على جهازٍ آخر (أو علامةٌ قديمةٌ على هذا الجهاز): لا خطوةَ تُعرض */
  const already = data?.onboarded === true;
  useEffect(() => {
    if (already) leave();
  }, [already, leave]);

  const finish = useCallback(async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const body: WelcomeFinishBody = {
        nickname: name,
        username: cleanHandle,
        avatarUrl: photo,
        genres,
        titles: chosen.map((c) => ({ id: c.id, progress: progress[c.id] ?? "none", upTo: upTo[c.id] ?? null })),
        people: [...toFollow],
      };
      const r = (await api<WelcomeFinishPayload>("/api/v1/welcome/finish", { method: "POST", body })).data;
      if (r.done) {
        haptic.success();
        leave();
        return;
      }
      /* 🔑 فشلٌ يُقال ويعيد إلى خطوته: من لم يُختم يعيده الحارسُ إلى هنا، وشاشةٌ تمضي به ثمّ تعيده تكذب عليه */
      if (r.step === "me") {
        if (r.reason !== "missing") setVerdict({ name: cleanHandle, state: r.reason });
        else setError(t.obFinishFailed);
        setStep(ME);
      } else if (r.step === "pick") {
        setError(t.obFinishFailed);
        setStep(PICK);
      } else setError(t.obFinishFailed);
    } catch {
      setError(t.obFinishFailed);
    } finally {
      setPending(false);
    }
  }, [pending, name, cleanHandle, photo, genres, chosen, progress, upTo, toFollow, leave, t]);

  /* رجوعُ النظام: خطوةٌ إلى الخلف، ومن الأولى يخرج من التطبيق — لا شيءَ خلف البوّابة يُرجَع إليه */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pending) return true;
      if (step > ME) go(step - 1);
      else BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, [step, pending, go]);

  const switchAccount = useCallback(() => {
    /* الخروجُ خروجُ الويب (`/auth/signout`) — والغلافُ يرفع شاشةَ الدخول الأصليّة حين يراه (D-1344/D-1346) */
    shell.post("/auth/signout");
  }, []);

  const tile = Math.floor((width - PAD * 2 - GRID_GAP * (COLS - 1)) / COLS);

  if (!data || already) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {boot.isError ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, gap: space.lg }}>
            <Text size={14} muted style={{ textAlign: "center", lineHeight: 22 }}>{t.obLoadFailed}</Text>
            <Button label={t.errorRetry} busy={boot.isFetching} onPress={() => void boot.refetch()} style={{ alignSelf: "stretch", minHeight: 52 }} />
            <Pressable onPress={switchAccount} hitSlop={8} accessibilityRole="button">
              <Text size={13} muted style={{ textDecorationLine: "underline" }}>{t.accountNoticeSwitch}</Text>
            </Pressable>
          </View>
        ) : (
          <Loading />
        )}
      </View>
    );
  }

  const title = step === ME ? t.obMeTitle : step === PICK ? t.obPickTitle : step === PROGRESS ? t.obProgressTitle : step === TASTE ? t.obGenresTitle : t.obPeopleTitle;
  const hint = step === ME ? t.obMeHint : step === PICK ? t.obPickHint : step === PROGRESS ? t.obProgressHint : step === TASTE ? t.obGenresHint : t.obPeopleHint;
  const nameColor = check === "free" ? tokens.success : check === "taken" || check === "reserved" || check === "short" ? tokens.error : tokens.muted;
  const nameLine =
    check === "free"
      ? t.obUserFree(cleanHandle)
      : check === "taken" || check === "reserved"
        ? t.apiUsernameTaken
        : check === "short"
          ? t.usernameShort
          : check === "checking"
            ? t.obUserChecking
            : cleanHandle && cleanHandle !== handle.trim().toLowerCase()
              ? t.willSaveAs(cleanHandle)
              : t.obUserRule;
  const cta = pending
    ? t.obSaving
    : step === PICK
      ? t.obPickedN(picked.size)
      : step === PEOPLE
        ? toFollow.size > 0
          ? t.obPeopleNext(toFollow.size)
          : t.obPeopleSkip
        : t.obNext;
  const locked = pending || uploading || (step === ME && (!cleanHandle || !handleOk)) || (step === PICK && picked.size === 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: space.md, paddingBottom: space.xl }}
      >
        {/* D-885 — البريدُ الذي دخل به فوق أوّل خطوة («ظنّ أنّ مكتبتَه ضاعت وهو على حساب جوجل آخر»)، ومعه بابُ
            الخروج الوحيدُ من البوّابة. كلُّ قطعةٍ `Text` بنصِّها (أبٌ فيه نصٌّ وعناصرُ يسقط إلى خطّ النظام). */}
        {data.email ? (
          <Text size={12} style={{ textAlign: "center", lineHeight: 20, marginBottom: space.lg }}>
            <Text size={12} muted>{`${t.accountNoticeSignedInAs(data.email)} `}</Text>
            <Text size={12} style={{ textDecorationLine: "underline" }} onPress={pending ? undefined : switchAccount}>{t.accountNoticeSwitch}</Text>
          </Text>
        ) : null}

        <View style={{ alignItems: "center", marginBottom: space.xl }}>
          <Text size={12} weight="700" color={tokens.accent}>{t.obStep(step, STEPS)}</Text>
          <Text size={24} weight="800" style={{ textAlign: "center", marginTop: space.sm, lineHeight: 34 }}>{title}</Text>
          <Text size={14} muted style={{ textAlign: "center", marginTop: space.sm, lineHeight: 22 }}>{hint}</Text>
        </View>

        {error ? (
          <View style={{ borderWidth: 1, borderColor: tokens.error, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: space.md, marginBottom: space.lg }}>
            <Text size={13} color={tokens.error} style={{ textAlign: "center", lineHeight: 20 }}>{error}</Text>
          </View>
        ) : null}

        {/* ١ — هذا أنت: الصورةُ والاسمُ من Google (يُعدَّلان)، واسمُ المستخدم إجباريّ (القرار ١٥). `@` خارج الحقل */}
        {step === ME ? (
          <Group>
            <View style={{ alignItems: "center", paddingVertical: space.lg + 4 }}>
              <View>
                <Avatar uri={photo} size={88} />
                <Pressable
                  onPress={() => void pickPhoto()}
                  disabled={uploading}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.setEditAvatar}
                  style={{ position: "absolute", bottom: 0, end: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.accent, borderWidth: 2, borderColor: tokens.surface, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.6 : 1 }}
                >
                  <Icon name={uploading ? "hourglass" : "image"} size={14} color={tokens.onAccent} />
                </Pressable>
              </View>
            </View>
            <Field label={t.displayNameSection} value={name} onChange={setName} maxLength={40} placeholder={t.displayNamePlaceholder} />
            <View>
              <Field label={t.usernameSection} value={handle} onChange={setHandle} maxLength={USERNAME_MAX} placeholder="ahmed_92" ltr prefix="@" />
              {/* سطرٌ واحدٌ تحت الحقل يقول حالَه: القاعدةُ، ثمّ ما سيُحفظ إن اختلف عمّا كُتب، ثمّ الحكم */}
              <Text size={12} color={nameColor} accessibilityLiveRegion="polite" style={{ paddingHorizontal: 14, paddingBottom: 12, marginTop: -6, lineHeight: 20 }}>{nameLine}</Text>
            </View>
          </Group>
        ) : null}

        {/* ٢ — اختيار ما شاهده */}
        {step === PICK ? (
          seeds.length === 0 ? (
            <Text size={14} muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.emptyStart}</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
              {seeds.map((s) => {
                const on = picked.has(s.id);
                const url = posterFor(s.posterPath, tile);
                return (
                  <Pressable key={`${s.mediaType}-${s.id}`} onPress={() => toggle(s.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={s.title} style={{ width: tile }}>
                    <View style={{ width: tile, height: Math.round(tile * 1.5), borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 2, borderColor: on ? tokens.accent : tokens.border, alignItems: "center", justifyContent: "center" }}>
                      {url ? <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={22} color={tokens.muted} />}
                      {on ? (
                        <View style={{ position: "absolute", top: 6, start: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: tokens.success, alignItems: "center", justifyContent: "center" }}>
                          <Icon name="check-line" size={14} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <Text size={12} numberOfLines={2} style={{ marginTop: 6, lineHeight: 17 }}>{s.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : null}

        {/* ٣ — أين وصل في كلِّ عمل */}
        {step === PROGRESS ? (
          <View style={{ gap: space.md }}>
            {chosen.map((s) => {
              const cur = progress[s.id] ?? "none";
              const url = posterFor(s.posterPath, 44);
              const at = upTo[s.id];
              return (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.card, padding: space.md }}>
                  <View style={{ width: 44, height: 66, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                    {url ? <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={14} weight="600" numberOfLines={1}>{s.title}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm }}>
                      <Chip label={t.obNotStarted} active={cur === "none"} onPress={() => setProg(s, "none")} />
                      <Chip label={t.obSomeOf} active={cur === "some"} onPress={() => setProg(s, "some")} />
                      <Chip label={t.obFinished} active={cur === "done"} onPress={() => setProg(s, "done")} />
                    </View>
                    {/* «بدأته» على مسلسل: الموضعُ الذي اختاره وبابُ تعديله — أو بابُ تحديده لمن أغلق الورقةَ بلا اختيار */}
                    {cur === "some" && s.mediaType === "tv" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm }}>
                        {at ? <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{t.obUpToReached(at.season, at.episode)}</Text> : null}
                        <Pressable onPress={() => setSheet(s)} hitSlop={8} accessibilityRole="button">
                          <Text size={12} weight="600" color={tokens.accent}>{at ? t.obUpToEdit : t.obUpToSet}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ٤ — الأنواع المفضّلة */}
        {step === TASTE ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center" }}>
            {GENRES.map((g) => (
              <Chip
                key={g.id}
                size="md"
                label={locale === "en" ? g.en : g.ar}
                active={genres.includes(g.id)}
                onPress={() => {
                  haptic.pick();
                  setGenres((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]));
                }}
              />
            ))}
          </View>
        ) : null}

        {/* ٥ — أشخاصٌ قد ترغب بمتابعتهم (D-126 · القرار ١٢). الصفُّ زرٌّ واحدٌ يبدّل الاختيار: لا متابعةَ تُكتب هنا */}
        {step === PEOPLE ? (
          <View style={{ gap: space.sm }}>
            {!peopleLoaded ? (
              [0, 1, 2].map((i) => <View key={i} style={{ height: 68, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.card, opacity: 0.6 }} />)
            ) : people.length === 0 ? (
              <Text size={14} muted style={{ textAlign: "center", paddingVertical: 40, lineHeight: 22 }}>{t.obPeopleNone}</Text>
            ) : (
              people.map((p) => {
                const on = toFollow.has(p.id);
                const who = p.nickname || p.username || t.anonymousUser;
                const reason = p.shared > 0 ? t.suggestShared(p.shared) : p.followers > 0 ? t.suggestFollowers(p.followers) : null;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      haptic.pick();
                      setToFollow((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      });
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: tokens.surface, borderWidth: on ? 2 : 1, borderColor: on ? tokens.accent : tokens.border, borderRadius: radius.card, padding: on ? space.md - 1 : space.md }}
                  >
                    <Avatar uri={p.avatar_url} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* السببُ تحت الاسم يقول «لماذا هو»، والشارةُ تقول «من هو» (D-773ب) */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{who}</Text>
                        <IdentityBadges flags={p} nameSize={14} />
                      </View>
                      {reason ? <Text size={12} muted numberOfLines={1}>{reason}</Text> : null}
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1, borderColor: tokens.border, backgroundColor: on ? tokens.success : "transparent" }}>
                      <Icon name={on ? "check-line" : "plus"} size={14} color={on ? "#fff" : tokens.muted} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* شريطُ الإجراء الثابت. الصفُّ الثاني: رجوعٌ (بعد الأولى) و«تخطّي» (في الاختياريّتين وحدَهما). الخطوتان المقفولتان
          بلا «تخطّي»، والأخيرةُ زرُّها نفسُه يقول «أكمل بدون متابعة». لا بابَ هنا يخرج من الترحيب. */}
      <View style={{ paddingHorizontal: PAD + 4, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm, borderTopWidth: 1, borderTopColor: tokens.divider, backgroundColor: tokens.bg }}>
        <Button label={cta} busy={pending} disabled={locked} onPress={() => (step < PEOPLE ? go(step + 1) : void finish())} style={{ minHeight: 52 }} />
        {step > ME ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md }}>
            <Pressable onPress={() => go(step - 1)} disabled={pending} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.obBack} style={{ paddingHorizontal: space.md, paddingVertical: 4 }}>
              {/* السهمُ `chevron-down` مُداراً مع اتّجاه الصفحة — يشير إلى الخلف في اللغتين (وصفةُ `SettingsScreen`) */}
              <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
                <Icon name="chevron-down" size={20} color={tokens.muted} />
              </View>
            </Pressable>
            {step === PROGRESS || step === TASTE ? (
              <Pressable onPress={skip} disabled={pending} hitSlop={10} accessibilityRole="button" style={{ paddingHorizontal: space.md, paddingVertical: 4 }}>
                <Text size={13} muted>{t.obSkip}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {sheet ? (
        <EpisodeSheet
          seed={sheet}
          value={upTo[sheet.id] ?? null}
          onClose={() => setSheet(null)}
          onPick={(v) => {
            const id = sheet.id;
            setUpTo((u) => {
              const next = { ...u };
              if (v) next[id] = v;
              else delete next[id];
              return next;
            });
            setSheet(null);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
