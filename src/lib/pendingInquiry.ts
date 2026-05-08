import type { Json } from '../types/database';
import { buildInquiryMessage, collectSelectedAdjustmentIds, parseHeadcountValue, toPlainTimeRange } from './inquiryHelpers';

export type PendingInquirySelection = {
  start: string;
  end: string;
};

export interface PendingInquiryPayload extends Record<string, Json | undefined> {
  propertyId: string;
  startDate: string;
  endDate: string;
  mode: 'daily' | 'hourly';
  isHourlyMode: boolean;
  hourlySelection: PendingInquirySelection | null;
  startAt: string | null;
  endAt: string | null;
  headcount: string;
  headcountValue: number | null;
  selectedUserDiscounts: Record<string, boolean>;
  selectedAdjustmentIds: string[];
  formData: {
    spaceRequirements: string;
    brandInfo: string;
    comments: string;
  };
  message: string;
  guestEmail?: string;
  guestName?: string;
  propertyTimezone: string | null;
  redirectPath: string;
  // New: setup/cleanup buffers captured from ManagePropertyPage settings
  setupBuffer?: number | null;
  cleanupBuffer?: number | null;
}

export const buildPendingInquiryPayload = (params: {
  propertyId: string;
  startDate: string;
  endDate: string;
  mode: 'daily' | 'hourly';
  hourlySelection: PendingInquirySelection | null;
  headcount: string;
  selectedUserDiscounts: Record<string, boolean>;
  formData: {
    spaceRequirements: string;
    brandInfo: string;
    comments: string;
  };
  guestEmail?: string;
  guestName?: string;
  propertyTimezone: string | null;
  redirectPath: string;
  // Optional buffers from the caller (minutes for hourly, days for daily)
  setupBuffer?: number | null;
  cleanupBuffer?: number | null;
}) => {
  const headcountValue = parseHeadcountValue(params.headcount);
  const plainSelection = toPlainTimeRange(params.hourlySelection);
  const message = buildInquiryMessage({
    sections: params.formData,
    mode: params.mode,
    hourlySelection: plainSelection,
    propertyTimezone: params.propertyTimezone,
  });

  const payload = {
    propertyId: params.propertyId,
    startDate: params.startDate,
    endDate: params.endDate,
    mode: params.mode,
    isHourlyMode: params.mode === 'hourly',
    hourlySelection: plainSelection,
    startAt: plainSelection?.start ?? null,
    endAt: plainSelection?.end ?? null,
    headcount: params.headcount,
    headcountValue,
    selectedUserDiscounts: params.selectedUserDiscounts,
    selectedAdjustmentIds: collectSelectedAdjustmentIds(params.selectedUserDiscounts),
    formData: params.formData,
    message,
    guestEmail: params.guestEmail,
    guestName: params.guestName,
    propertyTimezone: params.propertyTimezone,
    redirectPath: params.redirectPath,
    setupBuffer: params.setupBuffer ?? null,
    cleanupBuffer: params.cleanupBuffer ?? null,
  } satisfies PendingInquiryPayload;

  return payload;
};
