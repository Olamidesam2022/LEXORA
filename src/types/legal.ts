export type UserRole = "legal_officer" | "operations_manager" | "managing_partner";

export type ProceduralStage =
  | "Mention"
  | "Interlocutory"
  | "Trial"
  | "Judgment";

export type LitigationStatus =
  | "Active"
  | "In Progress"
  | "Pending"
  | "Closed"
  | "Urgent"
  | "Archived";

export type AdvisoryStatus = "Pending" | "In Progress" | "Completed" | "Urgent";
export type PracticeArea = "corporate_commercial" | "ma" | "tech_ip" | "contracts" | "regulatory_compliance" | "corporate_secretarial" | "adr" | "litigation" | "needs_review";
export type MatterStatus = "open" | "closed";

const practiceAreaLabels: Record<PracticeArea, string> = {
  corporate_commercial: "Corporate & Commercial",
  ma: "Mergers & Acquisitions",
  tech_ip: "Technology & Intellectual Property",
  contracts: "Commercial Transactions & Contracts",
  regulatory_compliance: "Regulatory & Compliance",
  corporate_secretarial: "Corporate Secretarial",
  adr: "Alternative Dispute Resolution",
  litigation: "Litigation",
  needs_review: "Needs Review",
};

export function formatPracticeArea(value?: string | null): string {
  if (!value) return practiceAreaLabels.needs_review;
  if (value in practiceAreaLabels) return practiceAreaLabels[value as PracticeArea];
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export type DocumentType =
  | "MoU"
  | "Court Process"
  | "Legal Opinion"
  | "Contract"
  | "Correspondence";

export type DocumentWorkflowStatus =
  | "draft"
  | "submitted"
  | "in_ops_review"
  | "awaiting_partner_approval"
  | "approved";

export interface Matter {
  id: string;
  clientId?: string;
  practiceArea?: PracticeArea;
  matterStatus?: MatterStatus;
  suitNumber: string;
  matterTitle: string;
  adversaryParty: string;
  proceduralStage: ProceduralStage;
  assignedCounsel: string;
  status: LitigationStatus;
  nextHearing: Date;
  court: string;
  filedDate: Date;
  description: string;
  createdBy?: string;
  creatorEmail?: string;
  enteredBy?: string;
  assignedTo?: string;
  assignedUserIds?: string[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface AdvisoryRequest {
  id: string;
  requestNumber: string;
  title: string;
  requestedBy: string;
  department: string;
  dateReceived: Date;
  dueDate: Date;
  status: AdvisoryStatus;
  assignedTo: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  description: string;
}

export interface LegalDocument {
  id: string;
  name: string;
  type: DocumentType;
  matterId?: string;
  storagePath?: string;
  mimeType?: string;
  version: string;
  uploadedBy: string;
  uploadedAt: Date;
  lastModified: Date;
  size: string;
  status: DocumentWorkflowStatus;
  createdBy?: string;
  enteredBy?: string;
  canDownload?: boolean;
  canDelete?: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  details: string;
}

export type MatterTaskStatus = "open" | "in_progress" | "completed";
export type MatterTaskPriority = "low" | "normal" | "high" | "urgent";

export interface MatterNote {
  id: string;
  matterId: string;
  content: string;
  createdBy?: string;
  authorName: string;
  isPrivate: boolean;
  noteType: string;
  createdAt: Date;
}

export interface MatterTask {
  id: string;
  matterId: string;
  title: string;
  description?: string;
  status: MatterTaskStatus;
  priority: MatterTaskPriority;
  dueDate?: Date;
  assignedTo?: string;
  assigneeName: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: "pending" | "approved" | "rejected";
  department: string;
  avatar?: string;
  createdAt?: string;
  assignedClientCount?: number;
}

export interface DashboardMetrics {
  activeLitigation: number;
  urgentHearings: number;
  winRate: number;
  totalMatters: number;
}
