import React, { useEffect, useState } from 'react';
import { X, CheckCircle, CreditCard, FileText, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface QuoteNotification {
  id: string;
  type: 'quote_accepted' | 'payment_received' | 'client_info_returned';
  quoteId: string;
  quoteShortCode?: string;
  leadId: string;
  leadName: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface QuoteNotificationPopupProps {
  notification: QuoteNotification;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  autoCloseDelay?: number; // milliseconds
}

export const QuoteNotificationPopup: React.FC<QuoteNotificationPopupProps> = ({
  notification,
  onClose,
  onMarkRead,
  autoCloseDelay = 10000 // 10 seconds default
}) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-close after delay
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose();
      }, 300); // Wait for fade-out animation
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [autoCloseDelay, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleClick = () => {
    onMarkRead(notification.id);
    navigate(`/lead-management?leadId=${notification.leadId}`);
    handleClose();
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'quote_accepted':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'payment_received':
        return <CreditCard className="h-6 w-6 text-blue-600" />;
      case 'client_info_returned':
        return <FileText className="h-6 w-6 text-purple-600" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-600" />;
    }
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'quote_accepted':
        return 'bg-green-50 border-green-200';
      case 'payment_received':
        return 'bg-blue-50 border-blue-200';
      case 'client_info_returned':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[100] w-full max-w-md ${getBgColor()} border-2 rounded-lg shadow-lg p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-1">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {notification.type === 'quote_accepted' && 'Quote Accepted'}
                {notification.type === 'payment_received' && 'Payment Received'}
                {notification.type === 'client_info_returned' && 'Client Info Returned'}
              </h4>
              <p className="text-sm text-gray-700 mb-2">
                {notification.message}
              </p>
              <p className="text-xs text-gray-500">
                {notification.leadName}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <button
              onClick={handleClick}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
            >
              View Lead
            </button>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400">
              {new Date(notification.createdAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
