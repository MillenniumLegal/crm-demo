import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { assignLeads } from '@/services/leadsService';
import { fetchUsers } from '@/services/usersService';
import { useAuth } from '@/context/AuthContext';
import { canAgentReceiveLead } from '@/services/quotaService';

interface AssignLeadModalProps {
  isOpen: boolean;
  lead: { id: string; name: string } | null;
  onClose: () => void;
  onSuccess?: (leadName: string, agentName: string) => void;
  onError?: (message: string) => void;
  onActivityUpdate?: () => void;
  refreshData?: () => Promise<void>;
}

export const AssignLeadModal: React.FC<AssignLeadModalProps> = ({
  isOpen,
  lead,
  onClose,
  onSuccess,
  onError,
  onActivityUpdate,
  refreshData
}) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [assignFormData, setAssignFormData] = useState({
    agentId: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    notes: ''
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignFeedback, setAssignFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load users when modal opens
  useEffect(() => {
    if (!isOpen || !lead) {
      // Reset when modal closes
      setUsers([]);
      setAssignFormData({ agentId: '', priority: 'Medium', notes: '' });
      setAssignFeedback(null);
      return;
    }

    // Load users when modal opens
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const fetchedUsers = await fetchUsers();
        // Filter for active agents only - safely handle status property
        const activeAgents = (fetchedUsers || []).filter(
          (u: any) => u && u.role === 'Agent' && (u.status === 'Active' || !u.status)
        );
        setUsers(activeAgents || []);
      } catch (error) {
        console.error('Error loading users:', error);
        setUsers([]); // Set empty array on error to prevent further issues
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
    // Reset form when modal opens
    setAssignFormData({ agentId: '', priority: 'Medium', notes: '' });
    setAssignFeedback(null);
  }, [isOpen, lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !assignFormData.agentId) {
      setAssignFeedback({
        type: 'error',
        message: 'Please select an agent.'
      });
      return;
    }

    setIsAssigning(true);
    setAssignFeedback(null);

    try {
      const selectedAgent = users.find(u => u.id === assignFormData.agentId);
      
      if (!selectedAgent) {
        throw new Error('Selected agent not found');
      }

      const quotaCheck = await canAgentReceiveLead(assignFormData.agentId, 1);
      if (!quotaCheck.canReceive) {
        const message = quotaCheck.reason || 'This agent has reached their daily lead quota.';
        setAssignFeedback({ type: 'error', message });
        onError?.(message);
        return;
      }

      await assignLeads([lead.id], assignFormData.agentId, {
        priority: assignFormData.priority,
        notes: assignFormData.notes.trim() || undefined,
        assignedById: user?.id || undefined,
        assignedByName: user?.name || undefined
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-center:updated', {
          detail: { type: 'lead_assigned', leadId: lead.id, agentId: assignFormData.agentId }
        }));
      }

      // Refresh data if callback provided
      if (refreshData) {
        await refreshData();
      }

      // Update activities if callback provided
      if (onActivityUpdate) {
        onActivityUpdate();
      }

      // Call success callback
      onSuccess?.(lead.name, selectedAgent.name);

      // Close modal and reset form
      setAssignFormData({ agentId: '', priority: 'Medium', notes: '' });
      setAssignFeedback(null);
      onClose();
    } catch (error) {
      console.error('Error assigning lead:', error);
      const errorMessage = 'Failed to assign lead. Please try again.';
      setAssignFeedback({
        type: 'error',
        message: errorMessage
      });
      onError?.(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setAssignFormData({ agentId: '', priority: 'Medium', notes: '' });
    setAssignFeedback(null);
    onClose();
  };

  // Don't render if modal is not open or lead is not provided
  if (!isOpen || !lead) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">Assign Lead</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isAssigning}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Assign <span className="font-medium text-gray-900">{lead.name}</span> to:
            </p>
            
            <div className="space-y-4">
              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Agent <span className="text-red-500">*</span>
                </label>
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading agents...</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={assignFormData.agentId}
                      onChange={(e) => setAssignFormData({ ...assignFormData, agentId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isAssigning}
                    >
                      <option value="">Choose an agent...</option>
                      {users.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.email})
                        </option>
                      ))}
                    </select>
                    {users.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">No active agents available</p>
                    )}
                  </>
                )}
              </div>

              {/* Priority Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={assignFormData.priority}
                  onChange={(e) => setAssignFormData({ ...assignFormData, priority: e.target.value as 'High' | 'Medium' | 'Low' })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isAssigning}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes <span className="text-gray-500 text-xs">(for notification to assigned agent)</span>
                </label>
                <textarea
                  value={assignFormData.notes}
                  onChange={(e) => setAssignFormData({ ...assignFormData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Add any notes or instructions for the assigned agent..."
                  disabled={isAssigning}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This note will be added to the lead and visible to the assigned agent.
                </p>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {assignFeedback && (
            <div className={`p-3 rounded-lg ${
              assignFeedback.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <p className="text-sm">{assignFeedback.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isAssigning}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#011E41] hover:bg-[#011633] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isAssigning || !assignFormData.agentId || isLoadingUsers}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Lead'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};





