import { Timestamp } from "firebase/firestore";

export interface ClientProfile {
  clickupFolderId: string;
  clickupFolderName: string;
  monthlyWorkListId: string;
  syncedAt: Timestamp;
  // Admin-managed fields
  fullName?: string;
  executiveDirectorName?: string;
  coverImageUrl?: string;
  logoImageUrl?: string;
  servicesAvailed?: string[];
  isActive?: boolean;
  createdAt?: Timestamp;
}

export interface ChecklistItem {
  id: string;
  name: string;
  resolved: boolean;
  orderIndex: number;
}

export interface Task {
  taskId: string;
  name: string;
  description: string;
  status: string;
  dueDate: Timestamp | null;
  checklist: ChecklistItem[];
  // Custom fields
  client: string | null;
  cadence: string | null;
  responsibility: string | null;
  listType: string | null;
  taskType: string | null;
  workMonth: string | null;
  workYear: string | null;
  approvalRequired: boolean;
  syncedAt: Timestamp;
}
