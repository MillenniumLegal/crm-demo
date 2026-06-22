import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchLeadsPage, updateLead, assignLeads, deleteLeads } from '@/services/leadsService';
import { Lead } from '@/types';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/activityService';
import { AssignLeadModal } from '@/components/AssignLeadModal';
import { canAgentReceiveLead } from '@/services/quotaService';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  UserPlus,
  Eye,
  Loader2,
  X,
  Download,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const LEADS_PER_PAGE = 25;

interface LeadTimeData {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: 'New' | 'Assigned' | 'Contacted' | 'Interested' | 'Quote Sent' | 'Sold' | 'Closed' | 'Archived';
  assignedTo?: string;
  createdAt: string;
  assignedAt?: string;
  lastActionAt?: string;
  ageInHours: number;
  ageInDays: number;
  priority: 'High' | 'Medium' | 'Low';
  contactAttempts: number;
  maxAttempts: number;
  isOverdue: boolean;
  timeToAssignment?: number; // hours
  timeToFirstContact?: number; // hours
}

// Helper function to calculate age in hours
function calculateAgeInHours(createdAt: string): number {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

// Helper function to calculate time difference in hours
function calculateTimeDifference(startDate: string, endDate?: string): number | undefined {
  if (!endDate) return undefined;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

// Transform Lead to LeadTimeData
function transformLeadToTimeData(lead: Lead): LeadTimeData {
  const ageInHours = calculateAgeInHours(lead.createdAt);
  const ageInDays = ageInHours / 24;
  
  // Calculate time to assignment if assigned
  const timeToAssignment = lead.assignedTo && lead.updatedAt 
    ? calculateTimeDifference(lead.createdAt, lead.updatedAt)
    : undefined;
  
  // Calculate time to first contact
  const timeToFirstContact = lead.lastActionAt
    ? calculateTimeDifference(lead.createdAt, lead.lastActionAt)
    : undefined;

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    assignedTo: lead.assignedToName || lead.assignedTo,
    createdAt: lead.createdAt,
    assignedAt: lead.updatedAt || undefined, // Approximate from updatedAt when assigned
    lastActionAt: lead.lastActionAt,
    ageInHours,
    ageInDays: Math.round(ageInDays * 100) / 100,
    priority: lead.priority,
    contactAttempts: lead.contactAttempts,
    maxAttempts: lead.maxAttempts,
    isOverdue: lead.isOverdue || false,
    timeToAssignment,
    timeToFirstContact
  };
}

export const LeadTimeTracking: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filterAge, setFilterAge] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [sortBy, setSortBy] = useState('age');
  const [leads, setLeads] = useState<LeadTimeData[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agents, setAgents] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<LeadTimeData | null>(null);

  // Account-wide stats (additive): fetch ALL matching leads once for an account-level SLA view.
  // Mirrors the same base filters as loadLeads but pulls a large page in one call.
  const [allLeads, setAllLeads] = useState<LeadTimeData[]>([]);
  const [allLeadsLoading, setAllLeadsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadAllLeads = async () => {
      setAllLeadsLoading(true);
      try {
        const ageThreshold = new Date();
        ageThreshold.setHours(ageThreshold.getHours() - 24);

        const filters: any = {
          status: filterStatus !== 'All' ? filterStatus : undefined,
          source: filterSource !== 'All' ? filterSource : undefined,
        };

        if (filterAge === 'New') {
          filters.createdAfter = ageThreshold.toISOString();
        } else if (filterAge === 'Old') {
          filters.createdBefore = ageThreshold.toISOString();
        } else if (filterAge === 'Overdue') {
          filters.isOverdue = true;
        }

        if (user?.role === 'Agent' && user?.id) {
          filters.userId = user.id;
        }

        const result = await fetchLeadsPage(filters, {
          limit: 1000,
          offset: 0,
          sortBy: 'created_at',
          sortDirection: 'asc',
        });

        if (!cancelled) {
          setAllLeads(result.leads.map(transformLeadToTimeData));
        }
      } catch (err) {
        console.error('Error loading account-wide lead time data:', err);
        if (!cancelled) setAllLeads([]);
      } finally {
        if (!cancelled) setAllLeadsLoading(false);
      }
    };

    if (user) {
      loadAllLeads();
    }
    return () => {
      cancelled = true;
    };
  }, [filterAge, filterStatus, filterSource, user?.id, user?.role, user]);

  // Account-wide SLA aggregates (guard empty / divide-by-zero)
  const accountStats = (() => {
    const total = allLeads.length;
    if (total === 0) {
      return { total: 0, avgAge: 0, overduePct: 0, avgTimeToFirstContact: null as number | null };
    }
    const avgAge = allLeads.reduce((sum, l) => sum + l.ageInHours, 0) / total;
    const overdueCount = allLeads.filter((l) => l.isOverdue).length;
    const overduePct = (overdueCount / total) * 100;
    const contacted = allLeads.filter((l) => typeof l.timeToFirstContact === 'number');
    const avgTimeToFirstContact = contacted.length > 0
      ? contacted.reduce((sum, l) => sum + (l.timeToFirstContact || 0), 0) / contacted.length
      : null;
    return { total, avgAge, overduePct, avgTimeToFirstContact };
  })();

  // Fetch agents for bulk assign
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('role', 'Agent')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error loading agents:', error);
        } else {
          setAgents(data || []);
        }
      } catch (err) {
        console.error('Error loading agents:', err);
      }
    };

    if (user?.role === 'Admin' || user?.role === 'Manager') {
      loadAgents();
    }
  }, [user?.role]);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const ageThreshold = new Date();
      ageThreshold.setHours(ageThreshold.getHours() - 24);

      const filters: any = {
        status: filterStatus !== 'All' ? filterStatus : undefined,
        source: filterSource !== 'All' ? filterSource : undefined,
      };

      if (filterAge === 'New') {
        filters.createdAfter = ageThreshold.toISOString();
      } else if (filterAge === 'Old') {
        filters.createdBefore = ageThreshold.toISOString();
      } else if (filterAge === 'Overdue') {
        filters.isOverdue = true;
      }

      if (user?.role === 'Agent' && user?.id) {
        filters.userId = user.id;
      }

      const sortOptions = (() => {
        switch (sortBy) {
          case 'name':
            return { sortBy: 'name' as const, sortDirection: 'asc' as const };
          case 'source':
            return { sortBy: 'source' as const, sortDirection: 'asc' as const };
          case 'status':
            return { sortBy: 'status' as const, sortDirection: 'asc' as const };
          case 'age':
          default:
            return { sortBy: 'created_at' as const, sortDirection: 'asc' as const };
        }
      })();

      const result = await fetchLeadsPage(filters, {
        limit: LEADS_PER_PAGE,
        offset: (currentPage - 1) * LEADS_PER_PAGE,
        ...sortOptions,
      });

      const timeDataLeads = result.leads.map(transformLeadToTimeData);
      setLeads(timeDataLeads);
      setTotalLeads(result.total);
    } catch (err) {
      console.error('Error loading leads for time tracking:', err);
      setLeads([]);
      setTotalLeads(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterAge, filterStatus, filterSource, sortBy, user?.id, user?.role]);

  // Fetch leads from Supabase
  useEffect(() => {
    if (user) {
      loadLeads();
    }
  }, [user, loadLeads]);

  const sortedLeads = leads;

  // Pagination
  const totalPages = Math.ceil(totalLeads / LEADS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
  const endIndex = startIndex + sortedLeads.length;
  const paginatedLeads = sortedLeads;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAge, filterStatus, filterSource, sortBy]);

  useEffect(() => {
    setSelectedLeads([]);
  }, [currentPage, filterAge, filterStatus, filterSource, sortBy]);

  const getAgeColor = (ageInHours: number, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600';
    if (ageInHours >= 24) return 'text-orange-600';
    if (ageInHours >= 12) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Assigned': return 'bg-yellow-100 text-yellow-800';
      case 'Contacted': return 'bg-purple-100 text-purple-800';
      case 'Interested': return 'bg-green-100 text-green-800';
      case 'Quote Sent': return 'bg-indigo-100 text-indigo-800';
      case 'Sold': return 'bg-emerald-100 text-emerald-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      case 'Archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAge = (ageInHours: number) => {
    if (ageInHours < 1) return `${Math.round(ageInHours * 60)}m`;
    if (ageInHours < 24) return `${Math.round(ageInHours)}h`;
    return `${Math.round(ageInHours / 24)}d ${Math.round(ageInHours % 24)}h`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStats = () => {
    const loadedLeadCount = leads.length;
    if (loadedLeadCount === 0) {
      return {
        totalLeads: 0,
        newLeads: 0,
        unassignedLeads: 0,
        overdueLeads: 0,
        avgAge: 0,
        oldestAge: 0,
        oldestLead: 'N/A'
      };
    }

    const newLeads = leads.filter(l => l.status === 'New').length;
    const unassignedLeads = leads.filter(l => !l.assignedTo).length;
    const overdueLeads = leads.filter(l => l.isOverdue).length;
    const avgAge = leads.reduce((sum, lead) => sum + lead.ageInHours, 0) / loadedLeadCount;
    const oldestLead = leads.reduce((oldest, lead) => 
      lead.ageInHours > oldest.ageInHours ? lead : oldest
    );

    return {
      totalLeads: loadedLeadCount,
      newLeads,
      unassignedLeads,
      overdueLeads,
      avgAge: Math.round(avgAge * 10) / 10,
      oldestAge: oldestLead.ageInHours,
      oldestLead: oldestLead.name
    };
  };

  const stats = getStats();

  const handleViewLead = (lead: LeadTimeData) => {
    navigate(`/lead-management?leadId=${lead.id}`);
  };

  const handleAssignLead = (lead: LeadTimeData) => {
    if (!(user?.role === 'Admin' || user?.role === 'Manager')) return;
    setSelectedLeadForAssign(lead);
    setShowAssignModal(true);
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === sortedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(sortedLeads.map(lead => lead.id));
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedAgentId || selectedLeads.length === 0) return;

    setIsAssigning(true);
    try {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (!agent) {
        setFeedback({
          type: 'error',
          message: 'Agent not found'
        });
        setIsAssigning(false);
        return;
      }

      // Store the count before clearing
      const leadCount = selectedLeads.length;
      const quotaCheck = await canAgentReceiveLead(selectedAgentId, leadCount);

      if (!quotaCheck.canReceive) {
        setFeedback({
          type: 'error',
          message: quotaCheck.reason || `${agent.name} has reached their daily lead quota.`
        });
        setIsAssigning(false);
        return;
      }

      // Use assignLeads for bulk update (more efficient)
      const success = await assignLeads(selectedLeads, selectedAgentId);
      
      if (!success) {
        throw new Error('Failed to assign leads');
      }

      // Log activity for each lead
      const activityPromises = selectedLeads.map(async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        try {
          await logActivity({
            activityType: 'lead_assigned',
            entityType: 'lead',
            entityId: leadId,
            leadId: leadId,
            leadName: lead.name,
            actionDescription: `Lead assigned to ${agent.name}`,
            doneByType: 'user',
            doneById: user?.id,
            doneByName: user?.name || 'Unknown',
            metadata: {
              assignedTo: selectedAgentId,
              assignedToName: agent.name,
              previousStatus: lead.status,
              newStatus: 'Assigned'
            }
          });
        } catch (activityError) {
          console.error(`Error logging activity for lead ${leadId}:`, activityError);
          // Continue even if activity logging fails
        }
      });

      await Promise.all(activityPromises);

      // Update leads to set stage to Call-1 for assigned leads
      const stageUpdatePromises = selectedLeads.map(async (leadId) => {
        try {
          await updateLead(leadId, {
            stage: 'Call-1'
          });
        } catch (stageError) {
          console.error(`Error updating stage for lead ${leadId}:`, stageError);
          // Continue even if stage update fails
        }
      });

      await Promise.all(stageUpdatePromises);

      // Reload leads
      await loadLeads();

      // Clear selection and close modal
      setSelectedLeads([]);
      setShowBulkAssignModal(false);
      setSelectedAgentId('');
      setFeedback({
        type: 'success',
        message: `Successfully assigned ${leadCount} lead${leadCount === 1 ? '' : 's'} to ${agent.name}.`
      });
    } catch (err) {
      console.error('Error bulk assigning leads:', err);
      setFeedback({
        type: 'error',
        message: 'Failed to assign leads. Please try again.'
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedLeads.length === 0) return;
    if (!(user?.role === 'Admin' || user?.role === 'Manager')) return;

    setDeleteError(null);
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedLeads.length === 0) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const success = await deleteLeads(selectedLeads, {
        deletedById: user?.id,
        deletedByName: user?.name || undefined,
        reason: 'Bulk delete from Lead Time Tracking'
      });

      if (!success) {
        throw new Error('Failed to delete leads');
      }

      await loadLeads();
      setSelectedLeads([]);
      setShowBulkDeleteModal(false);
      setFeedback({
        type: 'success',
        message: `Deleted ${selectedLeads.length} lead${selectedLeads.length === 1 ? '' : 's'}.`
      });
    } catch (err) {
      console.error('Error bulk deleting leads:', err);
      setDeleteError('Failed to delete selected leads. Please try again.');
      setFeedback({
        type: 'error',
        message: 'Failed to delete selected leads. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelBulkDelete = () => {
    if (isDeleting) return;
    setShowBulkDeleteModal(false);
    setDeleteError(null);
  };

  const handleExportReport = () => {
    // Prepare CSV data
    const headers = [
      'Lead Name',
      'Email',
      'Phone',
      'Source',
      'Status',
      'Assigned To',
      'Age (Hours)',
      'Age (Days)',
      'Priority',
      'Contact Attempts',
      'Max Attempts',
      'Is Overdue',
      'Time to Assignment (Hours)',
      'Time to First Contact (Hours)',
      'Created At',
      'Assigned At',
      'Last Action At'
    ];

    const rows = sortedLeads.map(lead => [
      lead.name,
      lead.email,
      lead.phone,
      lead.source,
      lead.status,
      lead.assignedTo || 'Unassigned',
      lead.ageInHours.toString(),
      lead.ageInDays.toFixed(2),
      lead.priority,
      lead.contactAttempts.toString(),
      lead.maxAttempts.toString(),
      lead.isOverdue ? 'Yes' : 'No',
      lead.timeToAssignment?.toString() || 'N/A',
      lead.timeToFirstContact?.toString() || 'N/A',
      lead.createdAt,
      lead.assignedAt || 'N/A',
      lead.lastActionAt || 'N/A'
    ]);

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lead-time-tracking-page-${currentPage}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Feedback Modal */}
      {feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="flex items-center justify-center">
                {feedback.type === 'success' ? (
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {feedback.type === 'success' ? 'Success' : 'Something went wrong'}
                </h3>
                <p className="text-sm text-gray-600 mt-2">{feedback.message}</p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setFeedback(null)}
                  className="w-full px-4 py-2 rounded-xl text-sm font-medium bg-[#011E41] text-white hover:bg-[#011E41]/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Time Tracking</h1>
          <p className="text-gray-600">Monitor lead age and assignment times</p>
        </div>
        <div className="flex space-x-3">
          <button 
            className="btn-secondary flex items-center space-x-2"
            onClick={handleExportReport}
            disabled={sortedLeads.length === 0}
          >
            <Download className="h-5 w-5" />
            <span>Export Current Page</span>
          </button>
          {(user?.role === 'Admin' || user?.role === 'Manager') && (
            <button 
              className="btn-primary flex items-center space-x-2"
              onClick={() => {
                if (selectedLeads.length === 0) {
                  alert('Please select at least one lead to assign');
                } else {
                  setShowBulkAssignModal(true);
                }
              }}
              disabled={selectedLeads.length === 0}
            >
            <UserPlus className="h-5 w-5" />
              <span>Bulk Assign ({selectedLeads.length})</span>
          </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading lead time data...</p>
        </div>
      )}

      {/* Stats Cards */}
      {!isLoading && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Matching Leads</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeads.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{stats.totalLeads} loaded on this page</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-500">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900">{stats.unassignedLeads}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-500">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overdueLeads}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Age</p>
              <p className="text-2xl font-bold text-gray-900">{formatAge(stats.avgAge)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account-wide SLA strip (additive): aggregates ALL matching leads, not just this page */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Across all leads</h3>
            <p className="text-sm text-gray-500">
              Account-wide SLA computed over every matching lead
              {allLeadsLoading ? '' : ` (${accountStats.total.toLocaleString()} leads)`}
            </p>
          </div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700"
          >
            All matching
          </span>
        </div>
        {allLeadsLoading ? (
          <div className="flex items-center text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading account-wide data…
          </div>
        ) : accountStats.total === 0 ? (
          <p className="text-sm text-gray-500">No matching leads found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg p-4" style={{ backgroundColor: '#EEF2FF' }}>
              <div className="flex items-center text-xs font-medium text-gray-600 mb-1">
                <Clock className="h-4 w-4 mr-1.5" style={{ color: '#6366F1' }} />
                Avg Lead Age
              </div>
              <p className="text-2xl font-bold" style={{ color: '#3730A3' }}>
                {formatAge(accountStats.avgAge)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {(accountStats.avgAge / 24).toFixed(1)} days
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: '#FEF2F2' }}>
              <div className="flex items-center text-xs font-medium text-gray-600 mb-1">
                <AlertTriangle className="h-4 w-4 mr-1.5" style={{ color: '#EF4444' }} />
                Overdue
              </div>
              <p className="text-2xl font-bold" style={{ color: '#B91C1C' }}>
                {accountStats.overduePct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-0.5">of all matching leads</p>
            </div>
            <div className="rounded-lg p-4" style={{ backgroundColor: '#ECFDF5' }}>
              <div className="flex items-center text-xs font-medium text-gray-600 mb-1">
                <TrendingUp className="h-4 w-4 mr-1.5" style={{ color: '#10B981' }} />
                Avg Time to First Contact
              </div>
              <p className="text-2xl font-bold" style={{ color: '#047857' }}>
                {accountStats.avgTimeToFirstContact !== null
                  ? formatAge(accountStats.avgTimeToFirstContact)
                  : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">across contacted leads</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Oldest Unassigned Leads on This Page</h3>
          <div className="space-y-3">
            {leads
              .filter(l => !l.assignedTo)
              .sort((a, b) => b.ageInHours - a.ageInHours)
              .slice(0, 3)
              .map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    <div className="text-sm text-gray-500">{lead.source} • {lead.email}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${getAgeColor(lead.ageInHours, lead.isOverdue)}`}>
                      {formatAge(lead.ageInHours)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(lead.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Page Assignment Snapshot</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Average Time to Assignment:</span>
              <span className="text-sm font-medium text-gray-900">
                {leads.filter(l => l.timeToAssignment).length > 0 
                  ? formatAge(leads.filter(l => l.timeToAssignment).reduce((sum, l) => sum + (l.timeToAssignment || 0), 0) / leads.filter(l => l.timeToAssignment).length)
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Average Time to First Contact:</span>
              <span className="text-sm font-medium text-gray-900">
                {leads.filter(l => l.timeToFirstContact).length > 0 
                  ? formatAge(leads.filter(l => l.timeToFirstContact).reduce((sum, l) => sum + (l.timeToFirstContact || 0), 0) / leads.filter(l => l.timeToFirstContact).length)
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Oldest Lead:</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.oldestLead} ({formatAge(stats.oldestAge)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Age Distribution (additive analysis visual) */}
      {(() => {
        const buckets: { label: string; test: (h: number) => boolean }[] = [
          { label: '<1h', test: (h) => h < 1 },
          { label: '1-6h', test: (h) => h >= 1 && h < 6 },
          { label: '6-12h', test: (h) => h >= 6 && h < 12 },
          { label: '12-24h', test: (h) => h >= 12 && h < 24 },
          { label: '1-3d', test: (h) => h >= 24 && h < 72 },
          { label: '3-7d', test: (h) => h >= 72 && h < 168 },
          { label: '7d+', test: (h) => h >= 168 },
        ];
        const ageItems = buckets.map((b) => ({
          label: b.label,
          count: leads.filter((l) => b.test(l.ageInHours)).length,
        }));
        return (
          <RankedBarList
            title="Lead age distribution"
            caption={`Loaded leads on this page bucketed by age (${leads.length} leads)`}
            items={ageItems}
            defaultTone="warn"
          />
        );
      })()}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            <select 
              className="input-field"
              value={filterAge}
              onChange={(e) => setFilterAge(e.target.value)}
            >
              <option value="All">All Ages</option>
              <option value="New">New (&lt; 24h)</option>
              <option value="Old">Old (≥ 24h)</option>
              <option value="Overdue">Overdue</option>
            </select>
            <select 
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested</option>
              <option value="Quote Sent">Quote Sent</option>
              <option value="Sold">Sold</option>
              <option value="Closed">Closed</option>
              <option value="Archived">Archived</option>
            </select>
            <select 
              className="input-field"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="All">All Sources</option>
              <option value="Hoowla">Hoowla</option>
              <option value="Comparison Site">Comparison Site</option>
              <option value="Direct">Direct</option>
              <option value="Referral">Referral</option>
            </select>
            <select 
              className="input-field"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="age">Sort by Age</option>
              <option value="name">Sort by Name</option>
              <option value="source">Sort by Source</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedLeads.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedLeads.length} lead(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                className="btn-secondary text-sm"
                onClick={() => setSelectedLeads([])}
              >
                Clear Selection
              </button>
              {(user?.role === 'Admin' || user?.role === 'Manager') && (
                <>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => setShowBulkAssignModal(true)}
                  >
                    Assign Selected
                  </button>
                  <button
                    className="btn-danger text-sm"
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete Selected'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="card p-0">
        <div className="overflow-x-hidden">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {(user?.role === 'Admin' || user?.role === 'Manager') && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === sortedLeads.length && sortedLeads.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                    />
                  </th>
                )}
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[180px]">Lead</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Source</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[90px]">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Assigned</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Age</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[90px]">Attempts</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[130px]">Created</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  {(user?.role === 'Admin' || user?.role === 'Manager') && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="rounded border-gray-300 text-[#401DBA] focus:ring-[#401DBA]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate" title={lead.name}>{lead.name}</div>
                      <div className="text-xs text-gray-500 truncate" title={lead.email}>{lead.email}</div>
                      <div className="text-xs text-gray-400 truncate" title={lead.phone}>{lead.phone}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 truncate max-w-full" title={lead.source}>
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${getStatusColor(lead.status)}`} title={lead.status}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 min-w-0">
                    {lead.assignedTo ? (
                      <span className="truncate block" title={lead.assignedTo}>{lead.assignedTo}</span>
                    ) : (
                      <span className="text-red-600 font-medium text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className={`text-sm font-medium ${getAgeColor(lead.ageInHours, lead.isOverdue)}`}>
                      {formatAge(lead.ageInHours)}
                    </div>
                    {lead.isOverdue && (
                      <div className="text-xs text-red-600">Overdue</div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(lead.priority)}`} title={lead.priority}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {lead.contactAttempts}/{lead.maxAttempts}
                    </div>
                    {lead.contactAttempts >= lead.maxAttempts && (
                      <div className="text-xs text-red-600">Max</div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs text-gray-900" title={formatDateTime(lead.createdAt)}>
                      {new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(lead.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        className="p-1.5 text-[#011E41]/80 hover:text-[#011E41] hover:bg-[#011E41]/10 rounded transition-colors" 
                        title="View details"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewLead(lead);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {(user?.role === 'Admin' || user?.role === 'Manager') && (
                        <button 
                          className="p-1.5 text-[#9164CC]/80 hover:text-[#9164CC] hover:bg-[#9164CC]/10 rounded transition-colors" 
                          title={lead.assignedTo ? 'Reassign lead' : 'Assign lead'}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAssignLead(lead);
                          }}
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="card flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm text-gray-600">
            Showing {totalLeads === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalLeads)} of {totalLeads.toLocaleString()} leads
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
        </>
      )}

      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Selected Leads</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete {selectedLeads.length} selected lead
                  {selectedLeads.length === 1 ? '' : 's'}. This action cannot be undone.
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                onClick={handleCancelBulkDelete}
                disabled={isDeleting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start space-x-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Warning</p>
                  <p className="text-sm text-red-700">
                    Please confirm you understand this operation cannot be reversed.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                onClick={handleCancelBulkDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn-danger flex items-center"
                onClick={handleConfirmBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  `Delete ${selectedLeads.length} Lead${selectedLeads.length === 1 ? '' : 's'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Bulk Assign Leads</h3>
                <button
                  onClick={() => {
                    setShowBulkAssignModal(false);
                    setSelectedAgentId('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Assign <span className="font-medium text-gray-900">{selectedLeads.length}</span> selected lead(s) to an agent:
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Agent *
                </label>
                <select
                  className="input-field"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Select an agent...</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedLeads.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Selected Leads:</p>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="text-xs text-gray-700 space-y-1">
                      {selectedLeads.map(leadId => {
                        const lead = leads.find(l => l.id === leadId);
                        return lead ? (
                          <li key={leadId}>• {lead.name} ({lead.email})</li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowBulkAssignModal(false);
                  setSelectedAgentId('');
                }}
                disabled={isAssigning}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleBulkAssign}
                disabled={!selectedAgentId || isAssigning}
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Assigning...
                  </>
                ) : (
                  `Assign ${selectedLeads.length} Lead(s)`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Lead Assign Modal */}
      <AssignLeadModal
        isOpen={showAssignModal}
        lead={selectedLeadForAssign ? { id: selectedLeadForAssign.id, name: selectedLeadForAssign.name } : null}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedLeadForAssign(null);
        }}
        onSuccess={(leadName, agentName) => {
          setFeedback({
            type: 'success',
            message: `Successfully assigned ${leadName} to ${agentName}.`
          });
          loadLeads();
        }}
        onError={(message) => {
          setFeedback({
            type: 'error',
            message: message || 'Failed to assign lead.'
          });
        }}
        refreshData={loadLeads}
      />
    </div>
  );
};






