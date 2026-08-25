import { notFound, redirect } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getTv, getMovie, getWatchProviders, searchMulti, type Provider } from "@/lib/tmdb";
import { adminSetProviderLink } from "@/lib/actions";
import { isTrustedProviderUrl } from "@/lib/providerLinks";
import { WATCH_REGIONS } from "@/lib/region";
import { buttonClass } from "@/components/ui/Button";

/**
 * 🆕 **لوحةُ روابط المنصّات — أصغرُ واجهةٍ داخليّةٍ ممكنة** (D-608):
 * لا لوحةَ إدارةٍ في التطبيق قبل اليوم، **فهذه صفحةٌ واحدةٌ بصلاحيّة
 * `am_admin()` القائمة ولا نظامَ صلاحيّاتٍ جديد** — غيرُ الإداريِّ يرى
 * 404 (وجودُ الصفحة نفسُه لا يُقال له)، **والحارسُ الحقيقيُّ في جسم
 * دوالِّ القاعدة لا هنا** (D-011).
 *
 * بحثٌ بالاسم أو المعرّف → منصّاتُ العمل الفعليّةُ من TMDB لبلدٍ بعينه
 * (**فلا رابطَ لمنصّةٍ لا تعرض العملَ أصلاً — لا تخمين**) → رابطٌ https
 * على نطاق المنصّة الموثوق حصراً → `verified` أو تعطيل.
 */

const STATUSES = ["verified", "pending", "disabled"] as const;

async function saveLink(formData: FormData) {
  "use server";
  const back =
    `/admin/links?id=${formData.get("tmdb")}&type=${formData.get("media")}` +
    `&country=${formData.get("country")}`;
  try {
    await adminSetProviderLink({
      tmdbId: Number(formData.get("tmdb")),
      mediaType: formData.get("media") === "movie" ? "movie" : "tv",
      providerId: Number(formData.get("provider")),
      providerName: String(formData.get("pname") ?? ""),
      country: String(formData.get("country") ?? "SA"),
      url: String(formData.get("url") ?? ""),
      status: (STATUSES as readonly string[]).includes(String(formData.get("status")))
        ? (String(formData.get("status")) as (typeof STATUSES)[number])
        : "pending",
    });
  } catch (e) {
    redirect(`${back}&err=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
  redirect(`${back}&ok=1`);
}

export default async function AdminLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string; type?: string; country?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const id = Number(sp.id);
  const media = sp.type === "movie" ? "movie" : "tv";
  const country = /^[A-Za-z]{2}$/.test(sp.country ?? "") ? sp.country!.toUpperCase() : "SA";

  const results = q && !Number.isFinite(id) ? await searchMulti(q).catch(() => []) : [];
  const picked = Number.isFinite(id) && id > 0;

  let title = "";
  let providers: Provider[] = [];
  let existing: {
    provider_id: number;
    country_code: string;
    destination_url: string;
    status: string;
  }[] = [];

  if (picked) {
    const d =
      media === "movie"
        ? await getMovie(id).catch(() => null)
        : await getTv(id).catch(() => null);
    title = d
      ? media === "movie"
        ? ((d as { title?: string }).title ?? "")
        : ((d as { name?: string }).name ?? "")
      : "";
    /* منصّاتُ هذا البلد بعينه — بلا سلسلة سقوط: الرابطُ يُدخل لبلده */
    const prov = await getWatchProviders(media, id, [country]).catch(() => null);
    if (prov && prov.region === country) {
      const all = [
        ...prov.options.flatrate,
        ...prov.options.free,
        ...(prov.options.ads ?? []),
        ...prov.options.rent,
        ...prov.options.buy,
      ];
      const seen = new Set<number>();
      providers = all.filter((p) => !seen.has(p.provider_id) && seen.add(p.provider_id));
    }
    try {
      const supabase = await createClient();
      const { data } = await supabase.rpc("admin_provider_links", {
        p_tmdb: id,
        p_media: media,
      });
      existing = (data ?? []) as typeof existing;
    } catch {
      existing = [];
    }
  }

  const linkOf = (pid: number) =>
    existing.find((r) => r.provider_id === pid && r.country_code === country) ?? null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-22 font-bold">روابط المنصّات المباشرة</h1>

      {/* بحثٌ بالاسم أو معرّف TMDB مباشرةً */}
      <form className="flex gap-2" action="/admin/links" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="اسم العمل أو TMDB ID"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-14"
        />
        <select name="type" defaultValue={media} className="rounded-xl border border-border bg-surface px-2 text-14">
          <option value="tv">مسلسل</option>
          <option value="movie">فيلم</option>
        </select>
        <button type="submit" className={buttonClass({ size: "sm" })}>بحث</button>
      </form>

      {q && /^\d+$/.test(q) && (
        <p className="text-13">
          <a className="text-accent" href={`/admin/links?id=${q}&type=${media}&country=${country}`}>
            فتح المعرّف {q} مباشرةً ←
          </a>
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results
            .filter((r) => r.media_type === "tv" || r.media_type === "movie")
            .slice(0, 8)
            .map((r) => (
              <li key={`${r.media_type}-${r.id}`}>
                <a
                  className="text-14 text-accent"
                  href={`/admin/links?id=${r.id}&type=${r.media_type}&country=${country}`}
                >
                  {(r.title || r.name) ?? "—"}{" "}
                  <span className="text-muted text-12" dir="ltr">
                    {(r.release_date || r.first_air_date || "").slice(0, 4)} · {r.media_type} · {r.id}
                  </span>
                </a>
              </li>
            ))}
        </ul>
      )}

      {picked && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-17 font-bold" dir="auto">
              {title || `#${id}`}{" "}
              <span className="text-muted text-12" dir="ltr">{media} · {id}</span>
            </h2>
            {/* البلد رابطٌ لا حالة — الصفحة خادميّة (D-438) */}
            <div className="flex gap-1 flex-wrap">
              {WATCH_REGIONS.slice(0, 8).map((r) => (
                <a
                  key={r.code}
                  href={`/admin/links?id=${id}&type=${media}&country=${r.code}`}
                  className={`text-12 px-2 py-1 rounded-lg border ${
                    r.code === country ? "border-accent text-accent" : "border-border text-muted"
                  }`}
                  dir="ltr"
                >
                  {r.code}
                </a>
              ))}
            </div>
          </div>

          {sp.err && <p className="text-13 text-[color:var(--error)]">⚠ {sp.err}</p>}
          {sp.ok && <p className="text-13 text-[color:var(--success)]">✓ حُفظ</p>}

          {providers.length === 0 && (
            <p className="text-13 text-muted">
              لا منصّات لهذا العمل في {country} عند TMDB — لا رابطَ يُدخل لمنصّةٍ لا تعرضه.
            </p>
          )}

          {providers.map((p) => {
            const row = linkOf(p.provider_id);
            const trusted = row ? isTrustedProviderUrl(p.provider_name, row.destination_url) : null;
            return (
              <form
                key={p.provider_id}
                action={saveLink}
                className="rounded-card border border-border bg-surface p-3 space-y-2"
              >
                <input type="hidden" name="tmdb" value={id} />
                <input type="hidden" name="media" value={media} />
                <input type="hidden" name="provider" value={p.provider_id} />
                <input type="hidden" name="pname" value={p.provider_name} />
                <input type="hidden" name="country" value={country} />
                <div className="flex items-center gap-2 text-14 font-semibold">
                  <span dir="ltr">{p.provider_name}</span>
                  <span className="text-muted text-12" dir="ltr">#{p.provider_id}</span>
                  {row && (
                    <span className="text-12 ms-auto" dir="ltr">
                      {row.status}
                      {trusted === false && <span className="text-[color:var(--error)]"> · نطاق مرفوض</span>}
                    </span>
                  )}
                </div>
                <input
                  name="url"
                  defaultValue={row?.destination_url ?? ""}
                  placeholder={`https://… رابط العمل على ${p.provider_name}`}
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-13"
                />
                <div className="flex items-center gap-2">
                  <select
                    name="status"
                    defaultValue={row?.status ?? "verified"}
                    className="rounded-xl border border-border bg-surface-2 px-2 py-1.5 text-13"
                    dir="ltr"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button type="submit" className={buttonClass({ size: "sm" })}>حفظ</button>
                  {row?.destination_url && (
                    <a
                      href={row.destination_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-13 text-accent ms-auto"
                    >
                      معاينة ↗
                    </a>
                  )}
                </div>
              </form>
            );
          })}
        </section>
      )}
    </div>
  );
}
