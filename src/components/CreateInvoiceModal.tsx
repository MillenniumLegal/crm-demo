import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { searchLeadOptions, LeadOption } from '@/services/leadsService';
import { fetchQuotes, Quote } from '@/services/quotesService';
import { createInvoice, CreateInvoiceParams } from '@/services/paymentsService';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [selectedLeadOption, setSelectedLeadOption] = useState<LeadOption | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateInvoiceParams>({
    leadId: '',
    quoteId: null,
    amount: 0,
    currency: 'GBP',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: '',
  });

  useEffect(() => {
    if (!isOpen) {
      setLeads([]);
      setLeadSearchTerm('');
      setSelectedLeadOption(null);
      return;
    }

    const timer = setTimeout(() => {
      loadLeads(leadSearchTerm);
    }, 450);

    return () => clearTimeout(timer);
  }, [isOpen, leadSearchTerm]);

  useEffect(() => {
    if (formData.leadId) {
      loadQuotesForLead(formData.leadId);
    } else {
      setQuotes([]);
    }
  }, [formData.leadId]);

  const loadLeads = async (search = '') => {
    setIsLoadingLeads(true);
    try {
      const fetchedLeads = await searchLeadOptions({
        search,
        limit: 50,
        activeOnly: true,
      });
      setLeads(fetchedLeads);
    } catch (err) {
      console.error('Error loading leads:', err);
      setError('Failed to load leads');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const loadQuotesForLead = async (leadId: string) => {
    try {
      const leadQuotes = await fetchQuotes({ leadId });
      setQuotes(leadQuotes);
      
      // Auto-select first quote if available
      if (leadQuotes.length > 0 && !formData.quoteId) {
        setFormData(prev => ({
          ...prev,
          quoteId: leadQuotes[0].id,
          amount: leadQuotes[0].totalIncVat || leadQuotes[0].totalAmount || 0,
        }));
      }
    } catch (err) {
      console.error('Error loading quotes:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.leadId || !formData.amount || formData.amount <= 0) {
      setError('Please select a lead and enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await createInvoice({
        ...formData,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
      });
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        leadId: '',
        quoteId: null,
        amount: 0,
        currency: 'GBP',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: '',
      });
      setLeadSearchTerm('');
      setSelectedLeadOption(null);
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      setError(err.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedLead = selectedLeadOption || leads.find(l => l.id === formData.leadId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Create Invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead *
            </label>
            <div className="space-y-2">
              <input
                type="text"
                className="input-field"
                value={leadSearchTerm}
                onChange={(e) => setLeadSearchTerm(e.target.value)}
                placeholder="Search leads by name, email, phone, or reference..."
              />
              {isLoadingLeads ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Searching leads...</span>
                </div>
              ) : (
                <>
              <select
                className="input-field"
                value={formData.leadId}
                onChange={(e) => {
                  const lead = leads.find(l => l.id === e.target.value) || null;
                  setSelectedLeadOption(lead);
                  setFormData(prev => ({
                    ...prev,
                    leadId: e.target.value,
                    quoteId: null,
                    amount: 0,
                  }));
                }}
                required
              >
                <option value="">Select a lead</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} {lead.email ? `(${lead.email})` : ''} {lead.shortCode ? `- ${lead.shortCode}` : ''} - Owner: {lead.assignedToName || (lead.assignedTo ? 'Assigned' : 'Unassigned')}
                  </option>
                ))}
              </select>
                  {leads.length === 0 && (
                    <p className="text-sm text-gray-500">
                      {leadSearchTerm.trim() ? 'No leads found. Try a different name, email, phone, or reference.' : 'Type to search leads, or choose from the most recent active leads.'}
                    </p>
                  )}
                </>
              )}
            </div>
            {selectedLead && (
              <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
                <div className="font-medium text-gray-900">{selectedLead.name}</div>
                <div className="text-gray-600">
                  {[selectedLead.email, selectedLead.phone, selectedLead.shortCode].filter(Boolean).join(' • ')}
                </div>
                <div className="mt-1 text-xs font-medium text-blue-800">
                  Owner: {selectedLead.assignedToName || (selectedLead.assignedTo ? 'Assigned' : 'Unassigned')}
                </div>
              </div>
            )}
          </div>

          {formData.leadId && quotes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quote (Optional)
              </label>
              <select
                className="input-field"
                value={formData.quoteId || ''}
                onChange={(e) => {
                  const quoteId = e.target.value || null;
                  const quote = quotes.find(q => q.id === quoteId);
                  setFormData(prev => ({
                    ...prev,
                    quoteId,
                    amount: quote ? (quote.totalIncVat || quote.totalAmount || 0) : prev.amount,
                  }));
                }}
              >
                <option value="">No quote</option>
                {quotes.map(quote => (
                  <option key={quote.id} value={quote.id}>
                    Quote {quote.id.substring(0, 8)}... - £{quote.totalIncVat || quote.totalAmount || 0}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (£) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  amount: parseFloat(e.target.value) || 0,
                }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                className="input-field"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              className="input-field"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              className="input-field"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Invoice description or notes..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Invoice</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
