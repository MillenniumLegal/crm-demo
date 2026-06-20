import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Clock, User, Globe, Zap, Filter, Search, Eye, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AssignLeadModal } from '@/components/AssignLeadModal';
import { supabase } from '@/lib/supabase';

interface Activity {
  id: string;
  action: string;
  lead: string;
  time: string;
  type: string;
  doneBy: string;
  doneByType?: 'user' | 'system' | 'webhook' | 'api';
  timestamp: number;
  leadId?: string;
}

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: Activity[];
  leadsMap?: Map<string, { assignedTo?: string; assignedToName?: string; source?: string }>;
  userRole?: string;
  onActivityUpdate?: () => void;
  onAssignSuccess?: (leadName: string, agentName: string) => void;
  onAssignError?: (message: string) => void;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({ 
  isOpen, 
  onClose, 
  activities, 
  leadsMap = new Map(),
  userRole,
  onActivityUpdate,
  onAssignSuccess,
  onAssignError
}) => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('All');
  const [filterSource, setFilterSource] = useState<string>('All');
  const [filterAction, setFilterAction] = useState<string>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<{ id: string; name: string } | null>(null);
  const [localLeadsMap, setLocalLeadsMap] = useState<Map<string, { assignedTo?: string; assignedToName?: string; source?: string }>>(leadsMap);

  const getActivityDisplayAction = (action: string, leadSource?: string) => {
    if (!leadSource || leadSource === 'Hoowla') return action;
    if (!action.includes('from Hoowla')) return action;
    return action.replace('from Hoowla', `from ${leadSource}`);
  };

  // Sync localLeadsMap when leadsMap prop changes or modal opens
  // Always sync when modal is open, even if leadsMap is empty (leads might have been unassigned)
  useEffect(() => {
    if (isOpen) {
      setLocalLeadsMap(new Map(leadsMap));
    }
  }, [isOpen, leadsMap]);
  
  // Refresh lead data when activities change to ensure we have latest assignment status
  // This handles cases where a lead is dropped while modal is open
  // Use a ref to track the last processed activities to prevent infinite loops
  const lastActivitiesRef = useRef<string>('');
  
  useEffect(() => {
    if (!isOpen || activities.length === 0) return;
    
    // Create a stable key from activity IDs
    const currentKey = activities.map(a => a.id).sort().join(',');
    
    // Skip if we've already processed these activities
    if (lastActivitiesRef.current === currentKey) return;
    lastActivitiesRef.current = currentKey;
    
    const refreshLeadData = async () => {
      const leadIds = activities.filter(a => a.leadId).map(a => a.leadId!);
      if (leadIds.length === 0) return;
      
      try {
        const uniqueLeadIds = Array.from(new Set(leadIds));
        const { data: leads, error } = await supabase
          .from('leads')
          .select('id, assigned_to')
          .in('id', uniqueLeadIds);

        if (error) throw error;

        const latestLeadsMap = new Map<string, { assignedTo?: string; assignedToName?: string }>();
        (leads || []).forEach((lead: any) => {
          latestLeadsMap.set(lead.id, {
            assignedTo: lead.assigned_to || undefined,
          });
        });
        setLocalLeadsMap(latestLeadsMap);
      } catch (error) {
        console.error('Error refreshing leads in ActivityModal:', error);
      }
    };
    
    // Short debounce lets the feed settle without making assignment chips feel stale.
    const timeout = setTimeout(refreshLeadData, 150);
    return () => clearTimeout(timeout);
  }, [isOpen, activities.length]); // Only depend on length to avoid infinite loops

  // Get unique action types for filtering
  const actionTypes = useMemo(() => {
    if (!isOpen) return [];
    const actions = new Set<string>();
    activities.forEach(act => {
      if (act.action.includes('New lead') || act.action.includes('Lead assigned')) {
        actions.add('New Leads');
      } else if (act.action.includes('Quote')) {
        actions.add('Quotes');
      } else if (act.action.includes('Payment')) {
        actions.add('Payments');
      } else if (act.action.includes('Task') || act.action.includes('Follow-up')) {
        actions.add('Tasks');
      } else if (act.action.includes('sold') || act.action.includes('closed') || act.action.includes('Status')) {
        actions.add('Status Changes');
      } else {
        actions.add('Other');
      }
    });
    return Array.from(actions).sort();
  }, [activities, isOpen]);

  // Get unique users for filtering
  const uniqueUsers = useMemo(() => {
    if (!isOpen) return [];
    const users = new Set<string>();
    activities.forEach(act => {
      if (act.doneByType === 'user' && act.doneBy && act.doneBy !== 'System') {
        users.add(act.doneBy);
      }
    });
    return Array.from(users).sort();
  }, [activities, isOpen]);

  // Filter activities based on selected filters
  const filteredActivities = useMemo(() => {
    if (!isOpen) return [];
    return activities.filter(activity => {
      // Filter by type
      if (filterType !== 'All' && activity.type !== filterType.toLowerCase()) {
        return false;
      }

      // Filter by source (doneByType)
      if (filterSource !== 'All') {
        if (filterSource === 'User' && activity.doneByType !== 'user') return false;
        if (filterSource === 'System' && activity.doneByType !== 'system') return false;
        if (filterSource === 'Webhook' && activity.doneByType !== 'webhook') return false;
        if (filterSource === 'API' && activity.doneByType !== 'api') return false;
      }

      // Filter by action category
      if (filterAction !== 'All') {
        const actionMatch = 
          (filterAction === 'New Leads' && (activity.action.includes('New lead') || activity.action.includes('Lead assigned'))) ||
          (filterAction === 'Quotes' && activity.action.includes('Quote')) ||
          (filterAction === 'Payments' && activity.action.includes('Payment')) ||
          (filterAction === 'Tasks' && (activity.action.includes('Task') || activity.action.includes('Follow-up'))) ||
          (filterAction === 'Status Changes' && (activity.action.includes('sold') || activity.action.includes('closed') || activity.action.includes('Status'))) ||
          (filterAction === 'Other' && !activity.action.includes('New lead') && !activity.action.includes('Lead assigned') && !activity.action.includes('Quote') && !activity.action.includes('Payment') && !activity.action.includes('Task') && !activity.action.includes('Follow-up') && !activity.action.includes('sold') && !activity.action.includes('closed') && !activity.action.includes('Status'));
        
        if (!actionMatch) return false;
      }

      // Filter by agent/user
      if (filterAgent !== 'All' && activity.doneByType === 'user') {
        if (activity.doneBy !== filterAgent) {
          return false;
        }
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          activity.action.toLowerCase().includes(searchLower) ||
          activity.lead.toLowerCase().includes(searchLower) ||
          activity.doneBy.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [activities, filterType, filterSource, filterAction, filterAgent, searchTerm, isOpen]);

  const resetFilters = () => {
    setFilterType('All');
    setFilterSource('All');
    setFilterAction('All');
    setFilterAgent('All');
    setSearchTerm('');
  };

  const hasActiveFilters = filterType !== 'All' || filterSource !== 'All' || filterAction !== 'All' || filterAgent !== 'All' || searchTerm !== '';

  if (!isOpen) return null;

  const isAssignmentActivity = (activity: Activity) =>
    activity.type.includes('lead_assigned') ||
    activity.type.includes('assignment') ||
    activity.action.toLowerCase().includes('assigned');

  const getActivityIcon = (type: string) => {
    if (type.includes('lead_deleted')) return '🗑️';
    if (type.includes('lead')) return '👤';
    if (type.includes('quote')) return '📄';
    if (type.includes('payment')) return '💳';
    if (type.includes('task')) return '✅';
    if (type.includes('contact')) return '📞';
    return '📋';
  };

  const getDoneByIcon = (doneByType?: string) => {
    switch (doneByType) {
      case 'user':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'webhook':
        return <Globe className="h-4 w-4 text-green-500" />;
      case 'system':
        return <Zap className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    if (type.includes('lead_created')) return 'bg-blue-500';
    if (type.includes('lead_assigned')) return 'bg-blue-600';
    if (type.includes('lead_deleted')) return 'bg-red-500';
    if (type.includes('quote')) return 'bg-green-500';
    if (type.includes('payment')) return 'bg-purple-500';
    if (type.includes('task')) return 'bg-yellow-500';
    if (type.includes('status')) return 'bg-green-600';
    return 'bg-gray-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Today's Activity</h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredActivities.length} of {activities.length} {activities.length === 1 ? 'activity' : 'activities'} today
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Filters Section */}
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Activity Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All Types</option>
              <option value="assignment">Assignments</option>
              <option value="quote">Quotes</option>
              <option value="payment">Payments</option>
              <option value="followup">Follow-ups</option>
              <option value="status">Status Changes</option>
            </select>

            {/* Source Filter */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All Sources</option>
              <option value="User">User Actions</option>
              <option value="System">System</option>
              <option value="Webhook">Webhook</option>
              <option value="API">API</option>
            </select>

            {/* Action Category Filter */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All Actions</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            {/* Agent/User Filter */}
            {uniqueUsers.length > 0 && (
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="All">All Agents</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Activity List - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {hasActiveFilters ? 'No activities match your filters' : 'No activities today'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear filters to see all activities
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Activity Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center text-white text-lg`}>
                      {getActivityIcon(activity.type)}
                    </div>
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {getActivityDisplayAction(
                            activity.action,
                            activity.leadId
                              ? (localLeadsMap.get(activity.leadId)?.source || leadsMap.get(activity.leadId)?.source)
                              : undefined
                          )}
                        </p>
                          {activity.leadId && (() => {
                            const leadData = localLeadsMap.get(activity.leadId!) || leadsMap.get(activity.leadId!);
                            const assignmentActivity = isAssignmentActivity(activity);
                            if (!leadData && !assignmentActivity) return null;
                            const isAssigned = !!leadData?.assignedTo || assignmentActivity;
                            return (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                isAssigned
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {isAssigned ? 'Assigned' : 'Unassigned'}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{activity.lead}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {activity.leadId && (
                          <>
                            <button
                              onClick={() => navigate(`/lead-management?leadId=${activity.leadId}`)}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View Lead"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {userRole !== 'Agent' && (() => {
                              const leadData = localLeadsMap.get(activity.leadId!) || leadsMap.get(activity.leadId!);
                              const isAssigned = !!leadData?.assignedTo;
                              return !isAssigned ? (
                                <button
                                  onClick={() => {
                                    setSelectedLeadForAssign({ id: activity.leadId!, name: activity.lead });
                                    setShowAssignModal(true);
                                  }}
                                  className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Assign Lead"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </button>
                              ) : null;
                            })()}
                          </>
                        )}
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{activity.time}</p>
                        </div>
                      </div>
                    </div>

                    {/* Done By Section */}
                    <div className="flex items-center space-x-2 mt-2">
                      {getDoneByIcon(activity.doneByType)}
                      <span className="text-xs text-gray-500">
                        Done by: <span className="font-medium text-gray-700">{activity.doneBy}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>

      {/* Assign Lead Modal */}
      <AssignLeadModal
        isOpen={showAssignModal}
        lead={selectedLeadForAssign ? { id: selectedLeadForAssign.id, name: selectedLeadForAssign.name } : null}
        onClose={() => {
                  setShowAssignModal(false);
                  setSelectedLeadForAssign(null);
                }}
        onSuccess={async (leadName, agentName) => {
          if (selectedLeadForAssign?.id) {
            setLocalLeadsMap((current) => {
              const next = new Map(current);
              next.set(selectedLeadForAssign.id, {
                assignedTo: 'assigned',
                assignedToName: agentName,
              });
              return next;
            });
          }
                        
                        // Refresh activities if callback provided
                        if (onActivityUpdate) {
                          onActivityUpdate();
                        }
                        
          onAssignSuccess?.(leadName, agentName);
        }}
        onError={(message) => {
          onAssignError?.(message);
        }}
        onActivityUpdate={onActivityUpdate}
      />
    </div>
  );
};
