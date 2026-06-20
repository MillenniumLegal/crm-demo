import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, CreditCard } from 'lucide-react';
import { fetchQuoteById } from '@/services/quotesService';
import { supabase } from '@/lib/supabase';

// API_BASE_URL removed - using Supabase Edge Functions directly

function formatAcceptedAt(dateString?: string) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const day = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const mm = minutes.toString().padStart(2, '0');
    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return s[(v - 20) % 10] || s[v] || s[0];
    };
    return `${day}${getOrdinal(day)} ${month} ${year} ${h12}:${mm}${ampm}`;
  } catch {
    return '';
  }
}

export const QuoteAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<{
    quoteId?: string;
    leadId?: string;
    paymentLink?: string;
    acceptanceUrl?: string;
    acceptedAt?: string;
    stage?: string;
    totalAmount?: number; // legacy total (grand total) - no longer shown
    payableAmount?: number; // amount to pay now (file opening + ID/AML)
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid quote acceptance link. No token provided.');
      setIsLoading(false);
      return;
    }

    // Auto-accept quote on page load
    handleAccept();
  }, [token]);

  const handleAccept = async () => {
    if (!token) {
      setError('Invalid quote acceptance link.');
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      // Call Supabase Edge Function instead of Vercel API route
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not configured');
      }
      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const functionUrl = `${baseUrl}/functions/v1/quote-accept`;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          token: token,
          userAgent: navigator.userAgent,
          ipAddress: null, // Will be handled by server
        }),
      });

      if (!response.ok) {
        // Try to get error details
        let errorText = '';
        try {
          errorText = await response.text();
          // Check if it's HTML (means route doesn't exist)
          if (errorText.trim().startsWith('<!')) {
            throw new Error(`API route not found. The accept quote endpoint may not be deployed yet. Status: ${response.status}`);
          }
          // Try to parse as JSON
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || errorJson.details || `Failed to accept quote (${response.status})`);
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message.includes('API route not found')) {
            throw parseError;
          }
          throw new Error(`Failed to accept quote: ${response.status} ${response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim().startsWith('<!')) {
          throw new Error('API route returned HTML instead of JSON. The route may not be deployed yet.');
        }
        throw new Error(`Invalid response type: ${contentType}`);
      }

      const data = await response.json();

      // Extract payment link from response (could be in multiple formats)
      const paymentLink = data.paymentLink || data.data?.paymentLink || null;
      const quoteId = data.quote?.id || data.data?.quoteId;
      const leadId = data.quote?.lead_id || data.data?.leadId;
      
      // Compute payable amount: £180 per file + £50 per person (no VAT on ID/AML)
      // Files = number of quotes for this lead (buy + sell = 2 files)
      // People = max people_count across those quotes
      let payableAmount: number | undefined = undefined;

      try {
        if (leadId) {
          const { data: quotesForLead, error: quotesErr } = await supabase
            .from('quotes')
            .select('id, people_count')
            .eq('lead_id', leadId);

          if (!quotesErr && quotesForLead && quotesForLead.length > 0) {
            const numberOfFiles = quotesForLead.length;
            const maxPeopleCount = Math.max(
              ...quotesForLead.map((q: any) => (q.people_count && typeof q.people_count === 'number' ? q.people_count : 1))
            );
            payableAmount = numberOfFiles * 180 + maxPeopleCount * 50;
          } else if (quoteId) {
            // Fallback: use single quote
            const singleQuote = await fetchQuoteById(quoteId);
            const peopleCount = (singleQuote as any)?.peopleCount || 1;
            payableAmount = 1 * 180 + peopleCount * 50;
          }
        } else if (quoteId) {
          const singleQuote = await fetchQuoteById(quoteId);
          const peopleCount = (singleQuote as any)?.peopleCount || 1;
          payableAmount = 1 * 180 + peopleCount * 50;
        }
      } catch (calcErr) {
        console.warn('[QuoteAccept] Failed to compute payable amount:', calcErr);
      }
      
      // Fetch quote details (legacy total for context, not displayed for payment)
      let totalAmount: number | undefined = undefined;
      let acceptedAt: string | undefined = data.data?.acceptedAt || data.quote?.accepted_at;
      if (quoteId) {
        try {
          const quote = await fetchQuoteById(quoteId);
          if (quote) {
            totalAmount = quote.totalIncVat || quote.totalAmount || undefined;
            // prefer server value, fallback to quote.acceptedAt
            acceptedAt = acceptedAt || (quote as any).acceptedAt;
          }
        } catch (quoteError) {
          console.error('Error fetching quote details:', quoteError);
        }
      }
      
      // If no payment link was returned, try to fetch it from the lead
      let finalPaymentLink = paymentLink;
      if (!finalPaymentLink && leadId) {
        try {
          console.log(`[QuoteAccept] Fetching payment link for lead ${leadId}`);
          // Call Supabase Edge Function instead of Vercel API route
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
          if (!supabaseUrl) {
            throw new Error('VITE_SUPABASE_URL is not configured');
          }
          const baseUrl = supabaseUrl.replace(/\/$/, '');
          const functionUrl = `${baseUrl}/functions/v1/payment-link/${leadId}`;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

          const paymentLinkResponse = await fetch(functionUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            }
          });

          if (!paymentLinkResponse.ok) {
            // Try to get error details
            let errorText = '';
            try {
              errorText = await paymentLinkResponse.text();
              // Check if it's HTML (means route doesn't exist)
              if (errorText.trim().startsWith('<!')) {
                throw new Error(`Payment link endpoint not found. Status: ${paymentLinkResponse.status}`);
              }
              // Try to parse as JSON
              const errorJson = JSON.parse(errorText);
              throw new Error(errorJson.error || errorJson.details || `Failed to fetch payment link (${paymentLinkResponse.status})`);
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message.includes('endpoint not found')) {
                throw parseError;
              }
              throw new Error(`Failed to fetch payment link: ${paymentLinkResponse.status} ${paymentLinkResponse.statusText}`);
            }
          }

          const contentType = paymentLinkResponse.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await paymentLinkResponse.text();
            if (text.trim().startsWith('<!')) {
              throw new Error('Payment link endpoint returned HTML instead of JSON. The endpoint may not be deployed yet.');
            }
            throw new Error(`Invalid response type: ${contentType}`);
          }

          const paymentLinkData = await paymentLinkResponse.json();
          if (paymentLinkData.success && paymentLinkData.data?.paymentLink) {
            finalPaymentLink = paymentLinkData.data.paymentLink;
            console.log(`[QuoteAccept] Payment link fetched: ${finalPaymentLink}`);
          } else {
            console.error('[QuoteAccept] Failed to fetch payment link:', paymentLinkData);
          }
        } catch (linkError) {
          console.error('Error fetching payment link:', linkError);
          // Don't throw - just log the error and continue without payment link
          // The UI will show "Generating Payment Link..." message
        }
      }

      setQuoteData({
        quoteId: quoteId,
        leadId: leadId,
        paymentLink: finalPaymentLink,
        acceptanceUrl: data.acceptanceUrl || data.data?.acceptanceUrl,
        acceptedAt: acceptedAt,
        stage: data.data?.stage || data.quote?.stage || 'Quote Accepted - Awaiting Payment',
        totalAmount: totalAmount,
        payableAmount: payableAmount,
      });
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error accepting quote:', err);
      setError(err.message || 'Failed to accept quote. Please try again.');
      setIsLoading(false);
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading || isAccepting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: '#011E41' }} />
          <p className="text-gray-600">Processing your quote acceptance...</p>
        </div>
      </div>
    );
  }

  if (error && !quoteData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#011E41' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#023E73'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#011E41'}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-8 text-white" style={{ backgroundColor: '#011E41' }}>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center space-x-3 mb-1">
                <CheckCircle className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Quote Accepted!</h1>
              </div>
              <p className="text-gray-100 max-w-2xl">
                Thank you for accepting your quote. Please proceed to pay your initial deposit to continue.
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Notice</p>
                  <p className="text-sm text-yellow-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-r-lg" style={{ backgroundColor: '#F8F8F9', borderLeft: '4px solid #011E41' }}>
              <h2 className="text-lg font-semibold mb-2" style={{ color: '#011E41' }}>Next Steps</h2>
              <ol className="list-decimal list-inside space-y-2" style={{ color: '#374151' }}>
                <li>Complete your payment using the secure link below</li>
                <li>After payment, you'll receive an instruction form to provide your details</li>
                <li>Once you complete the instruction form, we'll proceed with your conveyancing</li>
              </ol>
            </div>

            {quoteData?.paymentLink ? (
              <div className="space-y-4">
                <div className="rounded-lg p-6 text-center" style={{ backgroundColor: '#F8F8F9', border: '2px solid #E5E7EB' }}>
                  <CreditCard className="h-12 w-12 mx-auto mb-4" style={{ color: '#011E41' }} />
                  <h3 className="text-lg font-semibold mb-1" style={{ color: '#011E41' }}>
                    Pay Your Initial Deposit
                  </h3>
                  {quoteData?.acceptedAt && (
                    <div className="mb-3 text-xs text-gray-500">
                      Accepted on: {formatAcceptedAt(quoteData.acceptedAt)}
                    </div>
                  )}
                  {quoteData.payableAmount !== undefined && (
                    <div className="mb-3">
                      <p className="text-2xl font-bold" style={{ color: '#011E41' }}>
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: 'GBP',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(quoteData.payableAmount)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Initial Deposit (File Opening + ID/AML)</p>
                    </div>
                  )}
                  <p className="text-sm mb-6" style={{ color: '#374151' }}>
                    Click the button below to make your initial deposit securely.
                  </p>
                  <a
                    href={quoteData.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-8 py-4 text-white font-semibold text-lg rounded-lg transition-colors shadow-lg"
                    style={{ backgroundColor: '#011E41' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#023E73'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#011E41'}
                  >
                    Pay Initial Deposit
                  </a>
                </div>
                
                <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#F8F8F9', color: '#374151' }}>
                  <p className="font-medium mb-1" style={{ color: '#011E41' }}>Payment Link:</p>
                  <p className="break-all text-xs">{quoteData.paymentLink}</p>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generating Payment Link...
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please wait while we generate your secure payment link.
                </p>
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">What happens next?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#011E41' }} />
                  <span>Your quote has been accepted and your case is now active</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#011E41' }} />
                  <span>You'll receive a secure payment link via email (if not shown above)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#011E41' }} />
                  <span>After payment, you'll be redirected to an instruction form to collect your details</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: '#011E41' }} />
                  <span>Once complete, our team will begin processing your conveyancing</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#F8F8F9', color: '#374151' }}>
              <p className="font-medium mb-1" style={{ color: '#011E41' }}>Need Help?</p>
              <p>
                If you have any questions or concerns, please don't hesitate to contact us. 
                Our team is here to assist you throughout the process.
              </p>
              <p className="mt-2">
                Email us at:{' '}
                <a 
                  href="mailto:support@millenniumlegal.co.uk" 
                  className="font-semibold hover:underline"
                  style={{ color: '#011E41' }}
                >
                  support@millenniumlegal.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

