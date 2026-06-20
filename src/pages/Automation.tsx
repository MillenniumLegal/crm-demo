import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Zap, ChevronRight, AlertCircle } from 'lucide-react';
import { 
  fetchAutomations, 
  createAutomation, 
  updateAutomation, 
  deleteAutomation,
  Automation,
  AutomationStep 
} from '@/services/automationService';
import { fetchTemplates } from '@/services/templatesService';
import { fetchUsers } from '@/services/usersService';
import { fetchSolicitorFirms } from '@/services/automationService';

export const AutomationPage: React.FC = () => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [solicitorFirms, setSolicitorFirms] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    triggerType: 'new_lead' as Automation['triggerType'],
    triggerConditions: {} as Record<string, any>,
    steps: [] as AutomationStep[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [automationsData, templatesData, usersData, solicitorFirmsData] = await Promise.all([
        fetchAutomations(),
        fetchTemplates(),
        fetchUsers(),
        fetchSolicitorFirms(),
      ]);
      setAutomations(automationsData);
      setTemplates(templatesData);
      setUsers(usersData);
      setSolicitorFirms(solicitorFirmsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingAutomation(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
      triggerType: 'new_lead',
      triggerConditions: {},
      steps: [],
    });
    setShowModal(true);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setFormData({
      name: automation.name,
      description: automation.description || '',
      isActive: automation.isActive,
      triggerType: automation.triggerType,
      triggerConditions: automation.triggerConditions,
      steps: automation.steps,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    
    const success = await deleteAutomation(id);
    if (success) {
      await loadData();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a name for the automation');
      return;
    }

    if (formData.steps.length === 0) {
      alert('Please add at least one step to the automation');
      return;
    }

    try {
      if (editingAutomation) {
        await updateAutomation(editingAutomation.id, formData);
      } else {
        await createAutomation(formData);
      }
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving automation:', error);
      alert('Failed to save automation');
    }
  };

  const addStep = (stepType: AutomationStep['type']) => {
    const newStep: AutomationStep = {
      type: stepType,
      config: getDefaultStepConfig(stepType),
      order: formData.steps.length + 1,
    };
    setFormData({
      ...formData,
      steps: [...formData.steps, newStep],
    });
  };

  const removeStep = (index: number) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Reorder steps
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    setFormData({
      ...formData,
      steps: newSteps,
    });
  };

  const updateStep = (index: number, updates: Partial<AutomationStep>) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setFormData({
      ...formData,
      steps: newSteps,
    });
  };

  const getDefaultStepConfig = (stepType: AutomationStep['type']): Record<string, any> => {
    switch (stepType) {
      case 'send_template':
        return { templateId: '', type: 'SMS' };
      case 'send_sms':
        return { templateId: '' };
      case 'send_email':
        return { templateId: '' };
      case 'send_quote_email':
        return {}; // No config needed - automatically uses latest quote for the lead
      case 'send_quote_sms':
        return {}; // No config needed - automatically uses latest quote for the lead
      case 'instruct_solicitor':
        return { solicitorFirmId: '', updateStage: true, notes: '' };
      case 'assign_agent':
        return { agentId: '' };
      case 'update_stage':
        return { stage: 'New' };
      case 'update_status':
        return { status: 'Assigned' };
      case 'create_task':
        return { title: '', description: '', dueDate: '' };
      case 'wait':
        return { duration: 0, unit: 'minutes' };
      case 'condition':
        return { field: 'email', operator: 'exists', value: '', thenSteps: [], elseSteps: [] };
      default:
        return {};
    }
  };

  const getStepLabel = (stepType: AutomationStep['type']): string => {
    const labels: Record<AutomationStep['type'], string> = {
      send_template: 'Send Template',
      send_sms: 'Send SMS',
      send_email: 'Send Email',
      send_quote_email: 'Send Quote Email',
      send_quote_sms: 'Send Quote SMS',
      assign_agent: 'Assign Agent',
      update_stage: 'Update Stage',
      update_status: 'Update Status',
      create_task: 'Create Task',
      instruct_solicitor: 'Instruct Solicitor',
      wait: 'Wait',
      condition: 'Condition',
    };
    return labels[stepType] || stepType;
  };

  const getTriggerLabel = (triggerType: Automation['triggerType']): string => {
    const labels: Record<Automation['triggerType'], string> = {
      new_lead: 'New Lead Created',
      new_quote: 'New Quote Created',
      lead_assigned: 'Lead Assigned',
      lead_stage_changed: 'Lead Stage Changed',
      outcome_code_selected: 'Outcome Code Selected',
      payment_received: 'Payment Received',
      quote_accepted: 'Quote Accepted',
      quote_sent: 'Quote Sent',
      task_completed: 'Task Completed',
      custom: 'Custom Trigger',
    };
    return labels[triggerType] || triggerType;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation</h1>
          <p className="text-gray-600">Create and manage automated workflows</p>
        </div>
        <button onClick={handleCreateNew} className="btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>New Automation</span>
        </button>
      </div>

      {/* Automations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {automations.map((automation) => (
          <div key={automation.id} className="card">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <Zap className={`h-5 w-5 ${automation.isActive ? 'text-yellow-500' : 'text-gray-400'}`} />
                <h3 className="font-semibold text-gray-900">{automation.name}</h3>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleEdit(automation)}
                  className="p-1 text-gray-600 hover:text-blue-600"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(automation.id)}
                  className="p-1 text-gray-600 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {automation.description && (
              <p className="text-sm text-gray-600 mb-3">{automation.description}</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Trigger:</span>
                <span className="font-medium">{getTriggerLabel(automation.triggerType)}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Steps:</span>
                <span className="font-medium">{automation.steps.length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  automation.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {automation.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {automations.length === 0 && (
          <div className="col-span-full card text-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No automations yet. Create your first automation to get started.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAutomation ? 'Edit Automation' : 'Create Automation'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Welcome New Lead"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows={2}
                    placeholder="Describe what this automation does..."
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trigger *
                    </label>
                    <select
                      value={formData.triggerType}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        triggerType: e.target.value as Automation['triggerType'],
                        triggerConditions: {},
                      })}
                      className="input-field"
                    >
                      <option value="new_lead">New Lead Created</option>
                      <option value="new_quote">New Quote Created</option>
                      <option value="lead_assigned">Lead Assigned</option>
                      <option value="lead_stage_changed">Lead Stage Changed</option>
                      <option value="outcome_code_selected">Outcome Code Selected</option>
                      <option value="payment_received">Payment Received</option>
                      <option value="quote_accepted">Quote Accepted</option>
                      <option value="quote_sent">Quote Sent</option>
                      <option value="task_completed">Task Completed</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2 mt-6">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                      Active
                    </label>
                  </div>
                </div>

                {/* Trigger Conditions */}
                {(formData.triggerType === 'new_lead' || formData.triggerType === 'new_quote') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Only for Source
                    </label>
                    <select
                      value={formData.triggerConditions.source || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        triggerConditions: { ...formData.triggerConditions, source: e.target.value || undefined },
                      })}
                      className="input-field"
                    >
                      <option value="">All Sources</option>
                      <option value="Hoowla">Hoowla</option>
                      <option value="Comparison Site">Comparison Site</option>
                      <option value="Direct">Direct</option>
                      <option value="Referral">Referral</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Steps */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Steps</h3>
                  <div className="flex space-x-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addStep(e.target.value as AutomationStep['type']);
                          e.target.value = '';
                        }
                      }}
                      className="input-field text-sm"
                    >
                      <option value="">Add Step...</option>
                      <option value="send_sms">Send SMS</option>
                      <option value="send_email">Send Email</option>
                      <option value="send_quote_email">Send Quote Email</option>
                      <option value="send_quote_sms">Send Quote SMS</option>
                      <option value="assign_agent">Assign Agent</option>
                      <option value="update_stage">Update Stage</option>
                      <option value="update_status">Update Status</option>
                      <option value="create_task">Create Task</option>
                      <option value="instruct_solicitor">Instruct Solicitor</option>
                      <option value="wait">Wait</option>
                      <option value="condition">Condition</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500">Step {step.order}</span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{getStepLabel(step.type)}</span>
                        </div>
                        <button
                          onClick={() => removeStep(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Step Configuration */}
                      {step.type === 'send_sms' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select SMS Template *
                          </label>
                          <select
                            value={step.config.templateId || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, templateId: e.target.value },
                            })}
                            className="input-field text-sm"
                            required
                          >
                            <option value="">Select SMS Template</option>
                            {templates
                              .filter(t => t.type === 'SMS')
                              .map(template => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                          </select>
                          {templates.filter(t => t.type === 'SMS').length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">No SMS templates available. Create one in Settings.</p>
                          )}
                        </div>
                      )}

                      {step.type === 'send_email' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Email Template *
                          </label>
                          <select
                            value={step.config.templateId || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, templateId: e.target.value },
                            })}
                            className="input-field text-sm"
                            required
                          >
                            <option value="">Select Email Template</option>
                            {templates
                              .filter(t => t.type === 'Email')
                              .map(template => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                          </select>
                          {templates.filter(t => t.type === 'Email').length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">No Email templates available. Create one in Settings.</p>
                          )}
                        </div>
                      )}

                      {step.type === 'send_quote_email' && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-900">
                            <strong>Automatically sends the quote email</strong> to the lead using the latest quote associated with the lead.
                          </p>
                          <p className="text-xs text-blue-700 mt-2">
                            The email will include the professional quote template with PDF attachment. Contact history will be automatically logged.
                          </p>
                          <p className="text-xs text-blue-600 mt-1 italic">
                            Note: This step requires the lead to have a quote. If no quote exists, the step will be skipped.
                          </p>
                        </div>
                      )}

                      {step.type === 'send_quote_sms' && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-sm text-green-900">
                            <strong>Automatically sends the quote SMS</strong> to the lead using the latest quote associated with the lead.
                          </p>
                          <p className="text-xs text-green-700 mt-2">
                            The SMS will include a personalized message thanking them for requesting a quote and providing contact information. Contact history will be automatically logged.
                          </p>
                          <p className="text-xs text-green-600 mt-1 italic">
                            Note: This step requires the lead to have a quote and a phone number. If no quote exists or phone is missing, the step will be skipped.
                          </p>
                        </div>
                      )}

                      {step.type === 'send_template' && (
                        <div className="space-y-2">
                          <select
                            value={step.config.templateId || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, templateId: e.target.value },
                            })}
                            className="input-field text-sm"
                          >
                            <option value="">Select Template</option>
                            {templates
                              .filter(t => t.type === (step.config.type || 'SMS'))
                              .map(template => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                          </select>
                          <select
                            value={step.config.type || 'SMS'}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, type: e.target.value, templateId: '' },
                            })}
                            className="input-field text-sm"
                          >
                            <option value="SMS">SMS</option>
                            <option value="Email">Email</option>
                          </select>
                        </div>
                      )}

                      {step.type === 'assign_agent' && (
                        <select
                          value={step.config.agentId || ''}
                          onChange={(e) => updateStep(index, {
                            config: { ...step.config, agentId: e.target.value },
                          })}
                          className="input-field text-sm"
                        >
                          <option value="">Select Agent</option>
                          {users
                            .filter(u => u.role === 'Agent' && u.status === 'Active')
                            .map(user => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                        </select>
                      )}

                      {step.type === 'update_stage' && (
                        <select
                          value={step.config.stage || 'New'}
                          onChange={(e) => updateStep(index, {
                            config: { ...step.config, stage: e.target.value },
                          })}
                          className="input-field text-sm"
                        >
                          <option value="New">New</option>
                          <option value="Call-1">Call-1</option>
                          <option value="Call-2">Call-2</option>
                          <option value="Call-3">Call-3</option>
                          <option value="Call-4">Call-4</option>
                          <option value="Call-5">Call-5</option>
                          <option value="Interested">Interested</option>
                          <option value="Ready to Solicit">Ready to Solicit</option>
                          <option value="Quote Accepted - Awaiting Payment">Quote Accepted - Awaiting Payment</option>
                          <option value="Payment Completed - Awaiting Client Information">
                            Payment Completed - Awaiting client information
                          </option>
                          <option value="Completed">Completed</option>
                        </select>
                      )}

                      {step.type === 'update_status' && (
                        <select
                          value={step.config.status || 'Assigned'}
                          onChange={(e) => updateStep(index, {
                            config: { ...step.config, status: e.target.value },
                          })}
                          className="input-field text-sm"
                        >
                          <option value="New">New</option>
                          <option value="Assigned">Assigned</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Interested">Interested</option>
                          <option value="Quote Sent">Quote Sent</option>
                          <option value="Sold">Sold</option>
                          <option value="Closed">Closed</option>
                        </select>
                      )}

                      {step.type === 'create_task' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={step.config.title || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, title: e.target.value },
                            })}
                            className="input-field text-sm"
                            placeholder="Task Title"
                          />
                          <textarea
                            value={step.config.description || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, description: e.target.value },
                            })}
                            className="input-field text-sm"
                            rows={2}
                            placeholder="Task Description"
                          />
                        </div>
                      )}

                      {step.type === 'instruct_solicitor' && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Solicitor Firm *
                          </label>
                          <select
                            value={step.config.solicitorFirmId || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, solicitorFirmId: e.target.value },
                            })}
                            className="input-field text-sm"
                            required
                          >
                            <option value="">Select Solicitor Firm</option>
                            {solicitorFirms.map(firm => (
                              <option key={firm.id} value={firm.id}>
                                {firm.name}
                              </option>
                            ))}
                          </select>
                          {solicitorFirms.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">No solicitor firms available. Add them in Solicitor Firms page.</p>
                          )}
                          <div className="flex items-center space-x-2 mt-2">
                            <input
                              type="checkbox"
                              id={`updateStage-${index}`}
                              checked={step.config.updateStage !== false}
                              onChange={(e) => updateStep(index, {
                                config: { ...step.config, updateStage: e.target.checked },
                              })}
                              className="h-4 w-4 text-navy-600 focus:ring-navy-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`updateStage-${index}`} className="text-sm text-gray-700">
                              Update lead stage to "Payment Completed - Awaiting client information"
                            </label>
                          </div>
                          <textarea
                            value={step.config.notes || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, notes: e.target.value },
                            })}
                            className="input-field text-sm"
                            rows={2}
                            placeholder="Additional notes for solicitor instruction (optional)"
                          />
                        </div>
                      )}

                      {step.type === 'condition' && (
                        <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-sm font-semibold text-blue-900 mb-2">Condition: If...</div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
                              <select
                                value={step.config.field || 'email'}
                                onChange={(e) => updateStep(index, {
                                  config: { ...step.config, field: e.target.value, value: '' },
                                })}
                                className="input-field text-sm"
                              >
                                <optgroup label="Contact Info">
                                  <option value="email">Email</option>
                                  <option value="phone">Phone</option>
                                  <option value="name">Name</option>
                                </optgroup>
                                <optgroup label="Lead Status">
                                  <option value="status">Status</option>
                                  <option value="stage">Stage</option>
                                  <option value="source">Source</option>
                                  <option value="assignedTo">Assigned To</option>
                                </optgroup>
                                <optgroup label="Transaction">
                                  <option value="transactionType">Transaction Type</option>
                                  <option value="propertyValue">Property Value</option>
                                </optgroup>
                                <optgroup label="Quote">
                                  <option value="hasQuote">Has Quote</option>
                                  <option value="quoteStatus">Quote Status</option>
                                  <option value="quoteAmount">Quote Amount</option>
                                </optgroup>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Operator</label>
                              <select
                                value={step.config.operator || 'exists'}
                                onChange={(e) => updateStep(index, {
                                  config: { ...step.config, operator: e.target.value },
                                })}
                                className="input-field text-sm"
                              >
                                {['email', 'phone', 'name'].includes(step.config.field) ? (
                                  <>
                                    <option value="exists">Exists (not empty)</option>
                                    <option value="not_exists">Does Not Exist (empty)</option>
                                    <option value="equals">Equals</option>
                                    <option value="contains">Contains</option>
                                    <option value="starts_with">Starts With</option>
                                    <option value="ends_with">Ends With</option>
                                    <option value="matches">Matches Pattern</option>
                                  </>
                                ) : ['status', 'stage', 'source', 'transactionType', 'quoteStatus'].includes(step.config.field) ? (
                                  <>
                                    <option value="equals">Equals</option>
                                    <option value="not_equals">Not Equals</option>
                                    <option value="in">In List</option>
                                    <option value="not_in">Not In List</option>
                                  </>
                                ) : ['propertyValue', 'quoteAmount'].includes(step.config.field) ? (
                                  <>
                                    <option value="equals">Equals</option>
                                    <option value="greater_than">Greater Than</option>
                                    <option value="less_than">Less Than</option>
                                    <option value="greater_or_equal">Greater or Equal</option>
                                    <option value="less_or_equal">Less or Equal</option>
                                  </>
                                ) : ['hasQuote', 'assignedTo'].includes(step.config.field) ? (
                                  <>
                                    <option value="exists">Exists (Yes)</option>
                                    <option value="not_exists">Does Not Exist (No)</option>
                                    <option value="equals">Equals</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="exists">Exists</option>
                                    <option value="equals">Equals</option>
                                    <option value="not_equals">Not Equals</option>
                                  </>
                                )}
                              </select>
                            </div>

                            {!['exists', 'not_exists'].includes(step.config.operator) && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                                <input
                                  type="text"
                                  value={step.config.value || ''}
                                  onChange={(e) => updateStep(index, {
                                    config: { ...step.config, value: e.target.value },
                                  })}
                                  className="input-field text-sm"
                                  placeholder={
                                    step.config.operator === 'in' || step.config.operator === 'not_in'
                                      ? 'Comma-separated values'
                                      : step.config.operator === 'matches'
                                      ? 'Regex pattern'
                                      : 'Enter value'
                                  }
                                />
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <p className="text-xs text-blue-700 mb-2">
                              <strong>Note:</strong> If condition is true, continue to next step. If false, skip to next step after this condition block.
                            </p>
                          </div>
                        </div>
                      )}

                      {step.type === 'wait' && (
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={step.config.duration || 0}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, duration: parseInt(e.target.value) || 0 },
                            })}
                            className="input-field text-sm"
                            placeholder="Duration"
                          />
                          <select
                            value={step.config.unit || 'minutes'}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, unit: e.target.value },
                            })}
                            className="input-field text-sm"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}

                  {formData.steps.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>No steps added yet. Add steps to define what this automation will do.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Automation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

