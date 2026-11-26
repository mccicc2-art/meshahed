import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View, type ViewInstance } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Segmented } from "../library/ToolsSheet";
import { OneTimeHint } from "../library/OneTimeHint";
import { libraryQuery } from "../library/LibraryScreen";
import { DropMenu, measureAnchor, type Anchor } from "../library/HoldMenu";
import { Rail, PAGE_PAD, latinTitleFit } from "../home/Section";
import { formatDateShort } from "@/core/when";
import type { CinemaCard, CinemaOrigin, CinemaPayload } from "../contracts";

/**
 * ====== قسمُ السينما — التطبيق (T512) ======
 *
 * نسخةُ `CinemaRail` الويب بقرارات أحمد ٢٢ نوفمبر: **مكانٌ واحدٌ بحالتين** — العنوانُ بفشاره وسهمٍ ثقيلٍ بابُ قائمةٍ منسدلة
 * (`DropMenu` نفسُها: «الآن في السينما ٢٤ ✓ · قريباً ١٨»)، **ويفتح دائماً على «الآن»**؛ وسطرُ «في السعودية» برقاقات المنشأ
 * في طرفه المقابل؛ وتاريخُ النزول قرصاً على الملصق في «قريباً». **ولا اسمَ صالة** حتى نحصل على إذنها.
 *
 * 🔑 **رأسُ المكان لا رأسٌ ثالث**: الرئيسيّةُ بمقاس `SectionHeader` (رمزٌ ٢٠ بالتمييز · ٢٠/٧٠٠)، و«اكتشف» بمقاس `CardsRail`
 * (١٦ · ١٧/٧٠٠) — والفشارُ وحدَه بارتفاع حروف العنوان (٠٫٨٨ من الخطّ) كما طُلب.
 * 🔑 **البطاقةُ بطاقةُ المكان**: `renderCard` من الشاشة — `PosterCard` بالاسم داخله في الرئيسيّة، و`RailCard` بالاسم تحته في
 * «اكتشف» — فقائمةُ الضغط المطوَّل وخيطُ الحالة كما في جيرانها بلا نسخة.
 */
export const cinemaQuery = {
  queryKey: ["cinema"] as const,
  queryFn: async () => (await api<CinemaPayload>("/api/v1/cinema")).data,
  /* القائمةُ تتجدّد أسبوعيّاً والمطابقةُ بعد كلِّ طلب — عشرُ دقائق كصفوف «اكتشف» */
  staleTime: 10 * 60_000,
};

type Mode = "now" | "soon";

/**
 * 🆕 T519 — **تلميحٌ عُرض في هذا التشغيل لا يعود فيه** (خالد ٢٢ نوفمبر: «الهنت يجي كل ما ادخل … اضغط اكس وبرضوا يرجع»).
 * المقروءُ في الحساب يصل مع بيانات الشاشة، وبياناتُ الرئيسيّة لا تتجدّد لحظةَ الإغلاق — فهذه الذاكرةُ تسدّ ما بينهما.
 */
const seenThisRun = new Set<string>();

export function CinemaRail({
  place,
  hintReady,
  hintsRead,
  renderCard,
}: {
  place: "home" | "discover";
  /** «لا تلميحتان معاً» (D-1273): الشاشةُ تقول متى خلا دورُ التلميح */
  hintReady: boolean;
  /**
   * 🔴 T519 — **المقروءُ في الحساب** (بياناتُ الشاشة). في التطبيق الشاشةُ هي التي تقرّر أن تُظهر التلميح لا التلميحُ نفسُه،
   * ونسيانُ هذا الفحص أظهره في كلِّ دخولٍ مهما أُغلق. غائبٌ ⇒ لا تلميح (D-1259)
   */
  hintsRead: readonly string[] | undefined;
  /** البطاقةُ ومعها تاريخُ نزولها إن كانت في «قريباً» */
  renderCard: (c: CinemaCard, badge: string | null) => React.ReactNode;
}) {
  const { t, tokens } = useApp();
  const q = useQuery(cinemaQuery);
  const [mode, setMode] = useState<Mode>("now");
  const [origin, setOrigin] = useState<"all" | CinemaOrigin>("all");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const door = useRef<ViewInstance>(null);
  /* «يفتح دائماً على الآن» (حكمُ أحمد): الشاشتان جذرانِ لا يُنزعان، فالعودةُ إليهما بعد مغادرةٍ تُرجع الحالةَ الأولى */
  const hintId = `cinema-switch-${place}`;
  /* المقروءُ الذي يكتبه التلميحُ نفسُه عند الإغلاق (كاش المكتبة) — يُرى قبل أن تتجدّد بياناتُ الشاشة */
  const libHints = useQuery({ ...libraryQuery, enabled: false }).data?.hints;
  const [focused, setFocused] = useState(true);
  const hintShown = useRef(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setMode("now");
        setOrigin("all");
        setAnchor(null);
        /* 🆕 T519 — **المغادرةُ بعد أوّل عرضٍ إعلانُ قراءة** (عُرفُ `useHintTurn`): الشاشتان جذرانِ لا تُنزعان، فالتلميحُ يُنزل
           عند المغادرة (`focused`) فيكتب قراءتَه بنفسه، ولا يعود في هذا التشغيل */
        if (hintShown.current) seenThisRun.add(hintId);
      };
    }, [hintId]),
  );
  const showHint =
    hintReady &&
    focused &&
    hintsRead !== undefined &&
    !hintsRead.includes(hintId) &&
    !(libHints ?? []).includes(hintId) &&
    !seenThisRun.has(hintId);
  if (showHint) hintShown.current = true;

  const data = q.data;
  const list = useMemo(() => (data ? (mode === "soon" ? data.soon : data.now) : []), [data, mode]);
  const shown = useMemo(() => (origin === "all" ? list : list.filter((c) => c.origin === origin)), [list, origin]);
  if (!data || (data.now.length === 0 && data.soon.length === 0)) return null;

  const home = place === "home";
  const titleSize = home ? 20 : 17;
  const title = mode === "soon" ? t.cinemaSoon : t.cinemaNow;
  const count = (o: "all" | CinemaOrigin) => (o === "all" ? list.length : list.filter((c) => c.origin === o).length);
  const pick = (m: Mode) => {
    setAnchor(null);
    setMode(m);
    setOrigin("all");
  };
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: home ? 4 : 6, paddingHorizontal: PAGE_PAD }}>
        <Pressable
          ref={door}
          onPress={() => measureAnchor(door.current, setAnchor)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${title} — ${t.cinemaSwitch}`}
          accessibilityState={{ expanded: anchor !== null }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="popcorn" size={Math.round(titleSize * 0.88)} color={tokens.accent} />
          <Text size={titleSize} weight="700" numberOfLines={1} style={[{ flexShrink: 1 }, latinTitleFit(title)]}>
            {title}
          </Text>
          <Icon name="chevron-down-bold" size={Math.round(titleSize * 0.8)} color={tokens.accent} />
        </Pressable>
        {shown.length > 0 ? (
          <CinemaSeeAll mode={mode} title={title} home={home} />
        ) : null}
      </View>
      {/* سطرُ «في السعودية» ورقاقاتُ المنشأ في طرفه المقابل — سطرٌ واحد (طلبُ أحمد) */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingStart: PAGE_PAD, marginBottom: 8 }}>
        <Text size={12} muted>{t.cinemaInSaudi}</Text>
        {/* «ت٥أ» (أحمد ٢٦ نوفمبر): المنشأُ عائلةُ المقسّم بخطٍّ أصفر — لا كبسولات. 🆕 T585 (٢٧ نوفمبر «نفذ»): بالمقاس الصغير
           `dense` كي يبقى السطرُ بارتفاع الكبسولات القديمة — التبويبُ الكاملُ زاد القسمَ ~١٣ نقطة بلا معلومةٍ جديدة */}
        <View style={{ flex: 1, paddingEnd: PAGE_PAD }}>
          <Segmented
            dense
            items={(["all", "arabic", "foreign"] as const).map((o) => ({ id: o, label: `${o === "all" ? t.allWord : o === "arabic" ? t.cinemaArabic : t.cinemaForeign} ${count(o)}` }))}
            value={origin}
            onChange={(v) => setOrigin(v as typeof origin)}
          />
        </View>
      </View>
      {showHint ? <OneTimeHint id={hintId} text={t.cinemaHint} style={{ marginHorizontal: PAGE_PAD, marginBottom: 8 }} /> : null}
      {shown.length === 0 ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.browseEmpty}</Text>
      ) : (
        /* المفتاحُ يركّب الصفَّ من جديد عند كلِّ تبديل — قائمةٌ جديدةٌ تبدأ من أوّلها (والتثبيتُ على أوّل بطاقة في `Rail`) */
        <Rail key={`${mode}-${origin}`}>
          {shown.map((c) => (
            <React.Fragment key={c.id}>{renderCard(c, mode === "soon" && c.sa_date ? formatDateShort(c.sa_date, t) : null)}</React.Fragment>
          ))}
        </Rail>
      )}
      {anchor ? (
        <DropMenu
          anchor={anchor}
          onClose={() => setAnchor(null)}
          rows={(["now", "soon"] as const).map((m) => ({
            key: m,
            /* صفُّ الاختيار: الصحُّ على المختار وحدَه وخانتُه فارغةٌ في غيره (وصفةُ اختيار الفترة) */
            icon: mode === m ? "check" : undefined,
            tone: "accent" as const,
            label: m === "now" ? t.cinemaNow : t.cinemaSoon,
            trail: String((m === "now" ? data.now : data.soon).length),
            selected: mode === m,
            onPress: () => pick(m),
          }))}
        />
      ) : null}
    </View>
  );
}

/** «الكل» — صفحةُ القسم الأصليّة (`/section`) بحالته: `cs=soon` للقادم، والخادمُ يقرأ القائمةَ نفسَها (D-199) */
function CinemaSeeAll({ mode, title, home }: { mode: Mode; title: string; home: boolean }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const query = mode === "soon" ? "s=in-cinemas&m=movie&cs=soon" : "s=in-cinemas&m=movie";
  return (
    <Pressable onPress={() => router.push({ pathname: "/section", params: { title, query } })} hitSlop={8} accessibilityRole="link">
      {/* مقاسُ «الكل» في رأس المكان: ١٤ باهتةً في الرئيسيّة (R266) · ١٢ بالتمييز في «اكتشف» */}
      {home ? <Text size={14} weight="500" muted>{t.allWord}</Text> : <Text size={12} weight="600" color={tokens.accent}>{t.seeAll}</Text>}
    </Pressable>
  );
}
