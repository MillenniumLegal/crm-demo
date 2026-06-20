import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Eye,
  Plus,
  PoundSterling,
  RefreshCcw,
  Search,
  Mail,
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchPayments, PaymentRecord } from '@/services/paymentsService';
import { buildInvoicePdf } from '@/utils/invoicePdf';
import { supabase } from '@/lib/supabase';
import { CreateInvoiceModal } from '@/components/CreateInvoiceModal';
import { SendInvoiceModal } from '@/components/SendInvoiceModal';

type StatusFilter = 'All' | 'Pending' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled' | 'Draft';
type RangeFilter = 'All' | '7' | '30' | '90';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  draft: 'Draft'
};

const getStatusBadgeClass = (status: string) => {
  const normalised = status.toLowerCase();
  switch (normalised) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'sent':
      return 'bg-blue-100 text-blue-800';
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatCurrency = (amount: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
    minimumFractionDigits: 2
  }).format(amount || 0);

const formatDateDisplay = (value?: string | null) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return value;
  }
};

const getRangeFilters = (range: RangeFilter) => {
  if (range === 'All') return {};
  const days = Number.parseInt(range, 10);
  if (Number.isNaN(days)) return {};
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { fromDate: fromDate.toISOString() };
};

const Payments: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const paymentsPerPage = 10;
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showSendInvoiceModal, setShowSendInvoiceModal] = useState(false);
  const [paymentToSend, setPaymentToSend] = useState<PaymentRecord | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');

  const loadPayments = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        const range = getRangeFilters(rangeFilter);
        const next = await fetchPayments({
          status: statusFilter,
          ...range
        });
        setPayments(next);
        setError(null);
      } catch (loadError) {
        console.error('Failed to load payments:', loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load payments. Please try again.';
        setError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, rangeFilter]
  );

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const showNotificationMessage = (message: string, type: 'success' | 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const handleRefresh = () => {
    loadPayments({ silent: true });
  };

  const handleViewInvoice = async (payment: PaymentRecord) => {
    setIsGeneratingPdf(true);
    try {
      // Fetch lead and quote data if available
      let leadData = null;
      let quoteData = null;

      if (payment.leadId) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', payment.leadId)
          .single();
        leadData = lead;
      }

      if (payment.quoteId) {
        const { data: quote } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', payment.quoteId)
          .single();
        quoteData = quote;
      }

      const { doc } = await buildInvoicePdf(payment, leadData, quoteData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadInvoice = async (payment: PaymentRecord) => {
    setIsGeneratingPdf(true);
    try {
      // Fetch lead and quote data if available
      let leadData = null;
      let quoteData = null;

      if (payment.leadId) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', payment.leadId)
          .single();
        leadData = lead;
      }

      if (payment.quoteId) {
        const { data: quote } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', payment.quoteId)
          .single();
        quoteData = quote;
      }

      const { doc, fileName } = await buildInvoicePdf(payment, leadData, quoteData);
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const filteredPayments = useMemo(() => {
    if (!searchTerm) return payments;
    const term = searchTerm.toLowerCase();
    return payments.filter((payment) => {
      const candidates = [
        payment.id,
        payment.leadName,
        payment.leadEmail,
        payment.leadShortCode,
        payment.status
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return candidates.some((c) => c.includes(term));
    });
  }, [payments, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / paymentsPerPage) || 1;
  const startIndex = (currentPage - 1) * paymentsPerPage;
  const endIndex = startIndex + paymentsPerPage;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, rangeFilter, filteredPayments.length]);

  const stats = useMemo(() => {
    const totalRevenue = payments
      .filter((p) => p.status.toLowerCase() === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = payments
      .filter((p) => ['pending', 'sent'].includes(p.status.toLowerCase()))
      .reduce((sum, p) => sum + p.amount, 0);

    const overdueAmount = payments
      .filter((p) => p.status.toLowerCase() === 'overdue')
      .reduce((sum, p) => sum + p.amount, 0);

    const paidThisMonth = payments.filter((p) => {
      if (!p.paidAt || p.status.toLowerCase() !== 'paid') return false;
      const paidDate = new Date(p.paidAt);
      const now = new Date();
      return (
        paidDate.getMonth() === now.getMonth() &&
        paidDate.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      totalRevenue,
      pendingAmount,
      overdueAmount,
      paidThisMonth
    };
  }, [payments]);

  const recentActivity = useMemo(() => {
    return payments.slice(0, 5).map((payment) => ({
      id: payment.id,
      description:
        payment.status.toLowerCase() === 'paid'
          ? `Payment received from ${payment.leadName || 'client'}`
          : payment.status.toLowerCase() === 'sent'
          ? `Invoice sent to ${payment.leadName || 'client'}`
          : payment.status.toLowerCase() === 'overdue'
          ? `Payment overdue for ${payment.leadName || 'client'}`
          : `${STATUS_LABELS[payment.status.toLowerCase()] || payment.status} update`,
      amount: payment.amount,
      timestamp: payment.issuedAt,
      status: payment.status
    }));
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Manage invoices and payments</p>
        </div>
        <div className="flex space-x-3">
          <button
            className="btn-secondary flex items-center space-x-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <button 
            className="btn-primary flex items-center space-x-2"
            onClick={() => setShowCreateInvoiceModal(true)}
          >
            <Plus className="h-5 w-5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {user?.role !== 'Agent' ? (
          <>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-500">
                  <PoundSterling className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-500">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.pendingAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-red-500">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.overdueAmount)}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card col-span-4">
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Management</h3>
              <p className="text-gray-600">
                Access to payment information is restricted to management roles.
              </p>
            </div>
          </div>
        )}
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paid This Month</p>
              <p className="text-2xl font-bold text-gray-900">{stats.paidThisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="input-field"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <select
              className="input-field"
              value={rangeFilter}
              onChange={(event) => setRangeFilter(event.target.value as RangeFilter)}
            >
              <option value="All">All Time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-800 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to load payments</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {user?.role !== 'Agent' && (
        <div className="card p-0">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading payments…</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {searchTerm ? 'No payments match your search.' : 'No payments recorded yet.'}
            </div>
          ) : (
            <div className="overflow-x-hidden">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">Invoice ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">Lead</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Amount</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[90px]">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Issued</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Due Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Paid Date</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center min-w-0">
                          <CreditCard className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                          <span className="font-medium text-gray-900 text-xs truncate" title={payment.id}>
                            {payment.id.substring(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate" title={payment.leadName || 'Unknown lead'}>
                            {payment.leadName || 'Unknown lead'}
                          </div>
                          <div className="text-xs text-gray-500 truncate" title={payment.leadEmail || payment.leadShortCode || '—'}>
                            {payment.leadEmail || payment.leadShortCode || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {formatCurrency(payment.amount, payment.currency)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${getStatusBadgeClass(
                            payment.status
                          )}`}
                          title={STATUS_LABELS[payment.status.toLowerCase()] || payment.status}
                        >
                          {STATUS_LABELS[payment.status.toLowerCase()] || payment.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-500" title={formatDateDisplay(payment.issuedAt)}>
                          {payment.issuedAt ? new Date(payment.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-500" title={formatDateDisplay(payment.dueDate)}>
                          {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-500" title={formatDateDisplay(payment.paidAt)}>
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                            title="View Invoice"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewInvoice(payment);
                            }}
                            disabled={isGeneratingPdf}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                            title="Download Invoice"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownloadInvoice(payment);
                            }}
                            disabled={isGeneratingPdf}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {(payment.status.toLowerCase() === 'pending' || payment.status.toLowerCase() === 'draft') && (
                            <button 
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                              title="Send Invoice"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPaymentToSend(payment);
                                setShowSendInvoiceModal(true);
                              }}
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          )}
                          {payment.status.toLowerCase() === 'sent' && (
                            <button 
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" 
                              title="Send Reminder"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPaymentToSend(payment);
                                setShowSendInvoiceModal(true);
                              }}
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="card flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} payments
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 5) return true;
                      if (currentPage <= 3) return page <= 5;
                      if (currentPage >= totalPages - 2) return page >= totalPages - 4;
                      return Math.abs(page - currentPage) <= 2;
                    })
                    .map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === page
                            ? 'bg-[#011E41] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <span>Next</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {user?.role !== 'Agent' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payment Activity</h3>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity available.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const status = activity.status.toLowerCase();
                const dotColor =
                  status === 'paid'
                    ? 'bg-green-500'
                    : status === 'sent'
                    ? 'bg-blue-500'
                    : status === 'overdue'
                    ? 'bg-red-500'
                    : 'bg-gray-400';

                return (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-600">
                        {formatCurrency(activity.amount)} • {formatDateDisplay(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoiceModal}
        onClose={() => setShowCreateInvoiceModal(false)}
        onSuccess={() => {
          loadPayments();
          setShowCreateInvoiceModal(false);
        }}
      />

      {/* Send Invoice Modal */}
      <SendInvoiceModal
        isOpen={showSendInvoiceModal}
        onClose={() => {
          setShowSendInvoiceModal(false);
          setPaymentToSend(null);
        }}
        payment={paymentToSend}
        onSuccess={() => {
          showNotificationMessage('Invoice sent successfully!', 'success');
          loadPayments();
          setShowSendInvoiceModal(false);
          setPaymentToSend(null);
        }}
        onError={(error: string) => {
          showNotificationMessage(error || 'Failed to send invoice', 'error');
        }}
      />

      {/* Notification Modal */}
      {showNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  notificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {notificationType === 'success' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h2 className={`text-xl font-bold ${
                    notificationType === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {notificationType === 'success' ? 'Success!' : 'Error'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {notificationType === 'success' ? 'Action completed successfully' : 'An error occurred'}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="ml-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className={`text-sm ${
                notificationType === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {notificationMessage}
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowNotification(false)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    notificationType === 'success'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { Payments };
