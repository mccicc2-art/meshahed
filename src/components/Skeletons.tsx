// هياكل عظمية بنفس أبعاد المحتوى الحقيقي، حتى لا تقفز الصفحة عند وصول البيانات.
import { PosterGrid } from "./PosterGrid";

export function PosterCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[2/3] rounded-poster border border-border" />
      <div className="skeleton h-3 rounded mt-2 w-11/12" />
      <div className="skeleton h-2.5 rounded mt-1.5 w-1/2" />
    </div>
  );
}

export function RowSkeleton({ count = 6, title = true }: { count?: number; title?: boolean }) {
  return (
    <section aria-hidden>
      {title && <div className="skeleton h-5 w-40 rounded mb-4" />}
      <PosterGrid>
        {Array.from({ length: count }, (_, i) => (
          <PosterCardSkeleton key={i} />
        ))}
      </PosterGrid>
    </section>
  );
}

export function ProfileCardSkeleton() {
  return (
    <section aria-hidden className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="skeleton hidden sm:block h-40" />
      <div className="p-4 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-3 sm:block">
          <div className="skeleton w-12 h-12 sm:w-[88px] sm:h-[88px] rounded-full sm:-mt-14 shrink-0" />
          <div className="flex-1 sm:mt-3">
            <div className="skeleton h-5 w-40 rounded" />
            <div className="skeleton h-3 w-24 rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

/** صفٌّ أفقي بنفس مقاس RailItem الحقيقي (118px) — لا إعادة تخطيط عند الوصول */
export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section aria-hidden>
      <div className="flex items-center gap-2 mb-3">
        <div className="skeleton w-[22px] h-[22px] rounded-lg" />
        <div className="skeleton h-5 w-36 rounded" />
      </div>
      <div className="flex gap-3 overflow-hidden -mx-4 px-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-[118px] shrink-0">
            <div className="skeleton aspect-[2/3] rounded-poster border border-border" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** ترويسة الرئيسية: غلافٌ عريض وصفّ أرقام — بنفس ارتفاع ProfileHeader */
export function HomeHeaderSkeleton() {
  return (
    <section aria-hidden>
      <div className="skeleton -mx-4 -mt-[calc(1.5rem+env(safe-area-inset-top))] sm:mx-0 sm:mt-0 sm:rounded-3xl h-[14.2rem] sm:h-[18.2rem]" />
      {/* كتلة الهوية الحقيقية تعتلي الغلاف بهذا القدر وبنفس التراصف —
          صورة بجانب الاسم لا فوقه، وإلا قفز صفّ الأرقام عند وصول المحتوى */}
      <div className="flex items-end gap-3 pe-16 -mt-[5.25rem] sm:-mt-[5.75rem] relative">
        <div className="skeleton w-[86px] h-[86px] rounded-full shrink-0" />
        <div className="skeleton h-6 w-40 rounded mb-2" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    </section>
  );
}

/** صفحة قوائم/سجلّ عامة: عنوان وصفوف — لليوميات والقوائم والتقييمات والإعدادات */
export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden>
      <div className="skeleton h-8 w-44 rounded" />
      <div className="skeleton h-3 w-64 max-w-full rounded mt-2 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl border border-border" />
        ))}
      </div>
    </div>
  );
}

export function NextUpSkeleton() {
  return (
    <div aria-hidden className="skeleton h-28 sm:h-32 rounded-2xl border border-border" />
  );
}

export function DetailSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton -mx-4 -mt-6 h-44 sm:h-72 mb-4" />
      <div className="flex gap-4 -mt-24 sm:-mt-28 relative px-1">
        <div className="w-28 sm:w-40 shrink-0">
          <div className="skeleton aspect-[2/3] rounded-poster border border-border" />
        </div>
        <div className="flex-1 pt-2 space-y-3">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-6 w-20 rounded-full" />
            ))}
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-11/12 rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-11 w-32 rounded-xl mt-4" />
        </div>
      </div>
    </div>
  );
}

export function NewsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="skeleton aspect-[16/9]" />
          <div className="p-4 space-y-2">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-5/6 rounded" />
            <div className="flex gap-2 pt-2">
              <div className="skeleton h-9 w-20 rounded-full" />
              <div className="skeleton h-9 w-32 rounded-full" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
