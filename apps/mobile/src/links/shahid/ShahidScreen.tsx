import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Text } from "../../ui";
import { Icon } from "../../icons";
import { Sheet } from "../../library/Sheet";
import { OptionRow } from "../../settings/ui";
import { LinkingCover, PlatformScreen, type PlatformDriver, type PlatformLoginProps } from "../netflix/NetflixScreen";
import { isWatched } from "@/core/shahid";
import { mark } from "../../perfMarks";
import { SHAHID_HOME, ShahidWeb, type ShahidPageState, type ShahidProfile, type ShahidReady, type ShahidSeen, type ShahidWebRef } from "./bridge";
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
/** 🆕 المهمّة ٥٦٩ — اختيرَ ملفٌّ ولم تعُد الصفحةُ به هذه المدّة ⇐ لم يقبله شاهد: تُفتح نافذتُه هو */
const PICK_MS = 15_000;

/**
 * 🆕 المهمّة ٥٦٩ — **الملفُّ يُختار في Loopz** (قياسُ جوال أحمد بعد R318: `gate · c1s1p0k0` مراراً — داخلٌ بلا ملفّ، ونافذةُ شاهد
 * لا تظهر في متصفّح التطبيق، وإعادةُ فتح الرئيسيّة لم تُظهرها). ملّفاتُ الحساب تُقرأ من الصفحة:
 * - **ملفُّ كبارٍ واحدٌ غيرُ مقفل** ⇐ يُختار وحده (كما يفعل شاهد نفسُه حين يكون في الحساب ملفٌّ واحد).
 * - **أكثر** ⇐ ورقةُ Loopz بكلِّ الملفّات — والأطفالُ فيها لا يُختارون وحدهم (حكمُ أحمد «١أ»).
 * - **مقفلٌ برمز** ⇐ نافذةُ شاهد نفسُها: Loopz لا يتخطّى قفلاً ولا يكتب رمزاً.
 * - **لم يقبل شاهدُ الملفّ** ⇐ نافذتُه هو كذلك · **لا ملفّات** ⇐ تُفتح الرئيسيّةُ مرّةً، ثمّ رسالةٌ صريحة.
 * و«غيّر الملف» (`why = "profile"`) يفتح الورقةَ نفسَها ولو كان ملفٌّ مختاراً.
 */
function ShahidLogin({ why, d, onClose, onFound }: PlatformLoginProps) {
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
  const asking = useRef(false);
  /* الملفُّ الذي اختاره العضوُ هنا — حين تعود الصفحةُ جاهزةً به يكتمل الدخول */
  const picked = useRef<string | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheet, setSheet] = useState<{ list: ShahidProfile[]; current: string | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const note = useCallback((result: string, extra: Record<string, string | number> = {}) => {
    mark("nfx.sync", Math.max(0, Date.now() - started.current), { kind: "shahid.login", result, ...extra });
  }, []);
  useEffect(() => () => {
    if (pickTimer.current) clearTimeout(pickTimer.current);
  }, []);

  /* نافذةُ شاهد نفسُها — للملفّ المقفل ولمن لم يقبل شاهدُ اختيارَه */
  const openPicker = useCallback(
    (reason: string) => {
      note("picker", { why: reason });
      setMsg(t.shahidPickInShahid);
      web.current?.picker();
    },
    [note, t],
  );

  const choose = useCallback(
    (p: ShahidProfile) => {
      setSheet(null);
      if (p.lock) return openPicker("lock");
      note("pick", { why: p.kid ? "kid" : p.def ? "main" : "adult" });
      picked.current = p.id;
      setMsg(t.shahidPickOpening);
      web.current?.pick(p.id);
      if (pickTimer.current) clearTimeout(pickTimer.current);
      pickTimer.current = setTimeout(() => {
        if (done.current) return;
        note("pickfail", { why: "late" });
        openPicker("late");
      }, PICK_MS);
    },
    [note, openPicker, t],
  );

  /* ملفّاتُ الحساب ⇐ يُختار الوحيد، أو الورقة. `current`: الملفُّ المختار الآن («غيّر الملف») */
  const ask = useCallback(
    async (current: string | null) => {
      if (asking.current || done.current) return;
      asking.current = true;
      const r = await web.current?.profiles();
      note("profiles", { items: r ? r.list.length : -1, src: word(r?.src ?? "none") });
      if (done.current) return;
      if (!r || !r.list.length) {
        asking.current = false;
        /* لا ملفّات بعد: تُفتح الرئيسيّةُ مرّةً (قد تحفظها بعد تحميلٍ كامل)، ثمّ رسالةٌ صريحةٌ لا صفحةٌ معلّقة */
        if (!rehomed.current) {
          rehomed.current = true;
          note("rehome");
          web.current?.go(SHAHID_HOME);
        } else setMsg(t.shahidNoProfiles);
        return;
      }
      const grown = r.list.filter((p) => !p.kid);
      if (current === null && grown.length === 1 && !grown[0].lock) return choose(grown[0]);
      setSheet({ list: r.list, current });
    },
    [note, choose, t],
  );

  const onPageState = useCallback(
    (s: ShahidPageState, path: string, seen: ShahidSeen | null) => {
      if (done.current) return;
      const w = seen ? `c${seen.ck}s${seen.st}p${seen.pid}k${seen.pick}` : "-";
      note(s, { why: w, go: word(path) });
      /* داخلٌ بلا ملفٍّ ونافذةُ شاهد غائبة ⇐ الاختيارُ هنا. ونافذتُه إن ظهرت فهي أولى: يختار فيها العضو */
      if (s === "gate" && seen && !seen.pid && !seen.pick && picked.current === null) void ask(null);
    },
    [note, ask],
  );

  const onReady = useCallback(
    (r: ShahidReady) => {
      if (done.current) return;
      /* «غيّر الملف»: الصفحةُ جاهزةٌ بالملفّ القديم ⇐ الورقةُ أوّلاً، والدخولُ يكتمل بعد الاختيار */
      if (why === "profile" && picked.current === null) {
        void ask(r.profileId);
        return;
      }
      done.current = true;
      if (pickTimer.current) clearTimeout(pickTimer.current);
      setSheet(null);
      setMsg(null);
      note("ready", picked.current && picked.current !== r.profileId ? { why: "other" } : {});
      setCover(true);
      onFound(r.name, async () => {
        const read = await readShahid(web.current as ShahidWebRef, null, () => false);
        if (!read || read === "auth") return { episodes: 0, movies: 0 };
        const watched = read.progress.filter(isWatched);
        return { episodes: watched.filter((p) => read.episodes.has(p.assetId)).length, movies: watched.filter((p) => read.movieOf.has(p.assetId)).length };
      });
    },
    [onFound, note, why, ask],
  );

  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={18} color={tokens.muted} />
        </Pressable>
        <Text size={13} muted style={{ flex: 1, lineHeight: 18 }}>{cover ? "" : social ? t.shahidSocialBlocked : msg ?? t.shahidLoginHint}</Text>
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
      {sheet ? (
        <Sheet
          title={t.shahidPickTitle}
          onClose={() => {
            note("pickclose");
            setSheet(null);
            onClose();
          }}
        >
          <Text size={13} muted style={{ lineHeight: 20, paddingHorizontal: 4, paddingBottom: 8 }}>{t.shahidPickSub}</Text>
          {sheet.list.map((p) => (
            <OptionRow
              key={p.id}
              selected={p.id === sheet.current}
              title={p.name || t.shahidName}
              subtitle={p.lock ? t.shahidPickLocked : p.kid ? t.shahidPickKid : p.def ? t.shahidPickMain : undefined}
              onSelect={() => choose(p)}
            />
          ))}
        </Sheet>
      ) : null}
    </View>
  );
}
