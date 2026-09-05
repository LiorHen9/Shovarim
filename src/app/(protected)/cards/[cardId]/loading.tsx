import { CardDetailSkeleton } from "@/components/skeletons/PageSkeletons";
import { WaitingForConnection } from "@/components/skeletons/WaitingForConnection";

export default function Loading() {
  return (
    <>
      <WaitingForConnection />
      <CardDetailSkeleton />
    </>
  );
}
