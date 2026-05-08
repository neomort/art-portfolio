export type PlainTimeRange = {
  start: string;
  end: string;
};

export type InquiryFormSections = {
  spaceRequirements: string;
  brandInfo: string;
  comments: string;
};

const buildBaseMessage = (sections: InquiryFormSections): string => {
  return `Space Requirements:\n${sections.spaceRequirements}\n\nAbout the Brand:\n${sections.brandInfo}\n\nComments:\n${sections.comments}`;
};

const formatInTimezone = (iso: string, timezone: string | null | undefined): string => {
  try {
    const date = new Date(iso);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const formatted = formatter.format(date);
    return timezone ? `${formatted} (${timezone})` : formatted;
  } catch {
    return new Date(iso).toLocaleString();
  }
};

export const buildInquiryMessage = (params: {
  sections: InquiryFormSections;
  mode: 'daily' | 'hourly';
  hourlySelection: PlainTimeRange | null;
  propertyTimezone: string | null;
}): string => {
  const base = buildBaseMessage(params.sections);
  if (params.mode === 'hourly' && params.hourlySelection) {
    const startLabel = formatInTimezone(params.hourlySelection.start, params.propertyTimezone);
    const endLabel = formatInTimezone(params.hourlySelection.end, params.propertyTimezone);
    return `${base}\n\nRequested Time (Local): ${startLabel} - ${endLabel}`;
  }
  return base;
};

export const buildInquiryEmailSummary = (sections: InquiryFormSections): string => {
  return buildBaseMessage(sections);
};

export const toPlainTimeRange = (selection: { start: string; end: string } | null | undefined): PlainTimeRange | null => {
  if (!selection?.start || !selection?.end) return null;
  return { start: selection.start, end: selection.end };
};

export const parseHeadcountValue = (input: string): number | null => {
  if (!input) return null;
  const parsed = parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
};

export const collectSelectedAdjustmentIds = (selected: Record<string, boolean>): string[] => {
  return Object.entries(selected)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
};
