"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { findPeople } from "@/lib/actions";
import { getDict, num, type Locale } from "@/lib/i18n";
import type { PersonLite } from "@/lib/data";

/**
 * شريط المجتمع — سطرٌ واحد بدل ثلاثة أقسام.
 *
 * كانت الصفحة تفتتح بنموذج بحثٍ عريض ثم قسمَي «أتابعهم» و«يتابعونني»،
 * فيهبط خطّ الآراء — وهو جوهر الصفحة — تحت الطيّة. الآن كبسولتان
 * بعدّادين وزرُّ إضافة، والقوائم والبحث في نوافذ منبثقة تُفتح عند الطلب.
 *
 * البحث فوريّ: حرفان فأكثر يطلقان البحث تلقائياً بمهلة ٣٠٠ مللي ثانية —
 * لا زرّ ولا إرسال.
 */
export function CommunityBar({
  following,
  followers,
  locale,
}: {
  following: PersonLite[];
  followers: PersonLite[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState<"add" | "following" | "followers" | null>(null);

  /* الأيقونة والرقم وحدهما: الكلمتان كانتا تضاعفان عرض الكبسولة لتقولا
     ما تقوله الأيقونة — وأيقونتان مختلفتان في صفٍّ واحد تُقرآن بالتضادّ
     لا بالقراءة. الاسم يبقى في `aria-label` و`title` لمن يحتاجه ولقارئ
     الشاشة، فلا وضوحَ فُقد. والارتفاع موحَّد بين الثلاثة (٤٠ بكسلاً)
     فيستوي السطر بدل كبسولتين ضخمتين إلى جانب قرصٍ أضخم. */
  const pill =
    "flex items-center gap-1.5 h-10 rounded-full border border-border bg-surface px-3.5 hover:bg-surface-2 active:scale-[0.97] transition";

  return (
    <>
      {/* مجموعةٌ مضمومة لا صفٌّ يملأ العرض: صارت تجلس في طرف سطر عنوان
          الخطّ، فلو تمدّدت لدفعت العنوان وقصّته */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setOpen("following")}
          aria-label={t.peopleFollowingTitle}
          title={t.peopleFollowingTitle}
          className={pill}
        >
          <Icon name="person-check" size={18} className="text-accent shrink-0" />
          <span className="text-[15px] font-bold tabular-nums" dir="ltr">
            {num(following.length, locale)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen("followers")}
          aria-label={t.peopleFollowersTitle}
          title={t.peopleFollowersTitle}
          className={pill}
        >
          <Icon name="people" size={18} className="text-accent-2 shrink-0" />
          <span className="text-[15px] font-bold tabular-nums" dir="ltr">
            {num(followers.length, locale)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen("add")}
          aria-label={t.peopleAdd}
          title={t.peopleAdd}
          className="grid place-items-center w-10 h-10 rounded-full bg-accent text-[color:var(--on-accent)] shadow-lg shadow-accent/25 hover:brightness-110 active:scale-95 transition"
        >
          <Icon name="plus" size={19} strokeWidth={2.2} />
        </button>
      </div>

      {/* ===== النوافذ المنبثقة ===== */}
      {open === "add" && <SearchSheet t={t} onClose={() => setOpen(null)} />}
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
        <PeopleSheet
          t={t}
          title={t.peopleFollowersTitle}
          people={followers}
          empty={t.peopleNoResults}
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
      <Icon name="people" size={16} className="text-muted shrink-0 opacity-0" />
    </Link>
  );
}

/** قائمة أشخاص — للمتابَعين أو المتابِعين */
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
       قراءةٌ لا فعلٌ سريع — فتُفتح من أعلى الشاشة حيث تبدأ العين، ولا
       تُدفَع نصفَ الشاشة عند ظهور أي لوحة. ووحدةُ الموضع بين ورقتَي
       المجتمع تجعل الانتقال بينهما بلا قفزة */
    <Sheet
      open
      variant="top"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="people-sheet-title"
    >
      <SheetHeader
        id="people-sheet-title"
        title={title}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />
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

/** بحثٌ فوريّ عن الأشخاص — يُطلق نفسه بعد حرفين بلا زرّ */
function SearchSheet({ t, onClose }: { t: Dict; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonLite[] | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    const term = v.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      start(async () => {
        try {
          setResults(await findPeople(term));
        } catch {
          setResults([]);
        }
      });
    }, 300);
  }

  return (
    /* ورقةٌ علوية لا سفلية: لوحة المفاتيح تدفع الورقة السفلية فوقها
       فيبقى الحقل ظاهراً ويختفي المقترحون خلفها — يكتب المستخدم على غير
       هدى. أعلى الشاشة يبقى مرئياً مهما ارتفعت اللوحة */
    <Sheet
      open
      variant="top"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="people-search-title"
    >
      <SheetHeader
        id="people-search-title"
        title={t.peopleAdd}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />

      <div className="px-5 pt-4 pb-3">
        <div className="relative">
          <span className="absolute inset-y-0 start-3.5 grid place-items-center text-muted pointer-events-none">
            <Icon name="search" size={18} />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.peopleSearchPlaceholder}
            aria-label={t.peopleSearchPlaceholder}
            /* ١٦ بكسلاً لا ١٤: سفاري iOS يكبّر الصفحة عند التركيز على
               حقلٍ خطُّه أصغر من ١٦ فتقفز الشاشة عند فتح البحث */
            className="w-full rounded-xl bg-surface-2 border border-border ps-10 pe-4 py-3 text-base outline-none focus:border-accent transition"
            dir="ltr"
            autoComplete="off"
          />
        </div>
        {results === null && !pending && (
          <p className="text-xs text-muted mt-2">{t.peopleSearchHint}</p>
        )}
      </div>

      <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)] min-h-[8rem]">
        {pending ? (
          <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
        ) : results !== null && results.length === 0 ? (
          <p className="text-sm text-muted text-center py-8 px-5">{t.peopleNoResults}</p>
        ) : (
          (results ?? []).map((p) => <PersonRowLink key={p.id} p={p} t={t} />)
        )}
      </div>
    </Sheet>
  );
}
