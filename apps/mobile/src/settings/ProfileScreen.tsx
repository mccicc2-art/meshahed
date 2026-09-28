import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { api, filePart, postForm, queryClient, write, ApiError } from "../api";
import { Sheet } from "../library/Sheet";
import type { ToastHostRef } from "../HoldHost";
import type { ProfileEditPayload, ProfileImagePayload, ProfileSaveBody } from "../contracts";
import { SettingsScreen, Group, Row, Field, RowsSkeleton } from "./ui";
import { SETTINGS_KEY, messageOf, useOpenWeb } from "./api";

/**
 * ====== تعديلُ الملفّ أصليّاً — Phase 11-I · I3 (D-1106) ======
 *
 * 🔑 **ترجمةُ `EditProfileForm` لا إعادةُ تصميمه** (D-1067: الشكلُ للتطبيق، الوظائفُ من الويب):
 * بطاقةُ هويّةٍ واحدة (الغلافُ والصورةُ متراكبان كما يراهما الناس، ثمّ الاسمُ فالمعرّفُ فالنبذة —
 * D-641) · «حفظ» في الترويسة يستيقظ حين يوجد ما يُحفظ (D-217) · سحبٌ رأسيٌّ لتموضع الصورتين ·
 * رابطُ الملفّ ونسخُه · الظهورُ للقراءة وبابُه «الخصوصيّة» · حوارُ «تعديلاتٌ لم تُحفظ» عند الرجوع.
 *
 * **الرفعُ**: منتقي النظام (Photo Picker — بلا إذن معرضٍ ولا كاميرا) ثمّ تصغيرٌ إلى ١٩٢٠ بجودة ٠٫٨٥
 * (`fitForUpload` في الويب) ثمّ `POST /me/profile/image` — الرابطُ يعود ولا يُكتب حتى «حفظ».
 * **ربطُ X بابٌ**: هويّةٌ تُثبت بتسجيل دخولٍ في جلسة الويب (D-932)، فصفُّه يعرض ويفتح الصفحة.
 */
const BIO_MAX = 120;
const COVER_H = 128;
const AVATAR = 76;
const MAX_EDGE = 1920;
const KEY = ["me:profile-edit"] as const;

type Snap = { nickname: string; username: string; bio: string; avatarUrl: string | null; coverUrl: string | null; coverPos: number; avatarPos: number };
const snapOf = (d: ProfileEditPayload): Snap => ({
  nickname: d.nickname,
  username: d.username,
  bio: d.bio,
  avatarUrl: d.avatar_url,
  coverUrl: d.cover_url,
  coverPos: d.cover_pos,
  avatarPos: d.avatar_pos,
});

export function ProfileScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<ProfileEditPayload>("/api/v1/me/profile")).data, staleTime: 0 });
  const d = q.data;

  const [base, setBase] = useState<Snap | null>(null);
  const [v, setV] = useState<Snap | null>(null);
  /* اللقطةُ تُؤخذ مرّةً عند الوصول — جلبٌ ثانٍ لا يدوس ما يكتبه الآن */
  useEffect(() => {
    if (d && !base) {
      setBase(snapOf(d));
      setV(snapOf(d));
    }
  }, [d, base]);

  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ask, setAsk] = useState(false);
  /** رفعاتُ هذه الجلسة التي لم تُحفظ — تُسلَّم للخادم ليحذف ما استُبدل منها */
  const pendingUpload = useRef<{ avatar: string | null; cover: string | null }>({ avatar: null, cover: null });

  const set = <K extends keyof Snap>(k: K, val: Snap[K]) => setV((s) => (s ? { ...s, [k]: val } : s));
  const cleaned = (v?.username ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const dirty = !!v && !!base && (Object.keys(v) as (keyof Snap)[]).some((k) => v[k] !== base[k]);

  /* ===== الرفع ===== */
  async function pick(kind: "avatar" | "cover") {
    if (uploading) return;
    setError(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setUploading(kind);
    try {
      const long = Math.max(a.width || 0, a.height || 0);
      const ctx = ImageManipulator.manipulate(a.uri);
      if (long > MAX_EDGE) ctx.resize(a.width >= a.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      const form = new FormData();
      form.append("kind", kind);
      const prev = pendingUpload.current[kind];
      if (prev) form.append("replaces", prev);
      /* 🔴 M3-fix — `filePart` لا `{uri,name,type}`: `expo/fetch` يرفض الشكلَ القديم (رأسُ `filePart`) */
      form.append("file", filePart(img.uri, `${kind}.jpg`, "image/jpeg"));
      const out = await postForm<ProfileImagePayload>("/api/v1/me/profile/image", form);
      pendingUpload.current[kind] = out.url;
      set(kind === "avatar" ? "avatarUrl" : "coverUrl", out.url);
      haptic.pick();
    } catch (e) {
      setError(e instanceof ApiError ? messageOf(e, t as unknown as Record<string, unknown>, t.errUpload) : t.errUpload);
    } finally {
      setUploading(null);
    }
  }

  /* ===== السحبُ لضبط التموضع ===== المحورُ الرأسيُّ وحدَه (الويب حرفاً): الغلافُ يملأ العرضَ دائماً.
     🆕 K2 — على خيط الواجهة (انظر `usePosDrag`): الصورةُ تتبع الإصبعَ بلا رسمٍ للنموذج كلِّه، والقيمةُ تُكتب مرّةً عند الرفع */
  const setRef = useRef(set);
  setRef.current = set;
  const cover = usePosDrag(v?.coverPos ?? 50, COVER_H, !!v?.coverUrl, (n) => setRef.current("coverPos", n));
  const avatar = usePosDrag(v?.avatarPos ?? 50, AVATAR, !!v?.avatarUrl, (n) => setRef.current("avatarPos", n));

  /* ===== الحفظ ===== الخطُّ الأساسُ يتقدّم بعد النجاح وحدَه — لا يطفئ «حفظ» على ما لم يصل */
  async function save() {
    if (!v || !dirty || saving || uploading) return;
    setError(null);
    if (cleaned.length > 0 && cleaned.length < 3) return setError(t.usernameShort);
    setSaving(true);
    try {
      const body: ProfileSaveBody = {
        nickname: v.nickname,
        username: cleaned,
        bio: v.bio,
        avatar_url: v.avatarUrl,
        cover_url: v.coverUrl,
        cover_pos: v.coverPos,
        avatar_pos: v.avatarPos,
      };
      const out = await write<ProfileEditPayload>("/api/v1/me/profile", body);
      queryClient.setQueryData(KEY, out);
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      pendingUpload.current = { avatar: null, cover: null };
      setBase(snapOf(out));
      setV(snapOf(out));
      haptic.success();
      toast.current?.say(t.setSaved);
    } catch (e) {
      setError(messageOf(e, t as unknown as Record<string, unknown>, t.errSaveShort));
    } finally {
      setSaving(false);
    }
  }

  const back = () => {
    if (dirty) return setAsk(true);
    if (router.canGoBack()) router.back();
  };

  const saveAction = (
    <Pressable onPress={() => void save()} disabled={!dirty || saving || !!uploading} hitSlop={10} accessibilityRole="button" style={{ height: 44, justifyContent: "center", paddingHorizontal: 4 }}>
      <Text size={14} weight="700" color={dirty && !saving && !uploading ? tokens.accent : tokens.muted}>{saving ? t.saving : t.setSave}</Text>
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
            if (router.canGoBack()) router.back();
          }}
        />
      </View>
    </Sheet>
  ) : null;

  if (!d || !v) {
    return (
      <SettingsScreen title={t.setEditProfile}>
        {q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={5} />}
      </SettingsScreen>
    );
  }

  const disc = (name: "image" | "trash", onPress: () => void, label: string, busy?: boolean) => (
    <Pressable onPress={onPress} disabled={!!uploading} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", opacity: uploading && !busy ? 0.6 : 1 }}>
      <Icon name={busy ? "hourglass" : name} size={16} color="#fff" />
    </Pressable>
  );

  return (
    <SettingsScreen title={t.setEditProfile} toast={toast} onBack={back} action={saveAction} overlay={overlay}>
      {error ? (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.error, padding: 12 }}>
          <Text size={13} color={tokens.error}>{error}</Text>
        </View>
      ) : null}

      <Group label={t.setProfileDetails}>
        {/* ===== الصورتان معاينةٌ واحدة ===== ابنٌ واحدٌ للبطاقة (فلا فاصلَ بين الغلاف والوجه) */}
        <GestureHandlerRootView>
          <GestureDetector gesture={cover.gesture}>
          <View style={{ height: COVER_H, backgroundColor: tokens.surface2 }}>
            {v.coverUrl ? (
              <PosImage uri={v.coverUrl} value={v.coverPos} pos={cover.pos} boxH={COVER_H} />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text size={14} muted>{t.noCover}</Text>
              </View>
            )}
            <View style={{ position: "absolute", top: 8, end: 8, flexDirection: "row", gap: 8 }}>
              {v.coverUrl ? disc("trash", () => set("coverUrl", null), t.removeCover) : null}
              {disc("image", () => void pick("cover"), t.setEditCover, uploading === "cover")}
            </View>
          </View>
          </GestureDetector>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 14, paddingBottom: 14, marginTop: -36 }}>
            <GestureDetector gesture={avatar.gesture}>
            <View>
              <View style={{ width: AVATAR + 8, height: AVATAR + 8, borderRadius: (AVATAR + 8) / 2, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {v.avatarUrl ? (
                    <PosImage uri={v.avatarUrl} value={v.avatarPos} pos={avatar.pos} boxH={AVATAR} label={t.avatarAlt} />
                  ) : (
                    <Icon name="people" size={28} color={tokens.muted} />
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => void pick("avatar")}
                disabled={!!uploading}
                accessibilityRole="button"
                accessibilityLabel={t.setEditAvatar}
                style={{ position: "absolute", bottom: 2, end: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: tokens.accent, borderWidth: 2, borderColor: tokens.surface, alignItems: "center", justifyContent: "center", opacity: uploading && uploading !== "avatar" ? 0.6 : 1 }}
              >
                <Icon name={uploading === "avatar" ? "hourglass" : "image"} size={14} color={tokens.onAccent} />
              </Pressable>
            </View>
            </GestureDetector>
            <View style={{ flex: 1, alignItems: "flex-end", paddingBottom: 4 }}>
              {cleaned.length >= 3 ? <Button size="sm" variant="ghost" label={t.setPreviewProfile} onPress={() => openWeb(`/u/${cleaned}`)} /> : null}
            </View>
          </View>
          {v.coverUrl || v.avatarUrl ? <Text size={12} muted style={{ paddingHorizontal: 14, paddingBottom: 14, lineHeight: 18 }}>{t.repositionHint}</Text> : null}
        </GestureHandlerRootView>

        <Field label={t.displayNameSection} value={v.nickname} onChange={(x) => set("nickname", x)} maxLength={40} placeholder={t.displayNamePlaceholder} />
        <Field
          label={t.usernameSection}
          value={v.username}
          onChange={(x) => set("username", x)}
          maxLength={24}
          placeholder="ahmed_92"
          ltr
          prefix="@"
          hint={cleaned !== v.username.trim().toLowerCase() && v.username.trim() !== "" ? t.willSaveAs(cleaned || "—") : undefined}
        />
        <Field label={t.bioSection} value={v.bio} onChange={(x) => set("bio", x.slice(0, BIO_MAX))} maxLength={BIO_MAX} counter multiline lines={2} placeholder={t.bioPlaceholder} />

        {cleaned.length >= 3 ? (
          <Row
            icon="share"
            title={t.setProfileLink}
            subtitle={`${d.site_url.replace(/^https?:\/\//, "")}/u/${cleaned}`}
            trailing={
              <Button
                size="sm"
                variant="ghost"
                label={copied ? t.setCopied : t.setCopyLink}
                onPress={() => {
                  void Clipboard.setStringAsync(`${d.site_url}/u/${cleaned}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              />
            }
          />
        ) : null}
        <Row icon="eye" title={t.setProfileVisibility} value={d.is_private ? t.setVisibilityPrivate : t.setVisibilityPublic} onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "privacy" } })} />
      </Group>

      {/* ===== حسابُ X ===== يغيب مع مزوّده (D-217)؛ الربطُ وفكُّه في صفحة الويب (جلستُها — D-932) */}
      {d.x ? (
        <Group label={t.setXSection}>
          <Row
            title={d.x.handle && d.x.verified ? `@${d.x.handle}` : "X"}
            subtitle={d.x.handle && d.x.verified ? t.xVerified : dirty ? t.xSaveFirst : t.xHint}
            trailing={
              <Button
                size="sm"
                variant="ghost"
                disabled={dirty || openWeb.busy === "/profile/edit"}
                label={d.x.handle && d.x.verified ? t.xDisconnect : t.xConnect}
                onPress={() => openWeb("/profile/edit")}
              />
            }
          />
        </Group>
      ) : null}
    </SettingsScreen>
  );
}

/**
 * 🆕 K2 — **سحبُ التموضع على خيط الواجهة**. كان `PanResponder` يكتب `coverPos`/`avatarPos` في حالة النموذج مع كلِّ
 * حركة — فيُعاد رسمُ الشاشة كلِّها (الحقولُ والصفوف) في كلِّ إطارٍ والإصبعُ على الصورة. الآن القيمةُ `SharedValue`
 * تحرّك الصورةَ وحدَها، وتصل الحالةَ **مرّةً عند الرفع** (فيستيقظ «حفظ» عند الرفع لا في أثناء السحب).
 * **الأرقامُ كما كانت حرفاً**: القفلُ بعد ٤px والعمودُ يغلب الأفق · `next = round(clamp(start − dy/h × 100))`.
 */
function usePosDrag(value: number, h: number, enabled: boolean, commit: (n: number) => void) {
  const pos = useSharedValue(value);
  const start = useSharedValue(value);
  const live = useSharedValue(0);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  /* قيمةٌ جاءت من خارج السحب (صورةٌ جديدة، تراجع) تُعتمد ما لم يكن الإصبعُ على الصورة */
  useEffect(() => {
    if (!live.value) pos.value = value;
  }, [value, pos, live]);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const gesture = useMemo(() => {
    const done = (n: number) => commitRef.current(n);
    return Gesture.Pan()
      .enabled(enabled)
      .manualActivation(true)
      .onTouchesDown((e) => {
        const t0 = e.changedTouches[0];
        if (t0) {
          x0.value = t0.absoluteX;
          y0.value = t0.absoluteY;
        }
      })
      .onTouchesMove((e, m) => {
        const t0 = e.allTouches[0];
        if (!t0) return;
        const dx = t0.absoluteX - x0.value;
        const dy = t0.absoluteY - y0.value;
        if (Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx)) m.activate();
        else if (Math.abs(dx) > 4) m.fail();
      })
      .onStart(() => {
        live.value = 1;
        start.value = pos.value;
      })
      .onUpdate((e) => {
        pos.value = Math.round(Math.min(100, Math.max(0, start.value - (e.translationY / h) * 100)));
      })
      .onFinalize(() => {
        if (!live.value) return;
        live.value = 0;
        scheduleOnRN(done, pos.value);
      });
  }, [enabled, h, pos, start, live, x0, y0]);
  return { gesture, pos };
}

/**
 * الصورةُ مملوءةً (`cover`) ومزاحةً رأسيّاً بـ`pos` — **الحسبةُ حسبةُ `object-position`** (ما يرسمه الويبُ والملفُّ):
 * المقياسُ `max(عرض/عرض، ارتفاع/ارتفاع)` والإزاحةُ `(ارتفاعُ الصندوق − ارتفاعُ الصورة) × pos%` والأفقُ في الوسط.
 * قبل أن تُعرف أبعادُ الصورة تُرسم بـ`contentPosition` كما كانت — **والعنصرُ نفسُه** فلا وميضَ عند التبديل.
 */
function PosImage({ uri, value, pos, boxH, label }: { uri: string; value: number; pos: SharedValue<number>; boxH: number; label?: string }) {
  const [boxW, setBoxW] = useState(0);
  const [dims, setDims] = useState<{ uri: string; w: number; h: number } | null>(null);
  const known = dims && dims.uri === uri && boxW > 0 ? dims : null;
  const scale = known ? Math.max(boxW / known.w, boxH / known.h) : 1;
  const rw = known ? known.w * scale : 0;
  const rh = known ? known.h * scale : 0;
  const slide = useAnimatedStyle(() => (known ? { transform: [{ translateY: ((boxH - rh) * pos.value) / 100 }] } : {}), [known, boxH, rh]);
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <Reanimated.View style={known ? [{ position: "absolute", top: 0, left: (boxW - rw) / 2, width: rw, height: rh }, slide] : StyleSheet.absoluteFill}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={known ? undefined : { top: `${value}%`, left: "50%" }}
          accessibilityLabel={label}
          onLoad={(e) => {
            if (e.source.width > 0 && e.source.height > 0) setDims({ uri, w: e.source.width, h: e.source.height });
          }}
        />
      </Reanimated.View>
    </View>
  );
}
