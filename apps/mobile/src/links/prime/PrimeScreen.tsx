import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Text } from "../../ui";
import { Icon } from "../../icons";
import { LinkingCover, PlatformScreen, type PlatformDriver, type PlatformLoginProps } from "../netflix/NetflixScreen";
import { mark } from "../../perfMarks";
import { PRIME_HOME, PRIME_SIGNIN, PrimeWeb, type PrimePageState, type PrimeReady, type PrimeSeen, type PrimeWebRef } from "./bridge";
import { buildPrime, clearPrimeLocal, linkPrime, readPrime, readPrimeLocal, unlinkPrime, usePrimeAdded, writePrimeLocal } from "./sync";
import { requestPrimeSignOut, requestPrimeSync, usePrimeSync } from "./PrimeSyncHost";

/**
 * ====== 🆕 صفحةُ برايم فيديو — صفحةُ المنصّة نفسُها (`PlatformScreen`) بما يخصّ برايم (المهمّة ٦٠٤) ======
 * الموافقة ⇐ صفحةُ برايم نفسُها كاملةَ الشاشة (الدخولُ عند أمازون) ⇐ اختيارُ الملفّ في صفحة برايم ⇐ مدارُ الربط يقرأ ⇐ سؤالُ الاستيراد.
 */
export function PrimeScreen() {
  const { t } = useApp();
  const drv = useMemo<PlatformDriver>(
    () => ({
      platform: "prime",
      name: t.primeName,
      useSync: usePrimeSync,
      requestSync: requestPrimeSync,
      requestSignOut: requestPrimeSignOut,
      readLocal: readPrimeLocal,
      writeLocal: writePrimeLocal,
      clearLocal: clearPrimeLocal,
      link: linkPrime,
      unlink: unlinkPrime,
      useAdded: usePrimeAdded,
      Login: PrimeLogin,
      str: {
        consentLead: t.primeConsentLead,
        consent1Title: t.primeConsent1Title,
        consent1Sub: t.primeConsent1Sub,
        continue_: t.primeContinue,
        importLaterNote: t.primeImportLaterNote,
        stoppedSub: t.primeStoppedSub,
        profileSub: t.primeProfileSub,
        added: t.primeAdded,
      },
    }),
    [t],
  );
  return <PlatformScreen drv={drv} />;
}

/**
 * صفحةُ دخول برايم كاملةَ الشاشة. تُفتح على الرئيسية ليدخل صاحبُ الجلسة القائمة مباشرةً، ومَن ظهرت له بلا دخولٍ نُقل إلى دخول
 * أمازون نفسِه (`PRIME_SIGNIN`): زرُّ الدخول في واجهة برايم مخبوءٌ خلف صورة الحساب، وقد تاه فيه أحمد على هاتفه (٢٨ نوفمبر).
 * ⚖️ **الملفُّ يُختار في صفحة برايم**: صفحةُ «من يشاهد؟» من الموقع، والجسرُ يقول `gate` حتى يُختار — ثمّ `ready` بالملفّ المختار.
 */
/** كلمةٌ يقبلها القياس (`[\w.-]{1,16}`): المسارُ والمضيفُ بلا رموزٍ أخرى */
const word = (v: string) => v.replace(/[^\w.-]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 16) || "-";

function PrimeLogin({ d, onClose, onFound }: PlatformLoginProps) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const web = useRef<PrimeWebRef>(null);
  const done = useRef(false);
  const [cover, setCover] = useState(false);
  const [social, setSocial] = useState(false);
  /* قياسُ الدخول — كلُّ حالٍ جديدةٍ للصفحة علامةٌ بنوع `prime.login` (ما رآه السكربت، والمسار): التجربةُ الأولى تقول أين وقف */
  const started = useRef(Date.now());
  const note = useCallback((result: string, extra: Record<string, string | number> = {}) => {
    mark("nfx.sync", Math.max(0, Date.now() - started.current), { kind: "prime.login", result, ...extra });
  }, []);

  /* النقلُ إلى الدخول محدودٌ (ثلاثُ مرّاتٍ، بينها عشرُ ثوانٍ): مَن رجع من صفحة أمازون دون دخولٍ يُعاد إليها، ولا تدور الصفحةُ في حلقةٍ إن رفضت أمازون */
  const toSignIn = useRef({ n: 0, at: 0 });
  const onPageState = useCallback(
    (s: PrimePageState, path: string, seen: PrimeSeen | null) => {
      if (done.current) return;
      note(s, { why: seen ? `f${seen.pf}i${seen.id}k${seen.pick}` : "-", go: word(path) });
      /* المسارُ يبدأ بـ«/» على نطاق برايم وحده (على أمازون يأتي اسمَ المضيف) — فصفحةُ أمازون نفسُها لا تُنقل */
      const g = toSignIn.current;
      if (s !== "signed-out" || !path.startsWith("/") || path.startsWith("/auth-redirect")) return;
      if (g.n >= 3 || Date.now() - g.at < 10_000) return;
      g.n += 1;
      g.at = Date.now();
      note("signin", { count: g.n });
      web.current?.go(PRIME_SIGNIN);
    },
    [note],
  );

  const onReady = useCallback(
    (r: PrimeReady) => {
      if (done.current) return;
      done.current = true;
      note("ready");
      setCover(true);
      onFound(r.name, async () => {
        const read = await readPrime(web.current as PrimeWebRef, null, () => false);
        if (!read || read === "auth") {
          note("count", { why: read === "auth" ? "auth" : web.current?.why() || "-" });
          return { episodes: 0, movies: 0 };
        }
        const b = buildPrime(read, null);
        return { episodes: b.records.filter((x) => x.kind === "ep-name").length, movies: b.records.filter((x) => x.kind === "movie-name").length };
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
        <Text size={13} muted style={{ flex: 1, lineHeight: 18 }}>{cover ? "" : social ? t.primeSocialBlocked : t.primeLoginHint}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <PrimeWeb
          ref={web}
          url={PRIME_HOME}
          mode="visible"
          onReady={onReady}
          onPageState={onPageState}
          onSocialBlocked={() => {
            setSocial(true);
            note("social");
          }}
          onForeign={(host) => note("foreign", { src: word(host) })}
        />
        {cover ? <LinkingCover d={d} platform="prime" reading /> : null}
      </View>
    </View>
  );
}
