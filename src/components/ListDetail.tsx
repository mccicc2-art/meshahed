"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteList, renameList, reorderList, setListKind, toggleInList, saveList } from "@/lib/actions";
import { posterUrl } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import type { ListItem, ListKind } from "@/lib/data";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { ShareListSheet } from "./ShareListSheet";

type Dict = ReturnType<typeof getDict>;

const keyOf = (i: ListItem) => `${i.media_type}-${i.tmdb_id}`;
/** الأرقام لاتينية في اللغتين (D-015) */
const NUMBERED: ListKind[] = ["ranked", "watch_order"];

/**
 * صفحة القائمة الواحدة.
 *
 * القائمة ثلاثة أنواع لا نوعٌ واحد: مجموعةٌ لا ترتيب لها، وقائمةٌ مرتّبة،
 * وترتيبُ مشاهدة. النوع هو ما يمنح الرقم على الملصق معناه — ولذلك لا رقم
 * على قائمةٍ عادية أصلاً.
 *
 * والأفعال كلّها انتقلت إلى قائمة النقاط الثلاث: كان القلم يعيش في الترويسة
 * والحذف في شبكة القوائم فقط، فصار للاسم بابان وللحذف بابٌ بعيد. بابٌ واحد
 * لكل فعل: تسمية، نوع، ترتيب، حذف.
 *
 * والترتيب لا يجري إلا داخل ورقة «أعد الترتيب»: السحب في الشبكة نفسها كان
 * سيتنازع مع التمرير ومع فتح العمل، وفصلُ الوضع يجعل كل لمسةٍ في مكانها
 * تعني شيئاً واحداً.
 */
export function ListDetail({
  listId,
  name,
  subtitle,
  isPublic,
  kind,
  items,
  ratings,
  isOwner,
  owner,
  locale,
  initialSaved,
}: {
  listId: string;
  name: string;
  subtitle: string | null;
  isPublic: boolean;
  kind: ListKind;
  items: ListItem[];
  ratings: Record<string, number>;
  isOwner: boolean;
  /** صاحب القائمة — يُمرَّر حين يفتحها غيرُه. قائمةٌ بلا صاحبٍ ظاهرٍ
      مجهولةُ المصدر، ومن أخفى اسمه يصل هنا فارغاً فلا يُنسب شيء */
  owner?: { nickname: string | null; username: string | null; avatar: string | null } | null;
  locale: Locale;
  /** حالة الحفظ لغير المالك (D-068) — الغياب يعني زائراً بلا حساب فلا زرّ */
  initialSaved?: boolean | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  /* حفظ القائمة مرجعاً حيّاً — متفائلٌ مع تراجُع (D-007) */
  const [saved, setSaved] = useState(initialSaved ?? false);
  const canSave = !isOwner && initialSaved !== undefined && initialSaved !== null;

  function toggleSave() {
    const next = !saved;
    tap(next ? [12, 30] : 8);
    setSaved(next);
    saveList(listId, next)
      .then(() => toast(next ? t.listSavedToast : t.listUnsavedToast, next ? { tone: "success" } : undefined))
      .catch((e) => {
        setSaved(!next);
        flashError((e as Error).message);
      });
  }
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<
    "menu" | "rename" | "type" | "reorder" | "delete" | "share" | null
  >(null);

  /* الترتيب المحليّ يسبق الخادم: بعد «تمّ» تتبدّل الأرقام في اللحظة نفسها،
     ثم يلحق `router.refresh()` بالتأكيد. الانتظار كان سيجعل أهم لحظةٍ في
     الميزة تبدو معطّلة نصف ثانية. */
  const [order, setOrder] = useState<string[] | null>(null);

  const visible = useMemo(() => {
    const live = items.filter((i) => !removed.has(keyOf(i)));
    if (!order) return live;
    const rank = new Map(order.map((k, i) => [k, i]));
    return [...live].sort((a, b) => (rank.get(keyOf(a)) ?? 1e9) - (rank.get(keyOf(b)) ?? 1e9));
  }, [items, removed, order]);

  const numbered = NUMBERED.includes(kind);

  function remove(it: ListItem) {
    setRemoved((prev) => new Set(prev).add(keyOf(it)));
    start(async () => {
      try {
        await toggleInList({
          listId,
          tmdbId: it.tmdb_id,
          mediaType: it.media_type,
          title: it.title ?? "",
          posterPath: it.poster_path,
          add: false,
        });
        router.refresh();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div>
      {/* الترويسة: الاسم يملأ السطر وزرّ الخيارات وحده على الطرف — كان
          القلم يزاحم الاسم على شاشةٍ ضيّقة فيقصّه بلا داعٍ */}
      <div className="flex items-start gap-3 mb-1.5">
        <h1 className="flex-1 min-w-0 text-[22px] leading-tight font-bold break-words">{name}</h1>
        {/* «أضِفها إلى قوائمي» مكانَ نقاط المالك: مرجعٌ حيٌّ إلى قائمة
            صاحبها — تعديلاتُه تنعكس عندك لأنها القائمة نفسها (D-068) */}
        {canSave && (
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
              saved
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-accent bg-accent text-[color:var(--on-accent)] hover:brightness-110"
            }`}
          >
            <Icon name={saved ? "check-line" : "plus"} size={14} strokeWidth={2.2} />
            {saved ? t.listSavedBtn : t.listSaveBtn}
          </button>
        )}
        {isOwner && (
          /* هدف لمسٍ ٤٤×٤٤ كاملاً وإن بدت الدائرة ٣٦: أصغر من ذلك يُخطئه
             الإبهام — وهو المقاس الذي توصي به آبل ولا نجادل فيه */
          <button
            type="button"
            onClick={() => {
              tap(8);
              setSheet("menu");
            }}
            aria-label={t.listMenu}
            aria-haspopup="dialog"
            className="shrink-0 -m-1 p-1 grid place-items-center"
          >
            <span className="grid place-items-center w-9 h-9 rounded-full border border-border bg-surface text-muted transition active:scale-95 hover:border-accent hover:text-foreground">
              <Icon name="dots" size={16} />
            </span>
          </button>
        )}
      </div>

      {/* الوصف امتدادٌ للاسم لا منافسٌ له: نصف وزنه ولونٌ خافت وسطران على
          الأكثر ثم قصّ. وحين لا وصف لا يبقى فراغه — لا هامش ولا عنصر أصلاً */}
      {subtitle && (
        <p className="mt-2 text-[14px] font-normal leading-snug text-muted line-clamp-2 max-w-[46ch]">
          {subtitle}
        </p>
      )}

      {/* نسبة القائمة إلى صاحبها: صفٌّ واحدٌ تحت الوصف يظهر لغير المالك
          وحده. من أخفى اسمه لا اسم له هنا ولا رابط — القرار محفوظٌ في
          SQL لا في هذا السطر (D-011) */}
      {!isOwner && owner && (owner.nickname || owner.username) && (
        <div className="flex items-center gap-2 mt-3.5">
          <span className="relative w-6 h-6 rounded-full overflow-hidden bg-surface-2 border border-border shrink-0">
            {owner.avatar ? (
              <Image src={owner.avatar} alt="" fill sizes="24px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted">
                <Icon name="people" size={12} />
              </span>
            )}
          </span>
          {owner.username ? (
            <Link
              href={`/u/${owner.username}`}
              className="text-[13px] text-muted hover:text-foreground transition min-w-0 truncate"
            >
              {owner.nickname || `@${owner.username}`}
            </Link>
          ) : (
            <span className="text-[13px] text-muted min-w-0 truncate">{owner.nickname}</span>
          )}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-3.5 mb-5">
        <span className="text-xs text-muted">{t.listCount(visible.length)}</span>
        {numbered && (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-accent/40 text-accent">
            {kind === "ranked" ? t.listTypeRanked : t.listTypeWatch}
          </span>
        )}
        {isOwner ? (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                try {
                  await renameList(listId, name, !isPublic);
                  router.refresh();
                } catch (e) {
                  flashError((e as Error).message);
                }
              })
            }
            disabled={pending}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition disabled:opacity-50 ${
              isPublic
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/50"
            }`}
            title={t.listPublicHint}
          >
            {isPublic ? t.listPublic : t.listPrivate}
          </button>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted">
            {t.listOwnerOther}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listItemsEmpty}</p>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(102px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(136px,1fr))]">
          {visible.map((it, i) => (
            <PosterTile
              key={keyOf(it)}
              item={it}
              n={numbered ? i + 1 : null}
              rating={ratings[keyOf(it)] ?? null}
              canRemove={isOwner}
              onRemove={() => remove(it)}
              t={t}
            />
          ))}
        </div>
      )}

      {sheet === "menu" && (
        <Sheet open onClose={() => setSheet(null)} closeLabel={t.closeLabel} labelledBy="list-menu-title">
          <SheetHeader
            id="list-menu-title"
            title={name}
            closeLabel={t.closeLabel}
            onClose={() => setSheet(null)}
          >
            <p className="text-xs text-muted mt-0.5">{t.listCount(visible.length)}</p>
          </SheetHeader>
          {/* «عدّل القائمة» لا «غيّر الاسم»: الورقة تحمل الاسم والوصف معاً،
              فهما هويّة القائمة الواحدة — وصفٌّ لكلٍّ منهما بابان إلى ورقةٍ
              واحدة */}
          <MenuRow icon="edit" label={t.listEditTitle} onClick={() => setSheet("rename")} />
          {/* مشاركة القائمة — في المجتمع (تظهر في ملفّك العام) أو خارج
              التطبيق (رابط). بابٌ واحد لكل فعل، فمكانها هنا لا على البطاقة */}
          <MenuRow icon="share" label={t.listShare} onClick={() => setSheet("share")} />
          <MenuRow
            icon="list"
            label={t.listType}
            value={
              kind === "ranked"
                ? t.listTypeRanked
                : kind === "watch_order"
                  ? t.listTypeWatch
                  : t.listTypeRegular
            }
            onClick={() => setSheet("type")}
          />
          {/* «أعد الترتيب» لا يظهر على قائمةٍ عادية: صفٌّ يفتح وضعاً بلا أثرٍ
              مرئيّ هو وعدٌ كاذب — ومن أراده غيّر النوع أوّلاً */}
          {numbered && visible.length > 1 && (
            <MenuRow icon="grip" label={t.listReorder} onClick={() => setSheet("reorder")} />
          )}
          <MenuRow icon="trash" label={t.listDeleteThis} danger onClick={() => setSheet("delete")} />
        </Sheet>
      )}

      {sheet === "share" && (
        <ShareListSheet
          listId={listId}
          name={name}
          isPublic={isPublic}
          locale={locale}
          onClose={() => setSheet(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {sheet === "rename" && (
        <RenameSheet
          listId={listId}
          name={name}
          subtitle={subtitle}
          isPublic={isPublic}
          t={t}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      )}

      {sheet === "type" && (
        <Sheet open onClose={() => setSheet(null)} closeLabel={t.closeLabel} labelledBy="list-type-title">
          <SheetHeader
            id="list-type-title"
            title={t.listType}
            closeLabel={t.closeLabel}
            onClose={() => setSheet(null)}
          />
          {(
            [
              { id: "regular", label: t.listTypeRegular, hint: t.listTypeRegularHint, icon: "grid" },
              { id: "ranked", label: t.listTypeRanked, hint: t.listTypeRankedHint, icon: "chart" },
              { id: "watch_order", label: t.listTypeWatch, hint: t.listTypeWatchHint, icon: "play" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              onClick={() => {
                tap(8);
                setSheet(null);
                start(async () => {
                  try {
                    await setListKind(listId, o.id);
                    router.refresh();
                  } catch (e) {
                    flashError((e as Error).message);
                  }
                });
              }}
              className="flex items-center gap-3 w-full text-start px-5 py-3.5 border-t border-[color:var(--divider)] first-of-type:border-t-0 transition active:bg-surface-2 disabled:opacity-40"
            >
              <Icon
                name={o.icon}
                size={20}
                className={`shrink-0 ${kind === o.id ? "text-accent" : "text-muted"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-[11px] text-muted mt-0.5 leading-snug">{o.hint}</span>
              </span>
              {kind === o.id && (
                <Icon name="check" size={18} className="shrink-0 text-accent" strokeWidth={2.4} />
              )}
            </button>
          ))}
        </Sheet>
      )}

      {sheet === "reorder" && (
        <ReorderSheet
          items={visible}
          t={t}
          onClose={() => setSheet(null)}
          onDone={(keys) => {
            setOrder(keys);
            setSheet(null);
            start(async () => {
              try {
                await reorderList(listId, keys);
                router.refresh();
              } catch (e) {
                flashError((e as Error).message);
              }
            });
          }}
        />
      )}

      {sheet === "delete" && (
        <Sheet
          open
          variant="center"
          onClose={() => setSheet(null)}
          closeLabel={t.closeLabel}
          labelledBy="list-del-title"
        >
          <div className="p-5">
            <h3 id="list-del-title" className="text-base font-bold mb-1.5">
              {t.listDeleteThis}
            </h3>
            <p className="text-[13px] text-muted leading-relaxed mb-5">{t.listDeleteBody}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSheet(null)}
                className={buttonClass({ variant: "ghost", size: "sm", className: "flex-1" })}
              >
                {t.listCancel}
              </button>
              {/* الحذف يستعمل صيغة `danger` من مصنع الأزرار الواحد (D-017)
                  لا زرّاً أحمر مكتوباً باليد */}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      await deleteList(listId);
                      router.replace("/library?filter=list");
                    } catch (e) {
                      flashError((e as Error).message);
                    }
                  })
                }
                className={buttonClass({ variant: "danger", size: "sm", className: "flex-1" })}
              >
                {t.listDeleteYes}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** صفٌّ في قائمة الأفعال — نفس مقاسات لوح الإجراءات السريعة في المكتبة */
// ShareListSheet انتقل إلى مكوّنٍ مستقل ليُستعمل من صفحة «قوائمي» أيضاً (D-053)

function MenuRow({
  icon,
  label,
  value,
  danger = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full text-start px-5 py-3.5 text-sm font-semibold border-t border-[color:var(--divider)] first-of-type:border-t-0 transition active:bg-surface-2"
    >
      <Icon
        name={icon}
        size={20}
        className={`shrink-0 ${danger ? "text-[color:var(--error)]" : "text-accent"}`}
      />
      <span className={`flex-1 min-w-0 truncate ${danger ? "text-[color:var(--error)]" : ""}`}>
        {label}
      </span>
      {value && <span className="shrink-0 text-[12px] font-normal text-muted">{value}</span>}
    </button>
  );
}

/** تغيير الاسم — ورقةٌ علوية لأنّ فيها حقلاً يُكتب فيه (D-018) */
function RenameSheet({
  listId,
  name,
  subtitle,
  isPublic,
  t,
  onClose,
  onSaved,
}: {
  listId: string;
  name: string;
  subtitle: string | null;
  isPublic: boolean;
  t: Dict;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const [sub, setSub] = useState(subtitle ?? "");
  const [pending, start] = useTransition();

  const dirty = draft.trim() !== name || sub.trim() !== (subtitle ?? "");

  function save() {
    const clean = draft.trim();
    if (!clean) return;
    if (!dirty) return onClose();
    start(async () => {
      try {
        await renameList(listId, clean, isPublic, sub);
        onSaved();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const field =
    "w-full rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition";

  return (
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-rn-title">
      <SheetHeader
        id="list-rn-title"
        title={t.listEditTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />
      <div className="p-5 space-y-3">
        {/* ١٦ بكسل لا أصغر في كل حقل: سفاري iOS يكبّر الصفحة عند التركيز
            على أي حقلٍ أصغر ولا يتراجع عن التكبير (D-033) */}
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5">{t.listNameLabel}</span>
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className={field}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5">
            {t.listSubtitleLabel}
          </span>
          {/* سطرٌ واحد لا منطقة نصّ: السقف ١٢٠ حرفاً وجملةٌ واحدة، ومنطقة
              النصّ تدعو إلى فقرة ثم تُقصّ عند العرض */}
          <input
            value={sub}
            maxLength={120}
            placeholder={t.listSubtitlePlaceholder}
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className={field}
          />
          <span className="block text-[11px] text-muted/70 mt-1 tabular-nums" dir="ltr">
            {sub.length}/120
          </span>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={pending || !draft.trim()}
          className={buttonClass({ size: "sm", full: true })}
        >
          {t.listSave}
        </button>
      </div>
    </Sheet>
  );
}

/* ارتفاع الصفّ ثابتٌ عمداً: حساب موضع الإفلات قسمةٌ على هذا الرقم، وصفوفٌ
   متفاوتة الارتفاع تعني رياضياتٍ تقريبية تُخطئ الهدف بصفٍّ كامل */
const ROW = 68;

/**
 * ورقة إعادة الترتيب.
 *
 * السحب بأحداث المؤشّر لا بـ HTML5 drag-and-drop: الأخير لا يعمل باللمس على
 * الجوال أصلاً، وهو الجهاز الذي تُستعمل فيه هذه الميزة. وبلا مكتبة سحبٍ
 * خارجية: صفٌّ رأسيّ متساوي الارتفاع رياضياتُه سطرٌ واحد، والمكتبة كانت
 * ستضيف وزناً للحزمة مقابل ما لا نحتاجه (D-036).
 *
 * الصفوف بينهما تنزاح بانتقالٍ ناعم بينما يتبع المسحوبُ الإصبع بلا انتقال —
 * وهذا وحده ما يصنع إحساس iOS: الصفوف تُفسح الطريق قبل أن تُفلت.
 */
function ReorderSheet({
  items,
  t,
  onClose,
  onDone,
}: {
  items: ListItem[];
  t: Dict;
  onClose: () => void;
  onDone: (keys: string[]) => void;
}) {
  const [order, setOrder] = useState<ListItem[]>(items);
  const [from, setFrom] = useState<number | null>(null);
  const [dy, setDy] = useState(0);
  const startY = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const auto = useRef<number | null>(null);
  const edge = useRef(0);

  const to =
    from === null ? null : Math.max(0, Math.min(order.length - 1, from + Math.round(dy / ROW)));

  /* تمريرٌ ذاتيّ عند الحافّة: بدونه لا يمكن نقل عملٍ من آخر قائمةٍ طويلة
     إلى أوّلها إلا بعشر سحباتٍ متتالية */
  useEffect(() => {
    if (from === null) return;
    const step = () => {
      const el = body.current;
      if (el && edge.current) {
        const before = el.scrollTop;
        el.scrollTop += edge.current;
        // ما تحرّك فعلاً يُضاف إلى الإزاحة حتى لا يقفز الصفّ المسحوب
        startY.current -= el.scrollTop - before;
        if (el.scrollTop !== before) setDy((d) => d + (el.scrollTop - before));
      }
      auto.current = requestAnimationFrame(step);
    };
    auto.current = requestAnimationFrame(step);
    return () => {
      if (auto.current) cancelAnimationFrame(auto.current);
      auto.current = null;
    };
  }, [from]);

  function down(e: React.PointerEvent, i: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    edge.current = 0;
    setFrom(i);
    setDy(0);
    tap(10);
  }

  function move(e: React.PointerEvent) {
    if (from === null) return;
    setDy(e.clientY - startY.current);
    const el = body.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = e.clientY - r.top;
    const bottom = r.bottom - e.clientY;
    edge.current = top < 56 ? -8 : bottom < 56 ? 8 : 0;
  }

  function up() {
    if (from !== null && to !== null && to !== from) {
      setOrder((prev) => {
        const next = [...prev];
        const [x] = next.splice(from, 1);
        next.splice(to, 0, x);
        return next;
      });
      tap(8);
    }
    edge.current = 0;
    setFrom(null);
    setDy(0);
  }

  /** كم ينزاح الصفّ i بينما يُسحب صفٌّ آخر */
  function shift(i: number) {
    if (from === null || to === null) return 0;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -ROW;
    if (from > to && i >= to && i < from) return ROW;
    return 0;
  }

  /** بديلُ السحب للوحة المفاتيح — السهمان يحرّكان الصفّ المركَّز عليه */
  function nudge(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [x] = next.splice(i, 1);
      next.splice(j, 0, x);
      return next;
    });
  }

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-ro-title">
      <SheetHeader
        id="list-ro-title"
        title={t.listReorder}
        closeLabel={t.closeLabel}
        onClose={onClose}
        action={
          <button
            type="button"
            onClick={() => onDone(order.map(keyOf))}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            {t.listDone}
          </button>
        }
      >
        <p className="text-[11px] text-muted mt-0.5">{t.listReorderHint}</p>
      </SheetHeader>

      {/* `min-h-0` ليست زينة: ابنُ الفليكس لا ينكمش تحت ارتفاع محتواه بلا
          هذه، فقائمةٌ من ثلاثين عملاً كانت تتجاوز سقف الورقة (85vh) وتُقصّ
          بلا إمكانية تمرير — أي لا يمكن الوصول إلى آخرها أصلاً */}
      <div ref={body} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
        <ul className="relative" style={{ height: order.length * ROW }}>
          {order.map((it, i) => {
            const dragging = from === i;
            const url = posterUrl(it.poster_path, "w185");
            return (
              <li
                key={keyOf(it)}
                className={`absolute inset-x-0 flex items-center gap-3 px-2 rounded-card ${
                  dragging
                    ? "z-10 bg-surface-2 shadow-2xl scale-[1.02]"
                    : "transition-transform duration-200 ease-out"
                }`}
                style={{
                  top: i * ROW,
                  height: ROW - 8,
                  transform: `translateY(${shift(i)}px)`,
                }}
              >
                <span className="relative w-9 h-[54px] shrink-0 rounded-md overflow-hidden bg-surface border border-border">
                  {url ? (
                    <Image src={url} alt="" fill sizes="36px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name={it.media_type === "movie" ? "film" : "tv"} size={14} />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-tight line-clamp-2">
                    {it.title ?? `#${it.tmdb_id}`}
                  </span>
                  <span className="block text-[11px] text-muted tabular-nums mt-0.5" dir="ltr">
                    {i + 1}
                  </span>
                </span>

                {/* المقبض وحده يمسك السحب: لو أمسكه الصفّ كلّه لتنازع مع
                    تمرير الورقة، و`touch-none` تمنع المتصفّح من ابتلاع
                    الحركة تمريراً قبل أن تصلنا */}
                <button
                  type="button"
                  aria-label={`${it.title ?? ""} — ${t.listPositionOf(i + 1, order.length)}`}
                  onPointerDown={(e) => down(e, i)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      nudge(i, -1);
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      nudge(i, 1);
                    }
                  }}
                  className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-muted touch-none select-none transition active:text-accent active:bg-surface-2"
                >
                  <Icon name="grip" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

/**
 * ملصقٌ في شبكة القائمة.
 *
 * الرقم والتقييم معلومتان مستقلّتان تماماً ولا يجوز أن تُقرآ واحدة: الرقم
 * ترتيبُ مشاهدةٍ أو مرتبة، والتقييم رأيُ صاحب الحساب. ولذلك اختلفا شكلاً
 * قبل أن يختلفا موضعاً — الرقم رقمٌ عارٍ بلون الهوية بلا إطارٍ ولا خلفية،
 * والتقييم قرصٌ أسود صغير بنجمة، وهو فوقه لا بجانبه.
 *
 * الحجاب السفليّ الخفيف على الصورة (لا على الرقم) هو ما يجعل الأصفر مقروءاً
 * فوق ملصقٍ فاتح: #FFD200 على أبيض نسبتُه ١٫٥:١ — أي غير مقروء. هو نفس
 * الحلّ المستعمل في بطاقة الملصق منذ البداية (D-004)، لا شارةً ولا ظلّاً.
 */
function PosterTile({
  item,
  n,
  rating,
  canRemove,
  onRemove,
  t,
}: {
  item: ListItem;
  n: number | null;
  rating: number | null;
  canRemove: boolean;
  onRemove: () => void;
  t: Dict;
}) {
  const url = posterUrl(item.poster_path, "w342");
  const href = item.media_type === "movie" ? `/movie/${item.tmdb_id}` : `/show/${item.tmdb_id}`;

  return (
    <div className="relative group">
      <Link href={href} prefetch={false} className="block">
        <div className="relative aspect-[2/3] rounded-poster overflow-hidden bg-surface-2 border border-border">
          {url ? (
            <Image
              src={url}
              alt={item.title ?? ""}
              fill
              sizes="(max-width: 640px) 33vw, 140px"
              className="object-cover transition duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={item.media_type === "movie" ? "film" : "tv"} size={20} />
            </span>
          )}

          {(n !== null || rating !== null) && (
            <>
              <div
                className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)" }}
              />
              <div className="absolute bottom-1.5 start-1.5 flex flex-col items-start gap-1 pointer-events-none">
                {rating !== null && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums leading-none"
                    dir="ltr"
                  >
                    <Icon
                      name="star"
                      size={10}
                      strokeWidth={2.4}
                      className="text-[color:var(--verified)]"
                    />
                    {rating}
                  </span>
                )}
                {n !== null && (
                  /* `key` على القيمة: تغيّرُ الرقم يعيد تركيب العنصر فتعمل
                     قفزةُ `check-pop` — الأرقام تتبدّل بعد الترتيب فتُرى */
                  <span
                    key={n}
                    className="check-pop block text-accent font-extrabold leading-none tabular-nums text-[26px] sm:text-[30px]"
                    dir="ltr"
                  >
                    {n}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <p className="mt-1.5 text-[12px] leading-tight line-clamp-2">
          {item.title ?? `#${item.tmdb_id}`}
        </p>
      </Link>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.listRemove}
          /* ظاهرٌ دائماً لا عند التمرير: الجوال لا يعرف hover، وإخفاؤه
             خلفه كان سيمحو الإزالة من الجهاز الذي تُستعمل فيه أكثر */
          /* ظاهرٌ دائماً (الجوال لا يعرف hover) لكن خافتٌ عمداً: ستّ بطاقات
             بستّ علاماتٍ صارخة تنافس أرقام الترتيب على أول ما تقع عليه
             العين. الهدف ٣٢ بكسلاً واللمس عليه، والدائرة ٢٠ */
          className="absolute top-1 end-1 grid place-items-center w-8 h-8 text-white/60 transition active:scale-90 hover:text-white"
        >
          <span className="grid place-items-center w-5 h-5 rounded-full bg-black/55 backdrop-blur-sm">
            <Icon name="close" size={11} strokeWidth={2.2} />
          </span>
        </button>
      )}
    </div>
  );
}
