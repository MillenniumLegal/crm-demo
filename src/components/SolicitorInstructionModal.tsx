import React, { useState, useEffect } from 'react';
import { X, Building2, Send, AlertCircle, CheckCircle, Loader2, Paperclip } from 'lucide-react';
import { Lead } from '@/types';
import { fetchSolicitorFirms, createSolicitorInstruction, SolicitorFirm } from '@/services/automationService';
import { updateLead } from '@/services/leadsService';
import { useAuth } from '@/context/AuthContext';
import { Quote } from '@/services/quotesService';
import { buildQuotePdf } from '@/utils/quotePdf';
import { sendOutlookEmail, fetchOutlookStatus } from '@/services/outlookService';
import { logActivity } from '@/services/activityService';
import { supabase } from '@/lib/supabase';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

interface SolicitorInstructionModalProps {
  lead: Lead;
  quote?: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SolicitorInstructionModal: React.FC<SolicitorInstructionModalProps> = ({
  lead,
  quote,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [solicitorFirms, setSolicitorFirms] = useState<SolicitorFirm[]>([]);
  const [selectedFirmId, setSelectedFirmId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attachQuote, setAttachQuote] = useState(false);
  const [attachInstruction, setAttachInstruction] = useState(true); // Default to true
  const [isGeneratingQuotePdf, setIsGeneratingQuotePdf] = useState(false);
  const [isFetchingInstructionPdf, setIsFetchingInstructionPdf] = useState(false);
  const [isOutlookReady, setIsOutlookReady] = useState(false);
  const [isCheckingOutlook, setIsCheckingOutlook] = useState(true);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  // Client information form fields
  const [clientInfo, setClientInfo] = useState({
    name: lead.name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    address: lead.clientAddress || lead.propertyAddress || '',
    dateOfBirth: lead.clientDob || '',
    nationalInsurance: lead.clientNi || '',
    propertyAddress: lead.propertyAddress || '',
    propertyValue: lead.propertyValue?.toString() || '',
    transactionType: lead.transactionType || '',
    // Additional fields that might be needed
    mortgageProvider: '',
    lender: '',
    purchasePrice: '',
    salePrice: '',
    additionalNotes: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadSolicitorFirms();
      checkOutlookStatus();
      // Reset form with lead data
      setClientInfo({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        address: lead.clientAddress || lead.propertyAddress || '',
        dateOfBirth: lead.clientDob || '',
        nationalInsurance: lead.clientNi || '',
        propertyAddress: lead.propertyAddress || '',
        propertyValue: lead.propertyValue?.toString() || '',
        transactionType: lead.transactionType || '',
        mortgageProvider: '',
        lender: '',
        purchasePrice: '',
        salePrice: '',
        additionalNotes: '',
      });
      // Pre-select solicitor firm if already auto-assigned
      setSelectedFirmId(lead.instructedFirm || (lead as any).assignedSolicitorFirmId || '');
      setShowSuccessModal(false);
      setShowErrorModal(false);
      setErrorMessage('');
      setAttachQuote(!!quote);
      setAttachInstruction(!!lead.instructionPdfUrl); // Default to true if PDF exists
    }
  }, [isOpen, lead, quote]);

  // Generate default email content when firm is selected or modal opens
  useEffect(() => {
    if (isOpen) {
      generateDefaultEmailContent();
    }
  }, [selectedFirmId, isOpen, lead, quote, user]);

  const checkOutlookStatus = async () => {
    setIsCheckingOutlook(true);
    try {
      const status = await fetchOutlookStatus();
      setIsOutlookReady(status.connected);
    } catch (error) {
      console.error('Error checking Outlook status:', error);
      setIsOutlookReady(false);
    } finally {
      setIsCheckingOutlook(false);
    }
  };

  const generateDefaultEmailContent = () => {
    const transactionType = lead.transactionType || quote?.transactionType || 'conveyancing';
    const propertyAddress = lead.propertyAddress || quote?.propertyAddress || 'property';
    
    const defaultSubject = `New Client Instruction - ${lead.name} - ${transactionType}`;
    setEmailSubject(defaultSubject);

    const defaultMessage = `Dear ${selectedFirm ? selectedFirm.contactPerson || 'Team' : 'Team'},

We are pleased to instruct you on behalf of our client for their ${transactionType} transaction.

**Client Details:**
- Name: ${lead.name}
- Email: ${lead.email}
- Phone: ${lead.phone}
${lead.clientAddress || lead.propertyAddress ? `- Address: ${lead.clientAddress || lead.propertyAddress}` : ''}
${lead.clientDob ? `- Date of Birth: ${lead.clientDob}` : ''}
${lead.clientNi ? `- National Insurance Number: ${lead.clientNi}` : ''}

**Transaction Details:**
- Transaction Type: ${transactionType}
${propertyAddress ? `- Property Address: ${propertyAddress}` : ''}
${lead.propertyValue ? `- Property Value: £${lead.propertyValue.toLocaleString()}` : ''}
${lead.isMortgaged ? `- Mortgaged: Yes` : ''}

${lead.notes ? `**Additional Notes:**\n${lead.notes}\n` : ''}

Please confirm receipt and provide your case reference number at your earliest convenience.

${attachQuote && quote ? 'Attached: Quote PDF with full details and pricing.' : ''}${attachQuote && quote && attachInstruction && lead.instructionPdfUrl ? '\n' : ''}${attachInstruction && lead.instructionPdfUrl ? 'Attached: Instruction PDF with client information and details.' : ''}

Best regards,
${user?.name || 'Millennium Legal Team'}`;

    setEmailMessage(defaultMessage);
  };

  const loadSolicitorFirms = async () => {
    setIsLoading(true);
    try {
      const firms = await fetchSolicitorFirms();
      setSolicitorFirms(firms);
    } catch (error) {
      console.error('Error loading solicitor firms:', error);
      setErrorMessage('Failed to load solicitor firms');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFirmId) {
      setErrorMessage('Please select a solicitor firm');
      setShowErrorModal(true);
      return;
    }

    if (!selectedFirm?.email) {
      setErrorMessage('Selected solicitor firm does not have an email address');
      setShowErrorModal(true);
      return;
    }

    if (!isOutlookReady) {
      setErrorMessage('Outlook is not connected. Please connect Outlook in Settings → Notifications.');
      setShowErrorModal(true);
      return;
    }

    // Validate that instruction PDF exists if trying to attach it
    if (attachInstruction && !lead.instructionPdfUrl) {
      setErrorMessage('Instruction PDF is not available. Please send the instruction form to the client or fill it with their instructions before instructing the solicitor. The instruction PDF must be available before proceeding.');
      setShowErrorModal(true);
      return;
    }

    setIsSending(true);
    setShowErrorModal(false);

    try {
      // Generate quote PDF attachment if requested
      let quoteAttachment: { fileName: string; contentType: string; contentBytes: string } | undefined = undefined;
      
      if (attachQuote && quote) {
        setIsGeneratingQuotePdf(true);
        try {
          const { doc, fileName } = await buildQuotePdf(quote);
          const arrayBuffer = doc.output('arraybuffer');
          const base64 = arrayBufferToBase64(arrayBuffer);
          quoteAttachment = {
            fileName,
            contentType: 'application/pdf',
            contentBytes: base64
          };
        } catch (pdfError) {
          console.error('Error generating quote PDF:', pdfError);
          setErrorMessage('Failed to generate quote PDF. Please try again without attaching quote.');
          setShowErrorModal(true);
          setIsSending(false);
          setIsGeneratingQuotePdf(false);
          return;
        } finally {
          setIsGeneratingQuotePdf(false);
        }
      }

      // Fetch instruction PDF attachment if requested
      let instructionAttachment: { fileName: string; contentType: string; contentBytes: string } | undefined = undefined;
      
      if (attachInstruction && lead.instructionPdfUrl) {
        setIsFetchingInstructionPdf(true);
        try {
          // Fetch the PDF from the URL
          const response = await fetch(lead.instructionPdfUrl, { credentials: 'omit' });
          if (!response.ok) {
            throw new Error(`Failed to fetch instruction PDF: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          
          // Extract filename from URL or use default
          const urlParts = lead.instructionPdfUrl.split('/');
          const fileName = urlParts[urlParts.length - 1] || `instruction_${lead.name.replace(/\s+/g, '_')}.pdf`;
          
          instructionAttachment = {
            fileName,
            contentType: 'application/pdf',
            contentBytes: base64
          };
        } catch (pdfError) {
          console.error('Error fetching instruction PDF:', pdfError);
          setErrorMessage('Failed to fetch instruction PDF. Please try again or uncheck the attachment option.');
          setShowErrorModal(true);
          setIsSending(false);
          setIsFetchingInstructionPdf(false);
          return;
        } finally {
          setIsFetchingInstructionPdf(false);
        }
      }

      // Send email to solicitor
      try {
        const emailHTML = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              ${emailMessage.split('\n').map((line: string) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return `<h3 style="color: #011E41; margin-top: 20px; margin-bottom: 10px;">${line.replace(/\*\*/g, '')}</h3>`;
                }
                if (line.trim() === '') {
                  return '<br>';
                }
                if (line.startsWith('- ')) {
                  return `<li style="margin-bottom: 5px;">${line.substring(2)}</li>`;
                }
                return `<p style="margin-bottom: 10px;">${line}</p>`;
              }).join('')}
            </body>
          </html>
        `;

        await sendOutlookEmail({
          to: selectedFirm.email,
          subject: emailSubject || `New Client Instruction - ${lead.name}`,
          htmlBody: emailHTML,
          textBody: emailMessage,
          leadId: lead.id,
          leadName: lead.name,
          metadata: {
            templateType: 'solicitor_instruction',
            solicitorFirmId: selectedFirmId,
            quoteId: quote?.id || null,
            sentBy: user?.id || null,
            sentByName: user?.name || null
          },
          attachments: [
            ...(quoteAttachment ? [quoteAttachment] : []),
            ...(instructionAttachment ? [instructionAttachment] : [])
          ].length > 0 ? [
            ...(quoteAttachment ? [quoteAttachment] : []),
            ...(instructionAttachment ? [instructionAttachment] : [])
          ] : undefined,
          saveToSentItems: true
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        setErrorMessage(`Failed to send email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
        setShowErrorModal(true);
        setIsSending(false);
        return;
      }

      // Create solicitor instruction record
      const instruction = await createSolicitorInstruction({
        leadId: lead.id,
        solicitorFirmId: selectedFirmId,
        clientInfo,
        notes: clientInfo.additionalNotes || emailMessage,
      });

      if (!instruction) {
        throw new Error('Failed to create solicitor instruction record');
      }

      // Increment solicitor firm's daily capacity (daily quota usage)
      try {
        const { error: capacityError } = await supabase.rpc('increment_solicitor_capacity', {
          firm_id: selectedFirmId
        });

        if (capacityError) {
          console.error('Error incrementing solicitor capacity:', capacityError);
          // Don't throw - this is non-critical, just log it
        } else {
          console.log('✅ Solicitor firm daily quota incremented:', selectedFirmId);
        }
      } catch (capacityErr) {
        console.error('Error calling increment_solicitor_capacity:', capacityErr);
        // Continue anyway - capacity increment is not critical for the main flow
      }

      // Update solicitor instruction status to 'sent' after successful email
      try {
        await supabase
          .from('solicitor_instructions')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: user?.id || null
          })
          .eq('id', instruction.id);
      } catch (statusError) {
        console.warn('Could not update instruction status:', statusError);
        // Continue anyway
      }

      // Update lead to mark solicitor as instructed
      // After solicitor is instructed, move to "Instructed" stage and set status to "Sold"
      await updateLead(lead.id, {
        instructedFirm: selectedFirmId,
        stage: 'Instructed', // Move to Instructed stage when solicitor is instructed
        status: 'Sold', // Mark as sold when solicitor is instructed
      });

      // Log activity
      try {
        // Generate a UUID for the contact attempt entity
        // instruction.id should be a UUID from the database, but use it if valid, otherwise generate one
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const contactAttemptId = (instruction.id && uuidRegex.test(instruction.id))
          ? instruction.id
          : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              }));
        
        await logActivity({
          activityType: 'contact_attempt',
          entityType: 'contact_attempt',
          entityId: contactAttemptId,
          leadId: lead.id,
          leadName: lead.name,
          actionDescription: `Solicitor instruction sent to ${selectedFirm.name}${attachQuote && quote ? ' with quote PDF' : ''}${attachQuote && quote && attachInstruction && lead.instructionPdfUrl ? ' and instruction PDF' : attachInstruction && lead.instructionPdfUrl ? ' with instruction PDF' : ''}`,
          doneByType: 'user',
          doneById: user?.id,
          doneByName: user?.name || 'Unknown',
          metadata: {
            solicitorFirmId: selectedFirmId,
            solicitorFirmName: selectedFirm.name,
            instructionId: instruction.id, // Store original instruction ID in metadata
            quoteAttached: attachQuote && !!quote,
            instructionAttached: attachInstruction && !!lead.instructionPdfUrl,
            quoteId: quote?.id || null
          }
        });
      } catch (activityError) {
        console.warn('Could not log activity:', activityError);
      }

      setShowSuccessModal(true);
      
      // Don't auto-close - let user close manually after seeing success message
    } catch (error: any) {
      console.error('Error sending solicitor instruction:', error);
      setErrorMessage(error.message || 'Failed to send solicitor instruction');
      setShowErrorModal(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessModal(false);
    onClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  if (!isOpen) return null;

  const selectedFirm = solicitorFirms.find(f => f.id === selectedFirmId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-navy-600" />
            <h2 className="text-xl font-bold text-gray-900">Instruct Solicitor</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Solicitor Firm Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Solicitor Firm *
            </label>
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading solicitor firms...</div>
            ) : (
              <select
                value={selectedFirmId}
                onChange={(e) => setSelectedFirmId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select a solicitor firm</option>
                {solicitorFirms.map(firm => (
                  <option key={firm.id} value={firm.id}>
                    {firm.name} {firm.email ? `(${firm.email})` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedFirm && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                <p className="font-medium text-gray-900">{selectedFirm.name}</p>
                {selectedFirm.email && <p className="text-gray-600">Email: {selectedFirm.email}</p>}
                {selectedFirm.phone && <p className="text-gray-600">Phone: {selectedFirm.phone}</p>}
                {selectedFirm.contactPerson && <p className="text-gray-600">Contact: {selectedFirm.contactPerson}</p>}
                {(selectedFirm.dailyCapacityLimit !== undefined || selectedFirm.dailyCapacityUsed !== undefined) && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-1">Daily Quota:</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {selectedFirm.dailyCapacityUsed || 0} / {selectedFirm.dailyCapacityLimit || '∞'}
                      </span>
                      {selectedFirm.dailyCapacityLimit && selectedFirm.dailyCapacityLimit > 0 && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ((selectedFirm.dailyCapacityUsed || 0) / selectedFirm.dailyCapacityLimit) >= 1
                              ? 'bg-red-100 text-red-700'
                              : ((selectedFirm.dailyCapacityUsed || 0) / selectedFirm.dailyCapacityLimit) >= 0.8
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {Math.round(((selectedFirm.dailyCapacityUsed || 0) / selectedFirm.dailyCapacityLimit) * 100)}% used
                          </span>
                        </>
                      )}
                    </div>
                    {selectedFirm.dailyCapacityLimit && (selectedFirm.dailyCapacityUsed || 0) >= selectedFirm.dailyCapacityLimit && (
                      <p className="text-xs text-red-600 mt-1">⚠️ This firm has reached its daily quota</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Email Message Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Email to Solicitor
            </h3>

            {!isOutlookReady && !isCheckingOutlook && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Outlook is not connected. Please connect Outlook in Settings → Notifications to send emails.
              </div>
            )}

            {isCheckingOutlook && (
              <div className="text-sm text-gray-500 flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking Outlook connection...</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="input-field"
                required
                placeholder="Email subject line..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message *
              </label>
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                className="input-field"
                rows={12}
                required
                placeholder="Email message to solicitor..."
              />
              <button
                type="button"
                onClick={generateDefaultEmailContent}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Reset to default template
              </button>
            </div>

            <div className="space-y-2">
              {quote && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="attachQuote"
                    checked={attachQuote}
                    onChange={(e) => setAttachQuote(e.target.checked)}
                    className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-gray-300 rounded"
                    disabled={isSending || isGeneratingQuotePdf}
                  />
                  <label htmlFor="attachQuote" className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                    <Paperclip className="h-4 w-4" />
                    <span>Attach Quote PDF ({quote.shortCode || 'Quote'} - £{(quote.totalIncVat || quote.totalAmount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  </label>
                  {isGeneratingQuotePdf && (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
              )}

              {lead.instructionPdfUrl ? (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="attachInstruction"
                    checked={attachInstruction}
                    onChange={(e) => setAttachInstruction(e.target.checked)}
                    className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-gray-300 rounded"
                    disabled={isSending || isFetchingInstructionPdf}
                  />
                  <label htmlFor="attachInstruction" className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                    <Paperclip className="h-4 w-4" />
                    <span>Attach Instruction PDF (Client information and details)</span>
                  </label>
                  {isFetchingInstructionPdf && (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
              ) : (
                <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">Instruction PDF Not Available</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Please send the instruction form to the client or fill it with their instructions before instructing the solicitor. The instruction PDF must be available before proceeding.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Client Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={clientInfo.dateOfBirth}
                  onChange={(e) => setClientInfo({ ...clientInfo, dateOfBirth: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  National Insurance Number
                </label>
                <input
                  type="text"
                  value={clientInfo.nationalInsurance}
                  onChange={(e) => setClientInfo({ ...clientInfo, nationalInsurance: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <select
                  value={clientInfo.transactionType}
                  onChange={(e) => setClientInfo({ ...clientInfo, transactionType: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Type</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Sale">Sale</option>
                  <option value="Remortgage">Remortgage</option>
                  <option value="Remortgage Cashback">Remortgage Cashback</option>
                  <option value="Transfer of Equity">Transfer of Equity</option>
                  <option value="Equity Release">Equity Release</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Address *
              </label>
              <textarea
                value={clientInfo.address}
                onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })}
                className="input-field"
                rows={2}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Address
              </label>
              <textarea
                value={clientInfo.propertyAddress}
                onChange={(e) => setClientInfo({ ...clientInfo, propertyAddress: e.target.value })}
                className="input-field"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Value
                </label>
                <input
                  type="number"
                  value={clientInfo.propertyValue}
                  onChange={(e) => setClientInfo({ ...clientInfo, propertyValue: e.target.value })}
                  className="input-field"
                  placeholder="£"
                />
              </div>

              {clientInfo.transactionType === 'Purchase' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    value={clientInfo.purchasePrice}
                    onChange={(e) => setClientInfo({ ...clientInfo, purchasePrice: e.target.value })}
                    className="input-field"
                    placeholder="£"
                  />
                </div>
              )}

              {clientInfo.transactionType === 'Sale' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    value={clientInfo.salePrice}
                    onChange={(e) => setClientInfo({ ...clientInfo, salePrice: e.target.value })}
                    className="input-field"
                    placeholder="£"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mortgage Provider
                </label>
                <input
                  type="text"
                  value={clientInfo.mortgageProvider}
                  onChange={(e) => setClientInfo({ ...clientInfo, mortgageProvider: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lender
                </label>
                <input
                  type="text"
                  value={clientInfo.lender}
                  onChange={(e) => setClientInfo({ ...clientInfo, lender: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={clientInfo.additionalNotes}
                onChange={(e) => setClientInfo({ ...clientInfo, additionalNotes: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Any additional information for the solicitor..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={isSending || !selectedFirmId || !isOutlookReady || isGeneratingQuotePdf || isFetchingInstructionPdf || !emailSubject.trim() || !emailMessage.trim() || (attachInstruction && !lead.instructionPdfUrl)}
            >
              {isSending || isGeneratingQuotePdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isGeneratingQuotePdf ? 'Generating PDF...' : 'Sending...'}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send Instruction Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Success</h3>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-gray-600">
                Solicitor instruction sent successfully to <span className="font-medium">{selectedFirm?.name}</span>!
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">✓ Lead has been marked as Instructed</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  The lead stage has been updated to "Instructed" and status set to "Sold".
                </p>
              </div>
              {(attachQuote && quote) || (attachInstruction && lead.instructionPdfUrl) ? (
                <p className="text-sm text-gray-600">
                  {attachQuote && quote && attachInstruction && lead.instructionPdfUrl 
                    ? 'Both Quote PDF and Instruction PDF were attached to the email.'
                    : attachQuote && quote
                    ? 'Quote PDF was attached to the email.'
                    : 'Instruction PDF was attached to the email.'}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCloseSuccess}
                className="btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Error</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorMessage('');
                }}
                className="btn-primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

