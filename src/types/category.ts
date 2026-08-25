export interface Category {
  id: string;
  ownerId: string | "system";
  name: string;
  icon: string | null;
  color: string | null;
  isSystemDefault: boolean;
}
