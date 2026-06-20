import { supabase } from '@/lib/supabase';
import { DiaryTask } from '@/types';
import { logActivity } from './activityService';

const emitTasksUpdated = (detail: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tasks:updated', { detail }));
  }
};

// Transform database task to frontend DiaryTask interface
function transformTask(dbTask: any): DiaryTask {
  // Handle leads relation - might be an object (from join) or null
  let leadName = '';
  let leadStatus = '';
  let leadStage = '';
  
  // Try different possible formats for the joined leads data
  if (dbTask.leads && typeof dbTask.leads === 'object') {
    // If leads is an array (one-to-many), take the first one
    if (Array.isArray(dbTask.leads) && dbTask.leads.length > 0) {
      leadName = dbTask.leads[0].name || '';
      leadStatus = dbTask.leads[0].status || '';
      leadStage = dbTask.leads[0].stage || '';
    } else if (dbTask.leads.name) {
      // Single object
      leadName = dbTask.leads.name || '';
      leadStatus = dbTask.leads.status || '';
      leadStage = dbTask.leads.stage || '';
    }
  }
  
  // Fallback: check for old format (lead_name as separate field)
  if (!leadName && dbTask.lead_name) {
    if (typeof dbTask.lead_name === 'object' && dbTask.lead_name !== null) {
      leadName = dbTask.lead_name.name || '';
    } else if (typeof dbTask.lead_name === 'string') {
      leadName = dbTask.lead_name;
    }
  }
  
  // Debug: Log if we're missing lead stage data (only for tasks that are not just created)
  const taskCreatedRecently = dbTask.created_at && 
    (new Date().getTime() - new Date(dbTask.created_at).getTime()) < 5000;
  
  if (!leadStage && dbTask.lead_id && !taskCreatedRecently) {
    console.warn('⚠️ Task missing lead stage data:', {
      taskId: dbTask.id,
      leadId: dbTask.lead_id,
      leadsData: dbTask.leads,
      leadName: leadName
    });
  }

  const normalizeDate = (value?: string | null) => {
    if (!value) return '';
    if (value.length >= 10 && value.includes('T')) {
      return value.split('T')[0];
    }
    return value;
  };

  const normalizeTime = (value?: string | null) => {
    if (!value) return '';
    if (value.length >= 5) {
      return value.slice(0, 5);
    }
    return value;
  };

  return {
    id: dbTask.id,
    leadId: dbTask.lead_id,
    leadName: leadName,
    assignedTo: dbTask.assigned_to,
    taskType: dbTask.task_type || 'Call',
    title: dbTask.title,
    description: dbTask.description,
    dueDate: normalizeDate(dbTask.due_date),
    dueTime: normalizeTime(dbTask.due_time),
    priority: dbTask.priority || 'Medium',
    status: dbTask.status || 'Pending',
    completedAt: dbTask.completed_at,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
    leadStatus: leadStatus,
    leadStage: leadStage,
  };
}

// Fetch tasks with optional filters
export async function fetchTasks(filters?: {
  assignedTo?: string;
  dueDate?: string;
  status?: string;
  userId?: string;
  leadIds?: string[];
  today?: boolean;
  overdue?: boolean;
  completed?: boolean;
  completedToday?: boolean;
  upcoming?: boolean;
  limit?: number; // Optional cap to reduce DB load (e.g. for FloatingTaskBox)
}): Promise<DiaryTask[]> {
  try {
    let query = supabase
      .from('diary_tasks')
      .select(`
        *,
        leads:leads!diary_tasks_lead_id_fkey(name, status, stage)
      `);

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters?.userId) {
      query = query.eq('assigned_to', filters.userId);
    }

    if (filters?.leadIds) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validLeadIds = Array.from(new Set(filters.leadIds.filter(id => id && uuidRegex.test(id))));
      if (validLeadIds.length === 0) {
        return [];
      }
      query = query.in('lead_id', validLeadIds);
    }

    if (filters?.dueDate) {
      query = query.eq('due_date', filters.dueDate);
    }

    if (filters?.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }

    if (filters?.today) {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('due_date', today);
    }

    if (filters?.overdue) {
      const today = new Date().toISOString().split('T')[0];
      query = query.lt('due_date', today).eq('status', 'Pending');
    }

    if (filters?.upcoming) {
      const today = new Date().toISOString().split('T')[0];
      query = query.gt('due_date', today).in('status', ['Pending', 'In Progress']);
    }

    if (filters?.completed) {
      query = query.eq('status', 'Completed');
    }

    if (filters?.completedToday) {
      const today = new Date().toISOString().split('T')[0];
      query = query
        .eq('status', 'Completed')
        .gte('completed_at', `${today}T00:00:00.000Z`)
        .lt('completed_at', `${today}T23:59:59.999Z`);
    }

    if (filters?.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query.order('due_date', { ascending: true }).order('due_time', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    const transformedTasks = (data || []).map(transformTask);
    
    const allLeadIds = [...new Set(transformedTasks.filter(t => t.leadId).map(t => t.leadId))];
    if (allLeadIds.length > 0) {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('id, name, status, stage')
        .in('id', allLeadIds);
      
      if (!leadError && leadData) {
        const leadMap = new Map(leadData.map(l => [l.id, l]));
        transformedTasks.forEach(task => {
          if (task.leadId) {
            const lead = leadMap.get(task.leadId);
            if (lead) {
              task.leadStage = lead.stage || '';
              task.leadStatus = lead.status || '';
              if (lead.name) {
                task.leadName = lead.name;
              }
            }
          }
        });
      }
    }

    return transformedTasks;
  } catch (error) {
    console.error('Error in fetchTasks:', error);
    return [];
  }
}

// Fetch a single task by ID
export async function fetchTaskById(id: string): Promise<DiaryTask | null> {
  try {
    const { data, error } = await supabase
      .from('diary_tasks')
      .select(`
        *,
        lead_name:leads!diary_tasks_lead_id_fkey(name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error fetching task:', error);
      return null;
    }

    return transformTask(data);
  } catch (error) {
    console.error('Error in fetchTaskById:', error);
    return null;
  }
}

// Create a new task
export async function createTask(taskData: Partial<DiaryTask>): Promise<DiaryTask | null> {
  try {
    const dbData: any = {
      lead_id: taskData.leadId,
      assigned_to: taskData.assignedTo,
      task_type: taskData.taskType || 'Call',
      title: taskData.title,
      description: taskData.description,
      due_date: taskData.dueDate,
      due_time: taskData.dueTime,
      priority: taskData.priority || 'Medium',
      status: taskData.status || 'Pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('diary_tasks')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    const transformed = transformTask(data);
    emitTasksUpdated({ type: 'created', task: transformed });
    return transformed;
  } catch (error) {
    console.error('Error in createTask:', error);
    return null;
  }
}

// Update a task
export async function updateTask(id: string, updates: Partial<DiaryTask>): Promise<DiaryTask | null> {
  try {
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.dueTime !== undefined) dbUpdates.due_time = updates.dueTime;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;
    if (updates.taskType !== undefined) dbUpdates.task_type = updates.taskType;

    if (updates.status === 'Completed' && !updates.completedAt) {
      dbUpdates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('diary_tasks')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    const transformed = transformTask(data);
    emitTasksUpdated({ type: 'updated', task: transformed });
    return transformed;
  } catch (error) {
    console.error('Error in updateTask:', error);
    return null;
  }
}

// Complete a task
export async function completeTask(id: string, userId?: string, userName?: string): Promise<boolean> {
  try {
    const task = await fetchTaskById(id);
    
    const { error } = await supabase
      .from('diary_tasks')
      .update({
        status: 'Completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error completing task:', error);
      throw error;
    }

    if (task) {
      await logActivity({
        activityType: 'task_completed',
        entityType: 'task',
        entityId: id,
        leadId: task.leadId,
        leadName: task.leadName,
        actionDescription: `Task completed: ${task.title}`,
        doneByType: userId ? 'user' : 'system',
        doneById: userId,
        doneByName: userName || 'System',
      });
    }

    emitTasksUpdated({ type: 'completed', taskId: id });
    return true;
  } catch (error) {
    console.error('Error in completeTask:', error);
    return false;
  }
}

// Delete a task
export async function deleteTask(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('diary_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }

    emitTasksUpdated({ type: 'deleted', taskId: id });
    return true;
  } catch (error) {
    console.error('Error in deleteTask:', error);
    return false;
  }
}

export async function autoCompletePreviousStageTasks(
  leadId: string,
  newStage: string,
  userId?: string,
  userName?: string
): Promise<number> {
  try {
    const stageOrder = [
      'New',
      'Call-1',
      'Call-2',
      'Call-3',
      'Call-4',
      'Call-5',
      'Interested',
      'Ready to Solicit',
      'Quote Accepted - Awaiting Payment',
      'Payment Completed - Awaiting Client Information',
      'Completed',
      'Sold',
      'Closed'
    ];

    const newStageIndex = stageOrder.indexOf(newStage);
    if (newStageIndex === -1) {
      console.warn(`Unknown stage: ${newStage}, skipping auto-completion`);
      return 0;
    }

    const previousStages = stageOrder.slice(0, newStageIndex);
    if (previousStages.length === 0) {
      return 0;
    }

    const { data: tasks, error: fetchError } = await supabase
      .from('diary_tasks')
      .select('id, title, task_type, status')
      .eq('lead_id', leadId)
      .eq('status', 'Pending');

    if (fetchError || !tasks || tasks.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('diary_tasks')
      .update({
        status: 'Completed',
        completed_at: now,
        updated_at: now
      })
      .eq('lead_id', leadId)
      .eq('status', 'Pending');

    if (updateError) {
      console.error('Error auto-completing tasks:', updateError);
      return 0;
    }

    await logActivity({
      activityType: 'note_added',
      entityType: 'lead',
      entityId: leadId,
      leadId: leadId,
      actionDescription: `Auto-completed ${tasks.length} previous stage task(s) as lead progressed to ${newStage}`,
      doneByType: userId ? 'user' : 'system',
      doneById: userId,
      doneByName: userName || 'System',
    });

    return tasks.length;
  } catch (error) {
    console.error('Error in autoCompletePreviousStageTasks:', error);
    return 0;
  }
}

export async function completeAllPendingTasksForLead(
  leadId: string,
  reason?: string,
  userId?: string,
  userName?: string
): Promise<number> {
  try {
    const { data: tasks, error: fetchError } = await supabase
      .from('diary_tasks')
      .select('id, title, status')
      .eq('lead_id', leadId)
      .in('status', ['Pending', 'In Progress']);

    if (fetchError || !tasks || tasks.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('diary_tasks')
      .update({ status: 'Completed', completed_at: now, updated_at: now })
      .eq('lead_id', leadId)
      .in('status', ['Pending', 'In Progress']);

    if (updateError) {
      console.error('Error completing tasks for closed lead:', updateError);
      return 0;
    }

    await logActivity({
      activityType: 'note_added',
      entityType: 'lead',
      entityId: leadId,
      leadId,
      actionDescription: `Automatically completed ${tasks.length} task(s) because the lead was ${reason || 'closed'}.`,
      doneByType: userId ? 'user' : 'system',
      doneById: userId,
      doneByName: userName || 'System',
    });

    return tasks.length;
  } catch (error) {
    console.error('Error in completeAllPendingTasksForLead:', error);
    return 0;
  }
}


