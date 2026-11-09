import React from "react";
import { View } from "react-native";
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Path, Rect, Stop } from "react-native-svg";
import { useApp } from "../state";
import { Icon, iconSource, type IconName } from "../icons";
import { Text } from "../ui";
import { radius } from "../theme";
import type { DeviceKind } from "@/core/contracts/deviceLinks";

/**
 * 🆕 **شارةُ الجهاز في المدار وفي «من أجهزتك»** (خطّةُ Loopz+ v2 §الشعارات).
 * 🔑 **شعارٌ بإذن صاحبه وحده**: Plex وEmby بشعارهما الرسميّ (مسارُ المتّجه كما ينشرانه، بلونهما — لا نرسمه بأيدينا)، وسطرُ
 * نسبة Plex في «عن التطبيق». وKodi بشعاره الرسميّ (أذنت مؤسّستُه ٩ نوفمبر — T360)، وStremio برمزٍ عامٍّ من رموز التطبيق حتى يصل إذنُه، وJellyfin
 * برمزه العامِّ مصبوغاً بألوانه (T354) —
 * والاسمُ تحت الشارة في كلِّ حال.
 */
const PLEX =
  "M3.987 8.409c-.96 0-1.587.28-2.12.933v-.72H0v8.88s.038.018.127.037c.138.03.821.187 1.331-.249.441-.377.542-.814.542-1.318v-1.283c.533.573 1.147.813 2 .813 1.84 0 3.253-1.493 3.253-3.48 0-2.12-1.36-3.613-3.266-3.613Zm16.748 5.595.406.591c.391.614.894.906 1.492.908.621-.012 1.064-.562 1.226-.755 0 0-.307-.27-.686-.72-.517-.614-1.214-1.755-1.24-1.803l-1.198 1.779Zm-3.205-1.955c0-2.08-1.52-3.64-3.52-3.64s-3.467 1.587-3.467 3.573a3.48 3.48 0 0 0 3.507 3.52c1.413 0 2.626-.84 3.253-2.293h-2.04l-.093.093c-.427.4-.72.533-1.227.533-.787 0-1.373-.506-1.453-1.266h4.986c.04-.214.054-.307.054-.52Zm-7.671-.219c0 .769.11 1.701.868 2.722l.056.069c-.306.526-.742.88-1.248.88-.399 0-.814-.211-1.138-.579a2.177 2.177 0 0 1-.538-1.441V6.409H9.86l-.001 5.421Zm9.283 3.46h-2.39l2.247-3.332-2.247-3.335h2.39l2.248 3.335-2.248 3.332Zm1.593-1.286Zm-17.162-.342c-.933 0-1.68-.773-1.68-1.72s.76-1.666 1.68-1.666c.92 0 1.68.733 1.68 1.68 0 .946-.733 1.706-1.68 1.706Zm18.361-1.974L24 8.622h-2.391l-.87 1.293 1.195 1.773Zm-9.404-.466c.16-.706.72-1.133 1.493-1.133.773 0 1.373.467 1.507 1.133h-3Z";
const EMBY =
  "M11.041 0c-.007 0-1.456 1.43-3.219 3.176L4.615 6.352l.512.513.512.512-2.819 2.791L0 12.961l1.83 1.848c1.006 1.016 2.438 2.46 3.182 3.209l1.351 1.359.508-.496c.28-.273.515-.498.524-.498.008 0 1.266 1.264 2.794 2.808L12.97 24l.187-.182c.23-.225 5.007-4.95 5.717-5.656l.52-.516-.502-.513c-.276-.282-.5-.52-.496-.53.003-.009 1.264-1.26 2.802-2.783 1.538-1.522 2.8-2.776 2.803-2.785.005-.012-3.617-3.684-6.107-6.193L17.65 4.6l-.505.505c-.279.278-.517.501-.53.497-.013-.005-1.27-1.267-2.793-2.805A449.655 449.655 0 0011.041 0zM9.223 7.367c.091.038 7.951 4.608 7.957 4.627.003.013-1.781 1.056-3.965 2.32a999.898 999.898 0 01-3.996 2.307c-.019.006-.026-1.266-.026-4.629 0-3.7.007-4.634.03-4.625Z";
const LOGO: Partial<Record<DeviceKind, { d: string; color: string; scale: number }>> = {
  plex: { d: PLEX, color: "#EBAF00", scale: 0.82 },
  emby: { d: EMBY, color: "#52B54B", scale: 0.62 },
};
const GENERIC: Record<DeviceKind, IconName> = { stremio: "play", plex: "tv", jellyfin: "film", emby: "tv", kodi: "tv" };
/**
 * 🆕 T354 — **Jellyfin بألوانه لا بشعاره** (أحمد ٩ نوفمبر: «نفذ المقترح … ما راح نرسل»): دليلُ هويّتهم يقصر الشعارَ على المشاريع
 * المفتوحة المصدر، ويُبيح ألوانَهم المتدرّجة مع شكلٍ غيرِ شكل شعارهم. فرمزُ «فيلم» العامُّ نفسُه يُصبغ بتدرّجهم (بنفسجيٌّ إلى أزرق)
 * فيُعرف بلونه ولا ندّعي علامتَه. الصورةُ البيضاءُ قناعٌ بشفافيّتها (`maskType="alpha"`) لا رسمٌ ثانٍ للرمز.
 */
const TINT: Partial<Record<DeviceKind, readonly [string, string]>> = { jellyfin: ["#AA5CC3", "#00A4DC"] };

/**
 * 🆕 T360 — **شعارُ Kodi الرسميُّ بإذن مؤسّستهم** (رسالةُ trademark@kodi.tv، ٩ نوفمبر: «you have our permission»؛ أحمد «نفذ ١»).
 * المسارُ والألوانُ من ملفّهم الرسميّ في مستودع Kodi نفسِه (`xbmc/xbmc` → `tools/Linux/packaging/media/iconScalable.svg`) بلا تعديل:
 * الإطارُ الأبيضُ والحرفُ الأزرق بتدرّجيهما. تحويلُ التدرّج (`matrix(2 0 0 -2 831 927)`) محسوبٌ هنا إلى إحداثيّاتٍ صريحة لأنّ
 * `react-native-svg` لا يحتاجه — النتيجةُ نفسُها. ودليلُ هويّتهم يشترط علامةَ ™ بجانبه، فهي صغيرةٌ في الزاوية.
 */
const KODI_BORDER =
  "M17.3,114.9l97.6-97.6c7.2-7.2,19-7.2,26.2,0l97.6,97.6c7.2,7.2,7.2,19,0,26.2l-97.6,97.6c-7.2,7.2-19,7.2-26.2,0l-97.6-97.6C10.1,133.9,10.1,122.1,17.3,114.9z";
const KODI_MARK =
  "M61.6,96.1c0-4.4-2.1-6.4-4-4.4l-31.3,31.3c-2.8,2.8-2.8,7.3,0,10.1l31.3,31.3c1.9,1.9,4,0,4-4.4L61.6,96.1z M152.5,123l33.6-33.6c2.8-2.8,7.3-2.8,10.1,0l33.6,33.6c2.8,2.8,2.8,7.3,0,10.1l-33.6,33.6c-2.8,2.8-7.3,2.8-10.1,0L152.5,133C149.7,130.3,149.7,125.7,152.5,123z M89.4,186.1l33.6-33.6c2.8-2.8,7.3-2.8,10.1,0l33.6,33.6c2.8,2.8,2.8,7.3,0,10.1L133,229.7c-2.8,2.8-7.3,2.8-10.1,0l-33.6-33.6C86.6,193.4,86.6,188.8,89.4,186.1z M88.5,65.8c0-3.5,1-6,3.4-8.5c10.4-10.4,20.7-20.7,31-31.1c2.8-2.8,7.3-2.8,10.1,0l33.6,33.6c2.8,2.8,2.8,7.3,0,10.1c-24.8,24.8-49.5,49.5-74.3,74.3c-1.9,1.9-3.8,0-3.8-4.4L88.5,65.8L88.5,65.8z";

function KodiLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Defs>
        <LinearGradient id="kodiBorder" gradientUnits="userSpaceOnUse" x1="128" y1="11.9426" x2="128" y2="244.059">
          <Stop offset="0" stopColor="#FEFEFE" />
          <Stop offset="1" stopColor="#DFDFDF" />
        </LinearGradient>
        <LinearGradient id="kodiMark" gradientUnits="userSpaceOnUse" x1="128.0096" y1="26.264" x2="128.0096" y2="229.736">
          <Stop offset="0" stopColor="#33ADDD" />
          <Stop offset="1" stopColor="#148FBF" />
        </LinearGradient>
      </Defs>
      <Path d={KODI_BORDER} fill="url(#kodiBorder)" fillRule="evenodd" clipRule="evenodd" />
      <Path d={KODI_MARK} fill="url(#kodiMark)" fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );
}

export function DeviceMark({
  kind,
  size = 56,
  state = "idle",
}: {
  kind: DeviceKind;
  size?: number;
  /** `on` مربوطٌ ووصلت منه رسالة (✓ أخضر) · `waiting` صدر رابطُه ولم يتّصل بعد (ساعةٌ رمليّة) · `paused` موقوفٌ بعد النزول · `idle` في القائمة */
  state?: "idle" | "on" | "waiting" | "paused";
}) {
  const { tokens } = useApp();
  const logo = LOGO[kind];
  const tint = TINT[kind];
  const glyph = size * 0.42;
  const ring = state === "on" || state === "waiting" ? tokens.accent : tokens.border;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        borderWidth: state === "on" || state === "waiting" ? 1.5 : 1,
        borderColor: ring,
        backgroundColor: tokens.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: state === "paused" ? 0.55 : 1,
      }}
    >
      {kind === "kodi" ? (
        <>
          <KodiLogo size={size * 0.64} />
          <Text size={7} weight="700" muted style={{ position: "absolute", top: size * 0.12, end: size * 0.1, writingDirection: "ltr" }}>
            ™
          </Text>
        </>
      ) : logo ? (
        <Svg width={size * logo.scale} height={size * logo.scale} viewBox="0 0 24 24">
          <Path d={logo.d} fill={logo.color} />
        </Svg>
      ) : tint ? (
        <Svg width={glyph} height={glyph} viewBox="0 0 72 72">
          <Defs>
            <LinearGradient id="dmTint" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={tint[0]} />
              <Stop offset="1" stopColor={tint[1]} />
            </LinearGradient>
            <Mask id="dmGlyph" maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="72" maskType="alpha">
              <SvgImage href={iconSource(GENERIC[kind])} x="0" y="0" width="72" height="72" />
            </Mask>
          </Defs>
          <Rect x="0" y="0" width="72" height="72" fill="url(#dmTint)" mask="url(#dmGlyph)" />
        </Svg>
      ) : (
        <Icon name={GENERIC[kind]} size={glyph} color={tokens.muted} />
      )}
      {state !== "idle" ? (
        <View
          style={{
            position: "absolute",
            bottom: -5,
            end: -5,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: state === "on" ? tokens.success : tokens.surface2,
            borderWidth: 2,
            borderColor: tokens.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={state === "on" ? "check" : state === "waiting" ? "hourglass" : "pause"} size={10} color={state === "on" ? "#fff" : tokens.muted} />
        </View>
      ) : null}
    </View>
  );
}

/** الاسمُ تحت الشارة — اسمُ منتجٍ لا يُترجم ولا يُقلب */
export function DeviceLabel({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <Text size={12} weight="700" muted={muted} numberOfLines={1} style={{ marginTop: 6, writingDirection: "ltr", textAlign: "center" }}>
      {name}
    </Text>
  );
}
