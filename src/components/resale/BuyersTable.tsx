import React from 'react';

interface ResaleBuyer {
  name: string;
  leadsBought: number;
  spend: number;
  avgPrice: number;
  rating: string;
  status: string;
}

interface Props {
  buyers: ResaleBuyer[];
}

export const BuyersTable: React.FC<Props> = ({ buyers }) => {
  const fmt = (n: number) => '£' + Math.round(n).toLocaleString();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">Buyers</div>
      <div className="text-xs text-gray-500">Partner firms buying leads</div>

      {buyers.length === 0 ? (
        <div className="mt-4 text-xs text-gray-400">No buyers to display.</div>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 text-left font-medium">Buyer</th>
              <th className="py-2 text-right font-medium">Leads</th>
              <th className="py-2 text-right font-medium">Spend</th>
              <th className="py-2 text-right font-medium">Avg price</th>
              <th className="py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {buyers.map((b, i) => (
              <tr key={`${b.name}-${i}`}>
                <td className="py-2 text-left">
                  <span className="font-medium text-gray-900">{b.name}</span>
                  <span className="ml-2 rounded bg-gray-100 px-1.5 text-[10px] text-gray-600">
                    {b.rating}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">{b.leadsBought}</td>
                <td className="py-2 text-right tabular-nums">{fmt(b.spend)}</td>
                <td className="py-2 text-right tabular-nums">{fmt(b.avgPrice)}</td>
                <td className="py-2 text-right">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs capitalize ' +
                      (b.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-600')
                    }
                  >
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
