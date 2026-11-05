/**
 * 🆕 **عقدُ مدار الأجهزة** — `GET /api/v1/me/links` و`POST /api/v1/me/links` (هجرة ٢٣٧، أحمد ٥ نوفمبر).
 *
 * 🔑 **صفحةُ «الربط» تقرأ من هنا وحده**: كم خانة، وما في كلٍّ منها، وأيُّها موقوفٌ بعد النزول، و«سجّل بلا سؤال».
 * والإصدارُ نفسُه يبقى في أبوابه (`me/stremio/link` · `me/home-server/link` بنوعه · `me/home-server/kodi`) لأنّ لكلٍّ منها ردَّه.
 * ⚠️ **الحالةُ أسماءٌ وأرقامٌ لا جمل**: التطبيقُ يكتب «١ من ١ · مع بلس ٥» بقاموسه.
 */
import type { DeviceKind, HomeKind, LinkTier } from "../deviceLinks.ts";

export interface DeviceLinkInfo {
  kind: DeviceKind;
  /** في المدار (شغّالٌ أو موقوف) */
  linked: boolean;
  /** موقوفٌ: زاد على الخانات بعد النزول — يعود باختياره في «اختر ما يبقى» أو باشتراك */
  stopped: boolean;
  /** يمرّ في الرابط القديم المشترك (قبل ٢٣٧) لا في رابطه الخاصّ — فكُّه يفكّ ما يشاركه */
  shared: boolean;
  linked_at: string | null;
  used_at: string | null;
  /** كم عملاً سجّله هذا الجهاز في مكتبة العضو (شارةُ المصدر) — لتأكيد الفكّ «الـN عملاً تبقى في مكتبتك» */
  works: number;
  /** 🆕 آخرُ ما وصل من هذا الجهاز — اسمُ العمل وحلقتُه («آخر ما وصل قبل ساعتين · The Bear S3 E4»). `null` قبل أوّل حدث */
  last?: { title: string; season: number | null; episode: number | null } | null;
}

export interface DeviceLinksState {
  tier: LinkTier;
  /** `null` = بلا حدّ (الذهبيّ) */
  limit: number | null;
  /** الخاناتُ المستعملةُ الآن (الشغّالُ وحده) */
  used: number;
  /** خمسةُ أجهزةٍ بترتيب «من أجهزتك» الثابت */
  devices: DeviceLinkInfo[];
  /** الرابطُ القديمُ المشترك قبل أن يصل منه شيء — خانةٌ محسوبةٌ لا يُعرف سيرفرُها بعد */
  pending_legacy: { linked_at: string; stopped: boolean } | null;
  /** «سجّل بلا سؤال» كما اختاره العضو (الافتراضيُّ نعم) — يعمل لـLoopz+ وحده، ولا يمسّ Stremio */
  auto_mark: boolean;
  /** Kodi: اسمُ الجهاز، ورمزُ ربطٍ ينتظر */
  kodi_device: string | null;
  kodi_pairing: boolean;
  /** `false` قبل الهجرة — التطبيقُ يعرض الشاشات القديمة */
  ready: boolean;
}

export type DeviceLinksBody =
  /** «اختر ما يبقى»: الأجهزةُ التي تبقى، بحدود الخانات */
  | { action: "keep"; kinds: DeviceKind[] }
  /** «سجّل بلا سؤال» */
  | { action: "auto_mark"; value: boolean }
  /** فكُّ جهازٍ واحد (والرابطِ القديمِ إن كان يمرّ فيه) */
  | { action: "revoke"; kind: DeviceKind }
  /** فكُّ الرابط القديم المشترك قبل أن يصل منه شيء (`pending_legacy`) */
  | { action: "revoke_legacy" };

export type { DeviceKind, HomeKind, LinkTier };
