import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Save, Plus, Edit, Trash2, Users, Settings as SettingsIcon, Bell, Shield, Target, TrendingUp, X, Mail, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, RefreshCw, Link, DollarSign, Calendar, Phone, Brain } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchUsers, createUser, createUserWithLink, sendMagicLink, updateUser, deleteUser, User } from '@/services/usersService';
import { sendOutlookEmail } from '@/services/outlookService';
import { FeeConfigTab } from '@/components/FeeConfigTab';
import {
  addAgentQuotaAllowance,
  AgentQuotaAdjustment,
  fetchAgentQuotaOverview,
  fetchAgentQuotaAdjustmentHistory,
  resetAgentQuotaUsage,
  QuotaAdjustmentScope
} from '@/services/quotaService';
import {
  fetchThreeCxExtensionMappings,
  fetchThreeCxCallSettings,
  fetchThreeCxStatus,
  runThreeCxCdrProcessor,
  updateThreeCxCallSettings,
  saveUserThreeCxExtension,
  sendThreeCxTestWebhook,
  ThreeCxStatus
} from '@/services/threecxService';

const DEFAULT_AGENT_DAILY_QUOTA = 99;
const DEFAULT_AGENT_WEEKLY_QUOTA = DEFAULT_AGENT_DAILY_QUOTA * 7;
const SAFE_APCM_AI_BATCH_SIZE = 40;

export const Settings: React.FC = () => {
  const { user: currentUser } = useAuth();
  const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const defaultTab = currentUser?.role === 'Agent' ? 'settings' : 'users';
  const initialTab = initialParams?.get('tab') || defaultTab;
  const initialOutlookResult = initialParams?.get('outlook') || null;
  const [activeTab, setActiveTab] = useState(initialTab);
  // User profile state (for Agents and Admin/Manager)
  const [userProfile, setUserProfile] = useState({
    name: currentUser?.name || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pendingOutlookResult, setPendingOutlookResult] = useState<string | null>(initialOutlookResult);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditQuota, setShowEditQuota] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [quotaData, setQuotaData] = useState({
    dailyQuota: 0,
    weeklyQuota: 0,
    monthlyQuota: 0,
    priorityLeads: 0,
    maxConcurrent: 0
  });
  const [showGlobalQuotaModal, setShowGlobalQuotaModal] = useState(false);
  const [globalQuotaData, setGlobalQuotaData] = useState({
    dailyQuota: 0,
    weeklyQuota: 0,
    monthlyQuota: 0,
    priorityLeads: 0,
    maxConcurrent: 0
  });
  const [showQuotaResetModal, setShowQuotaResetModal] = useState(false);
  const [showQuotaAllowanceModal, setShowQuotaAllowanceModal] = useState(false);
  const [showQuotaHistoryModal, setShowQuotaHistoryModal] = useState(false);
  const [quotaResetData, setQuotaResetData] = useState({
    scope: 'both' as 'daily' | 'weekly' | 'both',
    reason: ''
  });
  const [quotaAllowanceData, setQuotaAllowanceData] = useState({
    scope: 'daily' as QuotaAdjustmentScope,
    amount: 1,
    reason: ''
  });
  const [quotaHistory, setQuotaHistory] = useState<AgentQuotaAdjustment[]>([]);
  const [isLoadingQuotaHistory, setIsLoadingQuotaHistory] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Agent' as 'Admin' | 'Manager' | 'Agent',
    createMethod: 'password' as 'password' | 'invite',
    dailyQuota: DEFAULT_AGENT_DAILY_QUOTA,
    weeklyQuota: DEFAULT_AGENT_WEEKLY_QUOTA,
    threeCxExtension: ''
  });
  const [newUserEmail, setNewUserEmail] = useState({
    sendEmail: false,
    subject: 'Your CRM Account Has Been Created',
    content: ''
  });
  const [editUserData, setEditUserData] = useState({
    name: '',
    email: '',
    role: 'Agent' as 'Admin' | 'Manager' | 'Agent',
    status: 'Active' as 'Active' | 'Inactive',
    newPassword: '',
    sendPasswordEmail: false,
    threeCxExtension: ''
  });
  const [editUserEmail, setEditUserEmail] = useState({
    sendEmail: false,
    subject: 'Your CRM Account Has Been Updated',
    content: ''
  });
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agentQuotas, setAgentQuotas] = useState<any[]>([]);
  const [quotaFilter, setQuotaFilter] = useState<'all' | 'at-limit' | 'adjusted' | 'over-weekly'>('all');
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(false);
  const [quotaLoadError, setQuotaLoadError] = useState('');
  const [isLoadingOutlook, setIsLoadingOutlook] = useState(false);
  const [threeCxExtensionByUserId, setThreeCxExtensionByUserId] = useState<Record<string, string>>({});
  const [outlookIntegration, setOutlookIntegration] = useState<{
    connected: boolean;
    email?: string;
    lastSynced?: string | null;
  }>({
    connected: false,
    email: undefined,
    lastSynced: null
  });
  const [threeCxStatus, setThreeCxStatus] = useState<ThreeCxStatus | null>(null);
  const [isLoadingThreeCxStatus, setIsLoadingThreeCxStatus] = useState(false);
  const [threeCxError, setThreeCxError] = useState('');
  const [threeCxWebhookSecret, setThreeCxWebhookSecret] = useState('');
  const [isTestingThreeCxWebhook, setIsTestingThreeCxWebhook] = useState(false);
  const [isProcessingThreeCxCdr, setIsProcessingThreeCxCdr] = useState(false);
  const [isReprocessingThreeCxCdr, setIsReprocessingThreeCxCdr] = useState(false);
  const [isRefreshingThreeCxTranscripts, setIsRefreshingThreeCxTranscripts] = useState(false);
  const [isAnalyzingPendingCalls, setIsAnalyzingPendingCalls] = useState(false);
  const [isSavingThreeCxSettings, setIsSavingThreeCxSettings] = useState(false);
  const [threeCxAutoAnalyzeEnabled, setThreeCxAutoAnalyzeEnabled] = useState(true);
  const [threeCxAutoAnalyzeLimit, setThreeCxAutoAnalyzeLimit] = useState(300);
  const [threeCxAutoAnalyzeMinDuration, setThreeCxAutoAnalyzeMinDuration] = useState(20);
  const canManageOutlook = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    if (pendingOutlookResult) {
      params.set('outlook', pendingOutlookResult);
    } else {
      params.delete('outlook');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [activeTab, pendingOutlookResult]);

  useEffect(() => {
    if (!pendingOutlookResult || !currentUser?.id) return;

    if (pendingOutlookResult === 'connected') {
      setShowNotification(true);
      setNotificationType('success');
      setNotificationMessage('Outlook account connected successfully.');
      fetchOutlookStatus();
    } else if (pendingOutlookResult === 'error') {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Unable to connect Outlook. Please try again.');
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.delete('outlook');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    setPendingOutlookResult(null);
  }, [pendingOutlookResult, currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'notifications' && currentUser?.id) {
      fetchOutlookStatus();
    }
  }, [activeTab, currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'threecx' && currentUser?.id && currentUser?.role !== 'Agent') {
      loadThreeCxStatus();
    }
  }, [activeTab, currentUser?.id, currentUser?.role]);

  // Auto-refresh Outlook status every 1 minute when on notifications tab
  // This ensures tokens are refreshed proactively before they expire
  useEffect(() => {
    if (activeTab !== 'notifications' || !currentUser?.id) {
      return;
    }

    // Initial fetch
    fetchOutlookStatus(false); // Don't show loader for auto-refresh

    // Set up interval to poll every 2 min, only when tab visible (reduces Supabase load)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchOutlookStatus(false);
    }, 120000);

    return () => {
      clearInterval(interval);
    };
  }, [activeTab, currentUser?.id]);

  const fetchOutlookStatus = async (displayLoader = true) => {
    if (displayLoader) {
      setIsLoadingOutlook(true);
    }
    try {
      const response = await fetch(`/api/outlook/status`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Outlook status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.connected) {
        setOutlookIntegration({
          connected: true,
          email: data.email,
          lastSynced: data.lastSynced || null
        });
      } else {
        setOutlookIntegration({
          connected: false,
          email: undefined,
          lastSynced: null
        });
      }
    } catch (error) {
      console.error(error);
      setOutlookIntegration({
        connected: false,
        email: undefined,
        lastSynced: null
      });
    } finally {
      if (displayLoader) {
        setIsLoadingOutlook(false);
      }
    }
  };

  const formatThreeCxDate = (value?: string) => {
    if (!value) return 'Not received yet';
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadThreeCxStatus = async () => {
    setIsLoadingThreeCxStatus(true);
    setThreeCxError('');
    try {
      const [status, settings] = await Promise.all([
        fetchThreeCxStatus(),
        fetchThreeCxCallSettings(),
      ]);
      setThreeCxStatus(status);
      setThreeCxAutoAnalyzeEnabled(settings.autoAnalyzeEnabled);
      setThreeCxAutoAnalyzeLimit(settings.autoAnalyzeLimit);
      setThreeCxAutoAnalyzeMinDuration(settings.autoAnalyzeMinDurationSeconds);
    } catch (error: any) {
      console.error('Error loading 3CX status:', error);
      setThreeCxError(error?.message || 'Unable to load call intelligence status. Please try again.');
      setThreeCxStatus(null);
    } finally {
      setIsLoadingThreeCxStatus(false);
    }
  };

  const formatThreeCxProcessingMessage = (label: string, result: Awaited<ReturnType<typeof runThreeCxCdrProcessor>>) => {
    const ai = result.autoAnalysis;
    const aiMessage = ai?.enabled
      ? ` APCM AI: ${ai.processed || 0} analysed, ${ai.failed || 0} failed, ${ai.skipped || 0} skipped.`
      : ' APCM AI: skipped because automatic analysis is off.';

    return `${label}: ${result.processed} processed, ${result.unmatched} unmatched, ${result.failed} failed.${aiMessage}`;
  };

  const saveThreeCxAutoAnalysisSettings = async (nextEnabled: boolean, nextLimit: number, nextMinDuration = threeCxAutoAnalyzeMinDuration) => {
    const sanitizedLimit = Math.min(Math.max(Number.isFinite(nextLimit) ? nextLimit : 300, 1), 300);
    const sanitizedMinDuration = Math.min(Math.max(Number.isFinite(nextMinDuration) ? nextMinDuration : 20, 0), 600);
    setThreeCxAutoAnalyzeEnabled(nextEnabled);
    setThreeCxAutoAnalyzeLimit(sanitizedLimit);
    setThreeCxAutoAnalyzeMinDuration(sanitizedMinDuration);
    setIsSavingThreeCxSettings(true);

    try {
      await updateThreeCxCallSettings({
        autoAnalyzeEnabled: nextEnabled,
        autoAnalyzeLimit: sanitizedLimit,
        autoAnalyzeMinDurationSeconds: sanitizedMinDuration,
        updatedBy: currentUser?.id,
        updatedByName: currentUser?.name,
      });
    } catch (error: any) {
      console.error('Unable to save 3CX auto-analysis settings:', error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage(error?.message || 'Unable to save call analysis settings.');
      await loadThreeCxStatus();
    } finally {
      setIsSavingThreeCxSettings(false);
    }
  };

  const handleThreeCxTestWebhook = async () => {
    if (!threeCxWebhookSecret.trim()) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Enter the private test passcode first.');
      return;
    }

    setIsTestingThreeCxWebhook(true);
    try {
      await sendThreeCxTestWebhook(threeCxWebhookSecret.trim());
      setShowNotification(true);
      setNotificationType('success');
      setNotificationMessage('Live call signal test received successfully.');
      await loadThreeCxStatus();
    } catch (error: any) {
      console.error('3CX webhook test failed:', error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage(error?.message || 'Live call signal test failed.');
    } finally {
      setIsTestingThreeCxWebhook(false);
    }
  };

  const handleThreeCxProcessCdr = async () => {
    setIsProcessingThreeCxCdr(true);
    try {
      const result = await runThreeCxCdrProcessor({
        limit: 100,
        autoAnalyze: threeCxAutoAnalyzeEnabled,
        autoAnalyzeLimit: threeCxAutoAnalyzeLimit,
      });
      setShowNotification(true);
      setNotificationType(result.failed > 0 ? 'error' : 'success');
      setNotificationMessage(formatThreeCxProcessingMessage('Call processing complete', result));
      await loadThreeCxStatus();
    } catch (error: any) {
      console.error('3CX CDR processing failed:', error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage(error?.message || 'Call processing failed.');
    } finally {
      setIsProcessingThreeCxCdr(false);
    }
  };

  const handleThreeCxReprocessCdr = async () => {
    setIsReprocessingThreeCxCdr(true);
    try {
      const result = await runThreeCxCdrProcessor({
        limit: 250,
        reprocess: true,
        autoAnalyze: threeCxAutoAnalyzeEnabled,
        autoAnalyzeLimit: threeCxAutoAnalyzeLimit,
      });
      setShowNotification(true);
      setNotificationType(result.failed > 0 ? 'error' : 'success');
      setNotificationMessage(formatThreeCxProcessingMessage('Recent call refresh complete', result));
      await loadThreeCxStatus();
    } catch (error: any) {
      console.error('3CX CDR reprocessing failed:', error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage(error?.message || 'Recent call refresh failed.');
    } finally {
      setIsReprocessingThreeCxCdr(false);
    }
  };

  const handleThreeCxRefreshTranscripts = async () => {
    setIsRefreshingThreeCxTranscripts(true);
    try {
      const result = await runThreeCxCdrProcessor({
        limit: 250,
        reprocess: true,
        source: 'recordings',
        autoAnalyze: false,
      });
      let analysisResult: Awaited<ReturnType<typeof runThreeCxCdrProcessor>> | null = null;

      if (threeCxAutoAnalyzeEnabled) {
        const safeBatchLimit = Math.min(SAFE_APCM_AI_BATCH_SIZE, Math.max(1, threeCxAutoAnalyzeLimit));
        analysisResult = await runThreeCxCdrProcessor({
          limit: safeBatchLimit,
          analysisOnly: true,
          autoAnalyze: true,
          forceAutoAnalyze: true,
          autoAnalyzeLimit: safeBatchLimit,
        });
      }

      setShowNotification(true);
      setNotificationType(result.failed > 0 || (analysisResult?.autoAnalysis?.failed || 0) > 0 ? 'error' : 'success');
      const transcriptMessage = `Transcript refresh complete: ${result.processed} processed, ${result.unmatched} unmatched, ${result.failed} failed.`;
      const analysisMessage = analysisResult
        ? ` ${formatThreeCxProcessingMessage('APCM AI batch complete', analysisResult)}`
        : ' APCM AI: skipped because automatic analysis is off.';
      setNotificationMessage(`${transcriptMessage}${analysisMessage}`);
      await loadThreeCxStatus();
    } catch (error: any) {
      console.error('3CX transcript refresh failed:', error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage(error?.message || 'Transcript refresh failed.');
    } finally {
      setIsRefreshingThreeCxTranscripts(false);
    }
  };

  const handleThreeCxAnalyzePending = async () => {
    const pendingCount = threeCxStatus?.aiBacklog ?? 0;
    const safeBatchLimit = Math.min(SAFE_APCM_AI_BATCH_SIZE, Math.max(1, threeCxAutoAnalyzeLimit));
    const confirmed = window.confirm(
      `Analyse the next ${safeBatchLimit} pending transcript-ready call(s)?\n\nCurrent AI backlog: ${pendingCount.toLocaleString('en-GB')} call(s). Already analysed calls will be skipped. Larger backlogs are processed in safe batches to avoid timeout.`
    );
    if (!confirmed) return;

    setIsAnalyzingPendingCalls(true);
    try {
      const result = await runThreeCxCdrProcessor({
        limit: safeBatchLimit,
        analysisOnly: true,
        autoAnalyze: true,
        forceAutoAnalyze: true,
        autoAnalyzeLimit: safeBatchLimit,
      });
      setShowNotification(true);
      setNotificationType(result.autoAnalysis?.failed ? 'error' : 'success');
      setNotificationMessage(formatThreeCxProcessingMessage('Pending APCM AI analysis complete', result));
      await loadThreeCxStatus();
    } catch (error: any) {
      console.error('3CX pending AI analysis failed:', error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage(error?.message || 'Pending APCM AI analysis failed.');
    } finally {
      setIsAnalyzingPendingCalls(false);
    }
  };

  const handleConnectOutlook = () => {
    if (!currentUser?.id) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('No authenticated user found. Please sign in again.');
      return;
    }

    if (!canManageOutlook) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Only administrators can manage the Outlook connection.');
      return;
    }

    window.location.href = `/api/outlook/connect?userId=${encodeURIComponent(currentUser.id)}`;
  };

  const handleResetOutlook = async () => {
    if (!canManageOutlook) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Only administrators can manage the Outlook connection.');
      return;
    }

    if (!outlookIntegration.connected) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('No Outlook connection to reset.');
      return;
    }

    const confirmed = confirm('Reset Outlook credentials and require re-authentication?');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/outlook/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to reset Outlook connection');
      }

      setShowNotification(true);
      setNotificationType('success');
      setNotificationMessage('Outlook connection reset. Please reconnect to continue sending emails.');
    } catch (error) {
      console.error(error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Failed to reset Outlook connection. Please try again.');
    } finally {
      await fetchOutlookStatus();
    }
  };

  const handleDisconnectOutlook = async () => {
    if (!canManageOutlook) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Only administrators can manage the Outlook connection.');
      return;
    }

    if (!outlookIntegration.connected) {
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('No Outlook connection to disconnect.');
      return;
    }

    const confirmed = confirm('Disconnect the current Outlook account from the CRM?');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/outlook/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to disconnect Outlook account');
      }

      setShowNotification(true);
      setNotificationType('success');
      setNotificationMessage(`Outlook account ${outlookIntegration.email || ''} disconnected.`);
    } catch (error) {
      console.error(error);
      setShowNotification(true);
      setNotificationType('error');
      setNotificationMessage('Failed to disconnect Outlook account. Please try again.');
    } finally {
      await fetchOutlookStatus();
    }
  };

  // Different tabs for Admin/Manager vs Agent
  const adminTabs = [
    { id: 'users', name: 'Users', icon: Users },
    { id: 'quotas', name: 'Lead Quotas', icon: Target },
    { id: 'fee-config', name: 'Quote / Fee configuration', icon: DollarSign },
    { id: 'threecx', name: '3CX / Call Intelligence', icon: Phone },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
  ];

  const agentTabs = [
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
    { id: 'security', name: 'Security', icon: Shield },
  ];

  const tabs = currentUser?.role === 'Agent' ? agentTabs : adminTabs;

  const getStatusColor = (status: string) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-purple-100 text-purple-800';
      case 'Manager': return 'bg-blue-100 text-blue-800';
      case 'Agent': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditQuota = (agent: any) => {
    setSelectedAgent(agent);
    setQuotaData({
      dailyQuota: agent.dailyQuota,
      weeklyQuota: agent.weeklyQuota,
      monthlyQuota: agent.monthlyQuota,
      priorityLeads: agent.priorityLeads,
      maxConcurrent: agent.maxConcurrent
    });
    setShowEditQuota(true);
  };

  const handleSaveQuota = async () => {
    if (!selectedAgent) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          daily_quota: quotaData.dailyQuota,
          weekly_quota: quotaData.weeklyQuota,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAgent.id);

      if (error) {
        console.error('Error saving quota:', error);
        showNotificationMessage('Failed to save quota. Please try again.', 'error');
      } else {
        showNotificationMessage('Quota saved successfully!', 'success');
        setShowEditQuota(false);
        setSelectedAgent(null);
        await loadQuotas(); // Reload quota data
      }
    } catch (err: any) {
      console.error('Error saving quota:', err);
      showNotificationMessage(err.message || 'Failed to save quota. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openQuotaResetModal = (agent: any) => {
    setSelectedAgent(agent);
    setQuotaResetData({ scope: 'both', reason: '' });
    setShowQuotaResetModal(true);
  };

  const openQuotaAllowanceModal = (agent: any) => {
    setSelectedAgent(agent);
    setQuotaAllowanceData({ scope: 'daily', amount: 1, reason: '' });
    setShowQuotaAllowanceModal(true);
  };

  const openQuotaHistoryModal = async (agent: any) => {
    setSelectedAgent(agent);
    setShowQuotaHistoryModal(true);
    setIsLoadingQuotaHistory(true);
    try {
      const history = await fetchAgentQuotaAdjustmentHistory(agent.id);
      setQuotaHistory(history);
    } catch (err) {
      console.error('Error loading quota adjustment history:', err);
      showNotificationMessage('Failed to load quota history. Please try again.', 'error');
      setQuotaHistory([]);
    } finally {
      setIsLoadingQuotaHistory(false);
    }
  };

  const handleResetQuotaUsage = async () => {
    if (!selectedAgent) return;
    const reason = quotaResetData.reason.trim();
    if (!reason) {
      showNotificationMessage('Please enter a reason for the quota reset.', 'error');
      return;
    }

    const scopes: QuotaAdjustmentScope[] =
      quotaResetData.scope === 'both' ? ['daily', 'weekly'] : [quotaResetData.scope];

    setIsSaving(true);
    try {
      await resetAgentQuotaUsage({
        agentId: selectedAgent.id,
        scopes,
        reason,
        actorId: currentUser?.id,
        actorName: currentUser?.name || 'Unknown user'
      });
      showNotificationMessage(`Quota usage reset for ${selectedAgent.name}.`, 'success');
      setShowQuotaResetModal(false);
      setQuotaResetData({ scope: 'both', reason: '' });
      await loadQuotas();
    } catch (err: any) {
      console.error('Error resetting quota usage:', err);
      showNotificationMessage(err.message || 'Failed to reset quota usage. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddQuotaAllowance = async () => {
    if (!selectedAgent) return;
    const reason = quotaAllowanceData.reason.trim();
    if (!reason) {
      showNotificationMessage('Please enter a reason for the allowance.', 'error');
      return;
    }
    if (quotaAllowanceData.amount <= 0) {
      showNotificationMessage('Allowance must be at least 1 lead.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await addAgentQuotaAllowance({
        agentId: selectedAgent.id,
        scope: quotaAllowanceData.scope,
        amount: quotaAllowanceData.amount,
        reason,
        actorId: currentUser?.id,
        actorName: currentUser?.name || 'Unknown user'
      });
      showNotificationMessage(`Allowance added for ${selectedAgent.name}.`, 'success');
      setShowQuotaAllowanceModal(false);
      setQuotaAllowanceData({ scope: 'daily', amount: 1, reason: '' });
      await loadQuotas();
    } catch (err: any) {
      console.error('Error adding quota allowance:', err);
      showNotificationMessage(err.message || 'Failed to add quota allowance. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Load users on mount and when tab changes (only for Admin/Manager)
  useEffect(() => {
    if (currentUser?.role !== 'Agent') {
      if (activeTab === 'users') {
        loadUsers();
      } else if (activeTab === 'quotas') {
        loadQuotas();
      }
    }
  }, [activeTab, currentUser?.role]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const [fetchedUsers, extensionMappings] = await Promise.all([
        fetchUsers(),
        fetchThreeCxExtensionMappings()
      ]);
      const extensionMap = extensionMappings.reduce<Record<string, string>>((acc, mapping) => {
        if (mapping.userId) acc[mapping.userId] = mapping.extension;
        return acc;
      }, {});
      setUsers(fetchedUsers);
      setThreeCxExtensionByUserId(extensionMap);
    } catch (err) {
      console.error('Error loading users:', err);
      showNotificationMessage('Failed to load users', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadQuotas = async () => {
    setIsLoadingQuotas(true);
    setQuotaLoadError('');
    try {
      const quotaOverview = await fetchAgentQuotaOverview();
      const quotasWithStats = quotaOverview.map(agent => {
        const dailyQuota = agent.dailyQuota ?? 999;
        const weeklyQuota = agent.weeklyQuota ?? dailyQuota * 7;
        const dailyEffectiveQuota = agent.dailyEffectiveQuota ?? dailyQuota;
        const weeklyEffectiveQuota = agent.weeklyEffectiveQuota ?? weeklyQuota;
        const monthlyQuota = dailyQuota * 30; // Display-only fallback; monthly enforcement is not implemented yet.
        const todayAssigned = agent.assignedTodayEffective || 0;
        const weeklyAssigned = agent.assignedWeekEffective || 0;
        const monthlyAssigned = todayAssigned;
        
        const dailyPerformance = dailyEffectiveQuota > 0 ? Math.min(100, (todayAssigned / dailyEffectiveQuota) * 100) : 0;

        return {
          id: agent.agentId,
          name: agent.agentName,
          email: agent.agentEmail,
          dailyQuota: dailyQuota,
          weeklyQuota: weeklyQuota,
          dailyEffectiveQuota,
          weeklyEffectiveQuota,
          rawAssignedToday: agent.assignedTodayRaw,
          rawAssignedThisWeek: agent.assignedWeekRaw,
          dailyUsageAdjustment: agent.dailyAdjustmentTotal,
          weeklyUsageAdjustment: agent.weeklyAdjustmentTotal,
          dailyAllowanceBonus: agent.dailyAllowanceBonus,
          weeklyAllowanceBonus: agent.weeklyAllowanceBonus,
          hasAdjustments: agent.dailyAdjustmentTotal !== 0 ||
            agent.weeklyAdjustmentTotal !== 0 ||
            agent.dailyAllowanceBonus !== 0 ||
            agent.weeklyAllowanceBonus !== 0,
          monthlyQuota: monthlyQuota,
          priorityLeads: 0, // Not stored in DB yet
          maxConcurrent: 999, // Not stored in DB yet
          currentLeads: agent.activeLeadsCount,
          todayAssigned: todayAssigned,
          weeklyAssigned: weeklyAssigned,
          monthlyAssigned: monthlyAssigned,
          remaining: agent.remainingToday,
          weeklyRemaining: agent.remainingWeek,
          weeklyQuotaReached: agent.quotaReachedWeek,
          quotaReached: agent.quotaReachedToday,
          resetTimezone: agent.timezoneUsed || 'Europe/London',
          rangeStart: agent.dayStart,
          rangeEnd: agent.dayEnd,
          weekRangeStart: agent.weekStart,
          weekRangeEnd: agent.weekEnd,
          performance: Math.round(dailyPerformance)
        };
      });

      setAgentQuotas(quotasWithStats);
    } catch (err) {
      console.error('Error loading quotas:', err);
      const message = err instanceof Error ? err.message : 'Failed to load quota data';
      setQuotaLoadError(message);
      setAgentQuotas([]);
      showNotificationMessage('Failed to load quota data. Please try again.', 'error');
    } finally {
      setIsLoadingQuotas(false);
    }
  };

  const showNotificationMessage = (message: string, type: 'success' | 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Generate random password
  const generateRandomPassword = (): string => {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;
    
    let password = '';
    // Ensure at least one character from each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Default email content template
  const getDefaultEmailContent = (userName: string, email: string, password: string, isNewUser: boolean = true, magicLink?: string | null): string => {
    if (isNewUser) {
      const verificationSection = magicLink 
        ? `\n\nIMPORTANT: Please verify your account before logging in.\n\nFind a verification link below to verify your account before logging in:\n${magicLink}\n\nThis verification link will activate your account and allow you to log in. Once you click the link and verify your email, you can then use the login details below to access your account.`
        : '';
      
      return `Dear ${userName},

Your CRM account has been created successfully.

Login Details:
Email: ${email}
Password: ${password}${verificationSection}

After verifying your account using the link below, you can log in and change your password from your settings tab.

Best regards,
Millennium Legal CRM Team`;
    } else {
      return `Dear ${userName},

Your CRM account password has been updated.

Login Details:
Email: ${email}
New Password: ${password}

Please log in and change your password from your settings tab after your next login.

Best regards,
Millennium Legal CRM Team`;
    }
  };

  const handleAddUser = () => {
    const randomPassword = generateRandomPassword();
    setNewUser({
      name: '',
      email: '',
      password: randomPassword,
      role: 'Agent',
      createMethod: 'password',
      dailyQuota: 99,
      weeklyQuota: 99 * 7,
      threeCxExtension: ''
    });
    // Auto-select send email by default
    setNewUserEmail({
      sendEmail: true,
      subject: 'Your CRM Account Has Been Created',
      content: getDefaultEmailContent('User', '', randomPassword, true)
    });
    setShowPassword(false);
    setShowAddUser(true);
  };

  const handleRandomizePassword = () => {
    const randomPassword = generateRandomPassword();
    setNewUser({ ...newUser, password: randomPassword });
    // Update email content if sendEmail is checked
    if (newUserEmail.sendEmail) {
      setNewUserEmail({
        ...newUserEmail,
        content: getDefaultEmailContent(newUser.name || 'User', newUser.email || '', randomPassword, true)
      });
    }
  };

  const handleSaveNewUser = async () => {
    if (!newUser.name || !newUser.email) {
      showNotificationMessage('Please fill in name and email', 'error');
      return;
    }

    if (!newUser.password) {
      showNotificationMessage('Please enter a password', 'error');
      return;
    }

    if (newUserEmail.sendEmail && (!newUserEmail.subject || !newUserEmail.content)) {
      showNotificationMessage('Please fill in email subject and content', 'error');
      return;
    }

    setIsSaving(true);
    try {
      let savedUser: User | null = null;
      // If sending email, use createUserWithLink (prevents Supabase from sending email)
      // Otherwise, use regular createUser
      if (newUserEmail.sendEmail) {
        const { user, error, magicLink } = await createUserWithLink({
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        dailyQuota: newUser.role === 'Agent' ? newUser.dailyQuota : undefined,
        weeklyQuota: newUser.role === 'Agent' ? newUser.weeklyQuota : undefined
      });

      if (error) {
        showNotificationMessage(error, 'error');
        return;
        } else if (user) {
          savedUser = user;
          if (newUser.role === 'Agent') {
            const { error: quotaUpdateError } = await supabase
              .from('users')
              .update({
                daily_quota: newUser.dailyQuota,
                weekly_quota: newUser.weeklyQuota ?? (newUser.dailyQuota ?? 99) * 7,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);

            if (quotaUpdateError) {
              throw quotaUpdateError;
            }
          }

          try {
            // Get email content - use default if not provided, or use custom content
            let emailContent = newUserEmail.content || getDefaultEmailContent(newUser.name, newUser.email, newUser.password, true, magicLink || null);
            
            // If custom content is used but magic link exists, append verification section
            if (newUserEmail.content && magicLink) {
              // Check if magic link is already in the content
              if (!emailContent.includes(magicLink)) {
                emailContent += `\n\nTo verify your email and activate your account, please click the link below:\n${magicLink}\n\nThis link will verify your email address and allow you to set up your account.`;
              }
            }
            
            // Convert to HTML with clickable link
            const htmlContent = emailContent
              .replace(/\n/g, '<br>')
              .replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" style="color: #011E41; text-decoration: underline;">$1</a>'
              );
            
            if (import.meta.env.DEV) {
              console.log('Sending email with magic link:', magicLink ? 'Yes' : 'No');
            }
            
            await sendOutlookEmail({
              to: newUser.email,
              subject: newUserEmail.subject,
              textBody: emailContent,
              htmlBody: htmlContent,
              saveToSentItems: true
            });
            showNotificationMessage('User created and login email sent successfully!', 'success');
          } catch (emailError: any) {
            console.error('Error sending email:', emailError);
            showNotificationMessage('User created successfully, but failed to send email. Please send login details manually.', 'error');
          }
        }
      } else {
        // Not sending email, use regular createUser
        const { user, error } = await createUser({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          dailyQuota: newUser.role === 'Agent' ? newUser.dailyQuota : undefined,
          weeklyQuota: newUser.role === 'Agent' ? newUser.weeklyQuota : undefined
        });

        if (error) {
          showNotificationMessage(error, 'error');
          return;
        } else {
          savedUser = user || null;
          showNotificationMessage('User created successfully!', 'success');
        }
        }

      if (savedUser) {
        await saveUserThreeCxExtension(savedUser.id, newUser.name, newUser.threeCxExtension);
      }
        
      // Cleanup and refresh
        setShowAddUser(false);
        setNewUser({
          name: '',
          email: '',
          password: '',
        role: 'Agent' as 'Admin' | 'Manager' | 'Agent',
        createMethod: 'password' as 'password' | 'invite',
          dailyQuota: 99,
          weeklyQuota: 99 * 7,
          threeCxExtension: ''
        });
        setNewUserEmail({
          sendEmail: false,
          subject: 'Your CRM Account Has Been Created',
          content: ''
        });
        await loadUsers();
    } catch (err: any) {
      console.error('Error saving user:', err);
      showNotificationMessage(err.message || 'Failed to save user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      newPassword: '',
      sendPasswordEmail: false,
      threeCxExtension: threeCxExtensionByUserId[user.id] || ''
    });
    setShowEditUser(true);
  };

  const handleSaveEditUser = async () => {
    if (!selectedUser || !editUserData.name || !editUserData.email) {
      showNotificationMessage('Please fill in all required fields', 'error');
      return;
    }

    // Validate password if provided
    if (editUserData.newPassword && editUserData.newPassword.length < 6) {
      showNotificationMessage('Password must be at least 6 characters long', 'error');
      return;
    }

    // Validate email if sending
    if (editUserEmail.sendEmail && (!editUserEmail.subject || !editUserEmail.content)) {
      showNotificationMessage('Please fill in email subject and content', 'error');
      return;
    }

    // Warn if email is being changed
    const emailChanged = selectedUser.email !== editUserData.email;
    if (emailChanged) {
      const confirmed = window.confirm(
        `You are changing the email from "${selectedUser.email}" to "${editUserData.email}".\n\n` +
        `The user will need to use the new email "${editUserData.email}" to log in.\n\n` +
        `Do you want to continue?`
      );
      if (!confirmed) {
        return;
      }
    }

    setIsSaving(true);
    try {
      // Update user data
      const { error } = await updateUser(selectedUser.id, {
        name: editUserData.name,
        email: editUserData.email,
        role: editUserData.role,
        status: editUserData.status
      });

      if (error) {
        showNotificationMessage(error, 'error');
        return;
      }

      await saveUserThreeCxExtension(selectedUser.id, editUserData.name, editUserData.threeCxExtension);

      // Change password if provided
      if (editUserData.newPassword && editUserData.newPassword.trim()) {
        try {
          // Use Supabase Edge Function for password change
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          
          if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
          }
          
          const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/change-password`;
          
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              userId: selectedUser.id,
              newPassword: editUserData.newPassword
              // Note: No currentPassword for admin password changes
            })
          });

          if (!response.ok) {
            let errorMessage = 'Failed to change password';
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
              } else {
                const errorText = await response.text();
                if (errorText.trim().startsWith('<!')) {
                  throw new Error(`API route not found. The change-password endpoint may not be deployed yet. Status: ${response.status}`);
                }
                errorMessage = errorText || `Server error: ${response.status} ${response.statusText}`;
              }
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message.includes('API route not found')) {
                throw parseError;
              }
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
          }
        } catch (passwordError: any) {
          console.error('Error changing password:', passwordError);
          showNotificationMessage(`User updated, but failed to change password: ${passwordError.message}`, 'error');
          setIsSaving(false);
          return;
        }
      }

      // Send email if requested
      if (editUserEmail.sendEmail) {
        try {
          let emailContent = editUserEmail.content;
          
          // If password was changed and sendPasswordEmail is checked, include password in email
          if (editUserData.newPassword && editUserData.sendPasswordEmail) {
            if (!emailContent || emailContent.trim() === '') {
              emailContent = getDefaultEmailContent(editUserData.name, editUserData.email, editUserData.newPassword, false);
            } else {
              // Append password to content if not already included
              if (!emailContent.includes(editUserData.newPassword)) {
                emailContent += `\n\nLogin Details:\nEmail: ${editUserData.email}\nNew Password: ${editUserData.newPassword}`;
              }
            }
          } else if (!emailContent || emailContent.trim() === '') {
            // If no password change but email is requested, use default update message
            emailContent = `Dear ${editUserData.name},\n\nYour CRM account has been updated.\n\nPlease contact support if you have any questions.\n\nBest regards,\nMillennium Legal CRM Team`;
          }

          await sendOutlookEmail({
            to: editUserData.email,
            subject: editUserEmail.subject,
            textBody: emailContent,
            htmlBody: emailContent.replace(/\n/g, '<br>'),
            saveToSentItems: true
          });
          showNotificationMessage('User updated and email sent successfully!', 'success');
        } catch (emailError: any) {
          console.error('Error sending email:', emailError);
          const message = emailChanged 
            ? `User updated successfully! The user must now use "${editUserData.email}" to log in. Email sending failed.`
            : 'User updated successfully, but failed to send email.';
          showNotificationMessage(message, 'error');
        }
      } else {
        const message = emailChanged 
          ? `User updated successfully! The user must now use "${editUserData.email}" to log in.`
          : editUserData.newPassword
          ? 'User updated and password changed successfully!'
          : 'User updated successfully!';
        showNotificationMessage(message, 'success');
      }

      setShowEditUser(false);
      setSelectedUser(null);
      setEditUserData({
        name: '',
        email: '',
        role: 'Agent',
        status: 'Active',
        newPassword: '',
        sendPasswordEmail: false,
        threeCxExtension: ''
      });
      setEditUserEmail({
        sendEmail: false,
        subject: 'Your CRM Account Has Been Updated',
        content: ''
      });
      await loadUsers();
    } catch (err: any) {
      console.error('Error updating user:', err);
      showNotificationMessage(err.message || 'Failed to update user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      showNotificationMessage('You cannot delete your own account', 'error');
      return;
    }
    setSelectedUser(user);
    setShowDeleteUser(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      const { error, warning } = await deleteUser(selectedUser.id);

      if (error) {
        showNotificationMessage(error, 'error');
      } else {
        if (warning) {
          showNotificationMessage(`User deleted, but ${warning}`, 'error');
        } else {
          showNotificationMessage('User deleted successfully from both tables!', 'success');
        }
        setShowDeleteUser(false);
        setSelectedUser(null);
        await loadUsers();
      }
    } catch (err: any) {
      console.error('Error deleting user:', err);
      showNotificationMessage(err.message || 'Failed to delete user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMagicLink = async (user: User) => {
    try {
      const { error } = await sendMagicLink(user.email);

      if (error) {
        showNotificationMessage(error, 'error');
      } else {
        showNotificationMessage(`Magic link sent to ${user.email}`, 'success');
      }
    } catch (err: any) {
      console.error('Error sending magic link:', err);
      showNotificationMessage(err.message || 'Failed to send magic link', 'error');
    }
  };

  const getQuotaStatus = (assigned: number, quota: number) => {
    const percentage = (assigned / quota) * 100;
    if (percentage >= 100) return { status: 'Full', color: 'text-red-600 bg-red-50' };
    if (percentage >= 80) return { status: 'Near Limit', color: 'text-yellow-600 bg-yellow-50' };
    return { status: 'Available', color: 'text-green-600 bg-green-50' };
  };

  const handleSetGlobalQuota = () => {
    setGlobalQuotaData({
      dailyQuota: DEFAULT_AGENT_DAILY_QUOTA,
      weeklyQuota: DEFAULT_AGENT_WEEKLY_QUOTA,
      monthlyQuota: 0,
      priorityLeads: 0,
      maxConcurrent: 0
    });
    setShowGlobalQuotaModal(true);
  };

  const handleSaveGlobalQuota = async () => {
    setIsSaving(true);
    try {
      // Get all active agents
      const agents = await fetchUsers();
      const activeAgents = agents.filter(a => a.role === 'Agent' && a.status === 'Active');

      // Update all agents with global quotas
      const updates = activeAgents.map(agent => 
        supabase
          .from('users')
          .update({
            daily_quota: globalQuotaData.dailyQuota ?? agent.daily_quota ?? 999,
            weekly_quota: globalQuotaData.weeklyQuota ?? agent.weekly_quota ?? (globalQuotaData.dailyQuota ?? agent.daily_quota ?? 999) * 7,
            updated_at: new Date().toISOString()
          })
          .eq('id', agent.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        console.error('Some quota updates failed:', errors);
        showNotificationMessage(`Failed to update ${errors.length} agent(s). Please try again.`, 'error');
      } else {
        showNotificationMessage(`Global quotas applied to ${activeAgents.length} agent(s) successfully!`, 'success');
    setShowGlobalQuotaModal(false);
    setGlobalQuotaData({
      dailyQuota: 0,
      weeklyQuota: 0,
      monthlyQuota: 0,
      priorityLeads: 0,
      maxConcurrent: 0
    });
        await loadQuotas(); // Reload quota data
      }
    } catch (err: any) {
      console.error('Error saving global quota:', err);
      showNotificationMessage(err.message || 'Failed to save global quotas. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // User profile handlers (for Agents and Admin/Manager)
  const handleUpdateUserProfile = async () => {
    if (!currentUser?.id) {
      showNotificationMessage('User not found', 'error');
      return;
    }

    if (!userProfile.name || userProfile.name.trim() === '') {
      showNotificationMessage('Please enter your name', 'error');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const { error } = await updateUser(currentUser.id, {
        name: userProfile.name.trim()
      });

      if (error) {
        showNotificationMessage(error, 'error');
      } else {
        showNotificationMessage('Profile updated successfully!', 'success');
        // Refresh user context to get updated name
        window.dispatchEvent(new CustomEvent('user-profile-updated'));
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showNotificationMessage(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (import.meta.env.DEV) {
      console.log('handleChangePassword called');
    }
    
    // Clear previous errors
    setPasswordErrors({});
    
    if (!currentUser?.id || !currentUser?.email) {
      console.error('User not found:', { id: currentUser?.id, email: currentUser?.email });
      showNotificationMessage('User not found', 'error');
      return;
    }

    // Validate and set errors
    const errors: typeof passwordErrors = {};
    let hasErrors = false;

    if (!userProfile.currentPassword) {
      errors.currentPassword = 'Current password is required';
      hasErrors = true;
    }

    if (!userProfile.newPassword) {
      errors.newPassword = 'New password is required';
      hasErrors = true;
    } else if (userProfile.newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long';
      hasErrors = true;
    }

    if (!userProfile.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
      hasErrors = true;
    } else if (userProfile.newPassword !== userProfile.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      hasErrors = true;
    }

    if (hasErrors) {
      setPasswordErrors(errors);
      showNotificationMessage('Please fix the errors below', 'error');
      return;
    }

    if (import.meta.env.DEV) {
      console.log('Starting password change process');
    }
    setIsChangingPassword(true);
    
    try {
      // First verify current password by attempting to sign in
      if (import.meta.env.DEV) {
        console.log('Verifying current password...');
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: userProfile.currentPassword
      });

      if (signInError) {
        console.error('Current password verification failed:', signInError);
        showNotificationMessage('Current password is incorrect', 'error');
        setIsChangingPassword(false);
        return;
      }

      if (import.meta.env.DEV) {
        console.log('Current password verified, changing password via Edge Function...');
      }
      // Use Supabase Edge Function for password change
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/change-password`;
      if (import.meta.env.DEV) {
        console.log('Edge Function URL:', functionUrl);
      }
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          userId: currentUser.id,
          newPassword: userProfile.newPassword,
          currentPassword: userProfile.currentPassword
        })
      });

      if (import.meta.env.DEV) {
        console.log('API Response status:', response.status, response.statusText);
      }

      if (!response.ok) {
        let errorMessage = 'Failed to change password';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            // Check if it's HTML (means route doesn't exist)
            const errorText = await response.text();
            if (errorText.trim().startsWith('<!')) {
              throw new Error(`API route not found. The change-password endpoint may not be deployed yet. Status: ${response.status}`);
            }
            errorMessage = errorText || `Server error: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message.includes('API route not found')) {
            throw parseError;
          }
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        console.error('API Error:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      await response.json();
      if (import.meta.env.DEV) {
        console.log('Password change successful');
      }

      // Password changed successfully
      // Sign in with new password to refresh session
      if (import.meta.env.DEV) {
        console.log('Signing in with new password...');
      }
      const { error: newSignInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: userProfile.newPassword
      });

      if (newSignInError) {
        console.error('Error signing in with new password:', newSignInError);
        // Still show success since password was changed, but warn about session
        showNotificationMessage('Password changed successfully, but session refresh failed. Please log in again.', 'error');
      } else {
        if (import.meta.env.DEV) {
          console.log('Session refreshed successfully');
        }
        showNotificationMessage('Password changed successfully!', 'success');
      }

      // Clear password fields
      setUserProfile({
        ...userProfile,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      console.error('Error changing password:', err);
      showNotificationMessage(err.message || 'Failed to change password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Update user profile when user changes
  useEffect(() => {
    if (currentUser?.name) {
      setUserProfile(prev => ({
        ...prev,
        name: currentUser.name
      }));
    }
  }, [currentUser?.name]);

  const filteredAgentQuotas = agentQuotas.filter(agent => {
    if (quotaFilter === 'at-limit') return agent.quotaReached || agent.weeklyQuotaReached;
    if (quotaFilter === 'adjusted') return agent.hasAdjustments;
    if (quotaFilter === 'over-weekly') return agent.weeklyQuotaReached;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Notification */}
      {showNotification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notificationType === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white flex items-center space-x-2`}>
          {notificationType === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{notificationMessage}</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">
          {currentUser?.role === 'Agent' 
            ? 'Manage your profile and account settings' 
            : 'Manage system configuration and users'}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-4 py-2 text-left leading-5 transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-navy-100 text-navy-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="break-words">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent Settings Tab */}
      {activeTab === 'settings' && currentUser?.role === 'Agent' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>

          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="input-field bg-gray-50 cursor-not-allowed"
                  value={currentUser?.email || ''}
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed. Contact your administrator to update your email.</p>
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleUpdateUserProfile}
                  disabled={isUpdatingProfile || !userProfile.name || userProfile.name.trim() === '' || userProfile.name === currentUser?.name}
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Update Profile
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && currentUser?.role !== 'Agent' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
            <button 
              onClick={handleAddUser}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Add User</span>
            </button>
          </div>

          {isLoadingUsers ? (
            <div className="card text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Loading users...</p>
            </div>
          ) : (
          <div className="card p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">3CX Ext</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-cell text-center py-8 text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-gray-900">{user.name}</td>
                      <td className="table-cell text-gray-900">{user.email}</td>
                      <td className="table-cell">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="table-cell text-gray-900">
                        {threeCxExtensionByUserId[user.id] ? (
                          <span className="inline-flex items-center rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            {threeCxExtensionByUserId[user.id]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex space-x-2">
                              <button 
                                className="text-gray-400 hover:text-gray-600" 
                                title="Edit"
                                onClick={() => handleEditUser(user)}
                              >
                            <Edit className="h-4 w-4" />
                          </button>
                              <button 
                                className="text-blue-400 hover:text-blue-600" 
                                title="Send Magic Link"
                                onClick={() => handleSendMagicLink(user)}
                              >
                                <Mail className="h-4 w-4" />
                              </button>
                              <button 
                                className="text-gray-400 hover:text-red-600" 
                                title="Delete"
                                onClick={() => handleDeleteUser(user)}
                                disabled={user.id === currentUser?.id}
                              >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Lead Quotas Tab */}
      {activeTab === 'quotas' && currentUser?.role !== 'Agent' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">CRM Agent Lead Quotas</h2>
              <p className="text-sm text-gray-600">Set daily and weekly CRM lead limits for each agent.</p>
            </div>
            <button 
              className="btn-primary flex items-center space-x-2"
              onClick={handleSetGlobalQuota}
            >
              <Plus className="h-5 w-5" />
              <span>Set Global Quotas</span>
            </button>
          </div>

          {isLoadingQuotas ? (
            <div className="card text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Loading quota data...</p>
            </div>
          ) : quotaLoadError ? (
            <div className="card text-center py-12">
              <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-4" />
              <p className="font-medium text-gray-900">Could not load quota data</p>
              <p className="mt-2 text-sm text-gray-600">
                The quota overview could not be loaded. Make sure the quota overview SQL migration has been applied.
              </p>
              <p className="mt-2 text-xs text-gray-500 break-words">{quotaLoadError}</p>
              <button className="btn-primary mt-4" onClick={loadQuotas}>
                Retry
              </button>
            </div>
          ) : (
            <>
          {/* Quota Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-500">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Daily Quota</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agentQuotas.reduce((sum, agent) => sum + agent.dailyQuota, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-500">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Leads Assigned Today</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agentQuotas.reduce((sum, agent) => sum + agent.todayAssigned, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-500">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Assigned This Week</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {agentQuotas.reduce((sum, agent) => sum + agent.weeklyAssigned, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-indigo-500">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Agents</p>
                  <p className="text-2xl font-bold text-gray-900">{agentQuotas.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Quotas Table */}
          <div className="card p-0 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
              Daily quota counts leads assigned to the agent today, including manager assignments. It resets at UK midnight. Weekly quota resets Monday UK time. Resetting quota affects capacity only; it does not delete assignment history.
            </div>
            <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
              {[
                { id: 'all', label: 'All Agents' },
                { id: 'at-limit', label: 'At Limit' },
                { id: 'adjusted', label: 'Adjusted Today' },
                { id: 'over-weekly', label: 'Over Weekly Limit' }
              ].map(option => (
                <button
                  key={option.id}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    quotaFilter === option.id
                      ? 'bg-[#011E41] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setQuotaFilter(option.id as typeof quotaFilter)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header w-32 text-left">Agent</th>
                    <th className="table-header w-24 text-left">Daily Limit</th>
                    <th className="table-header w-36 text-left">Assigned Today</th>
                    <th className="table-header w-24 text-left">Weekly Limit</th>
                    <th className="table-header w-36 text-left">Assigned Week</th>
                    <th className="table-header w-24 text-left">Remaining</th>
                    <th className="table-header w-24 text-left">Active Leads</th>
                    <th className="table-header w-32 text-left">Usage</th>
                    <th className="table-header w-32 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAgentQuotas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="table-cell text-center py-8 text-gray-500">
                        No agents match this quota filter
                      </td>
                    </tr>
                  ) : (
                    filteredAgentQuotas.map((agent) => {
                    const dailyStatus = getQuotaStatus(agent.todayAssigned, agent.dailyEffectiveQuota || agent.dailyQuota);
                    
                    return (
                      <tr key={agent.id} className="hover:bg-gray-50">
                          <td className="table-cell py-2">
                            <div className="min-w-[150px] max-w-[240px]">
                              <div className="break-words text-sm font-medium leading-5 text-gray-900" title={agent.name}>{agent.name}</div>
                              <div className="break-all text-xs leading-5 text-gray-500" title={agent.email}>{agent.email}</div>
                          </div>
                        </td>
                          <td className="table-cell py-2">
                            <div className="text-xs">
                              <div className="font-medium text-gray-900">{agent.dailyEffectiveQuota || agent.dailyQuota}</div>
                              <div className="text-gray-500">leads/day</div>
                              {agent.dailyAllowanceBonus > 0 && (
                                <div className="text-emerald-700">base {agent.dailyQuota} +{agent.dailyAllowanceBonus}</div>
                              )}
                          </div>
                          </td>
                          <td className="table-cell py-2">
                            <div className="text-xs">
                              <div className="font-medium text-gray-900">{agent.todayAssigned}</div>
                              <div className="text-gray-500">effective usage</div>
                              <div className="text-gray-500">raw {agent.rawAssignedToday}</div>
                              {agent.dailyUsageAdjustment !== 0 && (
                                <div className="text-blue-700">adjust {agent.dailyUsageAdjustment}</div>
                              )}
                          </div>
                          </td>
                          <td className="table-cell py-2">
                            <div className="text-xs">
                              <div className="font-medium text-gray-900">{agent.weeklyEffectiveQuota || agent.weeklyQuota}</div>
                              <div className="text-gray-500">leads/week</div>
                              {agent.weeklyAllowanceBonus > 0 && (
                                <div className="text-emerald-700">base {agent.weeklyQuota} +{agent.weeklyAllowanceBonus}</div>
                              )}
                          </div>
                          </td>
                          <td className="table-cell py-2">
                            <div className="text-xs">
                              <div className="font-medium text-gray-900">{agent.weeklyAssigned}</div>
                              <div className="text-gray-500">effective usage</div>
                              <div className="text-gray-500">raw {agent.rawAssignedThisWeek}</div>
                              {agent.weeklyUsageAdjustment !== 0 && (
                                <div className="text-blue-700">adjust {agent.weeklyUsageAdjustment}</div>
                              )}
                          </div>
                          </td>
                          <td className="table-cell py-2">
                            <div className="text-xs">
                              <div className={`font-medium ${agent.remaining === 0 ? 'text-red-700' : 'text-gray-900'}`}>{agent.remaining}</div>
                              <div className="text-gray-500">remaining</div>
                          </div>
                        </td>
                          <td className="table-cell py-2">
                            <div className="text-xs">
                              <div className="font-medium text-gray-900">{agent.currentLeads}</div>
                              <div className="text-gray-500 text-xs">leads</div>
                            </div>
                          </td>
                          <td className="table-cell py-2">
                            <div className="flex items-center space-x-1">
                              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                              <div 
                                  className="bg-green-500 h-1.5 rounded-full" 
                                style={{ width: `${agent.performance}%` }}
                              ></div>
                            </div>
                              <span className="text-xs font-medium text-gray-900">{agent.performance}%</span>
                          </div>
                            <div className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs ${dailyStatus.color}`}>
                              {dailyStatus.status}
                            </div>
                            {agent.hasAdjustments && (
                              <div className="mt-1 inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                                Adjusted
                              </div>
                            )}
                        </td>
                          <td className="table-cell py-2">
                            <div className="flex flex-wrap gap-1">
                            <button 
                                className="text-gray-400 hover:text-gray-600 transition-colors" 
                              title="Edit Quota"
                              onClick={() => handleEditQuota(agent)}
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </button>
                              <button
                                className="text-gray-400 hover:text-amber-600 transition-colors"
                                title="Reset Usage"
                                onClick={() => openQuotaResetModal(agent)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="text-gray-400 hover:text-green-600 transition-colors"
                                title="Add Allowance"
                                onClick={() => openQuotaAllowanceModal(agent)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Quota History"
                                onClick={() => openQuotaHistoryModal(agent)}
                              >
                                <TrendingUp className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* Quote / Fee configuration Tab (Admin & Manager only) */}
      {activeTab === 'fee-config' && currentUser?.role !== 'Agent' && (
        <FeeConfigTab onNotification={showNotificationMessage} />
      )}

      {/* 3CX / Call Intelligence Tab */}
      {activeTab === 'threecx' && currentUser?.role !== 'Agent' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">3CX / Call Intelligence</h2>
              <p className="text-sm text-gray-600">
                Call data and transcripts arrive after the daily 3CX transfer, then appear in Lead Management and Call Analysis.
              </p>
            </div>
            <button
              className="btn-secondary flex items-center gap-2 text-sm"
              onClick={loadThreeCxStatus}
              disabled={isLoadingThreeCxStatus}
            >
              {isLoadingThreeCxStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Status
            </button>
          </div>

          {threeCxError && (
            <div className="card border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">3CX status unavailable</p>
                  <p className="mt-1 text-sm text-red-700">{threeCxError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Total Linked Calls</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{threeCxStatus?.totalCalls ?? 0}</p>
            </div>
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Waiting to Process</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{threeCxStatus?.pendingCdrRows ?? 0}</p>
            </div>
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Unmatched Calls</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{threeCxStatus?.unmatchedCalls ?? 0}</p>
            </div>
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Ambiguous Calls</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{threeCxStatus?.ambiguousCalls ?? 0}</p>
            </div>
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Review Queue</p>
              <p className={`mt-2 text-3xl font-bold ${(threeCxStatus?.reviewQueueCalls ?? 0) > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {threeCxStatus?.reviewQueueCalls ?? 0}
              </p>
            </div>
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Eligible AI Backlog</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{threeCxStatus?.aiBacklog ?? 0}</p>
              {(threeCxStatus?.aiBelowMinDurationCalls ?? 0) > 0 && (
                <p className="mt-1 text-xs leading-4 text-gray-500">
                  {(threeCxStatus?.aiBelowMinDurationCalls ?? 0).toLocaleString('en-GB')} shorter than {threeCxStatus?.aiMinDurationSeconds ?? threeCxAutoAnalyzeMinDuration}s skipped
                </p>
              )}
            </div>
            <div className="card min-h-[124px]">
              <p className="text-sm font-medium leading-5 text-gray-600">Eligible Failed AI</p>
              <p className={`mt-2 text-3xl font-bold ${(threeCxStatus?.failedAiCalls ?? 0) > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {threeCxStatus?.failedAiCalls ?? 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Connection Status</h3>
              {isLoadingThreeCxStatus ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading call status...
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <span className="text-gray-600">Last live call signal</span>
                    <span className="break-words font-medium text-gray-900 sm:text-right">{formatThreeCxDate(threeCxStatus?.latestWebhookAt)}</span>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <span className="text-gray-600">Last call data received</span>
                    <span className="break-words font-medium text-gray-900 sm:text-right">{formatThreeCxDate(threeCxStatus?.latestCdrImportAt)}</span>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <span className="text-gray-600">Last processing run</span>
                    <span className="break-words font-medium text-gray-900 sm:text-right">{formatThreeCxDate(threeCxStatus?.latestProcessAt)}</span>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <span className="text-gray-600">Failed call rows</span>
                    <span className={`font-medium ${threeCxStatus?.failedCdrRows ? 'text-red-700' : 'text-gray-900'}`}>{threeCxStatus?.failedCdrRows ?? 0}</span>
                  </div>
                  {threeCxStatus?.latestSync && (
                    <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                      <p className="font-medium text-gray-900">Latest update</p>
                      <p>Status: {threeCxStatus.latestSync.status}</p>
                      <p>Rows: {threeCxStatus.latestSync.rowsProcessed} processed, {threeCxStatus.latestSync.rowsFailed} failed, {threeCxStatus.latestSync.rowsUnmatched} unmatched</p>
                      {threeCxStatus.latestSync.errorMessage && <p className="text-red-700">Error: {threeCxStatus.latestSync.errorMessage}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Live Call Signal</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Signal URL</label>
                  <div className="max-w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700 break-all">
                    https://zxyvworgnzemogzderum.supabase.co/functions/v1/threecx-call-start
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Private test passcode</label>
                  <input
                    type="password"
                    className="input-field"
                    value={threeCxWebhookSecret}
                    onChange={(e) => setThreeCxWebhookSecret(e.target.value)}
                    placeholder="Enter the private passcode to test"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This is managed privately and is only needed when testing the live call signal.
                  </p>
                </div>
                <button
                  className="btn-primary flex items-center gap-2 text-sm"
                  onClick={handleThreeCxTestWebhook}
                  disabled={isTestingThreeCxWebhook}
                >
                  {isTestingThreeCxWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  Test Signal
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Call Data Import</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  Expected source: <span className="font-medium text-gray-900">daily 3CX call data transfer</span>
                </p>
                <p>
                  Processing turns daily call history into linked call records for Lead Management and Call Analysis.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    className="btn-primary flex items-center justify-center gap-2 text-sm"
                    onClick={handleThreeCxProcessCdr}
                    disabled={isProcessingThreeCxCdr || isReprocessingThreeCxCdr || isRefreshingThreeCxTranscripts || isAnalyzingPendingCalls}
                  >
                    {isProcessingThreeCxCdr ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Process Latest Calls
                  </button>
                  <button
                    className="btn-secondary flex items-center justify-center gap-2 text-sm"
                    onClick={handleThreeCxReprocessCdr}
                    disabled={isProcessingThreeCxCdr || isReprocessingThreeCxCdr || isRefreshingThreeCxTranscripts || isAnalyzingPendingCalls}
                  >
                    {isReprocessingThreeCxCdr ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh Recent Matches
                  </button>
                  <button
                    className="btn-secondary flex items-center justify-center gap-2 text-sm"
                    onClick={handleThreeCxRefreshTranscripts}
                    disabled={isProcessingThreeCxCdr || isReprocessingThreeCxCdr || isRefreshingThreeCxTranscripts || isAnalyzingPendingCalls}
                  >
                    {isRefreshingThreeCxTranscripts ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {threeCxAutoAnalyzeEnabled ? 'Refresh Transcripts + Analyse' : 'Refresh Transcripts'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Refreshing recent matches updates call links and agent extension mapping. Refresh Transcripts pulls in transcript text after 3CX has transferred recording data.
                </p>
              </div>
            </div>

            <div className="card">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Call Analysis Settings</h3>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="font-medium text-emerald-900">Manual APCM AI analysis</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Enabled</span>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Auto-analyse calls after transcript import</p>
                    <p className="text-xs text-gray-500">When call processing runs, transcript-ready calls are analysed automatically in safe batches.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveThreeCxAutoAnalysisSettings(!threeCxAutoAnalyzeEnabled, threeCxAutoAnalyzeLimit, threeCxAutoAnalyzeMinDuration)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                        threeCxAutoAnalyzeEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                      aria-pressed={threeCxAutoAnalyzeEnabled}
                      title="Toggle automatic APCM AI analysis"
                      disabled={isSavingThreeCxSettings}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          threeCxAutoAnalyzeEnabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                  <label>
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Max calls per run</span>
                    <select
                      value={threeCxAutoAnalyzeLimit}
                      onChange={(event) => {
                        const value = Number(event.target.value || 300);
                        saveThreeCxAutoAnalysisSettings(threeCxAutoAnalyzeEnabled, value, threeCxAutoAnalyzeMinDuration);
                      }}
                      className="input-field"
                      disabled={isSavingThreeCxSettings}
                    >
                      {[50, 100, 200, 300].map((limit) => (
                        <option key={limit} value={limit}>
                          {limit} calls
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Nightly cap: up to 300 calls. Manual backlog runs use safe 25-call batches.</p>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Minimum call length</span>
                    <select
                      value={threeCxAutoAnalyzeMinDuration}
                      onChange={(event) => {
                        const value = Number(event.target.value || 20);
                        saveThreeCxAutoAnalysisSettings(threeCxAutoAnalyzeEnabled, threeCxAutoAnalyzeLimit, value);
                      }}
                      className="input-field"
                      disabled={isSavingThreeCxSettings}
                    >
                      {[0, 10, 20, 30, 60].map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds === 0 ? 'Analyse all durations' : `${seconds}+ seconds`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Shorter calls can still be analysed manually.</p>
                  </label>
                  <button
                    className="btn-primary flex items-center justify-center gap-2 text-sm"
                    onClick={handleThreeCxAnalyzePending}
                    disabled={isProcessingThreeCxCdr || isReprocessingThreeCxCdr || isRefreshingThreeCxTranscripts || isAnalyzingPendingCalls || isSavingThreeCxSettings || (threeCxStatus?.aiBacklog ?? 0) === 0}
                  >
                    {isAnalyzingPendingCalls ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                    Analyse Pending Calls
                  </button>
                </div>
                <div className="space-y-1 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                  <p className="font-medium">Automatic analysis after call transfer: {threeCxAutoAnalyzeEnabled ? 'Enabled' : 'Off'}</p>
                  <p>
                    {threeCxAutoAnalyzeMinDuration === 0
                      ? 'Auto-analysis can include any transcript-ready call length.'
                      : `Auto-analysis skips calls shorter than ${threeCxAutoAnalyzeMinDuration} seconds.`}
                  </p>
                  <p>Large transcript refreshes run in safe batches to avoid timeouts.</p>
                  <p>Manual backlog analysis runs in batches of up to {SAFE_APCM_AI_BATCH_SIZE} calls to avoid request timeouts.</p>
                  <p>
                    Current eligible backlog: {(threeCxStatus?.aiBacklog ?? 0).toLocaleString('en-GB')} transcript-ready call(s)
                    {(threeCxStatus?.aiBelowMinDurationCalls ?? 0) > 0
                      ? `; ${(threeCxStatus?.aiBelowMinDurationCalls ?? 0).toLocaleString('en-GB')} shorter call(s) are below the auto-analysis minimum.`
                      : '.'}
                  </p>
                  {threeCxStatus?.latestAiSync ? (
                    <p>
                      Last AI run: {formatThreeCxDate(threeCxStatus.latestAiSync.createdAt)} · {threeCxStatus.latestAiSync.rowsProcessed} analysed, {threeCxStatus.latestAiSync.rowsFailed} failed.
                    </p>
                  ) : (
                    <p>No APCM AI batch run recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Call Data Received</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              {[
                'Call ID',
                'Caller number',
                'Dialled number',
                'Extension / agent',
                'Direction',
                'Start time',
                'Duration / end time',
                'Call status',
                'Transcript',
                'Queue / department',
              ].map((field) => (
                <div key={field} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="break-words leading-5">{field}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-blue-100 bg-blue-50">
            <h3 className="text-md font-semibold text-blue-900 mb-2">How This Works</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-900">
              <li>3CX sends call history into the CRM on its daily schedule.</li>
              <li>Transcripts appear after that daily transfer, not during the live call.</li>
              <li>Nightly automation processes recent calls after the transfer and runs APCM AI up to the selected cap.</li>
              <li>Use Process Latest Calls after a manual 3CX transfer.</li>
              <li>Use Refresh Recent Matches after changing an agent extension.</li>
              <li>Use Refresh Transcripts after 3CX has transferred recording transcripts.</li>
              <li>Review unmatched calls in Call Analysis when a number cannot be linked safely.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && currentUser?.role !== 'Agent' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>

          <div className="card">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-md font-semibold text-gray-900 mb-1">Outlook Email Integration</h3>
                <p className="text-sm text-gray-600">
                  Connect the shared Outlook mailbox used for sending quotes, follow-ups, and automated emails from the CRM.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-gray-500">Status:</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      outlookIntegration.connected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {outlookIntegration.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                {isLoadingOutlook && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking Outlook connection…</span>
                  </div>
                )}
                {outlookIntegration.connected && (
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>
                      <span className="font-medium text-gray-900">Mailbox:</span>{' '}
                      {outlookIntegration.email}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Last synced:</span>{' '}
                      {outlookIntegration.lastSynced
                        ? new Date(outlookIntegration.lastSynced).toLocaleString()
                        : '—'}
                    </div>
                    <p className="text-xs text-gray-500">
                      Only one Outlook mailbox can be active at a time. Disconnect before linking a different account.
                    </p>
                  </div>
                )}
                {!canManageOutlook && (
                  <p className="mt-3 text-xs text-gray-500">
                    Outlook integration is managed by administrators. The shared mailbox is used automatically when you send emails from the CRM.
                  </p>
                )}
              </div>
              {canManageOutlook && (
                <div className="flex items-center gap-2">
                  {outlookIntegration.connected ? (
                    <>
                      <button
                        className="btn-secondary flex items-center gap-2 text-sm"
                        onClick={handleResetOutlook}
                        disabled={isLoadingOutlook}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reset Token
                      </button>
                      <button
                        className="btn-primary flex items-center gap-2 text-sm"
                        onClick={handleConnectOutlook}
                        disabled={isLoadingOutlook}
                      >
                        <Link className="h-4 w-4" />
                        Reconnect
                      </button>
                      <button
                        className="btn-danger flex items-center gap-2 text-sm"
                        onClick={handleDisconnectOutlook}
                        disabled={isLoadingOutlook}
                      >
                        <Trash2 className="h-4 w-4" />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-primary flex items-center gap-2 text-sm"
                      onClick={handleConnectOutlook}
                      disabled={isLoadingOutlook}
                    >
                      <Link className="h-4 w-4" />
                      Connect Outlook
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">New Lead Assignments</p>
                  <p className="text-sm text-gray-600">Get notified when new leads are assigned to you</p>
                </div>
                <input type="checkbox" className="rounded border-gray-300 text-navy-600 focus:ring-navy-500" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Payment Received</p>
                  <p className="text-sm text-gray-600">Get notified when payments are received</p>
                </div>
                <input type="checkbox" className="rounded border-gray-300 text-navy-600 focus:ring-navy-500" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Overdue Payments</p>
                  <p className="text-sm text-gray-600">Get notified about overdue payments</p>
                </div>
                <input type="checkbox" className="rounded border-gray-300 text-navy-600 focus:ring-navy-500" />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-4">SMS Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Urgent Lead Updates</p>
                  <p className="text-sm text-gray-600">Get SMS for urgent lead updates</p>
                </div>
                <input type="checkbox" className="rounded border-gray-300 text-navy-600 focus:ring-navy-500" />
              </div>
            </div>
          </div>

          <button className="btn-primary flex items-center space-x-2">
            <Save className="h-5 w-5" />
            <span>Save Settings</span>
          </button>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
          
          {/* Change Password Section (for all users) */}
          <div className="card">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password *</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className={`input-field pr-10 ${passwordErrors.currentPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                    value={userProfile.currentPassword}
                    onChange={(e) => {
                      setUserProfile({...userProfile, currentPassword: e.target.value});
                      if (passwordErrors.currentPassword) {
                        setPasswordErrors({...passwordErrors, currentPassword: undefined});
                      }
                    }}
                    placeholder="Enter your current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-red-600 mt-1">{passwordErrors.currentPassword}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className={`input-field pr-10 ${passwordErrors.newPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                    value={userProfile.newPassword}
                    onChange={(e) => {
                      setUserProfile({...userProfile, newPassword: e.target.value});
                      if (passwordErrors.newPassword) {
                        setPasswordErrors({...passwordErrors, newPassword: undefined});
                      }
                      // Clear confirm password error if passwords now match
                      if (passwordErrors.confirmPassword && e.target.value === userProfile.confirmPassword) {
                        setPasswordErrors({...passwordErrors, confirmPassword: undefined});
                      }
                    }}
                    placeholder="Enter new password (minimum 8 characters)"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordErrors.newPassword ? (
                  <p className="text-sm text-red-600 mt-1">{passwordErrors.newPassword}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters required</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`input-field pr-10 ${passwordErrors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                    value={userProfile.confirmPassword}
                    onChange={(e) => {
                      setUserProfile({...userProfile, confirmPassword: e.target.value});
                      if (passwordErrors.confirmPassword) {
                        setPasswordErrors({...passwordErrors, confirmPassword: undefined});
                      }
                    }}
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-red-600 mt-1">{passwordErrors.confirmPassword}</p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-primary flex items-center gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    if (import.meta.env.DEV) {
                      console.log('Change Password button clicked', {
                        currentPassword: !!userProfile.currentPassword,
                        newPassword: !!userProfile.newPassword,
                        confirmPassword: !!userProfile.confirmPassword,
                        newPasswordLength: userProfile.newPassword.length,
                        passwordsMatch: userProfile.newPassword === userProfile.confirmPassword,
                        isChangingPassword,
                        currentUser: currentUser?.id
                      });
                    }
                    handleChangePassword();
                  }}
                  disabled={isChangingPassword || !userProfile.currentPassword || !userProfile.newPassword || !userProfile.confirmPassword || userProfile.newPassword.length < 8 || userProfile.newPassword !== userProfile.confirmPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Admin Security Settings */}
          {currentUser?.role !== 'Agent' && (
            <>
              <div className="card">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Password Policy</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Minimum Password Length</label>
                    <input type="number" className="input-field mt-1" defaultValue="8" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password Expiry (days)</label>
                    <input type="number" className="input-field mt-1" defaultValue="90" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-md font-semibold text-gray-900 mb-4">Session Management</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Session Timeout (minutes)</label>
                    <input type="number" className="input-field mt-1" defaultValue="30" />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-navy-600 focus:ring-navy-500" defaultChecked />
                    <label className="ml-2 text-sm text-gray-700">Require re-authentication for sensitive actions</label>
                  </div>
                </div>
              </div>

              <button className="btn-primary flex items-center space-x-2">
                <Save className="h-5 w-5" />
                <span>Save Settings</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Quota Edit Modal */}
      {showEditQuota && selectedAgent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Daily / Weekly Quotas for {selectedAgent.name}</h3>
              <button 
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowEditQuota(false)}
                title="Close"
                aria-label="Close quota editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Daily Quota</label>
                  <input
                    type="number"
                    className="input-field"
                    value={quotaData.dailyQuota}
                    onChange={(e) => setQuotaData({...quotaData, dailyQuota: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum CRM leads this agent can receive per UK day.</p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                  Daily and weekly CRM lead limits are enforced. Monthly, priority, and concurrent limits are not enforced in this CRM yet.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Quota</label>
                  <input
                    type="number"
                    className="input-field"
                    value={quotaData.weeklyQuota}
                    onChange={(e) => setQuotaData({...quotaData, weeklyQuota: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum CRM leads this agent can receive per UK week.</p>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Current Status</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Today:</span>
                    <span className="ml-2 font-medium">{selectedAgent.todayAssigned}/{selectedAgent.dailyQuota}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Remaining:</span>
                    <span className="ml-2 font-medium">{selectedAgent.remaining}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Week:</span>
                    <span className="ml-2 font-medium">{selectedAgent.weeklyAssigned}/{selectedAgent.weeklyQuota}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Usage:</span>
                    <span className="ml-2 font-medium text-green-600">{selectedAgent.performance}%</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Usage is calculated from assignment history and current assignment. It resets automatically; editing quotas changes the limit, not the audit trail.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button 
                  className="btn-secondary"
                  onClick={() => setQuotaData({
                    ...quotaData,
                    dailyQuota: DEFAULT_AGENT_DAILY_QUOTA,
                    weeklyQuota: DEFAULT_AGENT_WEEKLY_QUOTA
                  })}
                  disabled={isSaving}
                >
                  Use Default Limits
                </button>
                <div className="flex justify-end space-x-3">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShowEditQuota(false);
                      setSelectedAgent(null);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveQuota}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Quotas'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quota Reset Modal */}
      {showQuotaResetModal && selectedAgent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reset Quota Usage</h3>
                <p className="text-sm text-gray-600">{selectedAgent.name}</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowQuotaResetModal(false)}
                title="Close"
                aria-label="Close reset quota modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                Resetting quota affects capacity only. It does not delete assignment history.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reset Period</label>
                <select
                  className="input-field"
                  value={quotaResetData.scope}
                  onChange={(e) => setQuotaResetData({ ...quotaResetData, scope: e.target.value as 'daily' | 'weekly' | 'both' })}
                >
                  <option value="both">Today and This Week</option>
                  <option value="daily">Today only</option>
                  <option value="weekly">This week only</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-gray-500">Today</div>
                  <div className="font-semibold text-gray-900">{selectedAgent.todayAssigned}/{selectedAgent.dailyEffectiveQuota || selectedAgent.dailyQuota}</div>
                  <div className="text-xs text-gray-500">raw {selectedAgent.rawAssignedToday}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-gray-500">This Week</div>
                  <div className="font-semibold text-gray-900">{selectedAgent.weeklyAssigned}/{selectedAgent.weeklyEffectiveQuota || selectedAgent.weeklyQuota}</div>
                  <div className="text-xs text-gray-500">raw {selectedAgent.rawAssignedThisWeek}</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                <textarea
                  className="input-field min-h-[90px]"
                  value={quotaResetData.reason}
                  onChange={(e) => setQuotaResetData({ ...quotaResetData, reason: e.target.value })}
                  placeholder="Example: Restart agent capacity for afternoon allocation"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  className="btn-secondary"
                  onClick={() => setShowQuotaResetModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleResetQuotaUsage}
                  disabled={isSaving || !quotaResetData.reason.trim()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Usage'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quota Allowance Modal */}
      {showQuotaAllowanceModal && selectedAgent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Quota Allowance</h3>
                <p className="text-sm text-gray-600">{selectedAgent.name}</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowQuotaAllowanceModal(false)}
                title="Close"
                aria-label="Close allowance modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800">
                Extra allowance adds temporary capacity for the current UK day or week.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
                  <select
                    className="input-field"
                    value={quotaAllowanceData.scope}
                    onChange={(e) => setQuotaAllowanceData({ ...quotaAllowanceData, scope: e.target.value as QuotaAdjustmentScope })}
                  >
                    <option value="daily">Today</option>
                    <option value="weekly">This Week</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Extra Leads</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={quotaAllowanceData.amount}
                    onChange={(e) => setQuotaAllowanceData({ ...quotaAllowanceData, amount: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                <textarea
                  className="input-field min-h-[90px]"
                  value={quotaAllowanceData.reason}
                  onChange={(e) => setQuotaAllowanceData({ ...quotaAllowanceData, reason: e.target.value })}
                  placeholder="Example: Temporary overflow support for new enquiries"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  className="btn-secondary"
                  onClick={() => setShowQuotaAllowanceModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAddQuotaAllowance}
                  disabled={isSaving || quotaAllowanceData.amount <= 0 || !quotaAllowanceData.reason.trim()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    'Add Allowance'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quota History Modal */}
      {showQuotaHistoryModal && selectedAgent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quota History</h3>
                <p className="text-sm text-gray-600">{selectedAgent.name}</p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowQuotaHistoryModal(false)}
                title="Close"
                aria-label="Close quota history"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingQuotaHistory ? (
              <div className="py-10 text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                Loading quota history...
              </div>
            ) : quotaHistory.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
                No quota resets or allowances recorded for this agent.
              </div>
            ) : (
              <div className="space-y-3">
                {quotaHistory.map(item => (
                  <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.actionType === 'reset_to_zero' ? 'Reset usage' : 'Extra allowance'} · {item.scope === 'daily' ? 'Today' : 'This week'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.createdAt).toLocaleString()} by {item.createdByName || 'Unknown user'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {item.usageOffset !== 0 && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                            Usage {item.usageOffset}
                          </span>
                        )}
                        {item.allowanceBonus > 0 && (
                          <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700">
                            Allowance +{item.allowanceBonus}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-700">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Quota Modal */}
      {showGlobalQuotaModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Set Global Daily / Weekly Quotas</h3>
              <button 
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowGlobalQuotaModal(false)}
                title="Close"
                aria-label="Close global quota editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Daily Quota</label>
                  <input
                    type="number"
                    className="input-field"
                    value={globalQuotaData.dailyQuota}
                    onChange={(e) => {
                      const dailyQuota = parseInt(e.target.value) || 0;
                      setGlobalQuotaData({
                        ...globalQuotaData,
                        dailyQuota,
                        weeklyQuota: globalQuotaData.weeklyQuota ?? dailyQuota * 7
                      });
                    }}
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum CRM leads per UK day for all active agents.</p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                  This applies the same daily and weekly CRM lead quotas to every active agent. It does not change comparison firm capacity.
                  Usage counters are not deleted; they reset automatically on the UK day/week boundary.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Quota</label>
                  <input
                    type="number"
                    className="input-field"
                    value={globalQuotaData.weeklyQuota}
                    onChange={(e) => setGlobalQuotaData({...globalQuotaData, weeklyQuota: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum CRM leads per UK week for all active agents.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
                <button 
                  className="btn-secondary"
                  onClick={() => setGlobalQuotaData({
                    ...globalQuotaData,
                    dailyQuota: DEFAULT_AGENT_DAILY_QUOTA,
                    weeklyQuota: DEFAULT_AGENT_WEEKLY_QUOTA
                  })}
                  disabled={isSaving}
                >
                  Use Default Limits
                </button>
                <div className="flex justify-end space-x-3">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowGlobalQuotaModal(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveGlobalQuota}
                  disabled={isSaving || globalQuotaData.dailyQuota < 0 || globalQuotaData.weeklyQuota < 0}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Applying...
                      </>
                    ) : (
                      'Set Global Quotas'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add New User</h3>
              <button 
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUser({
                      name: '',
                      email: '',
                      password: '',
                      role: 'Agent',
                      createMethod: 'password',
                      dailyQuota: 99,
                      weeklyQuota: 99 * 7,
                      threeCxExtension: ''
                    });
                    setShowPassword(false);
                  }}
                className="text-gray-400 hover:text-gray-600"
              >
                  <X className="h-5 w-5" />
              </button>
            </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    className="input-field"
                  value={newUser.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewUser({...newUser, name});
                    // Update email content if sendEmail is checked
                    if (newUserEmail.sendEmail && newUser.password) {
                      setNewUserEmail({
                        ...newUserEmail,
                        content: getDefaultEmailContent(name || 'User', newUser.email || '', newUser.password, true)
                      });
                    }
                  }}
                  placeholder="Enter full name"
                  required
                />
                </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                  type="email"
                    className="input-field"
                  value={newUser.email}
                  onChange={(e) => {
                    const email = e.target.value.trim();
                    setNewUser({...newUser, email});
                    // Update email content if sendEmail is checked
                    if (newUserEmail.sendEmail && newUser.password) {
                      setNewUserEmail({
                        ...newUserEmail,
                        content: getDefaultEmailContent(newUser.name || 'User', email, newUser.password, true)
                      });
                    }
                  }}
                  onBlur={(e) => {
                    const email = e.target.value.trim().toLowerCase();
                    setNewUser({...newUser, email});
                    // Update email content if sendEmail is checked
                    if (newUserEmail.sendEmail && newUser.password) {
                      setNewUserEmail({
                        ...newUserEmail,
                        content: getDefaultEmailContent(newUser.name || 'User', email, newUser.password, true)
                      });
                    }
                  }}
                  placeholder="Enter email address"
                  required
                  />
                <p className="text-xs text-gray-500 mt-1">Email will be automatically converted to lowercase</p>
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-24"
                    value={newUser.password}
                    onChange={(e) => {
                      const password = e.target.value;
                      setNewUser({...newUser, password});
                      // Update email content if sendEmail is checked
                      if (newUserEmail.sendEmail) {
                        setNewUserEmail({
                          ...newUserEmail,
                          content: getDefaultEmailContent(newUser.name || 'User', newUser.email || '', password, true)
                        });
                      }
                    }}
                    placeholder="Enter password"
                    required
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRandomizePassword}
                      className="text-gray-400 hover:text-blue-600 focus:outline-none transition-colors"
                      title="Randomize Password"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters recommended. Click the refresh icon to randomize.</p>
              </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    className="input-field"
                  value={newUser.role}
                  onChange={(e) => {
                    const role = e.target.value as 'Admin' | 'Manager' | 'Agent';
                    setNewUser({
                      ...newUser, 
                      role,
                      dailyQuota: role === 'Agent' ? (newUser.dailyQuota ?? 99) : undefined as any,
                      weeklyQuota: role === 'Agent' ? (newUser.weeklyQuota ?? (newUser.dailyQuota ?? 99) * 7) : undefined as any
                    });
                  }}
                  >
                  <option value="Agent">Agent</option>
                  {currentUser?.role === 'Manager' && <option value="Manager">Manager</option>}
                  <option value="Admin">Admin</option>
                  </select>
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">3CX Extension</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field"
                  value={newUser.threeCxExtension}
                  onChange={(e) => setNewUser({ ...newUser, threeCxExtension: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="e.g. 104"
                />
                <p className="text-xs text-gray-500 mt-1">Used to match 3CX calls to this CRM user.</p>
              </div>
              {newUser.role === 'Agent' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Daily Quota</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={newUser.dailyQuota ?? 99}
                      onChange={(e) => {
                        const dailyQuota = parseInt(e.target.value);
                        const nextDailyQuota = Number.isNaN(dailyQuota) ? 99 : dailyQuota;
                        setNewUser({
                          ...newUser,
                          dailyQuota: nextDailyQuota,
                          weeklyQuota: newUser.weeklyQuota ?? nextDailyQuota * 7
                        });
                      }}
                      placeholder="Enter daily quota"
                    />
                    <p className="text-xs text-gray-500 mt-1">CRM leads this agent can receive per UK day</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Quota</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={newUser.weeklyQuota ?? (newUser.dailyQuota ?? 99) * 7}
                      onChange={(e) => {
                        const weeklyQuota = parseInt(e.target.value);
                        setNewUser({
                          ...newUser,
                          weeklyQuota: Number.isNaN(weeklyQuota) ? (newUser.dailyQuota ?? 99) * 7 : weeklyQuota
                        });
                      }}
                      placeholder="Enter weekly quota"
                    />
                    <p className="text-xs text-gray-500 mt-1">CRM leads this agent can receive per UK week</p>
                  </div>
                </div>
              )}

              {/* Email Section */}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Send Login Details via Email
                  </label>
                  <input
                    type="checkbox"
                    checked={newUserEmail.sendEmail}
                    onChange={(e) => {
                      setNewUserEmail({
                        ...newUserEmail,
                        sendEmail: e.target.checked,
                        content: e.target.checked && !newUserEmail.content
                          ? getDefaultEmailContent(newUser.name || 'User', newUser.email || '', newUser.password, true)
                          : newUserEmail.content
                      });
                    }}
                    className="rounded border-gray-300 text-[#011E41] focus:ring-[#011E41]"
                  />
                </div>

                  {newUserEmail.sendEmail && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject *</label>
                        <input
                          type="text"
                          className="input-field"
                          value={newUserEmail.subject}
                          onChange={(e) => setNewUserEmail({...newUserEmail, subject: e.target.value})}
                          placeholder="Enter email subject"
                          required={newUserEmail.sendEmail}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Content *</label>
                        <textarea
                          className="input-field"
                          rows={8}
                          value={newUserEmail.content}
                          onChange={(e) => setNewUserEmail({...newUserEmail, content: e.target.value})}
                          placeholder="Enter email content (login details will be included automatically)"
                          required={newUserEmail.sendEmail}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Email and password from above will be included in the email. You can customize the message.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="btn-secondary"
                  onClick={() => {
                  setShowAddUser(false);
                  setNewUser({
                    name: '',
                    email: '',
                    password: '',
                    role: 'Agent',
                    createMethod: 'password',
                    dailyQuota: 99,
                    weeklyQuota: 99 * 7,
                    threeCxExtension: ''
                  });
                  setNewUserEmail({
                    sendEmail: false,
                    subject: 'Your CRM Account Has Been Created',
                    content: ''
                  });
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleSaveNewUser}
                disabled={isSaving || !newUser.name || !newUser.email || !newUser.password || (newUserEmail.sendEmail && (!newUserEmail.subject || !newUserEmail.content))}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    {newUserEmail.sendEmail ? (
                      <>
                        <Mail className="h-4 w-4" />
                        Create and Send Logins
                      </>
                    ) : (
                      'Create User'
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
                <button
                  onClick={() => {
                    setShowEditUser(false);
                    setSelectedUser(null);
                    setEditUserData({
                      name: '',
                      email: '',
                      role: 'Agent',
                      status: 'Active',
                      newPassword: '',
                      sendPasswordEmail: false,
                      threeCxExtension: ''
                    });
                    setEditUserEmail({
                      sendEmail: false,
                      subject: 'Your CRM Account Has Been Updated',
                      content: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editUserData.name}
                  onChange={(e) => setEditUserData({...editUserData, name: e.target.value})}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  className="input-field"
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({...editUserData, email: e.target.value})}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    className="input-field"
                  value={editUserData.role}
                  onChange={(e) => setEditUserData({...editUserData, role: e.target.value as 'Admin' | 'Manager' | 'Agent'})}
                  >
                  <option value="Agent">Agent</option>
                  {currentUser?.role === 'Manager' && <option value="Manager">Manager</option>}
                  <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                    className="input-field"
                  value={editUserData.status}
                  onChange={(e) => setEditUserData({...editUserData, status: e.target.value as 'Active' | 'Inactive'})}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">3CX Extension</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field"
                  value={editUserData.threeCxExtension}
                  onChange={(e) => setEditUserData({ ...editUserData, threeCxExtension: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="e.g. 104"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to clear this user's 3CX extension mapping.</p>
              </div>

                {/* Password Change Section */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Change Password (Optional)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field pr-10"
                      value={editUserData.newPassword}
                      onChange={(e) => setEditUserData({...editUserData, newPassword: e.target.value})}
                      placeholder="Enter new password (leave blank to keep current)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters. Leave blank to keep current password.</p>
                  
                  {editUserData.newPassword && editUserData.newPassword.trim() && (
                    <div className="mt-3 flex items-center">
                      <input
                        type="checkbox"
                        id="sendPasswordEmail"
                        checked={editUserData.sendPasswordEmail}
                        onChange={(e) => {
                          setEditUserData({...editUserData, sendPasswordEmail: e.target.checked});
                          if (e.target.checked) {
                            setEditUserEmail({
                              ...editUserEmail,
                              sendEmail: true,
                              content: editUserEmail.content || getDefaultEmailContent(editUserData.name, editUserData.email, editUserData.newPassword, false)
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-[#011E41] focus:ring-[#011E41]"
                      />
                      <label htmlFor="sendPasswordEmail" className="ml-2 text-sm text-gray-700">
                        Send updated password via email
                      </label>
                    </div>
                  )}
                </div>

                {/* Email Section */}
                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Send Notification Email
                    </label>
                    <input
                      type="checkbox"
                      checked={editUserEmail.sendEmail}
                      onChange={(e) => {
                        setEditUserEmail({
                          ...editUserEmail,
                          sendEmail: e.target.checked,
                          content: e.target.checked && !editUserEmail.content
                            ? (editUserData.newPassword && editUserData.sendPasswordEmail
                              ? getDefaultEmailContent(editUserData.name, editUserData.email, editUserData.newPassword, false)
                              : `Dear ${editUserData.name},\n\nYour CRM account has been updated.\n\nPlease contact support if you have any questions.\n\nBest regards,\nMillennium Legal CRM Team`)
                            : editUserEmail.content
                        });
                      }}
                      className="rounded border-gray-300 text-[#011E41] focus:ring-[#011E41]"
                    />
                  </div>

                  {editUserEmail.sendEmail && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject *</label>
                        <input
                          type="text"
                          className="input-field"
                          value={editUserEmail.subject}
                          onChange={(e) => setEditUserEmail({...editUserEmail, subject: e.target.value})}
                          placeholder="Enter email subject"
                          required={editUserEmail.sendEmail}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Content *</label>
                        <textarea
                          className="input-field"
                          rows={8}
                          value={editUserEmail.content}
                          onChange={(e) => setEditUserEmail({...editUserEmail, content: e.target.value})}
                          placeholder="Enter email content"
                          required={editUserEmail.sendEmail}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editUserData.newPassword && editUserData.sendPasswordEmail
                            ? 'Password will be included in the email. You can customize the message.'
                            : 'Customize the email message to notify the user about account updates.'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button 
                  className="btn-secondary"
                onClick={() => {
                  setShowEditUser(false);
                  setSelectedUser(null);
                  setEditUserData({
                    name: '',
                    email: '',
                    role: 'Agent',
                    status: 'Active',
                    newPassword: '',
                    sendPasswordEmail: false,
                    threeCxExtension: ''
                  });
                  setEditUserEmail({
                    sendEmail: false,
                    subject: 'Your CRM Account Has Been Updated',
                    content: ''
                  });
                }}
                disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary flex items-center gap-2"
                onClick={handleSaveEditUser}
                disabled={isSaving || !editUserData.name || !editUserData.email || (editUserData.newPassword && editUserData.newPassword.length < 6) || (editUserEmail.sendEmail && (!editUserEmail.subject || !editUserEmail.content))}
                >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {editUserEmail.sendEmail ? (
                      <>
                        <Mail className="h-4 w-4" />
                        Update and Send
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </>
                )}
                </button>
              </div>
            </div>
          </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteUser && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
                <button
                  onClick={() => {
                    setShowDeleteUser(false);
                    setSelectedUser(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
                  <p className="text-sm text-gray-500 mt-1">This action cannot be undone</p>
                </div>
              </div>
              <div className="p-4 rounded-lg mb-6 bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-800 leading-relaxed">
                  Are you sure you want to delete user <strong>{selectedUser.name}</strong> ({selectedUser.email})?
                  This will permanently remove their account and all associated data.
                </p>
                {selectedUser.role === 'Admin' && (
                  <p className="text-sm text-red-600 mt-2 font-medium">
                    ⚠️ Warning: This is an Admin user. Ensure there are other admins before proceeding.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteUser(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteUser}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Deleting...
                    </>
                  ) : (
                    'Delete User'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
