import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, View } from "react-native";
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
import { api, postForm, queryClient, write, ApiError } from "../api";
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
      /* RN يقبل `{uri,name,type}` جزءاً في النموذج — يقرأ الملفَّ من القرص بنفسه */
      form.append("file", { uri: img.uri, name: `${kind}.jpg`, type: "image/jpeg" } as unknown as Blob);
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

  /* ===== السحبُ لضبط التموضع ===== المحورُ الرأسيُّ وحدَه (الويب حرفاً): الغلافُ يملأ العرضَ دائماً */
  const drag = useRef<{ kind: "avatar" | "cover"; start: number; h: number } | null>(null);
  const vRef = useRef(v);
  vRef.current = v;
  const responder = (kind: "avatar" | "cover", h: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const s = vRef.current;
        drag.current = { kind, start: kind === "cover" ? (s?.coverPos ?? 50) : (s?.avatarPos ?? 50), h };
      },
      onPanResponderMove: (_, g) => {
        const dr = drag.current;
        if (!dr) return;
        const next = Math.round(Math.min(100, Math.max(0, dr.start - (g.dy / dr.h) * 100)));
        set(dr.kind === "cover" ? "coverPos" : "avatarPos", next);
      },
      onPanResponderRelease: () => (drag.current = null),
      onPanResponderTerminate: () => (drag.current = null),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const coverPan = useMemo(() => responder("cover", COVER_H), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const avatarPan = useMemo(() => responder("avatar", AVATAR), []);

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
        <View>
          <View {...(v.coverUrl ? coverPan.panHandlers : {})} style={{ height: COVER_H, backgroundColor: tokens.surface2 }}>
            {v.coverUrl ? (
              <Image source={{ uri: v.coverUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition={{ top: `${v.coverPos}%`, left: "50%" }} />
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
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 14, paddingBottom: 14, marginTop: -36 }}>
            <View {...(v.avatarUrl ? avatarPan.panHandlers : {})}>
              <View style={{ width: AVATAR + 8, height: AVATAR + 8, borderRadius: (AVATAR + 8) / 2, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {v.avatarUrl ? (
                    <Image source={{ uri: v.avatarUrl }} style={{ width: AVATAR, height: AVATAR }} contentFit="cover" contentPosition={{ top: `${v.avatarPos}%`, left: "50%" }} accessibilityLabel={t.avatarAlt} />
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
            <View style={{ flex: 1, alignItems: "flex-end", paddingBottom: 4 }}>
              {cleaned.length >= 3 ? <Button size="sm" variant="ghost" label={t.setPreviewProfile} onPress={() => openWeb(`/u/${cleaned}`)} /> : null}
            </View>
          </View>
          {v.coverUrl || v.avatarUrl ? <Text size={12} muted style={{ paddingHorizontal: 14, paddingBottom: 14, lineHeight: 18 }}>{t.repositionHint}</Text> : null}
        </View>

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
