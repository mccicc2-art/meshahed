"use client";

import { useCallback, useEffect, useState } from "react";
import { v1Get, v1Post } from "../InboxComposer";
import { SIGNAL_SOURCE_NAME } from "@/core/contracts/stremio";
import type { Dict } from "@/core/i18n";
import type { DeviceKind, DeviceLinksBody, DeviceLinksState } from "@/core/contracts/deviceLinks";

/**
 * 🆕 **«الربط» في الويب — قراءةٌ وكتابةٌ من الأبواب نفسِها التي يقرؤها التطبيق** (`GET/POST /api/v1/me/links`، T409).
 * حالةٌ واحدةٌ للصفحة وأوراق الأجهزة: كلُّ كتابةٍ تعيد الحالةَ كلَّها فتُكتب في مكانها، وإصدارُ رابطٍ يعيد القراءة.
 */
export function useLinksState() {
  const [state, setState] = useState<DeviceLinksState | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    const d = await v1Get<DeviceLinksState>("/api/v1/me/links");
    if (d) {
      setState(d);
      setFailed(false);
    } else setFailed(true);
    return d;
  }, []);
  useEffect(() => {
    let live = true;
    void v1Get<DeviceLinksState>("/api/v1/me/links").then((d) => {
      if (!live) return;
      if (d) setState(d);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return { state, setState, failed, reload };
}

export async function linksWrite(body: DeviceLinksBody, t: Dict): Promise<DeviceLinksState> {
  return v1Post<DeviceLinksState>("/api/v1/me/links", body, t);
}

/** أسماءُ منتجاتٍ لا تُترجم — من عقد المصادر نفسِه */
export const deviceName = (k: DeviceKind) => SIGNAL_SOURCE_NAME[k];

/** هل للعضو أن يربط هذا الجهاز الآن؟ — مربوطٌ (استبدالٌ لا خانة) أو بقيت خانة (كما في التطبيق `canLinkNow`) */
export function canLinkNow(d: DeviceLinksState, kind: DeviceKind): boolean {
  if (d.devices.find((x) => x.kind === kind)?.linked) return true;
  return d.limit == null || d.used < d.limit;
}

export function linkedNames(d: DeviceLinksState): string[] {
  return d.devices.filter((x) => x.linked && !x.stopped).map((x) => deviceName(x.kind));
}

export function episodeLabel(s: { season: number | null; episode: number | null }): string {
  return s.season != null && s.episode != null ? `S${s.season} E${s.episode}` : "";
}
