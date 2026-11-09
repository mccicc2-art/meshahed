import "server-only";
import { KODI_LICENSE_TXT } from "./kodiAddonLicense";

/**
 * ====== 🆕 إضافةُ Kodi — `service.loopz` (هجرة ٢٣٦؛ أحمد ٥ نوفمبر: «١ أ · ٢ أ · ٣ أ»، والرمزُ داخل التبويب «أ») ======
 *
 * 🔑 **الإضافةُ هنا نصّاً، والملفُّ المضغوط يُبنى منها عند الطلب** (`/api/v1/kodi/service.loopz-<version>.zip`): مصدرٌ واحدٌ
 * يُراجَع في المستودع، لا ملفٌّ ثنائيٌّ يُرفع بجانبه فيختلفان.
 * ⚖️ **تحت `/api/v1/` لا `/kodi`**: جدارُ Vercel يتحدّى كلَّ عميلٍ غير متصفّح خارج هذه السابقة (D-945) — وKodi عميلٌ غيرُ متصفّح،
 * فقائمةُ المصدر والملفُّ ونداءا الربط والإرسال كلُّها هنا.
 * ⚖️ **ما تفعله الإضافة**: ترى ما يُشغَّل (المكتبةُ عبر JSON-RPC، وإضافاتُ البثّ عبر وسم الفيديو)، وحين تبلغ ٩٠٪ — كـPlex —
 * ترسل «انتهى» إلى رابطها. **ولا تعلّم شيئاً**: السؤالُ «شفتها؟» في الرئيسيّة («٢ أ» في سيرفرات البيت).
 * ⚖️ **والربطُ بستّة أرقام** يُكتب في إعداداتها بريموت التلفزيون — الرابطُ الطويل لا يُكتب هناك.
 * 📌 بايثون ٣ (Kodi 19 فما بعد). وإصدارٌ جديدٌ = رقمٌ جديد هنا وفي `addon.xml` (Kodi يقارن الرقم).
 * 🆕 T359 — **جاهزةٌ لمستودع Kodi الرسميّ** (أذنت مؤسّسةُ Kodi بشعارها ٩ نوفمبر واقترحت المستودع): رخصةٌ مفتوحة (`kodiAddonLicense.ts`)،
 * وسجلٌّ بمستوى التصحيح وحدَه (قاعدتُهم)، ونصوصٌ مترجمةٌ كلُّها، ولا ذكرَ لخطّةٍ مدفوعة — ربطُ جهازٍ واحدٍ مجّانيّ (D-1640).
 */

export const KODI_ADDON_ID = "service.loopz";
export const KODI_ADDON_VERSION = "1.0.1";
export const KODI_ZIP_NAME = `${KODI_ADDON_ID}-${KODI_ADDON_VERSION}.zip`;

const ADDON_XML = String.raw`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<addon id="service.loopz" name="Loopz" version="1.0.1" provider-name="Loopz">
  <requires>
    <import addon="xbmc.python" version="3.0.0"/>
  </requires>
  <extension point="xbmc.service" library="service.py"/>
  <extension point="xbmc.addon.metadata">
    <summary lang="en_GB">Loopz asks "watched it?" when you finish an episode or a movie on Kodi</summary>
    <summary lang="ar_SA">يسألك Loopz «شفتها؟» لما تخلّص حلقة أو فيلم على Kodi</summary>
    <description lang="en_GB">When an episode or a movie reaches 90% on Kodi, Loopz asks you on Home whether you watched it. Nothing is marked without your answer. Link it with the 6-digit code from Loopz: Linking, Kodi.</description>
    <description lang="ar_SA">لما تكمل 90% من حلقة أو فيلم على Kodi، يسألك Loopz في الرئيسية: شفتها؟ ما نعلّم شيئاً بدون جوابك. اربطها بالرمز من ستة أرقام من Loopz: الربط، Kodi.</description>
    <platform>all</platform>
    <license>GPL-2.0-or-later</license>
    <website>https://loopztv.com</website>
    <source>https://github.com/mccicc2-art/meshahed/blob/main/src/lib/kodiAddon.ts</source>
    <news>v1.0.1: linking moved to the Linking page in Loopz; one Kodi link is free.</news>
    <assets>
      <icon>icon.png</icon>
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
msgid "Type the 6-digit code from Loopz: Settings, Home servers, Kodi"
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
msgid "Type the 6-digit code from Loopz: Settings, Home servers, Kodi"
msgstr "اكتب الرمز من ستة أرقام من Loopz: الإعدادات، سيرفرات البيت، Kodi"

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
    icon = xbmcgui.NOTIFICATION_ERROR if error else xbmcgui.NOTIFICATION_INFO
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
            pass

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

/** أيقونةُ التطبيق نفسُها (`public/icon-512.png`) */
const ICON_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAgPUlEQVR4nO3de7SVdZ348c8BuRwEIUgnTUQFvORCEiMZzQtZeV1yMVjmVJAZrbySqYWlNjMq" +
  "5Bqz8VbokIwzo2iIOTLVIIlrBBRxUsI8OKmp4GRIKgx0AJHz+2MWLf0NcC7s/Tz7nM/r9a/7PN9vnzh7v8/ez36eul69ejUFAJBKp7I3AAAUTwAAQEICAAAS" +
  "EgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEA" +
  "AAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQ" +
  "AACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAA" +
  "SEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQE" +
  "AAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABA" +
  "QgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQA" +
  "ACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAAS" +
  "EgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEA" +
  "AAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQ" +
  "AACAhHYrewNlmzJlSmFr3XjjjbFx48bC1gOAHanr1atXU9mbKNO6desKW6t///6xdu3awtYDgB3xEQAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAA" +
  "gIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAQAl222236NatW9nbILHdyt4AefTr1y+GDh0aBx98cBx44IExYMCA2HPPPeODH/xg9O7d" +
  "O7p16xZdu3aNiIjNmzfHpk2bYu3atbFmzZp444034pVXXokXX3wx/uu//iueeeaZePPNN0v+X1Q7zLY2HXjggXHUUUfFoYceGoceemgMHDgwevfuHT179oz6" +
  "+vqIiGhqaor169fH66+/HqtWrYqGhoZYvnx5LFq0KF5++eVy/wfQodX16tWrqexNlGndunWFrdW/f/9Yu3ZtYeuV7UMf+lCMHDkyRo4cGcccc0z079+/osdf" +
  "uXJlLFq0KBYsWBCPPPJI/OEPf6jo8WuZ2dbu7+7hhx8eZ555Zpx66qlx8MEH79K6K1eujH/913+N+++/P5566qldOlZbFDnjWrHHHnuUvYXCCIAafRJpr/r2" +
  "7Rvjxo2LsWPHxogRI6Kurq6Qdbdu3RpPPPFEzJkzJ37yk5/EW2+9Vci6RTLb96u1392RI0fG5MmTY+TIkVXZw/Lly2P69Olxzz33xDvvvFOVNf5/AqBjEwA1" +
  "9iTSXg0bNizOO++8GDVqVOmfa27cuDF++tOfxm233RbPPPNMqXupBLPdvlr53R00aFDcdNNN8YlPfKKQvbz66qsxderUuPvuu6OpqbpP3wKgYxMANfIk0l6N" +
  "GDEivvWtb8UnP/nJsreyXfPnz49p06bFk08+WfZWWs1sd67s393OnTvHJZdcEpdffnkpYbZ06dKYPHlyLF++vGprCICOzbcAaJP9998//umf/inmzZtXsy9Q" +
  "ERGf+tSnYv78+TFz5szYb7/9yt5Oi5ht7evZs2fce++9ceWVV5b2rszw4cNjwYIFcfHFFxf2cRAdiwCgVTp37hyTJ0+OJ598MkaNGlX2dlps7NixsXTp0rjw" +
  "wgujU6fa/Gdvtu3DvvvuG/Pnz4/PfOYzZW8lunbtGn/7t38bs2bNip49e5a9HdoZHwH4CKDFBgwYEDNnzowjjzyy7K3skqVLl8aXvvSlePXVV8veyp+ZbeuV" +
  "8bvbt2/fmDdvXhx00EGFrd1SDQ0NMXr06Pj9739fsWP6CKBj6/i5TkWccsopsXDhwnb/AhXxv2+dLly4ME4++eSytxIRZtte1NfXx09+8pOafPGPiDj00ENj" +
  "3rx5MWDAgLK3QjshAGjW+eefH7NmzYrevXuXvZWK6dOnT8yaNSvOO++8Uvdhtu3H9ddfH8OHDy97Gzs1YMCAeOihh+Iv/uIvyt4K7YAAYKeuvfbamDp1aoc8" +
  "yahTp04xbdq0uOaaa0pZ32zbj09/+tMxYcKEsrfRIvvvv3/MmTMnevToUfZWqHECgB269tpr48ILLyx7G1V30UUXFf5CZbbtyw033FD2FlplyJAhceutt5a9" +
  "DWqcAGC7pkyZkuIFapuLLroovvnNbxayltm2Px/4wAfK3kKrnXnmmTFp0qSyt0EN8y0A3wL4P8aNGxczZswoexulOOecc2L27NlVO77ZVm62Gc9Qb63GxsY4" +
  "5phj4oUXXmjTz2ecsW8BkNbQoUPjtttuK3sbpbntttvi8MMPr8qxzbZ6s2X76uvr45Zbbil7G9QoAcCf7b777jFz5szSrzdfpu7du8fMmTNj9913r+hxzbZ6" +
  "s2Xnjj766Bg/fnzZ26AGCQD+bNq0aTFw4MCyt1G6QYMGxdSpUyt6TLP9X9WYLc37m7/5m+jevXvZ26DGCAAiIuLYY4+NL37xi2Vvo2ZMmDChYnd3M9v3q+Rs" +
  "aZl99tknzjnnnLK3QY1xEqCTAGO33XaLJUuWxODBg8veSk357W9/G0cddVRs2bKlzccw2+2rxGwznqC2K1avXh2HHXZYbNq0qcU/k3HGTgIklXPOOccL1HYM" +
  "Hjw4Jk6cuEvHMNvtq8RsaZ299torPvvZz5a9DWqIdwCSvwNQX18fzz77bOy5555lb6UmrV69OoYMGRKNjY2t/lmz3bldmW1Ezr9Od9Wvf/3rVn38knHG3gEg" +
  "jS984QteoHZir732is9//vNt+lmz3bldmS1tc/jhh8eQIUPK3gY1QgAk1qlTp7jgggvK3kbNO//881t9n3uzbZm2zJZdc9ZZZ5W9hZp1xRVXlL2FQu1W9gYo" +
  "z8iRI2P//fcvdQ8rVqyIBx98MJ544ol48cUX4+23345OnTpF375946CDDopjjjkmxowZE/vuu29pezzwwAPj+OOPjwULFrT4Z8y2Zdoy21q0fv36+OlPfxqP" +
  "PPJIPPvss7Fq1apobGyM7t27xz777BOHHXZYnHDCCTFmzJjSLys8atSo+Pa3v92ix5bxdviwYcPi3/7t3wq/XsQ111yT7qJJzgFIfA7Aj3/849JOClq2bFlc" +
  "ddVVLXrir6urizFjxsTVV18dBxxwQAG7+7/uu+++OPfcc1v8eLNtudbOdpta+Hx6w4YN8Xd/93fxox/9KDZs2NDs47t16xYTJkyIK664Ivr27VvADrfvqKOO" +
  "ioaGhtLW35HBgwfHvHnzol+/foWu+/3vfz+++93vFrpmLRAASQOgvr4+Xn755aivry987RtuuCGuvfbaVn8FrL6+Pq6//vpSbsva2NgYAwYMiI0bNzb7WLNt" +
  "ndbM9r3KDoCnnnoqJkyYECtXrmz1z+65555x++23x4knnliFnTXvO9/5Ttx0002lrL0jH/7wh+Phhx8u/B2p6dOnx2WXXVbomrXCh29JHXfccYW/QDU1NcUF" +
  "F1wQf/3Xf92m7383NjbGhRdeGFdffXUVdrdz9fX1ceyxx7bosWbbOq2Zba2YO3dunHLKKW168Y+IeOONN+LMM8+MmTNnVnZjLXT00UeXsu6OfOADH4gHHnig" +
  "8Bf/u+66Ky6//PJC16wlAiCpz3zmM4Wvec0118Rdd921y8e58cYbS7mpzkknndSix5lt67V0trVg0aJFMWHChFZdUGd7tm7dGhdffHE8+OCDFdpZy40YMaLw" +
  "NXekR48eMXv27DjkkEMKXXf27Nlx0UUXRVNT3jfBBUBSRf/FtXjx4rjhhhsqdryrrroqli1bVrHjtURLvz9ttq3XXi4N/Oabb8a5554b77zzTkWO19TUFOef" +
  "f3688sorFTleS/Xt2zf69+9f6Jrb06VLl/iXf/mXGD58eKHrzp07NyZNmhRbt24tdN1aIwAS6tWrVxx00EGFrbdly5b46le/WtFfts2bN8ekSZMKrfdDDjkk" +
  "evbsudPHmG3btGS2tWDy5Mnx2muvVfSY69ata9NJkLvqIx/5SOFrvlddXV1Mnz698PMg5s+fHxMnTtyly1B3FAIgoWHDhhX63euHHnqoKn/hNDQ0xLx58yp+" +
  "3B3p1KlTHHHEETt9jNm2TUtmW7aGhoaqvV2/ZMmS+I//+I+qHHtHyg6A66+/vvBvyjz22GPxV3/1V7F58+ZC161VAiChgw8+uND1br/99qodu+jPq5ubndm2" +
  "XdGza61bb721qu+K3HzzzVU79vbst99+ha73Xt/85jfjq1/9aqFrLl26NMaPH9/mS093RAIgoUGDBhW21uuvvx6LFi2q2vEXLFgQa9asqdrx/3/Nzc5s267I" +
  "2bVWY2Nj3HfffVVdY968ebF69eqqrvFeZQXAl7/85RZfiKhSli1bFmPHjm3RtRoyEQAJFXmFuqVLl1Z9jaeeeqrqa2zT3OzMtu3KvnLizvznf/5nq69T0FpN" +
  "TU3xxBNPVHWN99p7770LW2ub0aNHV/SE1ZZYsWJFjB49umauwVJLBEBCe+21V2FrFfEi9eSTT1Z9jW2am53Ztl2Rs2utxx9/vJB1igyAoi9JfMIJJ8Q//MM/" +
  "FHqOzEsvvRRnnHFG/PGPfyxszfZEACRU5B3qfvOb31R9jeXLl1d9jW2am53Ztl0t3znxV7/6VSHrPPPMM4WsExGFXor4iCOOiLvvvju6du1a2JqrVq2K008/" +
  "PV5//fXC1mxvBEBCRd7g46233uoQa2zT3OzMtu1q+T7sRZ0LUeRfqvX19VFXV1f1dQYNGhT3339/oV/zfP311+P000+PVatWFbZmeyQAEiqywt9+++0OscY2" +
  "3bt33+l/N9u2a262ZSoqhIoMrojq/3vdZ5994sEHH4wPfvCDVV3nvf74xz/GGWecES+99FJha7ZXAiChbt26FbZWESfeFPki1dwTptm2XZHx1FpFzaHoAOjS" +
  "pUvVjt2nT5944IEHCr3i4Nq1a2PUqFGxYsWKwtZszwRAQkVe4a2IE346d+5c9TW2aW52Ztt2tXxN9qJOXCty3hHVm3l9fX3Mnj07Dj300Kocf3s2bNgQY8eO" +
  "jV//+teFrdneCYCEirwKVhGf6/bp06fqa2zT3OzMtu1q+epsRZ0xX+SJeRFRsXsavFeXLl3in//5n+PjH/94xY+9I42NjTFu3LhCvhnTkQiAhHb1LmatUcSL" +
  "VO/evau+xjbNzc5s267I2bVWUSFU9FfzKh1ddXV18cMf/jA+/elPV/S4O7N58+Y4++yzY+HChYWt2VEIgITWrVtX2FpFPKH169ev6mts09xnwWbbdkWeb9Ba" +
  "RV2joMhrIaxfv77ix5w2bVqMHz++4sfdkS1btsTEiRPjl7/8ZWFrdiQCIKE33nijsLUOO+ywqq8xdOjQqq+xTXOXajXbtivyMrit9bGPfayQdYp827zSJxxe" +
  "dtll8bWvfa2ix9yZrVu3xqRJk2Lu3LmFrdnRCICEinyiPfLII6u+xlFHHVX1NbZpbnZm23a1HAAjRowoZJ2//Mu/LGSdiIg333yzYseaOHFiXHnllRU7XnOa" +
  "mprioosuitmzZxe2ZkckABKqxu1jd6Tafzl17ty5kBfCbX73u9/t9L+bbds1N9syHXHEEdGjR4+qrlFfXx/Dhw+v6hrvVamL5Jxxxhnxgx/8oCLHaqnLL788" +
  "7rrrrkLX7IgEQEIvvPBCYWvtu+++MWzYsKod/7TTTiv0CnK//e1vd/rfzbbtmpttmbp27Rqf//znq7rG5z73udh9992rusZ7rVy5cpePcdxxx8WMGTMKvb7/" +
  "1VdfHdOnTy9svY5MACT0/PPPF7reOeecU7VjF31P8eYuMGK2bVfrF2/52te+VrVL59bV1cV5551XlWPvyMsvv7xLPz906NCYNWtWoRe/mjZtWtx4442FrdfR" +
  "CYCEnn766UIvuvLZz362KmeTDxs2LI499tiKH3dHtmzZ0uxFRsy2bVoy27INHDiwame4jx8/Pg466KCqHHtHGhoa2vyzAwcOjDlz5hR6ff9bbrklrrvuusLW" +
  "y0AAJLRu3bpC327t0aNHfP/736/oMevr6+OOO+6o6DGb8+yzz0ZjY+NOH2O2bdOS2daCG264IQYMGFDRY+6///4V//+wJdp6N8m99947HnzwwULv3jhjxoy4" +
  "4oorClsvCwGQVNEXzRgzZkyMGzeuYse7/vrrY/DgwRU7Xks89thjLXqc2bZeS2dbtj322CPuvPPOit24qHv37nHnnXdGr169KnK8lnrttdfa9K2LPn36xJw5" +
  "c2K//farwq6275577olLLrmksPUyEQBJzZ8/v/A1b7nlloq8rXzVVVfFhAkTKrCj1vn3f//3Fj3ObFuvpbOtBR/72Mfinnvu2eVvBfTo0SPuvffeQr9psc3j" +
  "jz/e6p+pr6+P++67r5DrT2zzwAMPxHnnnVfT94lozwRAUo8++mjhl16tr6+POXPmxNlnn92mn+/Zs2fMmDEjLr300grvrHlr165t8ZOm2bZOa2ZbK0488cR4" +
  "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" +
  "+93voqGhIZYtW5b2yWl7Ms62VgPgvfbee+/4+Mc/Hh/5yEfikEMOiYEDB0bv3r2jV69e0bNnz+jcuXNs2rQp1q1bF3/4wx9i5cqV0dDQEMuXL4/Fixe7hTRV" +
  "JQCAdqk9BADUMicBAkBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABIS" +
  "AACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASquvVq1dT2ZsAAIrlHQAASEgAAEBC" +
  "AgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAA" +
  "ICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABIS" +
  "AACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAA" +
  "CQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAA" +
  "AICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABI" +
  "SAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQA" +
  "ACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAAICEBAAAJCQAASEgAAEBC" +
  "AgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABISAACQkAAAgIQEAAAkJAAA" +
  "ICEBAAAJCQAASEgAAEBCAgAAEhIAAJCQAACAhAQAACQkAAAgIQEAAAkJAABISAAAQEICAAASEgAAkJAAAICEBAAAJCQAACAhAQAACQkAAEhIAABAQgIAABIS" +
  "AACQkAAAgIT+H2y5hrFWXSsvAAAAAElFTkSuQmCC";

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
