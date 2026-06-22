// Lead-resale eligibility queue — the admin operational page: work the sellable leads
// (filter by bucket, see freshness/quality/price/consent, open the Sell Panel and offer
// to a matched buyer). Pairs with the Lead Resale marketplace dashboard.

import React from 'react';
import { EligibilityQueue } from '@/components/resale/EligibilityQueue';

const LeadResaleQueue: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">
        Resale <span className="font-serif italic text-navy-700">queue.</span>
      </h1>
      <p className="mt-0.5 text-sm text-gray-500">Work the sellable leads — filter, price, and offer to a buyer.</p>
    </div>
    <EligibilityQueue />
  </div>
);

export default LeadResaleQueue;
