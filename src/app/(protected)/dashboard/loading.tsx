import { DashboardSkeleton } from "@/components/skeletons/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">סקירה</h1>
        <p className="text-muted-foreground">סיכום הכרטיסים הפעילים שלכם</p>
      </div>
      <DashboardSkeleton />
    </div>
  );
}
