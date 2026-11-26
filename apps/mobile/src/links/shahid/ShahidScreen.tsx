import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Text } from "../../ui";
import { Icon } from "../../icons";
import { LinkingCover, PlatformScreen, type PlatformDriver, type PlatformLoginProps } from "../netflix/NetflixScreen";
import { isWatched } from "@/core/shahid";
import { SHAHID_HOME, ShahidWeb, type ShahidReady, type ShahidWebRef } from "./bridge";
import { clearShahidLocal, linkShahid, readShahid, readShahidLocal, unlinkShahid, useShahidAdded, writeShahidLocal } from "./sync";
import { requestShahidSignOut, requestShahidSync, useShahidSync } from "./ShahidSyncHost";

/**
 * ====== 🆕 صفحةُ شاهد — صفحةُ المنصّة نفسُها (`PlatformScreen`) بما يخصّ شاهد (المهمّة ٥٦٧) ======
 * الموافقة ⇐ صفحةُ شاهد نفسُها كاملةَ الشاشة ⇐ «اختر من يشاهد الآن» ⇐ مدارُ الربط يقرأ ⇐ سؤالُ الاستيراد.
 */
export function ShahidScreen() {
  const { t } = useApp();
  const drv = useMemo<PlatformDriver>(
    () => ({
      platform: "shahid",
      name: t.shahidName,
      useSync: useShahidSync,
      requestSync: requestShahidSync,
      requestSignOut: requestShahidSignOut,
      readLocal: readShahidLocal,
      writeLocal: writeShahidLocal,
      clearLocal: clearShahidLocal,
      link: linkShahid,
      unlink: unlinkShahid,
      useAdded: useShahidAdded,
      Login: ShahidLogin,
      str: {
        consentLead: t.shahidConsentLead,
        consent1Title: t.shahidConsent1Title,
        consent1Sub: t.shahidConsent1Sub,
        continue_: t.shahidContinue,
        importLaterNote: t.shahidImportLaterNote,
        stoppedSub: t.shahidStoppedSub,
        profileSub: t.shahidProfileSub,
        added: t.shahidAdded,
      },
    }),
    [t],
  );
  return <PlatformScreen drv={drv} />;
}

/**
 * صفحةُ دخول شاهد كاملةَ الشاشة على رئيسيّته — ومَن لم يسجّل دخوله يدخل من زرّ «تسجيل الدخول» فيها.
 * ⚖️ «اختر من يشاهد الآن» نافذةٌ فوق الرئيسيّة لا صفحةٌ لها رابط (مقيس): شاهد يعرضها بعد الدخول، ومَن كان داخلاً بملفٍّ مختار
 * لا تُفتح له — فيُقرأ ملفُّه المختارُ واسمُه في سؤال الاستيراد (فرقٌ عن OSN+: لا بابَ لفتحها من خارج الموقع).
 */
function ShahidLogin({ d, onClose, onFound }: PlatformLoginProps) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const web = useRef<ShahidWebRef>(null);
  const done = useRef(false);
  const [cover, setCover] = useState(false);
  const [social, setSocial] = useState(false);

  const onReady = useCallback(
    (r: ShahidReady) => {
      if (done.current) return;
      done.current = true;
      setCover(true);
      onFound(r.name, async () => {
        const read = await readShahid(web.current as ShahidWebRef, null, () => false);
        if (!read || read === "auth") return { episodes: 0, movies: 0 };
        const watched = read.progress.filter(isWatched);
        return { episodes: watched.filter((p) => read.episodes.has(p.assetId)).length, movies: watched.filter((p) => read.movieOf.has(p.assetId)).length };
      });
    },
    [onFound],
  );

  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={18} color={tokens.muted} />
        </Pressable>
        <Text size={13} muted style={{ flex: 1, lineHeight: 18 }}>{cover ? "" : social ? t.shahidSocialBlocked : t.shahidLoginHint}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <ShahidWeb ref={web} url={SHAHID_HOME} mode="visible" onReady={onReady} onSocialBlocked={() => setSocial(true)} />
        {cover ? <LinkingCover d={d} platform="shahid" reading /> : null}
      </View>
    </View>
  );
}
