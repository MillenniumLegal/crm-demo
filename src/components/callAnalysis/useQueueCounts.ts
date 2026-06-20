// Range-wide worklist counts for the Call Analysis queue strip.
//
// One export-RPC scan covers most queues; manager risk flags are not in the
// export RPC, so flagged calls come from a short paged sweep of the rows RPC
// (analysed calls only, the only rows that can carry flags). The booked set
// comes from one range-wide activity_log query and replaces the old per-page
// follow-up schedule lookup.
//
// The scan deliberately does NOT run on the 90-second silent poll — the page
// calls refresh() on load, on filter change, and once when the AI backlog for
// the range drains to zero.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CallAnalysisFilters,
  CallAnalysisRow,
  fetchCallAnalysisExportRows,
  fetchCallAnalysisRows,
} from '@/services/threecxService';

const ROWS_SCAN_PAGE_SIZE = 100;
const ROWS_SCAN_MAX_PAGES = 8;
const BOOKED_SCAN_LIMIT = 2000;

const MISSED_STATUSES = ['missed', 'abandoned', 'no_answer', 'noanswer', 'no answer', 'unanswered'];

export interface QueueCounts {
  loading: boolean;
  capped: boolean;
  /** Hot or possible-hot inbound calls that were missed/abandoned. */
  missedHot: number;
  /** Calls where APCM AI detected a promised call-back. */
  callbacksPromised: number;
  /** Promised call-backs with no contact attempt booked from Call Analysis. */
  callbacksNotBooked: number;
  /** AI says they intend to instruct, but no CRM instruction yet. */
  intentNotSigned: number;
  /** Full rows for calls carrying manager risk flags (drives drawer queue mode). */
  flaggedRows: CallAnalysisRow[] | null;
  /** callRecordId -> a call-back was booked from Call Analysis. */
  bookedMap: Record<string, boolean>;
}

const emptyCounts: QueueCounts = {
  loading: true,
  capped: false,
  missedHot: 0,
  callbacksPromised: 0,
  callbacksNotBooked: 0,
  intentNotSigned: 0,
  flaggedRows: null,
  bookedMap: {},
};

export function useQueueCounts(filters: CallAnalysisFilters) {
  const [counts, setCounts] = useState<QueueCounts>(emptyCounts);
  const requestIdRef = useRef(0);

  const filterKey = JSON.stringify(filters);

  const runScan = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setCounts((current) => ({ ...current, loading: true }));

    try {
      const [exportResult, bookedResult] = await Promise.all([
        fetchCallAnalysisExportRows(filters),
        supabase
          .from('activity_log')
          .select('metadata, action_description')
          .contains('metadata', { source: 'call_analysis' })
          .order('created_at', { ascending: false })
          .limit(BOOKED_SCAN_LIMIT),
      ]);

      if (requestId !== requestIdRef.current) return;

      const bookedMap: Record<string, boolean> = {};
      (bookedResult.data || []).forEach((activity: any) => {
        const callRecordId = activity.metadata?.callRecordId || activity.metadata?.call_record_id;
        if (callRecordId) bookedMap[String(callRecordId)] = true;
      });
      if (bookedResult.error) {
        console.warn('Call analysis booked-set lookup failed:', bookedResult.error);
      }

      let missedHot = 0;
      let callbacksPromised = 0;
      let callbacksNotBooked = 0;
      let intentNotSigned = 0;

      for (const row of exportResult.rows) {
        const status = String(row.status || '').toLowerCase();
        const isMissed = MISSED_STATUSES.some((value) => status.includes(value));
        if ((row.inboundHotCall || row.possibleHotCall) && isMissed) missedHot += 1;
        if (row.followUpNeeded) {
          callbacksPromised += 1;
          if (!bookedMap[row.callId]) callbacksNotBooked += 1;
        }
        if (row.instructionIntent && !row.officialInstruction) intentNotSigned += 1;
      }

      // Manager-flag sweep: analysed calls only, newest first, capped pages.
      const flaggedRows: CallAnalysisRow[] = [];
      const flagFilters: CallAnalysisFilters = { ...filters, aiStatus: 'completed' };
      let scannedAll = true;
      for (let pageIndex = 1; pageIndex <= ROWS_SCAN_MAX_PAGES; pageIndex += 1) {
        const { rows: pageRows, totalCount } = await fetchCallAnalysisRows(flagFilters, pageIndex, ROWS_SCAN_PAGE_SIZE);
        if (requestId !== requestIdRef.current) return;
        flaggedRows.push(...pageRows.filter((row) => row.managerRiskFlags.length > 0));
        if (pageIndex * ROWS_SCAN_PAGE_SIZE >= totalCount || pageRows.length === 0) break;
        if (pageIndex === ROWS_SCAN_MAX_PAGES) scannedAll = false;
      }

      setCounts({
        loading: false,
        capped: exportResult.isCapped || !scannedAll,
        missedHot,
        callbacksPromised,
        callbacksNotBooked,
        intentNotSigned,
        flaggedRows,
        bookedMap,
      });
    } catch (scanError) {
      console.error('Call analysis queue scan failed:', scanError);
      if (requestId !== requestIdRef.current) return;
      setCounts((current) => ({ ...current, loading: false, flaggedRows: current.flaggedRows || [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  return { counts, refresh: runScan };
}
