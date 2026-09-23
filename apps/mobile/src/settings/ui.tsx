import React, { useCallback, useEffect } from "react";
import { BackHandler, I18nManager, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { PAGE_PAD } from "../home/Section";
import { ToastHost, type ToastHostRef } from "../HoldHost";

/**
 * ====== الإعداداتُ أصليّاً — العائلاتُ الأربع (Phase 11-I) ======
 *
 * 🔑 **الشكلُ للتطبيق، والوظائفُ من الويب** (D-1067): هذه ترجمةُ
 * `SettingsPageLayout` · `SettingsGroup` · `SettingsRow` · `SettingsExpandRow` ·
 * `SettingsOptionRow` · `ToggleRow` بأرقام الويب نفسِها (صفٌّ ٥٦ · بطاقةٌ `surface`
 * بزاوية `card` · فواصلُ `divider` · عنوانُ مجموعةٍ ١٢ خافت) — **ولا عائلةَ
 * صفٍّ ثانية**: بطاقةُ الحساب صفٌّ رمزُه وجهُك (D-849).
 *
 * الترويسةُ ترويسةُ صفحة الشخص (`HEADER_H` ٦٤ · العنوانُ في المنتصف · الرجوعُ
 * في البداية) — ترويسةٌ واحدةٌ للشاشات المدفوعة لا اثنتان.
 */
const HEADER_H = 64;
export const ROW_H = 56;

/** `toast` — مرجعُ مضيف الإشعار الواحد (القاعدة ٣) يُرسم فوق المحتوى لا داخل التمرير */
export function SettingsScreen({ title, children, onBack, toast }: { title: string; children: React.ReactNode; onBack?: () => void; toast?: React.Ref<ToastHostRef> }) {
  const { tokens, t } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = useCallback(() => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router, onBack]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ height: HEADER_H, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
        <Text size={15} weight="700" numberOfLines={1}>{title}</Text>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAGE_PAD - 4, top: 0, bottom: 0, justifyContent: "center", width: 44 }}>
          {/* السهمُ `chevron-down` مُداراً مع اتّجاه الصفحة (`rotate-90 rtl:-rotate-90` في الويب) */}
          <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
            <Icon name="chevron-down" size={24} color={tokens.fg} />
          </View>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {toast ? <ToastHost hostRef={toast} bottom={insets.bottom} /> : null}
    </View>
  );
}

/** `SettingsGroup` — عنوانٌ خافتٌ فوق بطاقةٍ بفواصل؛ الأبناءُ صفوفٌ والفاصلُ بين كلِّ اثنين */
export function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  const { tokens } = useApp();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View>
      {label ? <Text size={12} weight="600" muted style={{ paddingHorizontal: 4, marginBottom: 6 }}>{label}</Text> : null}
      <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: tokens.divider } : undefined}>{r}</View>
        ))}
      </View>
    </View>
  );
}

/** `SettingsRow` — رمزٌ · عنوانٌ وسطرٌ تحته · قيمةٌ · سهمٌ حين يكون باباً */
export function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  danger,
  trailing,
  leading,
  disabled,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  /** ما يُرسم بدل السهم (مفتاحٌ · سهمُ الطيّ) */
  trailing?: React.ReactNode;
  /** ما يُرسم بدل الرمز (وجهُ الحساب في بطاقته) */
  leading?: React.ReactNode;
  disabled?: boolean;
}) {
  const { tokens } = useApp();
  const color = danger ? tokens.error : tokens.fg;
  const body = (
    <>
      {leading ?? (icon ? <Icon name={icon} size={20} color={danger ? tokens.error : tokens.muted} /> : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={15} weight="600" color={color} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text size={12} weight="500" muted numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text size={14} muted numberOfLines={1} style={{ maxWidth: "40%" }}>{value}</Text> : null}
      {trailing !== undefined ? trailing : onPress ? <Chevron /> : null}
    </>
  );
  const style = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: ROW_H, paddingHorizontal: 14, paddingVertical: 10 };
  if (!onPress) return <View style={[style, disabled ? { opacity: 0.5 } : null]}>{body}</View>;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [style, { backgroundColor: pressed ? tokens.surface2 : "transparent", opacity: disabled ? 0.5 : 1 }]}>
      {body}
    </Pressable>
  );
}

/** سهمُ «باب» — يشير إلى الأمام في الاتّجاهين (`-rotate-90 rtl:rotate-90`) */
export function Chevron({ open }: { open?: boolean }) {
  const { tokens } = useApp();
  const deg = open ? "0deg" : I18nManager.isRTL ? "90deg" : "-90deg";
  return (
    <View style={{ transform: [{ rotate: deg }] }}>
      <Icon name="chevron-down" size={18} color={tokens.muted} />
    </View>
  );
}

/** `SettingsExpandRow` — صفٌّ يطوي لوحَه تحته في المكان (D-569): الخياراتُ تغيّر ما حولها وأنت تنظر */
export function ExpandRow({ icon, title, value, open, onToggle, children }: { icon?: IconName; title: string; value?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View>
      <Row icon={icon} title={title} value={value} onPress={onToggle} trailing={<Chevron open={open} />} />
      {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{children}</View> : null}
    </View>
  );
}

/** `SettingsOptionRow` — قرصٌ حلقةٌ ونقطة لا يتبدّل مقاسُه بين الحالتين فلا يزحف النصّ */
export function OptionRow({ selected, title, subtitle, onSelect, disabled }: { selected: boolean; title: string; subtitle?: string; onSelect: () => void; disabled?: boolean }) {
  const { tokens } = useApp();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        if (selected) return;
        haptic.pick();
        onSelect();
      }}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: ROW_H, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.control, backgroundColor: pressed ? tokens.surface2 : "transparent", opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? tokens.accent : tokens.border, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: selected ? tokens.accent : "transparent" }} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={15} weight="600" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text size={12} weight="500" muted style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

/** لوحُ الخيارات — `SettingsOptionList`: قائمةٌ داخل بطاقةٍ أدكن */
export function OptionList({ children }: { children: React.ReactNode }) {
  const { tokens } = useApp();
  return <View accessibilityRole="radiogroup" style={{ borderRadius: radius.control, backgroundColor: tokens.bg, borderWidth: 1, borderColor: tokens.divider, paddingVertical: 4 }}>{children}</View>;
}

/** `ToggleRow` — كبسولةٌ ٤٤×٢٦ بقرصٍ يزحف؛ المختارُ بلون التمييز */
export function Toggle({ icon, label, hint, checked, onChange, disabled }: { icon?: IconName; label: string; hint?: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  const { tokens } = useApp();
  return (
    <Row
      icon={icon}
      title={label}
      subtitle={hint}
      onPress={onChange}
      disabled={disabled}
      trailing={
        <View accessibilityRole="switch" accessibilityState={{ checked }} style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: checked ? tokens.accent : tokens.surface2, padding: 3, alignItems: checked ? "flex-end" : "flex-start", justifyContent: "center" }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: checked ? tokens.onAccent : tokens.muted }} />
        </View>
      }
    />
  );
}

/** هيكلُ الفهرس أثناء أوّل جلب — صفوفٌ `surface2` بارتفاع الصفّ (هيكلُ «اكتشف» — D-1092) */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  const { tokens } = useApp();
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ height: ROW_H, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
          <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: tokens.surface2 }} />
          <View style={{ height: 14, width: `${45 + (i % 3) * 12}%`, borderRadius: 6, backgroundColor: tokens.surface2 }} />
        </View>
      ))}
    </View>
  );
}
