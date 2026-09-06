"use client";

import { useAuth } from "@/hooks/useAuth";
import { ClubsGrid } from "@/components/clubs/ClubsGrid";

export default function ClubsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">מועדוני חברות</h1>
        <p className="text-sm text-muted-foreground">
          סמנו את כרטיסי המועדון שברשותכם. בהמשך נציג כאן את ההטבות הרלוונטיות עבורכם.
        </p>
      </div>

      {user && <ClubsGrid uid={user.uid} />}
    </div>
  );
}
