import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchLeadSummary } from '@/services/leadsService';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  FileText,
  UserCheck,
  Target,
  ArrowRight,
  X,
  Archive
} from 'lucide-react';

interface LeadStage {
  id: string;
  name: string;
  count: number;
  icon: React.ComponentType<any>;
  color: string;
  subStages?: LeadStage[];
}

interface LeadSidebarProps {
  onStageSelect: (stage: string) => void;
  selectedStage: string;
  userRole: 'Admin' | 'Manager' | 'Agent';
  refreshKey?: number;
}

export const LeadSidebar: React.FC<LeadSidebarProps> = ({
  onStageSelect,
  selectedStage,
  userRole,
  refreshKey = 0
}) => {
  const { user } = useAuth();
const [expandedSections, setExpandedSections] = useState<string[]>(['new-leads']);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [claimedCount, setClaimedCount] = useState(0);
  const [claimedTodayCount, setClaimedTodayCount] = useState(0);
  const [closedAssignedCount, setClosedAssignedCount] = useState(0);
  const [teamProgressCount, setTeamProgressCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [highPriorityCount, setHighPriorityCount] = useState(0);
  const [instructedTodayCount, setInstructedTodayCount] = useState(0);
  const [callbackRequestsTodayCount, setCallbackRequestsTodayCount] = useState(0);
  const [instructionRequestsTodayCount, setInstructionRequestsTodayCount] = useState(0);
  const [quoteAcceptedCount, setQuoteAcceptedCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);

  // Fetch counts using optimized lightweight queries (much faster - only counts, no data)
  useEffect(() => {
    const loadCounts = async () => {
      try {
        // Don't fetch if user is not available yet (for agents)
        if (userRole === 'Agent' && !user?.id) {
          return;
        }

        // Use fetchLeadSummary for quick counts (uses server-side count queries - very fast!)
        const summary = await fetchLeadSummary(userRole, user?.id);

        // Set quick counts immediately (these load fast!)
        setTotalCount(summary.totalActive);
        setUnassignedCount(summary.unassignedActive);
        setClaimedCount(summary.claimedActive || 0);
        setClaimedTodayCount(summary.claimedToday || 0);
        setClosedAssignedCount(summary.closedAssigned || 0);
        setTeamProgressCount(summary.teamProgress || 0);
        setOverdueCount(summary.overdue);
        setHighPriorityCount(summary.highPriority);
        setInstructedTodayCount(summary.instructedToday);
        setCallbackRequestsTodayCount(summary.callbackRequestsToday || 0);
        setInstructionRequestsTodayCount(summary.instructionRequestsToday || 0);
        setQuoteAcceptedCount(summary.quoteAccepted || 0);

        const archivedCatCounts: Record<string, number> = {};
        if (userRole !== 'Agent') {
          const { supabase } = await import('@/lib/supabase');
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('is_funnel_archived', true);
          const archivedTotalLocal = count || 0;
          setArchivedCount(archivedTotalLocal);

          // Per-reason breakdown so the Archived sidebar entry can spread like the
          // stage list. funnel_archived_category may not exist until the migration
          // runs — those queries simply return 0 then.
          const archiveCats = ['fake', 'duplicate', 'wrong_number', 'test'];
          const catResults = await Promise.all(archiveCats.map(async (cat) => {
            const { count: c } = await supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .eq('is_funnel_archived', true)
              .eq('funnel_archived_category', cat);
            return { cat, count: c || 0 };
          }));
          let knownArchived = 0;
          catResults.forEach(({ cat, count: c }) => {
            archivedCatCounts[`archived-${cat}`] = c;
            knownArchived += c;
          });
          archivedCatCounts['archived-other'] = Math.max(0, archivedTotalLocal - knownArchived);
        } else {
          setArchivedCount(0);
        }

        // Now fetch stage counts using lightweight count queries (parallel for speed)
        const stages = [
          'New',
          'Call-1',
          'Call-2',
          'Call-3',
          'Call-4',
          'Call-5',
          'Interested',
          'Quote Accepted - Awaiting Payment',
          'Payment Completed - Awaiting Client Information',
          'Ready to Solicit',
          'Instructed',
          'Cancelled'
        ];

        // Milestone outcome codes to count
        // Note: Use the actual outcome code names as stored in database
        const milestoneCodes = [
          'Incorrect Number',
          'Fake/Duplicate Quote',
          'Getting prices', // Database stores "Getting prices", UI displays as "Just Getting prices"
          'Custom Reason',
          'Gone Elsewhere',
          'Not Interested',
          'Call Attempts Exceeded' // Special milestone for leads cancelled after Call-5
        ];

        // Fetch stage counts in parallel using lightweight count queries (no data, just counts)
        const { supabase } = await import('@/lib/supabase');
        const ACTIVE_STATUSES_EXCLUDE = '("Sold","Closed","Archived")';
        const stageCountPromises = stages.map(async (stage) => {
          try {
            let query = supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .not('is_funnel_archived', 'is', true);

            // Apply role-based filtering
            if (userRole === 'Agent' && user?.id) {
              query = query.eq('assigned_to', user.id);
            }

            // Apply stage filter
          if (stage === 'Instructed') {
              // For "Instructed" stage: don't exclude by status (instructed leads may have status "Sold" or "Closed")
              query = query.eq('stage', 'Instructed');
              // Instructed stage already has role filter above
          } else if (stage === 'Cancelled') {
              // For "Cancelled" stage: don't exclude by status (cancelled leads may have status "Closed")
              query = query.eq('stage', 'Cancelled');
              // Cancelled stage already has role filter above
          } else {
              // For other stages: exclude inactive statuses (Sold, Closed, Archived)
              query = query
                .eq('stage', stage)
                .not('status', 'in', ACTIVE_STATUSES_EXCLUDE);
            }

            const { count, error } = await query;
            if (error) {
              console.warn(`Error counting stage ${stage}:`, error);
              return { stage, count: 0 };
            }
            return { stage, count: count ?? 0 };
          } catch (err) {
            console.warn(`Error counting stage ${stage}:`, err);
            return { stage, count: 0 };
          }
        });

        // Fetch milestone outcome code counts (only if outcome_code column exists)
        // Note: outcome_code column must be added via migration: add_outcome_code_to_leads.sql
        // If column doesn't exist, all milestone counts will be 0
        const milestoneCountPromises = milestoneCodes.map(async (outcomeCode) => {
          try {
            // Build query step by step to avoid issues
            let query = supabase
              .from('leads')
              .select('id', { count: 'exact', head: true })
              .not('is_funnel_archived', 'is', true);

            // Special handling for "Incorrect Number" - include "Incorrect Number", "Wrong Number", and "Number Invalid"
            if (outcomeCode === 'Incorrect Number') {
              query = query.in('outcome_code', ['Incorrect Number', 'Wrong Number', 'Number Invalid']);
            } else if (outcomeCode === 'Getting prices') {
              // Special handling for "Getting prices" - include both "Getting prices" and "Just Getting prices"
              // (UI shows "Just Getting prices" but database may have either)
              query = query.in('outcome_code', ['Getting prices', 'Just Getting prices']);
            } else if (outcomeCode === 'Call attempts exceeded' || outcomeCode === 'Call Attempts Exceeded') {
              // Special handling for "Call Attempts Exceeded" - filter by custom_outcome_reason
              query = query.eq('custom_outcome_reason', 'Call Attempts Exceeded');
            } else {
              // Apply outcome code filter (will fail if column doesn't exist)
              query = query.eq('outcome_code', outcomeCode);
            }

            // All milestone outcome codes move to Cancelled stage
            // - "Incorrect Number" (includes "Wrong Number" and "Number Invalid"), "Fake/Duplicate Quote", "Custom Reason", "Getting prices", "Gone Elsewhere", "Not Interested" → Cancelled stage, Closed status
            query = query.eq('stage', 'Cancelled');
            // Include 'Closed' status for cancelled milestone leads
            // Only exclude 'Sold' and 'Archived' statuses (not 'Closed')
            query = query.not('status', 'in', '("Sold","Archived")');

            // Apply role-based filtering
            if (userRole === 'Agent' && user?.id) {
              query = query.eq('assigned_to', user.id);
            }

            const { count, error } = await query;
            if (error) {
              // Check if error is due to missing column
              if (error.message && error.message.includes('does not exist')) {
                // Column doesn't exist - return 0 and don't log error
                return { outcomeCode, count: 0 };
              }
              // Other errors - silently return 0
              return { outcomeCode, count: 0 };
            }
            return { outcomeCode, count: count ?? 0 };
          } catch (err: any) {
            // Silently handle any errors - milestone counts are optional
            return { outcomeCode, count: 0 };
          }
        });

        const [stageCountResults, milestoneCountResults] = await Promise.all([
          Promise.all(stageCountPromises),
          Promise.all(milestoneCountPromises)
        ]);

        const counts: Record<string, number> = { ...archivedCatCounts };
        stageCountResults.forEach(({ stage, count }) => {
          counts[stage] = count;
        });

        // Store milestone counts with milestone prefix for easy lookup
        const milestoneIdMap: { [key: string]: string } = {
          'Incorrect Number': 'milestone-incorrect-number',
          'Fake/Duplicate Quote': 'milestone-fake-lead',
          'Getting prices': 'milestone-getting-prices', // Database has "Getting prices", UI shows "Just Getting prices"
          'Custom Reason': 'milestone-custom-reason',
          'Gone Elsewhere': 'milestone-gone-elsewhere',
          'Not Interested': 'milestone-not-interested',
          'Call Attempts Exceeded': 'milestone-call-attempts-exceeded'
        };
        milestoneCountResults.forEach(({ outcomeCode, count }) => {
          const milestoneId = milestoneIdMap[outcomeCode] || `milestone-${outcomeCode.toLowerCase().replace(/\s+/g, '-')}`;
          counts[milestoneId] = count;
        });

        setStageCounts(counts);
      } catch (err) {
        console.error('Error loading counts for sidebar:', err);
      }
    };

    loadCounts();
  }, [userRole, user?.id, refreshKey]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getLeadStages = (): LeadStage[] => {
    if (userRole === 'Agent') {
      return [
        {
          id: 'my-assigned',
          name: 'My Active Leads',
          count: totalCount,
          icon: UserCheck,
          color: 'text-green-600',
          subStages: [
            { id: 'New', name: 'New - Not contacted', count: stageCounts['New'] || 0, icon: AlertCircle, color: 'text-red-600' },
            { id: 'Call-1', name: 'Call - 1', count: stageCounts['Call-1'] || 0, icon: Phone, color: 'text-orange-600' },
            { id: 'Call-2', name: 'Call - 2', count: stageCounts['Call-2'] || 0, icon: Phone, color: 'text-yellow-600' },
            { id: 'Call-3', name: 'Call - 3', count: stageCounts['Call-3'] || 0, icon: Phone, color: 'text-amber-600' },
            { id: 'Call-4', name: 'Call - 4', count: stageCounts['Call-4'] || 0, icon: Phone, color: 'text-orange-600' },
            { id: 'Call-5', name: 'Call - 5', count: stageCounts['Call-5'] || 0, icon: Phone, color: 'text-red-600' },
            { id: 'Interested', name: 'Interested - Call back scheduled', count: stageCounts['Interested'] || 0, icon: CheckCircle, color: 'text-green-600' },
            {
              id: 'Quote Accepted - Awaiting Payment',
              name: 'Quote Accepted - Awaiting Payment',
              count: stageCounts['Quote Accepted - Awaiting Payment'] || 0,
              icon: CreditCard,
              color: 'text-purple-600'
            },
            {
              id: 'Payment Completed - Awaiting Client Information',
              name: 'Payment Completed - Awaiting client information',
              count: stageCounts['Payment Completed - Awaiting Client Information'] || 0,
              icon: FileText,
              color: 'text-indigo-600'
            },
            { id: 'Ready to Solicit', name: 'Ready to solicit', count: stageCounts['Ready to Solicit'] || 0, icon: Target, color: 'text-blue-600' },
            { id: 'Instructed', name: 'Instructed', count: stageCounts['Instructed'] || 0, icon: CheckCircle, color: 'text-emerald-600' }
          ]
        }
      ];
    } else {
      // Admin/Manager view
      return [
        {
          id: 'all-leads',
          name: 'Lead Stages',
          count: totalCount,
          icon: Users,
          color: 'text-blue-600',
          subStages: [
            { id: 'New', name: 'New - Not contacted', count: stageCounts['New'] || 0, icon: AlertCircle, color: 'text-red-600' },
            { id: 'Call-1', name: 'Call - 1', count: stageCounts['Call-1'] || 0, icon: Phone, color: 'text-orange-600' },
            { id: 'Call-2', name: 'Call - 2', count: stageCounts['Call-2'] || 0, icon: Phone, color: 'text-yellow-600' },
            { id: 'Call-3', name: 'Call - 3', count: stageCounts['Call-3'] || 0, icon: Phone, color: 'text-amber-600' },
            { id: 'Call-4', name: 'Call - 4', count: stageCounts['Call-4'] || 0, icon: Phone, color: 'text-orange-600' },
            { id: 'Call-5', name: 'Call - 5', count: stageCounts['Call-5'] || 0, icon: Phone, color: 'text-red-600' },
            { id: 'Interested', name: 'Interested - Call back scheduled', count: stageCounts['Interested'] || 0, icon: CheckCircle, color: 'text-green-600' },
            {
              id: 'Quote Accepted - Awaiting Payment',
              name: 'Quote Accepted - Awaiting Payment',
              count: stageCounts['Quote Accepted - Awaiting Payment'] || 0,
              icon: CreditCard,
              color: 'text-purple-600'
            },
            {
              id: 'Payment Completed - Awaiting Client Information',
              name: 'Payment Completed - Awaiting client information',
              count: stageCounts['Payment Completed - Awaiting Client Information'] || 0,
              icon: FileText,
              color: 'text-indigo-600'
            },
            { id: 'Ready to Solicit', name: 'Ready to solicit', count: stageCounts['Ready to Solicit'] || 0, icon: Target, color: 'text-blue-600' },
            { id: 'Instructed', name: 'Instructed', count: stageCounts['Instructed'] || 0, icon: CheckCircle, color: 'text-emerald-600' }
          ]
        },
        {
          id: 'unassigned',
          name: 'Unassigned Leads',
          count: unassignedCount,
          icon: AlertCircle,
          color: 'text-red-600'
        },
        {
          id: 'cancelled',
          name: 'Cancelled Leads',
          count: stageCounts['Cancelled'] || 0,
          icon: AlertCircle,
          color: 'text-gray-600'
        },
        {
          id: 'archived',
          name: 'Archived Leads',
          count: archivedCount,
          icon: Archive,
          color: 'text-slate-600',
          subStages: [
            { id: 'archived:all', name: 'All archived', count: archivedCount, icon: Archive, color: 'text-slate-600' },
            { id: 'archived:fake', name: 'Fake', count: stageCounts['archived-fake'] || 0, icon: AlertCircle, color: 'text-red-600' },
            { id: 'archived:duplicate', name: 'Duplicate', count: stageCounts['archived-duplicate'] || 0, icon: Users, color: 'text-orange-600' },
            { id: 'archived:wrong_number', name: 'Wrong number', count: stageCounts['archived-wrong_number'] || 0, icon: Phone, color: 'text-amber-600' },
            { id: 'archived:test', name: 'Test', count: stageCounts['archived-test'] || 0, icon: FileText, color: 'text-gray-600' },
            { id: 'archived:other', name: 'Aged & other', count: stageCounts['archived-other'] || 0, icon: Clock, color: 'text-slate-500' }
          ]
        },
        {
          id: 'milestones',
          name: 'Milestones',
          count: (stageCounts['milestone-incorrect-number'] || 0) +
                 (stageCounts['milestone-fake-lead'] || 0) +
                 (stageCounts['milestone-getting-prices'] || 0) +
                 (stageCounts['milestone-custom-reason'] || 0) +
                 (stageCounts['milestone-gone-elsewhere'] || 0) +
                 (stageCounts['milestone-not-interested'] || 0) +
                 (stageCounts['milestone-call-attempts-exceeded'] || 0),
          icon: Target,
          color: 'text-blue-600',
          subStages: [
            { id: 'milestone-incorrect-number', name: 'Incorrect Number', count: stageCounts['milestone-incorrect-number'] || 0, icon: Phone, color: 'text-red-600' },
            { id: 'milestone-fake-lead', name: 'Fake/Duplicate Quote', count: stageCounts['milestone-fake-lead'] || 0, icon: AlertCircle, color: 'text-orange-600' },
            { id: 'milestone-getting-prices', name: 'Just Getting prices', count: stageCounts['milestone-getting-prices'] || 0, icon: Clock, color: 'text-blue-600' },
            { id: 'milestone-custom-reason', name: 'Custom reason', count: stageCounts['milestone-custom-reason'] || 0, icon: FileText, color: 'text-gray-600' },
            { id: 'milestone-gone-elsewhere', name: 'Gone Elsewhere', count: stageCounts['milestone-gone-elsewhere'] || 0, icon: ArrowRight, color: 'text-orange-600' },
            { id: 'milestone-not-interested', name: 'Not Interested', count: stageCounts['milestone-not-interested'] || 0, icon: X, color: 'text-red-600' },
            { id: 'milestone-call-attempts-exceeded', name: 'Call Attempts Exceeded', count: stageCounts['milestone-call-attempts-exceeded'] || 0, icon: Phone, color: 'text-red-600' }
          ]
        }
      ];
    }
  };

  const stages = getLeadStages();

  const renderStage = (stage: LeadStage, level: number = 0) => {
    const isExpanded = expandedSections.includes(stage.id);
    const isSelected = selectedStage === stage.id;
    const hasSubStages = stage.subStages && stage.subStages.length > 0;
    const IconComponent = stage.icon;

    return (
      <div key={stage.id} className="mb-1">
        <div
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
            isSelected
              ? 'bg-[#011E41]/10 text-[#011E41]'
              : 'hover:bg-[#6D52B0]/10 text-gray-700 hover:text-[#401DBA]'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (hasSubStages) {
              toggleSection(stage.id);
            } else {
              onStageSelect(stage.id);
            }
          }}
        >
          <div className="flex items-center space-x-2">
            <IconComponent className={`h-4 w-4 shrink-0 ${
              isSelected ? 'text-[#011E41]' : stage.color
            }`} />
            <span className="text-sm font-medium">{stage.name}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isSelected
                ? 'bg-[#6D52B0] text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {stage.count}
            </span>
            {hasSubStages && (
              isExpanded ?
                <ChevronDown className="h-4 w-4 text-gray-400" /> :
                <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        {hasSubStages && isExpanded && (
          <div className="ml-4">
            {stage.subStages!.map(subStage => renderStage(subStage, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Lead Pipeline</h2>
        <p className="text-sm text-gray-600">
          {userRole === 'Agent' ? 'Your lead workflow' : 'All lead stages'}
        </p>
      </div>

      <div className="p-4 space-y-2">
        {/* Show All Leads Option - Only for Admin/Manager */}
        {userRole !== 'Agent' && (
          <div
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
              selectedStage === 'all'
                ? 'bg-[#011E41]/10 text-[#011E41]'
                : 'hover:bg-[#6D52B0]/10 text-gray-700 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('all')}
          >
            <div className="flex items-center space-x-2">
              <Users className={`h-4 w-4 ${
                selectedStage === 'all' ? 'text-[#011E41]' : 'text-blue-600'
              }`} />
              <span className="text-sm font-medium">Show All Leads</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              selectedStage === 'all'
                ? 'bg-[#6D52B0] text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {totalCount}
            </span>
          </div>
        )}

        {stages.map(stage => renderStage(stage))}
      </div>

      {/* Agent working queues */}
      {userRole === 'Agent' && (
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'unassigned'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('unassigned')}
          >
            <Users className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'unassigned' ? 'text-[#011E41]' : 'text-yellow-500'
            }`} />
            Available Leads
            {unassignedCount > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                selectedStage === 'unassigned'
                  ? 'bg-[#6D52B0] text-white'
                  : 'bg-yellow-200 text-yellow-800'
              }`}>
                {unassignedCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'claimed' || selectedStage === 'my-assigned'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('claimed')}
          >
            <UserCheck className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'claimed' || selectedStage === 'my-assigned' ? 'text-[#011E41]' : 'text-blue-500'
            }`} />
            My Active Leads
            {claimedCount > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                selectedStage === 'claimed' || selectedStage === 'my-assigned'
                  ? 'bg-[#6D52B0] text-white'
                  : 'bg-blue-200 text-blue-800'
              }`}>
                {claimedCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'claimed-today'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('claimed-today')}
          >
            <Clock className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'claimed-today' ? 'text-[#011E41]' : 'text-green-500'
            }`} />
            Claimed Today
            {claimedTodayCount > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                selectedStage === 'claimed-today'
                  ? 'bg-[#6D52B0] text-white'
                  : 'bg-green-100 text-green-700'
              }`}>
                {claimedTodayCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'my-closed'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('my-closed')}
          >
            <CheckCircle className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'my-closed' ? 'text-[#011E41]' : 'text-purple-500'
            }`} />
            My Closed Leads
            {closedAssignedCount > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                selectedStage === 'my-closed'
                  ? 'bg-[#6D52B0] text-white'
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {closedAssignedCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'team-progress'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('team-progress')}
          >
            <Users className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'team-progress' ? 'text-[#011E41]' : 'text-slate-500'
            }`} />
            Team Progress
            {teamProgressCount > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                selectedStage === 'team-progress'
                  ? 'bg-[#6D52B0] text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {teamProgressCount}
              </span>
            )}
          </button>
          <p className="px-2 text-xs leading-snug text-gray-500">
            Read-only view of active leads being worked by the team.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'overdue'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('overdue')}
          >
            <Clock className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'overdue' ? 'text-[#011E41]' : 'text-red-500'
            }`} />
            {userRole === 'Agent' ? 'My Overdue Leads' : 'Overdue Leads'}
            {overdueCount > 0 && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  selectedStage === 'overdue'
                    ? 'bg-[#6D52B0] text-white'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {overdueCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'highPriority'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('highPriority')}
          >
            <AlertCircle className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'highPriority' ? 'text-[#011E41]' : 'text-orange-500'
            }`} />
            {userRole === 'Agent' ? 'My High Priority' : 'High Priority'}
            {highPriorityCount > 0 && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  selectedStage === 'highPriority'
                    ? 'bg-[#6D52B0] text-white'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {highPriorityCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'callback-requests'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('callback-requests')}
          >
            <Phone className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'callback-requests' ? 'text-[#011E41]' : 'text-amber-500'
            }`} />
            {userRole === 'Agent' ? 'My Callback Requests Today' : 'Callback Requests Today'}
            {callbackRequestsTodayCount > 0 && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  selectedStage === 'callback-requests'
                    ? 'bg-[#6D52B0] text-white'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {callbackRequestsTodayCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'instruction-requests'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('instruction-requests')}
          >
            <UserCheck className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'instruction-requests' ? 'text-[#011E41]' : 'text-indigo-500'
            }`} />
            {userRole === 'Agent' ? 'My Instruction Requests Today' : 'Instruction Requests Today'}
            {instructionRequestsTodayCount > 0 && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  selectedStage === 'instruction-requests'
                    ? 'bg-[#6D52B0] text-white'
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {instructionRequestsTodayCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'quote-accepted'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('quote-accepted')}
          >
            <FileText className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'quote-accepted' ? 'text-[#011E41]' : 'text-green-600'
            }`} />
            {userRole === 'Agent' ? 'My Quote Accepted from Email' : 'Quote Accepted from Email'}
            {quoteAcceptedCount > 0 && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  selectedStage === 'quote-accepted'
                    ? 'bg-[#6D52B0] text-white'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {quoteAcceptedCount}
              </span>
            )}
          </button>
          <button
            className={`w-full text-left p-2 text-sm rounded-lg transition-colors duration-200 ${
              selectedStage === 'instructedToday'
                ? 'bg-[#011E41]/10 text-[#011E41] font-medium'
                : 'text-gray-600 hover:bg-[#6D52B0]/10 hover:text-[#401DBA]'
            }`}
            onClick={() => onStageSelect('instructedToday')}
          >
            <CheckCircle className={`h-4 w-4 inline mr-2 ${
              selectedStage === 'instructedToday' ? 'text-[#011E41]' : 'text-green-500'
            }`} />
            {userRole === 'Agent' ? 'My Instructions Today' : 'Instructed Today'}
            {instructedTodayCount > 0 && (
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  selectedStage === 'instructedToday'
                    ? 'bg-[#6D52B0] text-white'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {instructedTodayCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
