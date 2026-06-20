import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildInstructionPdf } from '@/utils/instructionPdf';

const BRAND_NAVY = '#011E41';
const BRAND_BG = '#F8F8F9';

export const InstructionForm: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const handleDownloadExistingPdf = async () => {
    try {
      if (!existingPdfUrl) return;
      const res = await fetch(existingPdfUrl, { credentials: 'omit' });
      if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `Instruction_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Failed to download instruction PDF:', err);
    }
  };

  // Form fields
  const [formData, setFormData] = useState({
    name: '',           // Accepts multiple, comma-separated
    email: '',          // Accepts multiple, comma-separated
    phone: '',          // Accepts multiple, comma-separated
    address: '',        // Correspondence address
    dateOfBirth: '',
    nationalInsurance: '',
    propertyAddress: '',
    propertyValue: '',
    transactionType: '', // Purchase | Sale | Purchase and Sale | Remortgage | Remortgage Cashback | Transfer of Equity | Equity Release
    tenure: '',          // Freehold | Leasehold
    mortgageProvider: '',
    lender: '',
    purchasePrice: '',
    salePrice: '',
    remortgageAmount: '',
    advisor: '',
    estateAgent: '',     // Name and phone if desired
    additionalNotes: '',
    purchasePropertyAddress: '',
    salePropertyAddress: ''
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid instruction link. No token provided.');
      setIsLoading(false);
      return;
    }
    // Check token status: if already submitted/completed, do not show the form
    (async () => {
      try {
        const { data, error: leadErr } = await supabase
          .from('leads')
          .select('id, instruction_form_status, instruction_form_submitted_at, instruction_pdf_url')
          .eq('instruction_form_token', token)
          .single();
        if (leadErr) {
          // If not found, show invalid token error
          setError('Invalid or expired instruction link.');
        } else if (data) {
          const status = (data as any).instruction_form_status || '';
          if (status === 'submitted' || status === 'completed') {
            setAlreadySubmitted(true);
            setSubmittedAt((data as any).instruction_form_submitted_at || null);
            setExistingPdfUrl((data as any).instruction_pdf_url || null);
          }
        }
      } catch (e) {
        // Non-blocking: allow form if lookup fails
        console.warn('Failed to check instruction token status:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent';
  const focusRing = { boxShadow: `0 0 0 2px ${BRAND_NAVY}33` } as React.CSSProperties;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Invalid instruction link. No token provided.');
      return;
    }
    if (alreadySubmitted) {
      setError('This instruction form has already been submitted.');
      return;
    }

    // Client-side validation for important required fields (beyond HTML required)
    const validationError = (() => {
      const requiredBasics = [
        { key: 'name', label: 'Full Name(s)' },
        { key: 'email', label: 'Email Address(es)' },
        { key: 'phone', label: 'Contact Number(s)' },
        { key: 'address', label: 'Current Correspondence Address' },
        { key: 'transactionType', label: 'Transaction Type' },
      ] as const;
      for (const f of requiredBasics) {
        if (!String((formData as any)[f.key]).trim()) {
          return `${f.label} is required.`;
        }
      }
      const tx = (formData.transactionType || '').toLowerCase();
      if (tx.includes('purchase') && !tx.includes('sale')) {
        if (!formData.propertyAddress.trim()) return 'Purchase Property Address is required.';
        if (!String(formData.purchasePrice).trim()) return 'Purchase Price is required.';
      }
      if (tx.includes('sale') && !tx.includes('purchase')) {
        if (!formData.propertyAddress.trim()) return 'Sale Property Address is required.';
        if (!String(formData.salePrice).trim()) return 'Sale Price is required.';
      }
      if (tx.includes('purchase') && tx.includes('sale')) {
        if (!formData.purchasePropertyAddress.trim()) return 'Purchase Property Address is required.';
        if (!formData.salePropertyAddress.trim()) return 'Sale Property Address is required.';
        if (!String(formData.purchasePrice).trim()) return 'Purchase Price is required.';
        if (!String(formData.salePrice).trim()) return 'Sale Price is required.';
      }
      if (tx.includes('remortgage')) {
        if (!String(formData.remortgageAmount).trim()) return 'Remortgage Amount is required.';
      }
      return '';
    })();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Call Supabase Edge Function instead of Vercel API route
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not configured');
      }
      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const functionUrl = `${baseUrl}/functions/v1/instruction-form-submit`;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          token: token,
          formData: formData
        }),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (parseErr) {
        // Non-JSON or empty body
        data = null;
      }

      if (!response.ok) {
        let serverMessage = (data && (data.error || data.message)) || raw || `HTTP ${response.status} ${response.statusText}`;
        if (data && data.details) {
          serverMessage = `${serverMessage}: ${data.details}`;
        }
        throw new Error(serverMessage);
      }

      // Build and upload instruction PDF, attach to lead
      const leadId: string | undefined = data?.lead?.id;
      console.log('📄 PDF Generation - Lead ID:', leadId);
      console.log('📄 PDF Generation - Full response data:', data);
      
      if (leadId) {
        try {
          console.log('📄 Fetching lead data for PDF...');
          // Fetch full lead and latest quote
          const { data: leadRow, error: leadFetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

          if (leadFetchError) {
            console.error('❌ Failed to fetch lead:', leadFetchError);
            throw leadFetchError;
          }

          console.log('📄 Fetching quotes for PDF...');
          let latestQuote: any = null;
          const { data: quotes, error: quotesError } = await supabase
            .from('quotes')
            .select('id, total_inc_vat, legal_fee_ex_vat, short_code, created_at')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (quotesError) {
            console.warn('⚠️ Failed to fetch quotes:', quotesError);
          }

          if (quotes && quotes.length > 0) latestQuote = quotes[0];

          const payload = {
            ...leadRow,
            ...formData,
            latestQuoteTotalIncVat: latestQuote?.total_inc_vat ?? null,
            latestLegalFeeExVat: latestQuote?.legal_fee_ex_vat ?? null,
            shortCode: (leadRow as any)?.short_code || latestQuote?.short_code || '',
          } as any;

          console.log('📄 Generating PDF...');
          const { doc } = await buildInstructionPdf(payload);
          const pdfArrayBuffer = doc.output('arraybuffer');
          const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

          console.log('📤 Uploading PDF to storage...');
          const path = `${leadId}/instruction_${Date.now()}.pdf`;
          const upload = await supabase.storage.from('instructions').upload(path, pdfBlob, { upsert: true, contentType: 'application/pdf' });
          
          if (upload.error) {
            console.error('❌ Failed to upload instruction PDF:', upload.error);
          } else {
            console.log('✅ PDF uploaded successfully:', path);
            const { data: pub } = supabase.storage.from('instructions').getPublicUrl(path);
            const publicUrl = pub?.publicUrl;
            console.log('🔗 Public URL:', publicUrl);
            
            if (publicUrl) {
              console.log('💾 Saving PDF URL to lead...');
              const { error: updateError } = await supabase
                .from('leads')
                .update({ instruction_pdf_url: publicUrl })
                .eq('id', leadId);
              
              if (updateError) {
                console.error('❌ Failed to save PDF URL:', updateError);
              } else {
                console.log('✅ PDF URL saved to lead successfully');
              }
            }
          }
        } catch (pdfErr) {
          console.error('❌ Instruction PDF generation/upload failed:', pdfErr);
        }
      } else {
        console.warn('⚠️ No lead ID found in response, skipping PDF generation');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting instruction form:', err);
      setError(err.message || 'Failed to submit instruction form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: BRAND_NAVY }} />
          <p className="text-gray-600">Loading instruction form...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: BRAND_NAVY }} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-4">
            Your instruction form has been submitted successfully.
          </p>
          <p className="text-sm text-gray-500">
            We've received your details. Our team will be in touch.
          </p>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: BRAND_NAVY }} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Instruction Form Already Submitted</h1>
          <p className="text-gray-600 mb-2">
            Thank you. Our team has received your information{submittedAt ? ' on ' : ''}{
              submittedAt ? new Date(submittedAt).toLocaleString('en-GB') : ''}.
          </p>
          {existingPdfUrl ? (
            <button
              type="button"
              onClick={handleDownloadExistingPdf}
              className="inline-flex items-center mt-4 px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: BRAND_NAVY }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Download Your Instruction PDF
            </button>
          ) : null}
          <div className="mt-6">
            <a
              href="https://millenniumlegal.co.uk"
              className="px-4 py-2 inline-block rounded-lg text-gray-700 border border-gray-300"
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-8 text-white" style={{ backgroundColor: BRAND_NAVY }}>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <FileText className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Instruction Form</h1>
              </div>
              <p className="max-w-2xl text-gray-100">
                Thanks for completing your payment. Please provide your information to complete the instruction process.
              </p>
            </div>
          </div>

          {/* Accent bar */}
          <div style={{ height: 4, backgroundColor: BRAND_NAVY }} />

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg p-4 flex items-start space-x-3" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#991B1B' }}>Error</p>
                  <p className="text-sm mt-1" style={{ color: '#B91C1C' }}>{error}</p>
                </div>
              </div>
            )}

            {/* Client Information Section */}
            <div className="space-y-4">
              <div className="rounded-lg p-5" style={{ backgroundColor: BRAND_BG, border: '1px solid #E5E7EB' }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: BRAND_NAVY }}>Client Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name(s) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                      placeholder="e.g., John Doe, Jane Doe"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address(es) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                      placeholder="e.g., john@example.com, jane@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Number(s) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                      placeholder="e.g., 07700 900123, 07700 900456"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                    />
                  </div>

                  <div>
                    <label htmlFor="nationalInsurance" className="block text-sm font-medium text-gray-700 mb-1">
                      National Insurance Number
                    </label>
                    <input
                      type="text"
                      id="nationalInsurance"
                      name="nationalInsurance"
                      value={formData.nationalInsurance}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                    />
                  </div>

                  <div>
                    <label htmlFor="transactionType" className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="transactionType"
                      name="transactionType"
                      value={formData.transactionType}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="Purchase">Purchase</option>
                      <option value="Sale">Sale</option>
                      <option value="Purchase and Sale">Purchase and Sale</option>
                      <option value="Remortgage">Remortgage</option>
                      <option value="Remortgage Cashback">Remortgage Cashback</option>
                      <option value="Transfer of Equity">Transfer of Equity</option>
                      <option value="Equity Release">Equity Release</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Correspondence Address <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={inputClass}
                    style={focusRing}
                    rows={3}
                    placeholder="House number/name, street, town/city, postcode"
                    required
                  />
                </div>
              </div>

              <div className="rounded-lg p-5" style={{ backgroundColor: BRAND_BG, border: '1px solid #E5E7EB' }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: BRAND_NAVY }}>Property & Tenure</h2>

                <div className="mb-4">
                  <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Property Address
                  </label>
                  <textarea
                    id="propertyAddress"
                    name="propertyAddress"
                    value={formData.propertyAddress}
                    onChange={handleChange}
                    className={inputClass}
                    style={focusRing}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tenure" className="block text-sm font-medium text-gray-700 mb-1">
                      Tenure
                    </label>
                    <select
                      id="tenure"
                      name="tenure"
                      value={formData.tenure}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                    >
                      <option value="">Select Tenure</option>
                      <option value="Freehold">Freehold</option>
                      <option value="Leasehold">Leasehold</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="propertyValue" className="block text-sm font-medium text-gray-700 mb-1">
                      Property Value
                    </label>
                    <input
                      type="number"
                      id="propertyValue"
                      name="propertyValue"
                      value={formData.propertyValue}
                      onChange={handleChange}
                      className={inputClass}
                      style={focusRing}
                      placeholder="£"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction-specific */}
              <div className="rounded-lg p-5" style={{ backgroundColor: BRAND_BG, border: '1px solid #E5E7EB' }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: BRAND_NAVY }}>Transaction Details</h2>

                {formData.transactionType === 'Purchase' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                        Purchase Property Address
                      </label>
                      <textarea
                        id="propertyAddress"
                        name="propertyAddress"
                        value={formData.propertyAddress}
                        onChange={handleChange}
                        className={inputClass}
                        style={focusRing}
                        rows={3}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700 mb-1">
                          Purchase Price
                        </label>
                        <input
                          type="number"
                          id="purchasePrice"
                          name="purchasePrice"
                          value={formData.purchasePrice}
                          onChange={handleChange}
                          className={inputClass}
                          style={focusRing}
                          placeholder="£"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="mortgageProvider" className="block text-sm font-medium text-gray-700 mb-1">
                          Mortgage Provider (if applicable)
                        </label>
                        <input
                          type="text"
                          id="mortgageProvider"
                          name="mortgageProvider"
                          value={formData.mortgageProvider}
                          onChange={handleChange}
                          className={inputClass}
                          style={focusRing}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.transactionType === 'Sale' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                        Sale Property Address
                      </label>
                      <textarea
                        id="propertyAddress"
                        name="propertyAddress"
                        value={formData.propertyAddress}
                        onChange={handleChange}
                        className={inputClass}
                        style={focusRing}
                        rows={3}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700 mb-1">
                          Sale Price
                        </label>
                        <input
                          type="number"
                          id="salePrice"
                          name="salePrice"
                          value={formData.salePrice}
                          onChange={handleChange}
                          className={inputClass}
                          style={focusRing}
                          placeholder="£"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="estateAgent" className="block text-sm font-medium text-gray-700 mb-1">
                          Estate Agent (name and phone)
                        </label>
                        <input
                          type="text"
                          id="estateAgent"
                          name="estateAgent"
                          value={formData.estateAgent}
                          onChange={handleChange}
                          className={inputClass}
                          style={focusRing}
                          placeholder="e.g., PropertyPros Estate Agents, 01234 567890"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.transactionType === 'Purchase and Sale' && (
                  <div className="space-y-6">
                    <div className="rounded-lg p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                      <h3 className="font-semibold mb-3" style={{ color: BRAND_NAVY }}>Purchase Details</h3>
                      <div className="mb-4">
                        <label htmlFor="purchasePropertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                          Purchase Property Address
                        </label>
                        <textarea
                          id="purchasePropertyAddress"
                          name="purchasePropertyAddress"
                          value={formData.purchasePropertyAddress}
                          onChange={handleChange}
                          className={inputClass}
                          style={focusRing}
                          rows={3}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700 mb-1">
                            Purchase Price
                          </label>
                          <input
                            type="number"
                            id="purchasePrice"
                            name="purchasePrice"
                            value={formData.purchasePrice}
                            onChange={handleChange}
                            className={inputClass}
                            style={focusRing}
                            placeholder="£"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="mortgageProvider" className="block text-sm font-medium text-gray-700 mb-1">
                            Mortgage Provider (if applicable)
                          </label>
                          <input
                            type="text"
                            id="mortgageProvider"
                            name="mortgageProvider"
                            value={formData.mortgageProvider}
                            onChange={handleChange}
                            className={inputClass}
                            style={focusRing}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                      <h3 className="font-semibold mb-3" style={{ color: BRAND_NAVY }}>Sale Details</h3>
                      <div className="mb-4">
                        <label htmlFor="salePropertyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                          Sale Property Address
                        </label>
                        <textarea
                          id="salePropertyAddress"
                          name="salePropertyAddress"
                          value={formData.salePropertyAddress}
                          onChange={handleChange}
                          className={inputClass}
                          style={focusRing}
                          rows={3}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700 mb-1">
                            Sale Price
                          </label>
                          <input
                            type="number"
                            id="salePrice"
                            name="salePrice"
                            value={formData.salePrice}
                            onChange={handleChange}
                            className={inputClass}
                            style={focusRing}
                            placeholder="£"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="estateAgent" className="block text-sm font-medium text-gray-700 mb-1">
                            Estate Agent (name and phone)
                          </label>
                          <input
                            type="text"
                            id="estateAgent"
                            name="estateAgent"
                            value={formData.estateAgent}
                            onChange={handleChange}
                            className={inputClass}
                            style={focusRing}
                            placeholder="e.g., PropertyPros Estate Agents, 01234 567890"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {formData.transactionType === 'Remortgage' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="remortgageAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Remortgage Amount
                      </label>
                      <input
                        type="number"
                        id="remortgageAmount"
                        name="remortgageAmount"
                        value={formData.remortgageAmount}
                        onChange={handleChange}
                        className={inputClass}
                        style={focusRing}
                        placeholder="£"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lender" className="block text-sm font-medium text-gray-700 mb-1">
                        Lender
                      </label>
                      <input
                        type="text"
                        id="lender"
                        name="lender"
                        value={formData.lender}
                        onChange={handleChange}
                        className={inputClass}
                        style={focusRing}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label htmlFor="advisor" className="block text-sm font-medium text-gray-700 mb-1">
                    Advisor (if applicable)
                  </label>
                  <input
                    type="text"
                    id="advisor"
                    name="advisor"
                    value={formData.advisor}
                    onChange={handleChange}
                    className={inputClass}
                    style={focusRing}
                    placeholder="Name / Firm"
                  />
                </div>
              </div>

              <div className="rounded-lg p-5" style={{ backgroundColor: BRAND_BG, border: '1px solid #E5E7EB' }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: BRAND_NAVY }}>Additional Information</h2>

                <div>
                  <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    id="additionalNotes"
                    name="additionalNotes"
                    value={formData.additionalNotes}
                    onChange={handleChange}
                    className={inputClass}
                    style={focusRing}
                    rows={4}
                    placeholder="Any additional information..."
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-4 border-t">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                style={{ backgroundColor: BRAND_NAVY }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    <span>Submit Instruction Form</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};





