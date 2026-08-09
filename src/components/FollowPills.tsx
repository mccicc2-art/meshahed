"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { acceptFollowRequest, rejectFollowRequest, removeFollowerUser } from "@/lib/actions";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { getDict, type Locale } from "@/lib/i18n";
import type { PersonLite } from "@/lib/data";

/**
 * عدّادا «أتابعهم» و«يتابعونني» — **انتقلا من صفحة المجتمع إلى الرئيسية**
 * (طلب أحمد 9 Aug مساءً: «المتابعين خلّها في الهوم جنب المتابعين»).
 *
 * كانا كبسولتين ضخمتين في رأس `/people` مع زرّ إضافةٍ ثالث، فوق خطّ
 * النشاط مباشرة: ثلاثة أزرارٍ عن **حسابك أنت** تعتلي صفحةً موضوعها
 * **الآخرون**. ورقمُ متابعيك ليس خبراً يتجدّد كي يجلس فوق الخطّ — هو
 * إحصاءٌ عنك، وبيتُ إحصاءاتك ترويسة الرئيسية حيث تجلس بقيّة أرقامك.
 *
 * والشكل تبع المكان: لا كبسولتين بحدودٍ هنا، بل **أيقونة ورقمٌ** بنفس
 * حجم ولون سطر التعليقات والتقييمات الذي تجلسان فيه — دخلتا صفّاً قائماً
 * فأخذتا لغته، ولم تُنشئا لغةً ثالثة فوق صورة الغلاف.
 *
 * وزرّ «+» لم ينتقل معهما: **أُلغي**، وصار البحث عن شخصٍ وضعاً داخل ورقة
 * البحث العامة (`TitleSearchSheet`) — بابٌ واحد للبحث لا بابان.
 */
export function FollowPills({
  following,
  followers,
  requests = [],
  locale,
}: {
  following: PersonLite[];
  followers: PersonLite[];
  /** طلبات المتابعة الواردة (الحساب الخاص) — تُعرض أعلى ورقة المتابِعين */
  requests?: PersonLite[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState<"following" | "followers" | null>(null);

  /* نفس أصناف روابط الصفّ في `ProfileHeader` حرفاً بحرف: هذه أزرارٌ لا
     روابط (تفتح ورقة)، والفرق الدلاليّ لا يجوز أن يظهر بصرياً */
  const item =
    "shrink-0 flex items-center gap-1.5 hover:text-white transition";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen("following")}
        title={t.peopleFollowingTitle}
        aria-label={`${following.length} ${t.peopleFollowingTitle}`}
        className={item}
      >
        <Icon name="person-check" size={15} />
        <span className="font-bold text-white tabular-nums">{following.length}</span>
      </button>

      <span className="opacity-40 shrink-0">•</span>

      <button
        type="button"
        onClick={() => setOpen("followers")}
        title={t.peopleFollowersTitle}
        aria-label={`${followers.length} ${t.peopleFollowersTitle}`}
        className={`relative ${item}`}
      >
        <Icon name="people-filled" size={16} />
        <span className="font-bold text-white tabular-nums">{followers.length}</span>
        {/* شارة الطلبات المعلّقة — تختفي عند الصفر كشارة الرسائل */}
        {requests.length > 0 && (
          <span
            aria-label={t.followRequestsTitle}
            className="absolute -top-2 -end-2.5 grid place-items-center min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[10px] font-bold tabular-nums"
            dir="ltr"
          >
            {requests.length}
          </span>
        )}
      </button>

      {open === "following" && (
        <PeopleSheet
          t={t}
          title={t.peopleFollowingTitle}
          people={following}
          empty={t.peopleNoFollowing}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "followers" && (
        <FollowersSheet
          t={t}
          followers={followers}
          requests={requests}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

type Dict = ReturnType<typeof getDict>;

function PersonRowLink({ p, t }: { p: PersonLite; t: Dict }) {
  const name = p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";
  return (
    <Link
      /* من لا معرّف له يُفتح بهويته: كان صفّه يعيد إلى صفحة المجتمع
         نفسها، فيبدو الاسم معطّلاً بلا سبب ظاهر */
      href={`/u/${p.username ?? p.id}`}
      prefetch={false}
      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition"
    >
      <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{name}</span>
        {p.username && (
          <span className="block text-xs text-muted truncate" dir="ltr">
            @{p.username}
          </span>
        )}
      </span>
    </Link>
  );
}

/** قائمة أشخاص — للمتابَعين */
function PeopleSheet({
  t,
  title,
  people,
  empty,
  onClose,
}: {
  t: Dict;
  title: string;
  people: PersonLite[];
  empty: string;
  onClose: () => void;
}) {
  return (
    /* علوية كورقة البحث: قوائم الناس تُقرأ ويُنقر فيها اسمٌ بعينه، وهذه
       قراءةٌ لا فعلٌ سريع — فتُفتح من أعلى الشاشة حيث تبدأ العين */
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="people-sheet-title">
      <SheetHeader id="people-sheet-title" title={title} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)]">
        {people.length === 0 ? (
          <p className="text-sm text-muted text-center py-10 px-5">{empty}</p>
        ) : (
          people.map((p) => <PersonRowLink key={p.id} p={p} t={t} />)
        )}
      </div>
    </Sheet>
  );
}

/**
 * ورقة المتابِعين — طلباتُ المتابعة أولاً ثم القائمة، مع «إزالة».
 *
 * الطلبات فوق القائمة لا في شاشةٍ مستقلّة: العددان صغيران، والقبول فعلٌ
 * سريعٌ لا يستحقّ وجهة. القبول/الرفض/الإزالة تفاؤليّان — الصفّ يختفي
 * فوراً ويُسترجَع عند الخطأ (D-007).
 */
function FollowersSheet({
  t,
  followers,
  requests,
  onClose,
}: {
  t: Dict;
  followers: PersonLite[];
  requests: PersonLite[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [reqs, setReqs] = useState(requests);
  const [list, setList] = useState(followers);

  const nameOf = (p: PersonLite) =>
    p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

  function decide(p: PersonLite, accept: boolean) {
    tap(8);
    setReqs((prev) => prev.filter((x) => x.id !== p.id));
    if (accept) setList((prev) => [p, ...prev]);
    (accept ? acceptFollowRequest(p.id) : rejectFollowRequest(p.id))
      .then(() => router.refresh())
      .catch((e) => {
        flashError((e as Error).message);
        setReqs((prev) => [p, ...prev]);
        if (accept) setList((prev) => prev.filter((x) => x.id !== p.id));
      });
  }

  function remove(p: PersonLite) {
    tap([10, 20]);
    setList((prev) => prev.filter((x) => x.id !== p.id));
    removeFollowerUser(p.id)
      .then(() => {
        toast(t.removedFollowerToast, { tone: "info" });
        router.refresh();
      })
      .catch((e) => {
        flashError((e as Error).message);
        setList((prev) => [p, ...prev]);
      });
  }

  return (
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="followers-sheet-title">
      <SheetHeader
        id="followers-sheet-title"
        title={t.peopleFollowersTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />
      <div className="overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {reqs.length > 0 && (
          <section className="border-b border-[color:var(--divider)]">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wide px-5 pt-3 pb-1">
              {t.followRequestsTitle}
            </p>
            {reqs.map((p) => {
              const name = nameOf(p);
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{name}</span>
                    {p.username && (
                      <span className="block text-xs text-muted truncate" dir="ltr">
                        @{p.username}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => decide(p, true)}
                    className="shrink-0 px-3.5 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-[13px] font-bold hover:brightness-110 active:scale-95 transition"
                  >
                    {t.requestAccept}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(p, false)}
                    className="shrink-0 px-3.5 h-9 rounded-full border border-border text-[13px] font-semibold text-muted hover:text-foreground hover:border-accent/50 active:scale-95 transition"
                  >
                    {t.requestReject}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        <div className="divide-y divide-[color:var(--divider)]">
          {list.length === 0 && reqs.length === 0 ? (
            <p className="text-sm text-muted text-center py-10 px-5">{t.peopleNoResults}</p>
          ) : (
            list.map((p) => {
              const name = nameOf(p);
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition">
                  <Link
                    href={`/u/${p.username ?? p.id}`}
                    prefetch={false}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{name}</span>
                      {p.username && (
                        <span className="block text-xs text-muted truncate" dir="ltr">
                          @{p.username}
                        </span>
                      )}
                    </span>
                  </Link>
                  {/* إزالة متابِع — زرٌّ حقيقي خارج الرابط، هادئٌ حتى المرور */}
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    aria-label={t.removeFollowerAria(name)}
                    title={t.removeFollower}
                    className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-[color:var(--error)] hover:bg-surface transition"
                  >
                    <Icon name="close" size={16} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Sheet>
  );
}
