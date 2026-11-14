import "server-only";
import { KODI_LICENSE_TXT } from "./kodiAddonLicense";
import { KODI_FANART_JPG_B64 } from "./kodiAddonFanart";

/**
 * ====== 🆕 إضافةُ Kodi — `service.loopz` (هجرة ٢٣٦؛ أحمد ٥ نوفمبر: «١ أ · ٢ أ · ٣ أ»، والرمزُ داخل التبويب «أ») ======
 *
 * 🔑 **الإضافةُ هنا نصّاً، والملفُّ المضغوط يُبنى منها عند الطلب** (`/api/v1/kodi/service.loopz-<version>.zip`): مصدرٌ واحدٌ
 * يُراجَع في المستودع، لا ملفٌّ ثنائيٌّ يُرفع بجانبه فيختلفان.
 * ⚖️ **تحت `/api/v1/` لا `/kodi`**: جدارُ Vercel يتحدّى كلَّ عميلٍ غير متصفّح خارج هذه السابقة (D-945) — وKodi عميلٌ غيرُ متصفّح،
 * فقائمةُ المصدر والملفُّ ونداءا الربط والإرسال كلُّها هنا.
 * ⚖️ **ما تفعله الإضافة**: ترى ما يُشغَّل (المكتبةُ عبر JSON-RPC، وإضافاتُ البثّ عبر وسم الفيديو)، وحين تبلغ ٩٠٪ — كـPlex —
 * ترسل «انتهى» إلى رابطها. **ولا تعلّم شيئاً بنفسها**: الخادمُ يسأل «شفتها؟» في الرئيسيّة («٢ أ» في سيرفرات البيت)، أو يضيفها مباشرةً لمن فعّل التتبّع التلقائي.
 * ⚖️ **والربطُ بستّة أرقام** يُكتب في إعداداتها بريموت التلفزيون — الرابطُ الطويل لا يُكتب هناك.
 * 📌 بايثون ٣ (Kodi 19 فما بعد). وإصدارٌ جديدٌ = رقمٌ جديد هنا وفي `addon.xml` (Kodi يقارن الرقم).
 * 🆕 T359 — **جاهزةٌ لمستودع Kodi الرسميّ** (أذنت مؤسّسةُ Kodi بشعارها ٩ نوفمبر واقترحت المستودع): رخصةٌ مفتوحة (`kodiAddonLicense.ts`)،
 * وسجلٌّ بمستوى التصحيح وحدَه (قاعدتُهم)، ونصوصٌ مترجمةٌ كلُّها، ولا ذكرَ لخطّةٍ مدفوعة — ربطُ جهازٍ واحدٍ مجّانيّ (D-1640).
 * 🆕 T363 — **1.0.2: «انتهى» يُرسل لحظةَ تجاوز ٩٠٪ والفيديو يعمل** (أحمد: «لازم ف كودي اضغط ايقاف عالحلقة عشان تجي؟ ما يمدي اطلع
 * وبس؟» ثمّ «نفذ»). كان ينتظر الإيقافَ أو النهاية: و«رجوع» في Kodi يُخفي الفيديو ولا يوقفه، وإغلاقُ Kodi قد يُطفئ الإضافةَ قبل
 * أن ترسل. الآن كـPlex — مرّةً لكلِّ عمل (`finish` يمحو العنصر).
 * 🆕 T364 — **1.0.3: نصوصٌ فقط** قبل تقديمها لمستودع Kodi (أحمد «نفذ»): الوصفُ كان يقول «ما نعلّم شيئاً بدون جوابك» وقد صار
 * التتبّعُ التلقائيُّ يضيف بلا سؤال، وتلميحُ الرمز كان يدلّ على «الإعدادات، سيرفرات البيت» وقد انتقل الربطُ إلى «الربط». ولا ذكرَ لخطّة.
 * 🆕 T381 — **1.0.4: خلفيّةٌ (`fanart.jpg`) في `<assets>`** (أحمد «١ أ» ثمّ «نفذ»): تحذيرُ `art.no-fanart` من فاحص طلب المستودع.
 * لا تغييرَ في السلوك. ⚖️ وتحذيرُه الثاني (`<website>` ردّ 429) يبقى: جدارُ Vercel يتحدّى كلَّ عميلٍ غير متصفّح (D-945)،
 * وقرارُ أحمد («٢ أ»): لا يُضعَف الجدار لأجله — يُشرح في وصف الطلب.
 * 🆕 T382 — **1.0.5: شعارُ اللانهاية أيقونةً للإضافة وعلى إشعاراتها** (أحمد «نفذ»): الأيقونةُ كانت «Loopz» كلمةً، وإشعاراتُ التأكيد
 * بعلامة «i» العامّة من Kodi. ⚖️ إشعاراتُ الخطأ تبقى بالحمراء: شعارُنا عليها يجعل «الرمز خطأ» يُقرأ تأكيداً.
 */

export const KODI_ADDON_ID = "service.loopz";
export const KODI_ADDON_VERSION = "1.0.5";
export const KODI_ZIP_NAME = `${KODI_ADDON_ID}-${KODI_ADDON_VERSION}.zip`;

const ADDON_XML = String.raw`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<addon id="service.loopz" name="Loopz" version="1.0.5" provider-name="Loopz">
  <requires>
    <import addon="xbmc.python" version="3.0.0"/>
  </requires>
  <extension point="xbmc.service" library="service.py"/>
  <extension point="xbmc.addon.metadata">
    <summary lang="en_GB">Tells your Loopz account when you finish an episode or a movie on Kodi</summary>
    <summary lang="ar_SA">يُخبر حسابك في Loopz حين تُنهي حلقةً أو فيلماً على Kodi</summary>
    <description lang="en_GB">When an episode or a movie passes 90% on Kodi, your Loopz account hears about it: Loopz asks you on Home whether you watched it, or adds it to your library straight away if you turned on auto-tracking. Link it with the 6-digit code from Loopz: Linking, Kodi.</description>
    <description lang="ar_SA">حين تتجاوز 90% من حلقةٍ أو فيلم على Kodi يصل الخبر إلى حسابك في Loopz: يسألك في الرئيسية «شفتها؟»، أو يضيفها إلى مكتبتك مباشرةً إن فعّلت التتبّع التلقائي. اربطها بالرمز من ستة أرقام من Loopz: الربط، Kodi.</description>
    <platform>all</platform>
    <license>GPL-2.0-or-later</license>
    <website>https://loopztv.com</website>
    <source>https://github.com/mccicc2-art/meshahed/blob/main/src/lib/kodiAddon.ts</source>
    <news>v1.0.5: the Loopz logo as the add-on icon and on its notifications.&#10;v1.0.4: background art (fanart) for the add-on page.&#10;v1.0.3: the description and the link-code hint match Loopz today (auto-tracking, the Linking page).&#10;v1.0.2: Kodi reports a title the moment it passes 90%, so leaving or closing Kodi afterwards no longer matters.&#10;v1.0.1: linking moved to the Linking page in Loopz; one Kodi link is free.</news>
    <assets>
      <icon>icon.png</icon>
      <fanart>fanart.jpg</fanart>
    </assets>
  </extension>
</addon>
`;

const SETTINGS_XML = String.raw`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<settings>
  <category label="30000">
    <setting type="lsep" label="30002"/>
    <setting id="code" type="text" label="30001" default=""/>
    <setting id="status" type="text" label="30003" default="" enable="false"/>
  </category>
</settings>
`;

const STRINGS_EN = String.raw`# Kodi Media Center language file
# Addon Name: Loopz
# Addon id: service.loopz
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: en_GB\n"

msgctxt "#30000"
msgid "Loopz"
msgstr ""

msgctxt "#30001"
msgid "Link code"
msgstr ""

msgctxt "#30002"
msgid "Type the 6-digit code from Loopz: Linking, Kodi"
msgstr ""

msgctxt "#30003"
msgid "Status"
msgstr ""

msgctxt "#30010"
msgid "Linked to Loopz"
msgstr ""

msgctxt "#30011"
msgid "Not linked"
msgstr ""

msgctxt "#30012"
msgid "The code is wrong or expired. Get a new one in Loopz"
msgstr ""

msgctxt "#30013"
msgid "Couldn't reach Loopz. Check the internet and type the code again"
msgstr ""

msgctxt "#30014"
msgid "Too many tries. Wait a minute"
msgstr ""

`;

const STRINGS_AR = String.raw`# Kodi Media Center language file
# Addon Name: Loopz
# Addon id: service.loopz
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Language: ar_SA\n"

msgctxt "#30000"
msgid "Loopz"
msgstr "Loopz"

msgctxt "#30001"
msgid "Link code"
msgstr "رمز الربط"

msgctxt "#30002"
msgid "Type the 6-digit code from Loopz: Linking, Kodi"
msgstr "اكتب الرمز من ستة أرقام من Loopz: الربط، Kodi"

msgctxt "#30003"
msgid "Status"
msgstr "الحالة"

msgctxt "#30010"
msgid "Linked to Loopz"
msgstr "مربوط بـ Loopz"

msgctxt "#30011"
msgid "Not linked"
msgstr "غير مربوط"

msgctxt "#30012"
msgid "The code is wrong or expired. Get a new one in Loopz"
msgstr "الرمز خطأ أو انتهى. خذ رمزاً جديداً من Loopz"

msgctxt "#30013"
msgid "Couldn't reach Loopz. Check the internet and type the code again"
msgstr "تعذّر الوصول إلى Loopz. تأكد من الإنترنت واكتب الرمز مرة ثانية"

msgctxt "#30014"
msgid "Too many tries. Wait a minute"
msgstr "محاولات كثيرة. انتظر دقيقة"

`;

/* 🆕 T359 — **مدخلٌ قصيرٌ والمنطقُ في `resources/lib/loopz.py`**: أداةُ فحص مستودع Kodi (`kodi-addon-checker`) تنبّه على مدخلٍ يزيد على
   خمسة عشر سطراً، والمراجعون يطلبون نقلَه — فالسلوكُ نفسُه حرفاً، والمدخلُ يستدعيه فقط. */
const ENTRY_PY = String.raw`# -*- coding: utf-8 -*-
from resources.lib.loopz import main

main()
`;

const LIB_PY = String.raw`# -*- coding: utf-8 -*-
"""
Loopz for Kodi.

When an episode or a movie finishes here, Loopz asks the member "did you watch it?".
Nothing is marked watched from Kodi: the answer is given in the app.

Linking: the app shows a 6-digit code; the member types it in this add-on's
settings, and the add-on exchanges it for its own private link.
"""
import json
import os
import threading
import urllib.error
import urllib.request

import xbmc
import xbmcaddon
import xbmcgui
import xbmcvfs

ADDON_ID = "service.loopz"
PAIR_URL = "https://loopztv.com/api/v1/home-server/kodi/pair"
FINISHED_AT = 0.9  # the same 90% Plex uses
MIN_LENGTH = 120  # trailers and samples are not watches

S_LINKED = 30010
S_NOT_LINKED = 30011
S_BAD_CODE = 30012
S_OFFLINE = 30013
S_BUSY = 30014


def addon():
    # a fresh instance reads the settings as they are now
    return xbmcaddon.Addon(ADDON_ID)


def tr(string_id):
    return addon().getLocalizedString(string_id)


def log(msg):
    xbmc.log("[%s] %s" % (ADDON_ID, msg), xbmc.LOGDEBUG)


def notify(string_id, error=False):
    # the add-on's own icon (the Loopz logo) on confirmations; errors keep Kodi's red icon so they read as errors
    icon = xbmcgui.NOTIFICATION_ERROR if error else addon().getAddonInfo("icon")
    xbmcgui.Dialog().notification("Loopz", tr(string_id), icon, 5000)


def version():
    return addon().getAddonInfo("version")


def link_file():
    folder = xbmcvfs.translatePath("special://profile/addon_data/%s" % ADDON_ID)
    return os.path.join(folder, "link.json")


def read_link():
    try:
        with open(link_file(), "r", encoding="utf-8") as f:
            url = json.load(f).get("webhook_url", "")
    except (OSError, ValueError, AttributeError):
        return ""
    return url if isinstance(url, str) and url.startswith("https://") else ""


def write_link(url):
    path = link_file()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"webhook_url": url}, f)


def show_status():
    addon().setSetting("status", tr(S_LINKED if read_link() else S_NOT_LINKED))


def post(url, payload):
    """POST JSON -> (status, body). Network failure -> (0, {})."""
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "Loopz-Kodi/%s" % version()},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode("utf-8")
            status = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        status = e.code
    except (urllib.error.URLError, OSError, ValueError) as e:
        log("network: %s" % e)
        return 0, {}
    try:
        body = json.loads(raw or "{}")
    except ValueError:
        body = {}
    return status, body if isinstance(body, dict) else {}


# ---------------------------------------------------------------- linking

_pairing = threading.Lock()


def pair_from_settings():
    code = "".join(ch for ch in addon().getSetting("code") if ch.isdigit())
    if not code:
        return
    if not _pairing.acquire(blocking=False):
        return
    try:
        # the code is used once: clear it before anything else
        addon().setSetting("code", "")
        if len(code) != 6:
            notify(S_BAD_CODE, error=True)
            return
        device = xbmc.getInfoLabel("System.FriendlyName") or "Kodi"
        status, body = post(PAIR_URL, {"code": code, "device": device})
        url = body.get("webhook_url") if status == 200 and body.get("ok") else None
        if isinstance(url, str) and url.startswith("https://"):
            write_link(url)
            notify(S_LINKED)
        elif status == 0:
            notify(S_OFFLINE, error=True)
        elif status == 429:
            notify(S_BUSY, error=True)
        else:
            notify(S_BAD_CODE, error=True)
        show_status()
    finally:
        _pairing.release()


# ---------------------------------------------------------------- what is playing

def rpc(method, params):
    req = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    try:
        res = json.loads(xbmc.executeJSONRPC(json.dumps(req)))
    except ValueError:
        return {}
    out = res.get("result") if isinstance(res, dict) else None
    return out if isinstance(out, dict) else {}


def ids_of(uniqueid):
    """Kodi "uniqueid" {"tmdb": "1396", "imdb": "tt0903747", "tvdb": "81189"} -> what Loopz reads."""
    out = {}
    if not isinstance(uniqueid, dict):
        return out
    for key in ("tmdb", "tvdb"):
        v = str(uniqueid.get(key) or "").strip()
        if v.isdigit() and int(v) > 0:
            out[key] = int(v)
    imdb = str(uniqueid.get("imdb") or "").strip()
    if imdb.startswith("tt") and imdb[2:].isdigit():
        out["imdb"] = imdb
    return out


def tag_ids(tag):
    """Items from streaming add-ons are not in the library: read what they set on the tag."""
    raw = {}
    for key in ("tmdb", "imdb", "tvdb"):
        try:
            raw[key] = tag.getUniqueID(key)
        except (AttributeError, RuntimeError):
            pass
    if not raw.get("imdb"):
        try:
            raw["imdb"] = tag.getIMDBNumber()
        except (AttributeError, RuntimeError):
            pass
    return ids_of(raw)


def describe(tag):
    """The finished item as Loopz reads it, or None for what is not an episode or a movie."""
    kind = tag.getMediaType()
    dbid = tag.getDbId()
    if kind == "movie":
        item = {"type": "movie", "title": tag.getTitle(), "year": tag.getYear() or None, "ids": tag_ids(tag)}
        if dbid and dbid > 0:
            d = rpc("VideoLibrary.GetMovieDetails", {"movieid": dbid, "properties": ["uniqueid", "year", "title"]})
            d = d.get("moviedetails") or {}
            item["ids"] = ids_of(d.get("uniqueid")) or item["ids"]
            item["title"] = d.get("title") or item["title"]
            item["year"] = d.get("year") or item["year"]
        return item if item["title"] or item["ids"] else None
    if kind != "episode":
        return None
    item = {
        "type": "episode",
        "title": tag.getTVShowTitle(),
        "season": tag.getSeason(),
        "episode": tag.getEpisode(),
        "ids": tag_ids(tag),
    }
    if dbid and dbid > 0:
        d = rpc(
            "VideoLibrary.GetEpisodeDetails",
            {"episodeid": dbid, "properties": ["tvshowid", "season", "episode", "showtitle", "uniqueid"]},
        )
        d = d.get("episodedetails") or {}
        item["ids"] = ids_of(d.get("uniqueid")) or item["ids"]
        item["title"] = d.get("showtitle") or item["title"]
        if isinstance(d.get("season"), int):
            item["season"] = d["season"]
        if isinstance(d.get("episode"), int):
            item["episode"] = d["episode"]
        show_id = d.get("tvshowid")
        if isinstance(show_id, int) and show_id > 0:
            s = rpc("VideoLibrary.GetTVShowDetails", {"tvshowid": show_id, "properties": ["uniqueid"]})
            show = ids_of((s.get("tvshowdetails") or {}).get("uniqueid"))
            if show:
                item["show"] = show
    if not isinstance(item["season"], int) or item["season"] < 0:
        return None
    if not isinstance(item["episode"], int) or item["episode"] < 1:
        return None
    return item


def send(item):
    url = read_link()
    if not url:
        return
    payload = dict(item, server="kodi", event="finished")
    for attempt in range(2):
        status, _ = post(url, payload)
        if status:
            return
        if attempt == 0:
            xbmc.Monitor().waitForAbort(30)
    log("could not reach Loopz")


class Player(xbmc.Player):
    def __init__(self):
        super().__init__()
        self.item = None
        self.pos = 0.0
        self.total = 0.0

    def onAVStarted(self):
        self.finish()  # a playlist moving on: the previous item ended here
        if not self.isPlayingVideo() or not read_link():
            return
        try:
            self.item = describe(self.getVideoInfoTag())
        except RuntimeError as e:
            log("describe: %s" % e)
            self.item = None
        self.pos, self.total = 0.0, 0.0

    def tick(self):
        if self.item is None:
            return
        try:
            if self.isPlayingVideo():
                self.pos, self.total = self.getTime(), self.getTotalTime()
        except RuntimeError:
            return
        # past 90% counts now, while it still plays: Back only hides the video, and quitting Kodi may not
        # leave time to send — finish() clears the item, so it is sent once
        if self.total >= MIN_LENGTH and self.pos / self.total >= FINISHED_AT:
            self.finish()

    def finish(self):
        item, pos, total = self.item, self.pos, self.total
        self.item = None
        # the last position seen decides, ended or stopped: 90% and a real length
        if item is None or total < MIN_LENGTH or pos / total < FINISHED_AT:
            return
        threading.Thread(target=send, args=(item,), daemon=True).start()

    def onPlayBackEnded(self):
        self.finish()

    def onPlayBackStopped(self):
        self.finish()

    def onPlayBackError(self):
        self.item = None


class Monitor(xbmc.Monitor):
    def onSettingsChanged(self):
        threading.Thread(target=pair_from_settings, daemon=True).start()


def main():
    monitor = Monitor()
    player = Player()
    show_status()
    pair_from_settings()  # a code typed while Kodi was closing
    while not monitor.abortRequested():
        if monitor.waitForAbort(1):
            break
        player.tick()
`;

/** أيقونةُ التطبيق نفسُها — شعارُ اللانهاية (`apps/mobile/assets/icon.png` مصغّرةً إلى 512، وهي `public/icon-512.png` منذ T382).
 *  🆕 T382 — كانت هنا «Loopz» كلمةً على أسود: `public/icon-512.png` القديمة، لا أيقونةُ التطبيق (أحمد ١٤ نوفمبر: «جاء شعار لوبز ككتابة»). */
const ICON_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAABMDklEQVR42u3dZ1xUZ9438OlzhplhGIqIKNKxoohdLNiw7ppkU0w0to0laixx46Zsommb9TbGTowYS4z3pmwWYwV7FxWlqoAoIr3XKWfa8+L/yXm4" +
  "NTFGYeYw/r4v9uMmRoe5Zq7fdf5XE6rVagEAADx9RHgLAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAA" +
  "AAAAAQAAAAgAAABAAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAEAAAAAA" +
  "AgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAA" +
  "AAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABA" +
  "AAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAA" +
  "AEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAI" +
  "AAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAADASxK8BSAQCIRCoVAo5P6vzWbj/hecoHHv+wWaGBAAT2Mv0LSjFwqF9P23Wq02m43+l/s9" +
  "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" +
  "mZmVlXXnzp28vDw691gmk9HqVfQLzdKs1LI2m81kMnGbAf38/EJDQzt16hQaGhocHNy1a1eNRtNcOzqNRmNDQ0NeXl52dnZWVlZ6evqtW7dycnJoswK1L33SEO0IAODj4FEoFFKJgGVZi8WiUChcXV3d3d09PT2D" +
  "g4P9/Pzc3Nx8fHw6dOigUqmkUimN5rihn8ViMZlMVqvVZDKxLGs0GktLS/Pz8ysrKysqKjIzM0tLSysrK2tra+mxQyaT0U5XlIDtUB2ik1NZlrXZbHK5XKPReHp6uru7d+zY0d/f38PDw9PTk/6JUqmUSCS0z44K" +
  "hpQoFouFPhssy9IfVVJSkpubW15eXlxcnJ2dXVVVVV1dXVNTQwtVqb5P7YtcRwBAa0oC+t6azWaz2UyFWuoLRCIRwzAMw8jlcqVS6eLiQifzUFXHYDDQciPuF/Tf0vdfLBZLJBIqQdiawHtut8cC7snAbDabTKam" +
  "C8BEIpFYLOYaV6VSqdVqWq9JxzNQ19/Y2NjY2EiLUBsbG6l9uf1cYrH4vk4f7YsAgFbfazQt9NNTfNPvNv2iae2YOpSm04zo8fnZslzDca3DTcw+2FJNm5hr3/v+c7Tv00CCt0DwdNy48qu9wO8uIKH/CoWd1tWy" +
  "3K6RX50HfnCSH9V8BAA8pfeRYaCHxoWnlghvAQAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAA" +
  "AAABAAAACAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAAAIAAAAQAAAAAAC" +
  "AAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAA" +
  "AAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAAQAAAAgAAABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAA" +
  "AAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAQAAAAgAAAAAAEAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAA" +
  "QAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgAAABAAAAAIAAAAAABAAAACAAAAEAAAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAEAAAAIAAAAAABAAAACAAAAAAAQAAAAgA" +
  "AABAAAAAAAIAAAAQAAAAgAAAAAAEAAAAAgAAABAAAACAAAAAAAQAAAAgAAAAAAEAAAAIAAAAQAAAAAACAAAAeOn/ASKlroSJfhyGAAAAAElFTkSuQmCC";

/* `crc32` في `node:zlib` أحدثُ من نسخ Node كلِّها — والجدولُ سطران */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ============================================================
 * ملفٌّ مضغوطٌ بلا ضغط (stored) — Kodi يقرؤه، ولا حاجةَ لمكتبة
 * ============================================================ */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  /* التاريخُ ثابتٌ (يوم الإصدار): الملفُّ نفسُه بايتاً ببايت في كلِّ بناء */
  const time = 0;
  const date = ((2026 - 1980) << 9) | (11 << 5) | 5;
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const dir = f.name.endsWith("/");
    const crc = dir ? 0 : crc32(f.data) >>> 0;
    const size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // الأسماءُ UTF-8
    lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    local.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, (3 << 8) | 20, true); // صُنع على يونكس — الصلاحياتُ تُقرأ
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(38, (dir ? 0o40755 : 0o100644) * 0x10000 + (dir ? 0x10 : 0), true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

let cached: Uint8Array | null = null;

/** الملفُّ الذي يثبّته Kodi («Install from zip file»): مجلّدُ الإضافة باسمها في رأسه، كما يشترط Kodi */
export function kodiAddonZip(): Uint8Array {
  if (cached) return cached;
  const enc = new TextEncoder();
  const root = `${KODI_ADDON_ID}/`;
  const text = (name: string, s: string) => ({ name: root + name, data: enc.encode(s) });
  const dir = (name: string) => ({ name: root + name, data: new Uint8Array(0) });
  cached = zip([
    dir(""),
    text("addon.xml", ADDON_XML),
    /* 🆕 T359 — يشترطه مستودعُ Kodi الرسميّ، وبه يعرف من يثبّت الملفَّ من موقعنا رخصتَه أيضاً */
    text("LICENSE.txt", KODI_LICENSE_TXT),
    text("service.py", ENTRY_PY),
    { name: `${root}icon.png`, data: new Uint8Array(Buffer.from(ICON_PNG_B64, "base64")) },
    { name: `${root}fanart.jpg`, data: new Uint8Array(Buffer.from(KODI_FANART_JPG_B64, "base64")) },
    dir("resources/"),
    text("resources/settings.xml", SETTINGS_XML),
    dir("resources/lib/"),
    text("resources/lib/loopz.py", LIB_PY),
    dir("resources/language/"),
    dir("resources/language/resource.language.en_gb/"),
    text("resources/language/resource.language.en_gb/strings.po", STRINGS_EN),
    dir("resources/language/resource.language.ar_sa/"),
    text("resources/language/resource.language.ar_sa/strings.po", STRINGS_AR),
  ]);
  return cached;
}

/**
 * قائمةُ المصدر كما يقرؤها Kodi (فهرسُ مجلّدٍ على طريقة Apache): Kodi يقبل الرابطَ إذا **طابق نصُّه عنوانَه**، ويبنيه على
 * رابط المصدر نفسِه — فالعنوانُ نسبيٌّ واسمُ الملفّ هو النصّ.
 */
export function kodiIndexHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Index of /api/v1/kodi/</title></head>
<body><h1>Index of /api/v1/kodi/</h1><pre>
<a href="${KODI_ZIP_NAME}">${KODI_ZIP_NAME}</a>
</pre></body></html>
`;
}
