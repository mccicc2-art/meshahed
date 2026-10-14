import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * واجهةُ جسر الودجتات (`modules/loopz-widget`).
 *
 * 🔑 **اختياريّةٌ عمداً** (`requireOptionalNativeModule`): بناءٌ أصليٌّ أقدمُ من الجسر لا يملك الوحدة — وتحديثٌ
 * OTA لا يصله أصلاً لأنّ البصمةَ تغيّرت، لكنّ «لا وحدة» يجب أن تعني «لا ودجت» لا شاشةً تسقط.
 */
type Native = {
  writeText(name: string, text: string): void;
  importFile(fromUri: string, name: string): void;
  exists(name: string): boolean;
  /** 🆕 بناءٌ أصليٌّ أقدمُ لا يملكها — فهي اختياريّة */
  readText?(name: string): string | null;
  /** 🆕 W40 — أندرويد: الودجتاتُ الموضوعة (رقمٌ ومقاسٌ بالـdp)؛ الآيفون: الحجمُ والتخطيطُ لكلِّ ودجت. اختياريّةٌ للبناء الأقدم */
  installedWidgets?(): AndroidPlaced[] | Promise<IosPlaced[]>;
  /** 🆕 أندرويد 8+: يطلب من المشغِّل وضعَ ودجتٍ جديد — `false` إن لم يدعمه */
  requestPin?(): boolean;
  prune(keep: string[]): void;
  reload(): void;
  configuredLists(): string[];
  installedCount(): number | Promise<number>;
};

export type AndroidPlaced = { id: number; w: number; h: number };
export type IosPlaced = { family: "small" | "medium" | "large" | "xl" | "other"; layout: string };

export const LoopzWidget = requireOptionalNativeModule<Native>("LoopzWidget");
