import { PartOwnerRole, PartStatus } from "@prisma/client";

export type PartListItem = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  status: PartStatus;
  quantityRequired: number;
  quantityComplete: number;
  priority: number;
  updatedAt: string;
  owners: Array<{
    userId: string;
    role: PartOwnerRole;
    user: {
      id: string;
      displayName: string;
    };
  }>;
  photos: Array<{
    id: string;
    storageKey: string;
  }>;
};
