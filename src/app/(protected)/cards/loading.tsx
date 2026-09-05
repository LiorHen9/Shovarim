import { CardListSkeleton } from "@/components/skeletons/PageSkeletons";
import { WaitingForConnection } from "@/components/skeletons/WaitingForConnection";

export default function Loading() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הרשימות שלי</h1>
      <WaitingForConnection />
      <CardListSkeleton />
    </div>
  );
}
