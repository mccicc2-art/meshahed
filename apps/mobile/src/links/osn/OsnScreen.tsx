import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Text } from "../../ui";
import { Icon } from "../../icons";
import { LinkingCover, PlatformScreen, type PlatformDriver, type PlatformLoginProps } from "../netflix/NetflixScreen";
import { OSN_PROFILES, OsnWeb, type OsnReady, type OsnWebRef } from "./bridge";
import { clearOsnLocal, linkOsn, readOsn, readOsnLocal, unlinkOsn, useOsnAdded, writeOsnLocal } from "./sync";
import { requestOsnSignOut, requestOsnSync, useOsnSync } from "./OsnSyncHost";

/**
 * ====== 🆕 صفحةُ OSN+ — صفحةُ المنصّة نفسُها (`PlatformScreen`) بما يخصّ OSN+ (المهمّة ٥٥٧، التصميمُ المعتمد ٢٦ نوفمبر) ======
 * الموافقة ⇐ صفحةُ OSN+ نفسُها كاملةَ الشاشة ⇐ «اختر الملف الشخصي» (بلا «تم») ⇐ مدارُ الربط يقرأ ⇐ سؤالُ الاستيراد.
 */
export function OsnScreen() {
  const { t } = useApp();
  const drv = useMemo<PlatformDriver>(
    () => ({
      platform: "osn",
      name: "OSN+",
      useSync: useOsnSync,
      requestSync: requestOsnSync,
      requestSignOut: requestOsnSignOut,
      readLocal: readOsnLocal,
      writeLocal: writeOsnLocal,
      clearLocal: clearOsnLocal,
      link: linkOsn,
      unlink: unlinkOsn,
      useAdded: useOsnAdded,
      Login: OsnLogin,
      str: {
        consentLead: t.osnConsentLead,
        consent1Title: t.osnConsent1Title,
        consent1Sub: t.osnConsent1Sub,
        continue_: t.osnContinue,
        importLaterNote: t.osnImportLaterNote,
        stoppedSub: t.osnStoppedSub,
        profileSub: t.osnProfileSub,
        added: t.osnAdded,
      },
    }),
    [t],
  );
  return <PlatformScreen drv={drv} />;
}

/**
 * صفحةُ دخول OSN+ كاملةَ الشاشة — تبدأ بـ«اختر الملف الشخصي» (`/profiles`)، ومَن لم يسجّل دخوله يحوّله الموقعُ إلى الدخول.
 * - رأينا «اختر الملف الشخصي» ثمّ صار في الحساب بملفٍّ مختار ⇐ اختار: مدارُ الربط يغطّي الموقع، ويُقرأ ما في الملفّ للسؤال.
 * - في الحساب بلا «اختر الملف الشخصي» (كان مسجّلاً بملفٍّ قديم) ⇐ نفتحها مرّةً تحت غطاءٍ قصير — فلا يُقرأ ملفٌّ لم يختره
 *   (درسُ نتفليكس T552/T553: لا تُرى رئيسيّةُ الموقع بينهما). وللغطاء حدٌّ (عشرُ ثوانٍ) يرتفع بعده.
 */
function OsnLogin({ d, onClose, onFound }: PlatformLoginProps) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const web = useRef<OsnWebRef>(null);
  const gateSeen = useRef(false);
  const sent = useRef(false);
  const done = useRef(false);
  const [cover, setCover] = useState(false);
  const [gap, setGap] = useState(false);
  /* 🆕 المهمّة ٥٥٨ — بابُ دخولٍ ممنوع (جوجل · أبل · فيسبوك): السطرُ العلويّ يقول لماذا بدل الإرشاد */
  const [social, setSocial] = useState(false);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endGap = useCallback(() => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = null;
    setGap(false);
  }, []);
  useEffect(() => () => endGap(), [endGap]);

  const onReady = useCallback(
    (r: OsnReady) => {
      if (done.current) return;
      if (!gateSeen.current) {
        if (sent.current) return;
        sent.current = true;
        setGap(true);
        gapTimer.current = setTimeout(endGap, 10_000);
        web.current?.go(OSN_PROFILES);
        return;
      }
      done.current = true;
      endGap();
      setCover(true);
      onFound(r.name, async () => {
        const read = await readOsn(web.current as OsnWebRef, null, () => false);
        if (!read || read === "auth") return { episodes: 0, movies: 0 };
        return { episodes: read.bookmarks.filter((b) => b.kind === "episode").length, movies: read.bookmarks.filter((b) => b.kind === "movie").length };
      });
    },
    [onFound, endGap],
  );

  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={18} color={tokens.muted} />
        </Pressable>
        <Text size={13} muted style={{ flex: 1, lineHeight: 18 }}>{cover ? "" : social ? t.osnSocialBlocked : t.osnLoginHint}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <OsnWeb
          ref={web}
          url={OSN_PROFILES}
          mode="visible"
          onReady={onReady}
          onSocialBlocked={() => setSocial(true)}
          onPageState={(s) => {
            if (s === "gate") {
              gateSeen.current = true;
              endGap();
            }
          }}
        />
        {cover ? (
          <LinkingCover d={d} platform="osn" reading />
        ) : gap ? (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={tokens.accent} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
