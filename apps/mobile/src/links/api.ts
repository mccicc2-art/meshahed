import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { SIGNAL_SOURCE_NAME } from "@/core/contracts/stremio";
import type { DeviceKind, DeviceLinksBody, DeviceLinksState } from "@/core/contracts/deviceLinks";

/**
 * 🆕 **مدارُ الأجهزة** — استعلامٌ واحدٌ لصفحة «الربط» وصفحات الأجهزة وصفِّ الإعدادات (`GET /api/v1/me/links`، هجرة ٢٣٧).
 * المفتاحُ هو الوسمُ نفسُه (`me:links`) فيُسقطه كلُّ إصدارٍ أو فكٍّ يعلنه بلا سطرٍ آخر.
 */
export const LINKS_KEY = ["me:links"] as const;

export function useLinks() {
  return useQuery({
    queryKey: LINKS_KEY,
    queryFn: async () => (await api<DeviceLinksState>("/api/v1/me/links")).data,
    staleTime: 30_000,
  });
}

/** «اختر ما يبقى» · «سجّل بلا سؤال» · فكُّ جهاز — والردُّ الحالةُ الجديدة كلُّها، فتُكتب في الكاش في حينها */
export async function linksWrite(body: DeviceLinksBody): Promise<DeviceLinksState> {
  const next = await write<DeviceLinksState>("/api/v1/me/links", body);
  queryClient.setQueryData(LINKS_KEY, next);
  return next;
}

/** أسماءُ منتجاتٍ لا تُترجم — من عقد المصادر نفسِه */
export const deviceName = (k: DeviceKind) => SIGNAL_SOURCE_NAME[k];

/** صفحةُ الجهاز في الإعدادات (`/settings/<kind>`) */
export const devicePath = (k: DeviceKind) => `/settings/${k}` as const;

/** هل للعضو أن يربط هذا الجهاز الآن؟ — مربوطٌ (استبدالٌ لا خانة) أو بقيت خانة */
export function canLinkNow(d: DeviceLinksState, kind: DeviceKind): boolean {
  if (d.devices.find((x) => x.kind === kind)?.linked) return true;
  return d.limit == null || d.used < d.limit;
}

/** المربوطُ الشغّالُ (لا الموقوف) — لـ«فكّ ربط X أولاً» */
export function linkedNames(d: DeviceLinksState): string[] {
  return d.devices.filter((x) => x.linked && !x.stopped).map((x) => deviceName(x.kind));
}
