import React from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import type { HomeFriendCard, HomeFriendWho } from "../contracts";
import { friendBadge } from "@/core/contracts/home";

/**
 * ====== 🆕 D-1353 — مَن يشاهد العمل من أصدقائك ======
 *
 * طلبُ أحمد ١١ أكتوبر بلقطة صفّ «يشاهده أصدقاؤك»: «ليش ما نضيف مين الشخص اللي يتابع العمل هذا؟» — واختار من ثماني صور
 * الشكلَ الرابع: **سطرٌ تحت الملصق خارجَه** (صورٌ دائريّةٌ صغيرةٌ ثمّ الاسم)، لا شيءَ فوق الصورة. وقراراتُه معه:
 * - **المصدرُ نشاطُ من تتابعهم** (ما يبني الصفَّ أصلاً)، لا «كلُّ من يتابع العمل» — بلا استعلامٍ جديد.
 * - **صديقٌ واحدٌ ⇒ الضغطةُ تفتح ملفَّه**؛ أكثر ⇒ قائمةُ الأسماء.
 * - **التطبيقُ وحدَه الآن** (الويبُ يبقى ملصقاً بلا سطر).
 *
 * ⚖️ **من أخفى اسمَه لا يُسمّى**: يصل من الخادم بلا اسمٍ ولا صورة (`others`) فيدخل العدَّ وحدَه — «و٢ آخرين».
 * ⚖️ **الملصقُ يفتح العمل والسطرُ يفتح الناس**: منطقتان منفصلتان، فلا يتنازع هدفان على ضغطة.
 */
export const WHO_H = 30;
const AV = 20;

function Face({ uri, size, ring }: { uri: string | null; size: number; ring: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1.5, borderColor: ring, alignItems: "center", justifyContent: "center" }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={size * 0.5} color={tokens.muted} />}
    </View>
  );
}

/**
 * 🆕 D-1445 — **شارةُ الملصق: ماذا فعل صديقُك بالعمل** (أحمد ١٦ أكتوبر: «كيف الواحد يفرّق بين اللي قيّم واللي شاهد بس والحلقة»،
 * «يهمّني تقييمه وأنه شاهد»، واختار الشارةَ على الملصق): وجهُ أحدثِ صديقٍ ثمّ ★ تقييمُه (ذهبيّ) · ✓ خلّصه (أخضر) ·
 * ▶ آخرُ موسمٍ وحلقة (أبيض). الحالُ من الخادم (`friendBadge` نفسُها في الويب)؛ لا حالَ ⇒ لا شارة.
 * فوق الزاوية العليا المقابلة لعلامة «عندك» في `PosterCard`، فلا تتزاحمان.
 */
export function FriendBadge({ card }: { card: HomeFriendCard }) {
  const { tokens } = useApp();
  const who = (card.people ?? []).find((p) => friendBadge(p.state));
  const b = who ? friendBadge(who.state) : null;
  if (!who || !b) return null;
  const color = b.kind === "rated" || b.kind === "ep_rated" ? tokens.accent : b.kind === "done" ? tokens.success : "#fff";
  /* 🆕 D-1503 — «★ ٩ · E3»: تقييمُه للحلقة التي وصلها */
  const label =
    b.kind === "rated" ? `★ ${b.rating}` : b.kind === "ep_rated" ? `★ ${b.rating} · E${b.episode}` : b.kind === "done" ? "✓" : b.episode ? `▶ S${b.season} · E${b.episode}` : `▶ S${b.season}`;
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={`${who.name} · ${label}`}
      style={{ position: "absolute", top: 7, end: 7, flexDirection: "row", alignItems: "center", gap: 5, paddingStart: 3, paddingEnd: 8, height: 26, borderRadius: 13, borderWidth: 1, borderColor: color, backgroundColor: "rgba(0,0,0,0.72)" }}
    >
      <Face uri={who.avatar_url} size={19} ring="transparent" />
      <Text size={12} weight="700" color={color} style={{ writingDirection: "ltr" }}>{label}</Text>
    </View>
  );
}

/** ما يقوله السطر: اسمٌ · اسمان · أو صورتان و«+ن» */
export function whoOf(card: Pick<HomeFriendCard, "people" | "others">) {
  const people = card.people ?? [];
  const others = card.others ?? 0;
  return { people, others, total: people.length + others };
}

/**
 * السطرُ تحت الملصق. `onPress` يأخذ ما يُفتح: اسمَ مستخدمٍ (صديقٌ واحدٌ ظاهر) أو البطاقةَ (قائمةُ الأسماء).
 * بلا أحدٍ يُسمّى (الكلُّ أخفى اسمَه) يُقرأ ولا يُضغط.
 */
export function FriendsWhoLine({ card, onProfile, onNames }: { card: HomeFriendCard; onProfile: (username: string) => void; onNames: (card: HomeFriendCard) => void }) {
  const { t, tokens, locale } = useApp();
  const sep = locale === "en" ? ", " : "، ";
  const { people, others, total } = whoOf(card);
  if (total === 0) return <View style={{ height: WHO_H }} />;
  const shown = people.slice(0, 2);
  const rest = total - shown.length;
  const single = people.length === 1 && others === 0;
  const label = people.length === 0 ? t.friendsCount(others) : rest > 0 ? `+${rest}` : shown.map((p) => p.name).join(sep);
  const press = people.length === 0 ? undefined : single && people[0].username ? () => onProfile(people[0].username!) : single ? undefined : () => onNames(card);
  return (
    <Pressable onPress={press} disabled={!press} hitSlop={{ top: 4, bottom: 8 }} accessibilityRole={press ? "button" : undefined} accessibilityLabel={people.length ? [...people.map((p) => p.name), others ? t.andOthers(others) : ""].filter(Boolean).join(sep) : label} style={{ height: WHO_H, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 }}>
      {shown.length > 0 ? (
        <View style={{ flexDirection: "row" }}>
          {shown.map((p, i) => (
            <View key={i} style={{ marginStart: i > 0 ? -7 : 0, zIndex: 2 - i }}>
              <Face uri={p.avatar_url} size={AV} ring={tokens.bg} />
            </View>
          ))}
        </View>
      ) : (
        <Icon name="people" size={14} color={tokens.muted} />
      )}
      <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** قائمةُ الأسماء — جسدُ ورقة: صفٌّ لكلِّ صديق يفتح ملفَّه، وسطرُ «وآخرين» لمن أخفوا أسماءهم */
export function FriendsNames({ people, others, onProfile }: { people: HomeFriendWho[]; others: number; onProfile: (username: string) => void }) {
  const { t, tokens } = useApp();
  return (
    <View style={{ marginTop: -8 }}>
      {people.map((p, i) => (
        <Pressable
          key={`${p.username ?? p.name}-${i}`}
          onPress={p.username ? () => onProfile(p.username!) : undefined}
          disabled={!p.username}
          accessibilityRole={p.username ? "link" : undefined}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8, opacity: pressed ? 0.7 : 1, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.border })}
        >
          <Face uri={p.avatar_url} size={40} ring="transparent" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={15} weight="600" numberOfLines={1}>{p.name}</Text>
            {p.username ? <Text size={12} muted numberOfLines={1}>{`@${p.username}`}</Text> : null}
          </View>
        </Pressable>
      ))}
      {others > 0 ? <Text size={13} muted style={{ paddingTop: 12 }}>{people.length > 0 ? t.andOthers(others) : t.friendsCount(others)}</Text> : null}
    </View>
  );
}
