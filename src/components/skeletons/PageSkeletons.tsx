import { Skeleton } from "@/components/ui/skeleton";

// Shared between each route's loading.tsx and the client page that renders behind it.
//
// The duplication this avoids is visible, not theoretical: loading.tsx covers the server
// render, then the page mounts and shows its own placeholder while the onSnapshot hooks
// resolve. If the two draw different shapes the user sees a double flash, so both sides
// import from here.

/** Dashboard: a single summary panel. */
export function DashboardSkeleton() {
  return <Skeleton className="h-24 w-full" />;
}

/** Card lists and the cards inside one list: a stack of rows. */
export function CardListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

/** A single card's detail panel. */
export function CardDetailSkeleton() {
  return <Skeleton className="h-40 w-full" />;
}

/** Settings and the admin home: a heading followed by stacked sections. */
export function SectionsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
