import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Info } from 'lucide-react';
import { saveAs } from 'file-saver';
import { usePageHeaderTitle } from '../lib/usePageTitle';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DateRangePicker } from '../components/DateRangePicker';

type CsvRow = Record<string, string | number | null>;

const formatDateDisplay = (date: string | Date | null | undefined) => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
};

const formatDisplayDate = (date: string | Date | null | undefined) => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'MM/dd/yyyy');
};

const toMoneyString = (value: number | string | null | undefined) => {
  if (value == null) return '0.00';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numeric)) return '0.00';
  return numeric.toFixed(2);
};

const toCsv = (rows: CsvRow[]) => {
  if (rows.length === 0) {
    return 'No data available';
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number | null) => {
    if (value == null) return '';
    const cell = String(value);
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const csvLines = [headers.join(',')];

  rows.forEach((row) => {
    const line = headers.map((header) => escapeCell(row[header] ?? '')).join(',');
    csvLines.push(line);
  });

  return csvLines.join('\n');
};

const ExportPaymentDataPage: React.FC = () => {
  usePageHeaderTitle('Export Payment Data');
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [startDate, endDate] = dateRange;

  const rangeLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${formatDateDisplay(startDate)} → ${formatDateDisplay(endDate)}`;
    }
    if (startDate) {
      return `${formatDateDisplay(startDate)} → present`;
    }
    if (endDate) {
      return `All dates up to ${formatDateDisplay(endDate)}`;
    }
    return 'All dates';
  }, [startDate, endDate]);

  const handleExport = async () => {
    if (!user) {
      setError('You must be signed in to export payment data.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('export-payout-summary', {
        body: {
          startDate: startDate ? startDate.toISOString() : undefined,
          endDate: endDate ? endDate.toISOString() : undefined,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to generate payout summary.');
      }

      const payouts = Array.isArray(data?.payouts) ? data.payouts : [];
      const transactions = Array.isArray(data?.transactions) ? data.transactions : [];

      if (payouts.length === 0 && transactions.length === 0) {
        setError('No Stripe payouts or transactions were found for the selected range.');
        return;
      }

      const bankFeedRows: CsvRow[] = payouts.map((payout: any) => ({
        Date: formatDisplayDate(payout.arrival_date),
        Description: `Stripe Payout ${payout.id}`,
        Amount: payout.amount != null ? toMoneyString(Number(payout.amount)) : '0.00',
      }));

      const detailRows: CsvRow[] = transactions.map((tx: any) => ({
        TransactionDate: formatDisplayDate(tx.transaction_date || tx.payout_arrival_date),
        GrossSale: toMoneyString(Number(tx.gross_sale ?? 0)),
        TotalFee: toMoneyString(Number(tx.total_fee ?? 0)),
        NetPayoutValue: toMoneyString(Number(tx.net_payout_value ?? 0)),
        CustomerReference: tx.customer_reference ?? '',
        Description: tx.description ?? '',
        StripePaymentIntent: tx.stripe_payment_intent ?? '',
      }));

      const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
      const bankFeedCsv = toCsv(bankFeedRows);
      const detailCsv = toCsv(detailRows);

      saveAs(new Blob([bankFeedCsv], { type: 'text/csv;charset=utf-8;' }), `qbo-bank-feed-${timestamp}.csv`);
      saveAs(new Blob([detailCsv], { type: 'text/csv;charset=utf-8;' }), `qbo-transaction-detail-${timestamp}.csv`);

      setSuccessMessage('Two CSV downloads are starting: QBO Bank Feed and Detailed Transaction Report.');
    } catch (err: any) {
      setError(err?.message || 'Unable to export payment data. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-maroon-900 font-display">Export Payment Data</h1>
        <p className="text-maroon-600 max-w-2xl">
          Download QuickBooks-ready CSV files that summarize Stripe payouts and provide transaction-level detail. Import the bank feed file into a Stripe Clearing Account, then use the detailed report to record gross income and fees before matching in QuickBooks Online.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Date range</CardTitle>
            <CardDescription>
              Choose the period to include in the export. Leaving the range empty exports all booking records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateRangePicker value={dateRange} onChange={(value) => setDateRange(value)} />
            <div className="text-sm text-maroon-500">Selected range: {rangeLabel}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Payout summary CSV
            </CardTitle>
            <CardDescription>
              Net payout amounts grouped per booking, intended to match Stripe payout deposits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-maroon-600">
            <p>Each row includes booking ID, property, dates, status, currency, and gross amount.</p>
            <p>Use this to reconcile deposits in your QuickBooks Online banking feed.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Transaction detail CSV
            </CardTitle>
            <CardDescription>
              Full line-item breakdown, including fees, tax rates, and Stripe payment intent IDs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-maroon-600">
            <p>Pair this with the payout summary to document fees and taxes for each booking.</p>
            <p>Helpful for QuickBooks journal entries or audit trails.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Export files</CardTitle>
          <CardDescription>
            Click export to generate both CSV files. They will download automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-700 text-sm">
              {successMessage}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 text-sm text-maroon-600">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Workflow reminder: import the bank feed CSV into your Stripe Clearing Account in QBO, create Sales Receipts or Journal Entries from the detailed report, then match deposits in the Banking Center.
              </span>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleExport}
              isLoading={isExporting}
              disabled={isExporting}
              icon={<Download className="h-4 w-4 mr-2" />}
            >
              Export
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExportPaymentDataPage;
