import { Dispatch, SetStateAction } from 'react';
import {
  AdminDataBundle,
  BodyshopOwnerRecord,
  BodyshopRecord,
  LeadRecord,
  NotificationLogRecord,
} from '../../services/adminPlatformService';

export type AdminActionApi = {
  openSection: (section: string) => void;
  openLead: (leadId: string) => void;
  mutateLead: (leadId: string, updater: (lead: LeadRecord) => LeadRecord) => void;
  sendLeadNotification: (lead: LeadRecord) => void;
  moveToManualReview: (lead: LeadRecord, reason?: string) => void;
  markLeadResolved: (lead: LeadRecord) => void;
  archiveLead: (lead: LeadRecord) => void;
  assignLeadToTopShop: (lead: LeadRecord) => void;
  addInternalNote: (leadId: string, note: string) => void;
  addNotificationLog: (entry: Omit<NotificationLogRecord, 'id' | 'sentAt'>) => void;
  setData: Dispatch<SetStateAction<AdminDataBundle>>;
  refresh: () => Promise<void>;
};

export type CommonPageProps = {
  data: AdminDataBundle;
  actions: AdminActionApi;
  bodyshopMap: Record<string, BodyshopRecord>;
  ownerMap: Record<string, BodyshopOwnerRecord>;
};
