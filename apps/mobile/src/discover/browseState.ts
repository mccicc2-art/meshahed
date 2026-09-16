import {
  BROWSE_COUNTRIES,
  BROWSE_ERAS,
  BROWSE_GENRES,
  BROWSE_LANGS,
  BROWSE_SEASONS,
  BROWSE_STATUSES,
  BROWSE_STUDIOS,
  BROWSE_TAGS,
  browseCountryName,
  browseEraName,
  browseGenreName,
  browseLangName,
  browseSeasonName,
  browseStatusName,
  browseStudioName,
  browseTagName,
} from "@/core/browse";
import { AWARDS, awardName } from "@/core/awards";
import type { CuratedTab } from "../contracts";

/**
 * ====== حالةُ الفلتر في «اكتشف» الأصليّة — Phase 11-C4 (D-992) ======
 *
 * **الشكلُ شكلُ رابط الويب**: المفاتيحُ نفسُها التي يقرؤها `parseBrowse` (`g` · `lang` · `co` ·
 * `p` · `era` · `rate` · `tag` · `award` · `st` · `se` · `std`) — فالفلترُ المحفوظ (`q` في
 * `personal.filters`) يُقرأ هنا بلا ترجمة، والاستعلامُ الذي يُرسل إلى `/api/v1/discover/*` هو
 * ما كانت الصفحةُ تضعه في عنوانها. **قائمةُ الخيارات من `core/browse` مباشرةً** — لا نسخةَ
 * ثانية في التطبيق (القاعدة ٣).
 */
export type BrowseState = {
  g: string | null;
  lang: string | null;
  co: string | null;
  p: number | null;
  era: string | null;
  rate: number | null;
  tag: string | null;
  award: string | null;
  st: string | null;
  se: string | null;
  std: string | null;
};

export const EMPTY_BROWSE: BrowseState = { g: null, lang: null, co: null, p: null, era: null, rate: null, tag: null, award: null, st: null, se: null, std: null };

export function browseActive(b: BrowseState): boolean {
  return Object.values(b).some((v) => v !== null);
}

/** استعلامُ الرابط — بلا `tab` (يضيفه المستدعي) */
export function browseQuery(b: BrowseState): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(b)) if (v !== null && v !== "") p.set(k, String(v));
  return p.toString();
}

/** قراءةُ فلترٍ محفوظ (`q` من `personal.filters`) — كما يقرؤه الرابط */
export function browseFromQuery(q: string): BrowseState {
  const p = new URLSearchParams(q);
  const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    g: p.get("g"),
    lang: p.get("lang"),
    co: p.get("co"),
    p: num(p.get("p")),
    era: p.get("era"),
    rate: num(p.get("rate")),
    tag: p.get("tag"),
    award: p.get("award"),
    st: p.get("st"),
    se: p.get("se"),
    std: p.get("std"),
  };
}

export type AxisKey = keyof BrowseState;

/** أسماءُ القيم المختارة — للرقاقات النشطة وسطر «الأدوات» */
export function axisValueLabel(
  key: AxisKey,
  value: string | number,
  locale: "ar" | "en",
  providers: { id: number; name: string }[],
  t: { browseRateFrom: (n: string) => string },
): string {
  const v = String(value);
  switch (key) {
    case "g": {
      const x = BROWSE_GENRES.find((g) => g.slug === v);
      return x ? browseGenreName(x, locale) : v;
    }
    case "lang": {
      const x = BROWSE_LANGS.find((l) => l.code === v);
      return x ? browseLangName(x, locale) : v;
    }
    case "co": {
      const x = BROWSE_COUNTRIES.find((c) => c.code === v);
      return x ? browseCountryName(x, locale) : v;
    }
    case "p":
      return providers.find((x) => String(x.id) === v)?.name ?? v;
    case "era": {
      const x = BROWSE_ERAS.find((e) => e.slug === v);
      return x ? browseEraName(x, locale) : v;
    }
    case "rate":
      return t.browseRateFrom(v);
    case "tag": {
      const x = BROWSE_TAGS.find((e) => e.slug === v);
      return x ? browseTagName(x, locale) : v;
    }
    case "award": {
      const x = AWARDS.find((a) => a.slug === v);
      return x ? awardName(x, locale) : v;
    }
    case "st": {
      const x = BROWSE_STATUSES.find((e) => e.slug === v);
      return x ? browseStatusName(x, locale) : v;
    }
    case "se": {
      const x = BROWSE_SEASONS.find((e) => e.slug === v);
      return x ? browseSeasonName(x, locale) : v;
    }
    case "std": {
      const x = BROWSE_STUDIOS.find((e) => e.slug === v);
      return x ? browseStudioName(x, locale) : v;
    }
  }
}

/** المحاورُ التي تنطبق على تبويبٍ — القواعدُ نفسُها التي في `DiscoverFilterSheet` الويب */
export function axesForTab(tab: CuratedTab): AxisKey[] {
  if (tab === "anime") return ["g", "tag", "lang", "co", "p", "era", "rate", "se", "std"];
  if (tab === "shows") return ["g", "tag", "lang", "co", "p", "era", "rate", "award", "st"];
  return ["g", "tag", "lang", "co", "p", "era", "rate", "award"];
}
