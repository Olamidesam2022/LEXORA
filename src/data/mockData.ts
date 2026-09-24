import { 
  Matter,
  AdvisoryRequest, 
  LegalDocument, 
  AuditLog, 
  User,
  DashboardMetrics 
} from '@/types/legal';

// Empty arrays - all data will be created by users
export const mockUsers: User[] = [];

export const mockMatters: Matter[] = [];

export const mockAdvisoryRequests: AdvisoryRequest[] = [];

export const mockDocuments: LegalDocument[] = [];

export const mockAuditLogs: AuditLog[] = [];

export const mockMetrics: DashboardMetrics = {
  activeLitigation: 0,
  urgentHearings: 0,
  winRate: 0,
  totalMatters: 0,
};
