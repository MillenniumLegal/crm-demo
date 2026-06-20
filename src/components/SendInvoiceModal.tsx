import React, { useState } from 'react';
import { X, Loader2, AlertCircle, Mail, FileText } from 'lucide-react';
import { PaymentRecord } from '@/services/paymentsService';
import { sendInvoice, SendInvoiceParams } from '@/services/paymentsService';

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  onSuccess: () => void;
  onError?: (error: string) => void;
}

export const SendInvoiceModal: React.FC<SendInvoiceModalProps> = ({
  isOpen,
  onClose,
  payment,
  onSuccess,
  onError,
}) => {
  const [formData, setFormData] = useState<SendInvoiceParams>({
    paymentId: payment?.id || '',
    to: payment?.leadEmail || '',
    subject: `Invoice ${payment?.id || ''} - Payment Due`,
    message: `Dear ${payment?.leadName || 'Client'},

Please find attached your invoice ${payment?.id || ''} for the amount of £${payment?.amount || 0}.

Payment is due by ${payment?.dueDate ? new Date(payment.dueDate).toLocaleDateString('en-GB') : 'the due date specified'}.

If you have any questions, please don't hesitate to contact us.

Best regards,
Millennium Legal CRM Team`,
    attachInvoice: true,
  });

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format invoice ID to shorter format
  const formatInvoiceId = (paymentId: string, issuedAt?: string): string => {
    try {
      if (paymentId.length > 8) {
        const lastChars = paymentId.substring(paymentId.length - 6).toUpperCase();
        const year = issuedAt ? new Date(issuedAt).getFullYear() : new Date().getFullYear();
        return `INV-${year}-${lastChars}`;
      }
      return `INV-${paymentId}`;
    } catch {
      return paymentId.length > 12 ? paymentId.substring(0, 12) : paymentId;
    }
  };

  React.useEffect(() => {
    if (payment && isOpen) {
      const shortInvoiceId = formatInvoiceId(payment.id, payment.issuedAt);
      setFormData({
        paymentId: payment.id,
        to: payment.leadEmail || '',
        subject: `Invoice ${shortInvoiceId} - Payment Due`,
        message: `Dear ${payment.leadName || 'Client'},

Please find attached your invoice ${shortInvoiceId} for the amount of £${payment.amount || 0}.

Payment is due by ${payment.dueDate ? new Date(payment.dueDate).toLocaleDateString('en-GB') : 'the due date specified'}.

If you have any questions, please don't hesitate to contact us.

Best regards,
Millennium Legal CRM Team`,
        attachInvoice: true,
      });
    }
  }, [payment, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.to || !formData.subject || !formData.message) {
      setError('Please fill in all required fields');
      return;
    }

    if (!payment) {
      setError('Payment not found');
      return;
    }

    setIsSending(true);
    try {
      await sendInvoice({
        ...formData,
        paymentId: payment.id,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error sending invoice:', err);
      const errorMessage = err.message || 'Failed to send invoice';
      setError(errorMessage);
      // Also call onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Send Invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSending}
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Invoice Details</p>
                <p className="text-sm text-blue-700 mt-1">
                  Invoice ID: {formatInvoiceId(payment.id, payment.issuedAt)} | Amount: £{payment.amount.toFixed(2)} | 
                  Due Date: {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString('en-GB') : 'Not set'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To (Email) *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                className="input-field pl-10"
                value={formData.to}
                onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
                placeholder="client@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <input
              type="text"
              className="input-field"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Invoice subject"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              className="input-field"
              rows={8}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Email message..."
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="attachInvoice"
              checked={formData.attachInvoice}
              onChange={(e) => setFormData(prev => ({ ...prev, attachInvoice: e.target.checked }))}
              className="rounded border-gray-300 text-[#011E41] focus:ring-[#011E41]"
            />
            <label htmlFor="attachInvoice" className="text-sm text-gray-700">
              Attach invoice PDF
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  <span>Send Invoice</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

