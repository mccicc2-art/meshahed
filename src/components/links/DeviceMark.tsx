import { Icon, type IconName } from "../Icon";
import type { DeviceKind } from "@/core/contracts/deviceLinks";

/**
 * 🆕 **شارةُ الجهاز في الويب** — نظيرُ `apps/mobile/src/links/DeviceMark.tsx` بقراراته نفسِها (T409):
 * Plex وEmby بشعارهما الرسميّ (مسارُ المتّجه كما ينشرانه، بلونهما)، وKodi بشعاره الرسميّ بإذن مؤسّستهم (٩ نوفمبر) وعلامةِ ™،
 * وJellyfin وStremio برمزٍ عامٍّ مصبوغٍ بتدرّج ألوانهما (لا شعارَ بلا إذنٍ مكتوب — `device-logo-permissions`).
 * ⚠️ **المساراتُ منسوخةٌ من ملفّ التطبيق** لا مستوردة: الويبُ لا يستورد من `apps/mobile`، ونقلُها إلى `src/core` يُطلق تحديثَ
 * التطبيق الهوائيّ (شغلُ الويب لا يلمس التطبيق — أحمد ١٨ نوفمبر). يومَ يتغيّر شعارٌ يتغيّر في الملفّين.
 */
const PLEX =
  "M3.987 8.409c-.96 0-1.587.28-2.12.933v-.72H0v8.88s.038.018.127.037c.138.03.821.187 1.331-.249.441-.377.542-.814.542-1.318v-1.283c.533.573 1.147.813 2 .813 1.84 0 3.253-1.493 3.253-3.48 0-2.12-1.36-3.613-3.266-3.613Zm16.748 5.595.406.591c.391.614.894.906 1.492.908.621-.012 1.064-.562 1.226-.755 0 0-.307-.27-.686-.72-.517-.614-1.214-1.755-1.24-1.803l-1.198 1.779Zm-3.205-1.955c0-2.08-1.52-3.64-3.52-3.64s-3.467 1.587-3.467 3.573a3.48 3.48 0 0 0 3.507 3.52c1.413 0 2.626-.84 3.253-2.293h-2.04l-.093.093c-.427.4-.72.533-1.227.533-.787 0-1.373-.506-1.453-1.266h4.986c.04-.214.054-.307.054-.52Zm-7.671-.219c0 .769.11 1.701.868 2.722l.056.069c-.306.526-.742.88-1.248.88-.399 0-.814-.211-1.138-.579a2.177 2.177 0 0 1-.538-1.441V6.409H9.86l-.001 5.421Zm9.283 3.46h-2.39l2.247-3.332-2.247-3.335h2.39l2.248 3.335-2.248 3.332Zm1.593-1.286Zm-17.162-.342c-.933 0-1.68-.773-1.68-1.72s.76-1.666 1.68-1.666c.92 0 1.68.733 1.68 1.68 0 .946-.733 1.706-1.68 1.706Zm18.361-1.974L24 8.622h-2.391l-.87 1.293 1.195 1.773Zm-9.404-.466c.16-.706.72-1.133 1.493-1.133.773 0 1.373.467 1.507 1.133h-3Z";
const EMBY =
  "M11.041 0c-.007 0-1.456 1.43-3.219 3.176L4.615 6.352l.512.513.512.512-2.819 2.791L0 12.961l1.83 1.848c1.006 1.016 2.438 2.46 3.182 3.209l1.351 1.359.508-.496c.28-.273.515-.498.524-.498.008 0 1.266 1.264 2.794 2.808L12.97 24l.187-.182c.23-.225 5.007-4.95 5.717-5.656l.52-.516-.502-.513c-.276-.282-.5-.52-.496-.53.003-.009 1.264-1.26 2.802-2.783 1.538-1.522 2.8-2.776 2.803-2.785.005-.012-3.617-3.684-6.107-6.193L17.65 4.6l-.505.505c-.279.278-.517.501-.53.497-.013-.005-1.27-1.267-2.793-2.805A449.655 449.655 0 0011.041 0zM9.223 7.367c.091.038 7.951 4.608 7.957 4.627.003.013-1.781 1.056-3.965 2.32a999.898 999.898 0 01-3.996 2.307c-.019.006-.026-1.266-.026-4.629 0-3.7.007-4.634.03-4.625Z";
const KODI_BORDER =
  "M17.3,114.9l97.6-97.6c7.2-7.2,19-7.2,26.2,0l97.6,97.6c7.2,7.2,7.2,19,0,26.2l-97.6,97.6c-7.2,7.2-19,7.2-26.2,0l-97.6-97.6C10.1,133.9,10.1,122.1,17.3,114.9z";
const KODI_MARK =
  "M61.6,96.1c0-4.4-2.1-6.4-4-4.4l-31.3,31.3c-2.8,2.8-2.8,7.3,0,10.1l31.3,31.3c1.9,1.9,4,0,4-4.4L61.6,96.1z M152.5,123l33.6-33.6c2.8-2.8,7.3-2.8,10.1,0l33.6,33.6c2.8,2.8,2.8,7.3,0,10.1l-33.6,33.6c-2.8,2.8-7.3,2.8-10.1,0L152.5,133C149.7,130.3,149.7,125.7,152.5,123z M89.4,186.1l33.6-33.6c2.8-2.8,7.3-2.8,10.1,0l33.6,33.6c2.8,2.8,2.8,7.3,0,10.1L133,229.7c-2.8,2.8-7.3,2.8-10.1,0l-33.6-33.6C86.6,193.4,86.6,188.8,89.4,186.1z M88.5,65.8c0-3.5,1-6,3.4-8.5c10.4-10.4,20.7-20.7,31-31.1c2.8-2.8,7.3-2.8,10.1,0l33.6,33.6c2.8,2.8,2.8,7.3,0,10.1c-24.8,24.8-49.5,49.5-74.3,74.3c-1.9,1.9-3.8,0-3.8-4.4L88.5,65.8L88.5,65.8z";

const LOGO: Partial<Record<DeviceKind, { d: string; color: string; scale: number }>> = {
  /* أصغرُ قليلاً من التطبيق (٠٫٨٢): حدُّ الويب أرفع، فالكلمةُ العريضة كانت تلمسه */
  plex: { d: PLEX, color: "#EBAF00", scale: 0.76 },
  emby: { d: EMBY, color: "#52B54B", scale: 0.62 },
};
/* Nuvio يُرسم كلمةً بتدرّج ألوانه (T560، أدناه) — رمزُه هنا يكمل الجدولَ ولا يُرى */
const GENERIC: Record<DeviceKind, IconName> = { stremio: "play", nuvio: "play", plex: "tv", jellyfin: "film", emby: "tv", kodi: "tv" };
const TINT: Partial<Record<DeviceKind, readonly [string, string]>> = { jellyfin: ["#AA5CC3", "#00A4DC"], stremio: ["#8B80F5", "#685CEE"] };

export type MarkState = "idle" | "on" | "waiting" | "paused";

export function DeviceMark({ kind, size = 56, state = "idle" }: { kind: DeviceKind; size?: number; state?: MarkState }) {
  const logo = LOGO[kind];
  const tint = TINT[kind];
  const ring = state === "on" || state === "waiting";
  const gid = `dm-tint-${kind}`;
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface ${
        ring ? "border-[1.5px] border-accent" : "border border-border"
      } ${state === "paused" ? "opacity-55" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {kind === "kodi" ? (
        <>
          <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 256 256">
            <defs>
              <linearGradient id="kodiBorderW" gradientUnits="userSpaceOnUse" x1="128" y1="11.9426" x2="128" y2="244.059">
                <stop offset="0" stopColor="#FEFEFE" />
                <stop offset="1" stopColor="#DFDFDF" />
              </linearGradient>
              <linearGradient id="kodiMarkW" gradientUnits="userSpaceOnUse" x1="128.0096" y1="26.264" x2="128.0096" y2="229.736">
                <stop offset="0" stopColor="#33ADDD" />
                <stop offset="1" stopColor="#148FBF" />
              </linearGradient>
            </defs>
            <path d={KODI_BORDER} fill="url(#kodiBorderW)" fillRule="evenodd" clipRule="evenodd" />
            <path d={KODI_MARK} fill="url(#kodiMarkW)" fillRule="evenodd" clipRule="evenodd" />
          </svg>
          <span className="absolute text-[7px] font-bold text-muted" style={{ top: size * 0.08, insetInlineEnd: size * 0.08 }} dir="ltr">
            ™
          </span>
        </>
      ) : kind === "nuvio" ? (
        /* 🆕 T560 — «NUVIO» كلمةً بتدرّج ألوانهم كتطبيق الجوّال (لا شعارَ بلا إذن — D-1646). والنهاريُّ درجةٌ أعمق: سماويُّهم على الأبيض
           تباينُه ١٫٧. `light-dark()` يقرأ `color-scheme` الذي يكتبه الثيمُ على `:root`، والسطرُ قبله لمتصفّحٍ لا يعرفها (درجةُ
           النهار، تُقرأ على الداكن أيضاً) */
        <span
          dir="ltr"
          className="font-extrabold tracking-[0.4px] [-webkit-background-clip:text] [background-clip:text] text-transparent"
          style={{
            fontSize: Math.max(7, Math.round(size * 0.17)),
            backgroundImage: "linear-gradient(90deg, #2E6BD6, #9A3FE0)",
            ["--nuvio-word" as string]: "linear-gradient(90deg, light-dark(#2E6BD6, #4BD8EC), light-dark(#9A3FE0, #B048F0))",
          }}
          aria-label="Nuvio"
        >
          <span className="[background-image:var(--nuvio-word)] [-webkit-background-clip:text] [background-clip:text]">NUVIO</span>
        </span>
      ) : logo ? (
        <svg width={size * logo.scale} height={size * logo.scale} viewBox="0 0 24 24">
          <path d={logo.d} fill={logo.color} />
        </svg>
      ) : tint ? (
        /* الرمزُ العامُّ نفسُه بتدرّج ألوانهم: خطوطُ الأيقونة تُصبغ بالتدرّج عبر CSS (الخاصّيةُ تغلب سمةَ `stroke`) */
        <span className="relative grid place-items-center" style={{ width: size * 0.46, height: size * 0.46 }}>
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={tint[0]} />
                <stop offset="1" stopColor={tint[1]} />
              </linearGradient>
            </defs>
          </svg>
          <span className="grid place-items-center [&_*]:[stroke:var(--dm-tint)]" style={{ ["--dm-tint" as string]: `url(#${gid})` }}>
            <Icon name={GENERIC[kind]} size={Math.round(size * 0.46)} />
          </span>
        </span>
      ) : (
        <Icon name={GENERIC[kind]} size={Math.round(size * 0.42)} className="text-muted" />
      )}
      {state === "on" && (
        <span className="absolute -bottom-1 -end-1 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--success)] text-black ring-2 ring-[color:var(--background)]">
          <Icon name="check" size={10} />
        </span>
      )}
      {state === "waiting" && (
        <span className="absolute -bottom-1 -end-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-black ring-2 ring-[color:var(--background)]">
          <Icon name="hourglass" size={10} />
        </span>
      )}
    </span>
  );
}
