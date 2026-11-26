import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Text } from "../../ui";
import { Icon } from "../../icons";
import { LinkingCover, PlatformScreen, type PlatformDriver, type PlatformLoginProps } from "../netflix/NetflixScreen";
import { isWatched } from "@/core/shahid";
import { mark } from "../../perfMarks";
import { SHAHID_HOME, ShahidWeb, type ShahidPageState, type ShahidReady, type ShahidSeen, type ShahidWebRef } from "./bridge";
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
/** 🆕 المهمّة ٥٦٨ — كلمةٌ يقبلها القياس (`[\w.-]{1,16}`): المسارُ والمضيفُ بلا رموزٍ أخرى */
const word = (v: string) => v.replace(/[^\w.-]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 16) || "-";
/** داخلٌ بلا ملفٍّ مختارٍ ولا نافذة اختيار هذه المدّة ⇐ تُفتح رئيسيّةُ شاهد من جديد لتظهر «اختر من يشاهد الآن» */
const NO_PROFILE_MS = 5_000;

function ShahidLogin({ d, onClose, onFound }: PlatformLoginProps) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const web = useRef<ShahidWebRef>(null);
  const done = useRef(false);
  const [cover, setCover] = useState(false);
  const [social, setSocial] = useState(false);
  /* 🆕 المهمّة ٥٦٨ — قياسُ الدخول (فيديو أحمد ٢٦ نوفمبر: دخل بالجوال فعلقت الصفحة ولم يلحظ Loopz دخوله): كلُّ حالٍ جديدةٍ للصفحة
     علامةُ `nfx.sync` بنوع `shahid.login` — ما رآه السكربت (أرقام) والمسار — فالتجربةُ التالية تقول أين علق، ولو بقي العطل */
  const started = useRef(Date.now());
  const rehomed = useRef(false);
  const noProfile = useRef<ReturnType<typeof setTimeout> | null>(null);
  const note = useCallback((result: string, extra: Record<string, string | number> = {}) => {
    mark("nfx.sync", Math.max(0, Date.now() - started.current), { kind: "shahid.login", result, ...extra });
  }, []);
  useEffect(() => () => {
    if (noProfile.current) clearTimeout(noProfile.current);
  }, []);
  const onPageState = useCallback(
    (s: ShahidPageState, path: string, seen: ShahidSeen | null) => {
      if (done.current) return;
      const why = seen ? `c${seen.ck}s${seen.st}p${seen.pid}k${seen.pick}` : "-";
      note(s, { why, go: word(path) });
      /* داخلٌ (جلسةٌ موجودة) بلا ملفٍّ ولا نافذةِ اختيار: الصفحةُ علقت قبل أن تعرضها — تُفتح الرئيسيّةُ مرّةً واحدة */
      if (noProfile.current) clearTimeout(noProfile.current);
      noProfile.current = null;
      if (s === "gate" && seen && !seen.pid && !seen.pick && !rehomed.current) {
        noProfile.current = setTimeout(() => {
          if (done.current || rehomed.current) return;
          rehomed.current = true;
          note("rehome");
          web.current?.go(SHAHID_HOME);
        }, NO_PROFILE_MS);
      }
    },
    [note],
  );

  const onReady = useCallback(
    (r: ShahidReady) => {
      if (done.current) return;
      done.current = true;
      if (noProfile.current) clearTimeout(noProfile.current);
      note("ready");
      setCover(true);
      onFound(r.name, async () => {
        const read = await readShahid(web.current as ShahidWebRef, null, () => false);
        if (!read || read === "auth") return { episodes: 0, movies: 0 };
        const watched = read.progress.filter(isWatched);
        return { episodes: watched.filter((p) => read.episodes.has(p.assetId)).length, movies: watched.filter((p) => read.movieOf.has(p.assetId)).length };
      });
    },
    [onFound, note],
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
        <ShahidWeb
          ref={web}
          url={SHAHID_HOME}
          mode="visible"
          onReady={onReady}
          onPageState={onPageState}
          onSocialBlocked={() => {
            setSocial(true);
            note("social");
          }}
          onForeign={(host) => note("foreign", { src: word(host) })}
        />
        {cover ? <LinkingCover d={d} platform="shahid" reading /> : null}
      </View>
    </View>
  );
}
