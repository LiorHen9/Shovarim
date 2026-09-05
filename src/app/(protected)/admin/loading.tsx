import { SectionsSkeleton } from "@/components/skeletons/PageSkeletons";

// /admin is an async Server Component running four Firestore aggregations in
// parallel (ADR #50), so unlike the client pages this one has a real server-side
// wait to cover — and it had no placeholder of any kind before.
export default function Loading() {
  return (
    <>
      <SectionsSkeleton />
    </>
  );
}
