import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Target, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { outcomeCodeActions } from '@/services/outcomeCodeService';

interface OutcomeCode {
  id: string;
  code: string;
  name: string;
  description: string;
  nextAction: string;
  autoSchedule: boolean;
  scheduleDelay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const OutcomeCodes: React.FC = () => {
  const [codes, setCodes] = useState<OutcomeCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCode, setEditingCode] = useState<OutcomeCode | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'warning'>('success');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    nextAction: 'call',
    autoSchedule: false,
    scheduleDelay: 24,
    isActive: true
  });

  const normalizeAction = (action: string) => {
    if (!action) return 'call';
    return action === 'archive' ? 'delete' : action;
  };

  useEffect(() => {
    loadOutcomeCodes();
  }, []);

  const loadOutcomeCodes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('outcome_codes')
        .select('*')
        .order('code', { ascending: true });

      if (error) {
        console.error('Error loading outcome codes:', error);
        showNotification('Failed to load outcome codes', 'error');
        setCodes(getDefaultOutcomeCodes());
      } else if (data && data.length > 0) {
        setCodes(data.map(transformOutcomeCode));
      } else {
        setCodes(getDefaultOutcomeCodes());
      }
    } catch (err) {
      console.error('Error in loadOutcomeCodes:', err);
      showNotification('Failed to load outcome codes', 'error');
      setCodes(getDefaultOutcomeCodes());
    } finally {
      setIsLoading(false);
    }
  };

  const transformOutcomeCode = (dbCode: any): OutcomeCode => {
    return {
      id: dbCode.id,
      code: dbCode.code,
      name: dbCode.name,
      description: dbCode.description || '',
      nextAction: normalizeAction(dbCode.next_action || 'call'),
      autoSchedule: dbCode.auto_schedule || false,
      scheduleDelay: dbCode.schedule_delay || 24,
      isActive: dbCode.is_active !== undefined ? dbCode.is_active : true,
      createdAt: dbCode.created_at,
      updatedAt: dbCode.updated_at
    };
  };

  const getDefaultOutcomeCodes = (): OutcomeCode[] => {
    const defaultCodes = Object.keys(outcomeCodeActions).map(key => ({
      id: key,
      code: key,
      name: key,
      description: '',
      nextAction: normalizeAction('call'),
      autoSchedule: false,
      scheduleDelay: 24,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    return defaultCodes;
  };

  const handleAddCode = () => {
    setEditingCode(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      nextAction: 'call',
      autoSchedule: false,
      scheduleDelay: 24,
      isActive: true
    });
    setShowModal(true);
  };

  const handleEditCode = (code: OutcomeCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description,
      nextAction: code.nextAction || 'call',
      autoSchedule: code.autoSchedule,
      scheduleDelay: code.scheduleDelay,
      isActive: code.isActive
    });
    setShowModal(true);
  };

  const handleDeleteCode = (code: OutcomeCode) => {
    showConfirmDialog(
      `Are you sure you want to delete the outcome code "${code.name}"? This action cannot be undone.`,
      async () => {
        try {
          const { error } = await supabase
            .from('outcome_codes')
            .delete()
            .eq('id', code.id);

          if (error) throw error;

          showNotification('Outcome code deleted successfully', 'success');
          loadOutcomeCodes();
        } catch (err) {
          console.error('Error deleting outcome code:', err);
          showNotification('Failed to delete outcome code', 'error');
        }
      }
    );
  };

  const handleSaveCode = async () => {
    if (!formData.code || !formData.name) {
      showNotification('Please fill in all required fields', 'warning');
      return;
    }

    try {
      const dbData: any = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        next_action: formData.nextAction,
        auto_schedule: formData.autoSchedule,
        schedule_delay: formData.scheduleDelay,
        is_active: formData.isActive,
        updated_at: new Date().toISOString()
      };

      if (editingCode) {
        const { error } = await supabase
          .from('outcome_codes')
          .update(dbData)
          .eq('id', editingCode.id);

        if (error) throw error;
        showNotification('Outcome code updated successfully', 'success');
      } else {
        dbData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('outcome_codes')
          .insert(dbData);

        if (error) throw error;
        showNotification('Outcome code created successfully', 'success');
      }

      setShowModal(false);
      loadOutcomeCodes();
    } catch (err) {
      console.error('Error saving outcome code:', err);
      showNotification('Failed to save outcome code', 'error');
    }
  };

  const showConfirmDialog = (message: string, action: () => void) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
  };

  const getNextActionIcon = (action: string) => {
    const key = normalizeAction(action);
    const iconMap: { [key: string]: string } = {
      'call': '📞',
      'sms': '💬',
      'email': '📧',
      'schedule': '📅',
      'delete': '🗑️'
    };
    return iconMap[key] || '📋';
  };

  const getNextActionColor = (action: string) => {
    const key = normalizeAction(action);
    const colorMap: { [key: string]: string } = {
      'call': 'bg-blue-100 text-blue-800',
      'sms': 'bg-green-100 text-green-800',
      'email': 'bg-purple-100 text-purple-800',
      'schedule': 'bg-yellow-100 text-yellow-800',
      'delete': 'bg-red-100 text-red-800'
    };
    return colorMap[key] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#011E41] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading outcome codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Target className="h-8 w-8 mr-3 text-[#011E41]" />
            Outcome Codes Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure outcome codes for lead management and automated actions
          </p>
        </div>
        <button
          onClick={handleAddCode}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Outcome Code</span>
        </button>
      </div>

      {/* Outcome Codes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auto Schedule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{code.code}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{code.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{code.description}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const actionKey = normalizeAction(code.nextAction || 'call');
                      const label = actionKey === 'delete'
                        ? 'Delete'
                        : actionKey.charAt(0).toUpperCase() + actionKey.slice(1);
                      return (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNextActionColor(actionKey)}`}>
                          <span className="mr-1">{getNextActionIcon(actionKey)}</span>
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {code.autoSchedule ? (
                      <span className="text-sm text-gray-900">
                        Yes ({code.scheduleDelay}h)
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      code.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditCode(code)}
                      className="text-[#401DBA] hover:text-[#6D52B0] mr-3"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCode(code)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingCode ? 'Edit Outcome Code' : 'Add New Outcome Code'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Code *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                      placeholder="e.g., CNA"
                      disabled={!!editingCode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                      placeholder="e.g., Called - No Answer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                    rows={3}
                    placeholder="Describe what this outcome code represents..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next Action
                    </label>
                    <select
                      value={formData.nextAction}
                      onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                    >
                      <option value="call">Call</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="schedule">Schedule</option>
                      <option value="delete">Delete</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Delay (hours)
                    </label>
                    <input
                      type="number"
                      value={formData.scheduleDelay}
                      onChange={(e) => setFormData({ ...formData, scheduleDelay: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#401DBA] focus:border-[#401DBA]"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.autoSchedule}
                      onChange={(e) => setFormData({ ...formData, autoSchedule: e.target.checked })}
                      className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                    />
                    <span className="ml-2 text-sm text-gray-700">Auto-schedule follow-up</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCode}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-[#011E41] text-white hover:bg-[#011633] transition-colors"
                >
                  {editingCode ? 'Update' : 'Create'} Outcome Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-orange-100">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    Confirm Action
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Please confirm this action
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmAction(null);
                    setConfirmMessage('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 rounded-lg mb-6 bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-800 leading-relaxed">
                  {confirmMessage}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmAction(null);
                    setConfirmMessage('');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmAction) {
                      confirmAction();
                    }
                    setShowConfirmModal(false);
                    setConfirmAction(null);
                    setConfirmMessage('');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  notificationType === 'success' ? 'bg-green-100' :
                  notificationType === 'error' ? 'bg-red-100' :
                  'bg-orange-100'
                }`}>
                  {notificationType === 'success' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : notificationType === 'error' ? (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <h2 className={`text-xl font-bold ${
                    notificationType === 'success' ? 'text-green-900' :
                    notificationType === 'error' ? 'text-red-900' :
                    'text-orange-900'
                  }`}>
                    {notificationType === 'success' ? 'Success!' :
                     notificationType === 'error' ? 'Error' :
                     'Warning'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {notificationType === 'success' ? 'Action completed successfully' :
                     notificationType === 'error' ? 'An error occurred' :
                     'Please review the message'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                    setNotificationMessage('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`p-4 rounded-lg mb-6 border ${
                notificationType === 'success' 
                  ? 'bg-green-50 border-green-200' 
                  : notificationType === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <p className={`text-sm leading-relaxed ${
                  notificationType === 'success' ? 'text-green-800' :
                  notificationType === 'error' ? 'text-red-800' :
                  'text-orange-800'
                }`}>
                  {notificationMessage}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowNotificationModal(false);
                  setNotificationMessage('');
                }}
                className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  notificationType === 'success'
                    ? 'bg-[#011E41] text-white hover:bg-[#011633]'
                    : notificationType === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
