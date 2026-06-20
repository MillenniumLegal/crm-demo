import { supabase } from '@/lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent';
  status: 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
  daily_quota?: number;
  weekly_quota?: number;
}

/**
 * Fetch all users from Supabase
 */
export async function fetchUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    return (data || []).map(user => ({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'Agent',
      status: (user.status || 'Active') as 'Active' | 'Inactive',
      created_at: user.created_at,
      updated_at: user.updated_at,
      daily_quota: user.daily_quota,
      weekly_quota: user.weekly_quota
    }));
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    return [];
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize email (trim and lowercase)
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create a new user (sign up) - requires password
 */
export async function createUser(userData: {
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'Manager' | 'Agent';
  dailyQuota?: number;
  weeklyQuota?: number;
}): Promise<{ user: User | null; error: string | null }> {
  try {
    // Normalize and validate email
    const normalizedEmail = normalizeEmail(userData.email);
    
    if (!isValidEmail(normalizedEmail)) {
      return { user: null, error: 'Please enter a valid email address' };
    }

    // Check if user already exists in public.users
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    if (existingUserByEmail) {
      return { user: null, error: 'User with this email already exists' };
    }

    // Validate password
    if (!userData.password || userData.password.length < 6) {
      return { user: null, error: 'Password must be at least 6 characters long' };
    }

    // First, create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: userData.password,
      options: {
        data: {
          name: userData.name.trim(),
          role: userData.role
        },
        emailRedirectTo: 'https://www.apcmcrm.co.uk/'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      
      // Provide more user-friendly error messages
      let errorMessage = authError.message;
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        errorMessage = 'A user with this email already exists. Please use a different email or invite them instead.';
      } else if (authError.message?.includes('invalid')) {
        errorMessage = 'Invalid email address. Please check the email format and try again.';
      } else if (authError.message?.includes('password')) {
        errorMessage = 'Password does not meet requirements. Please use a stronger password.';
      }
      
      return { user: null, error: errorMessage };
    }

    if (!authData.user) {
      return { user: null, error: 'Failed to create user' };
    }

    // Wait a moment for the trigger to potentially create the user record
    await new Promise(resolve => setTimeout(resolve, 1500));

    // First, check if user already exists (created by trigger)
    let { data: existingUserRecord, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    const updateData: any = {
      name: userData.name.trim(),
      email: normalizedEmail,
      role: userData.role,
      status: 'Active',
      updated_at: new Date().toISOString()
    };
    
    // Add daily_quota only if provided (typically for Agent role)
    if (userData.dailyQuota !== undefined && userData.dailyQuota !== null) {
      updateData.daily_quota = userData.dailyQuota;
    }
    if (userData.weeklyQuota !== undefined && userData.weeklyQuota !== null) {
      updateData.weekly_quota = userData.weeklyQuota;
    }

    let userData_result;
    let userError;

    if (!fetchError && existingUserRecord) {
      // User exists (created by trigger), update it
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', authData.user.id)
        .select()
        .single();
      
      userData_result = updatedUser;
      userError = updateError;
    } else {
      // User doesn't exist, try to insert
      // But first, ensure we're not setting any foreign key fields that might cause issues
      const insertData: any = {
        id: authData.user.id,
        name: userData.name.trim(),
        email: normalizedEmail,
        role: userData.role,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Only add daily_quota if provided
    if (userData.dailyQuota !== undefined && userData.dailyQuota !== null) {
      insertData.daily_quota = userData.dailyQuota;
    }
    if (userData.weeklyQuota !== undefined && userData.weeklyQuota !== null) {
      insertData.weekly_quota = userData.weeklyQuota;
    }
    
      // Try insert with upsert to handle race conditions
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .upsert(insertData, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();
      
      userData_result = insertedUser;
      userError = insertError;

      // If insert failed with foreign key error, wait and try to fetch again
      if (userError && (userError.code === '23503' || userError.message?.includes('foreign key'))) {
        // Wait a bit more for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to fetch the user that might have been created by trigger
        const { data: retryUser, error: retryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        
        if (!retryError && retryUser) {
          // User exists now, update it
          const { data: finalUser, error: finalError } = await supabase
      .from('users')
            .update(updateData)
            .eq('id', authData.user.id)
      .select()
      .single();
          
          if (!finalError && finalUser) {
            userData_result = finalUser;
            userError = null;
          }
        }
      }
    }

    if (userError) {
      console.error('Error creating user record:', userError);
      return { user: null, error: userError.message || 'Failed to create user record' };
    }

    return {
      user: {
        id: userData_result.id,
        name: userData_result.name,
        email: userData_result.email,
        role: userData_result.role,
        status: userData_result.status || 'Active',
        created_at: userData_result.created_at,
        updated_at: userData_result.updated_at,
        daily_quota: userData_result.daily_quota,
        weekly_quota: userData_result.weekly_quota
      },
      error: null
    };
  } catch (error: any) {
    console.error('Error in createUser:', error);
    return { user: null, error: error.message || 'Failed to create user' };
  }
}

/**
 * Get Supabase Edge Function URL
 */
function getSupabaseFunctionUrl(functionName: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not configured');
  }
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  return `${baseUrl}/functions/v1/${functionName}`;
}

/**
 * Get Supabase Anon Key
 */
function getSupabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

/**
 * Create user via server Admin API (without Supabase sending email) and get magic link
 * This is used when we want to send a custom email with login details + verification link
 */
export async function createUserWithLink(userData: {
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'Manager' | 'Agent';
  dailyQuota?: number;
  weeklyQuota?: number;
}): Promise<{ user: User | null; error: string | null; magicLink?: string | null }> {
  try {
    const normalizedEmail = userData.email.toLowerCase().trim();
    
    if (!isValidEmail(normalizedEmail)) {
      return { user: null, error: 'Please enter a valid email address', magicLink: null };
    }

    if (!userData.password || userData.password.length < 6) {
      return { user: null, error: 'Password must be at least 6 characters long', magicLink: null };
    }

    // Call Supabase Edge Function instead of Vercel API route
    const functionUrl = getSupabaseFunctionUrl('create-user-with-link');
    const supabaseKey = getSupabaseAnonKey();

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        name: userData.name,
        email: normalizedEmail,
        password: userData.password,
        role: userData.role,
        dailyQuota: userData.dailyQuota,
        weeklyQuota: userData.weeklyQuota,
        redirectTo: 'https://www.apcmcrm.co.uk/'
      })
    });

    if (!response.ok) {
      // Try to get error details
      let errorText = '';
      try {
        errorText = await response.text();
        // Check if it's HTML (means route doesn't exist)
        if (errorText.trim().startsWith('<!')) {
          throw new Error(`API route not found. The create-user-with-link endpoint may not be deployed yet. Status: ${response.status}`);
        }
        // Try to parse as JSON
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `Failed to create user (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('API route not found')) {
          throw parseError;
        }
        throw new Error(`Failed to create user: ${response.status} ${response.statusText}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<!')) {
        throw new Error('API route returned HTML instead of JSON. The route may not be deployed yet.');
      }
      throw new Error(`Invalid response type: ${contentType}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      return { user: null, error: result.error || 'Failed to create user', magicLink: null };
    }

    return {
      user: result.data.user,
      error: null,
      magicLink: result.data.magicLink || null
    };
  } catch (error: any) {
    console.error('Error in createUserWithLink:', error);
    return { user: null, error: error.message || 'Failed to create user', magicLink: null };
  }
}

/**
 * Invite user via email (magic link)
 * Generates a magic link that can be included in a custom email
 * User record will be automatically created via database trigger when they sign up
 */
export async function inviteUser(userData: {
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent';
  dailyQuota?: number;
  weeklyQuota?: number;
}): Promise<{ success: boolean; error: string | null; magicLink?: string | null }> {
  try {
    // Normalize and validate email
    const normalizedEmail = normalizeEmail(userData.email);
    
    if (!isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    // Check if user already exists in auth.users or public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      return { success: false, error: 'User with this email already exists' };
    }

    // Prepare metadata for the magic link
    const metadata: any = {
      name: userData.name.trim(),
      role: userData.role
    };
    
    // Include daily_quota in metadata if provided (for Agent role)
    if (userData.dailyQuota !== undefined && userData.dailyQuota !== null) {
      metadata.daily_quota = userData.dailyQuota;
    }
    if (userData.weeklyQuota !== undefined && userData.weeklyQuota !== null) {
      metadata.weekly_quota = userData.weeklyQuota;
    }
    
    // Call Supabase Edge Function instead of Vercel API route
    const functionUrl = getSupabaseFunctionUrl('generate-invite-link');
    const supabaseKey = getSupabaseAnonKey();

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        email: normalizedEmail,
        redirectTo: 'https://www.apcmcrm.co.uk/',
        metadata
      })
    });

    if (!response.ok) {
      // Try to get error details
      let errorText = '';
      try {
        errorText = await response.text();
        // Check if it's HTML (means route doesn't exist)
        if (errorText.trim().startsWith('<!')) {
          throw new Error(`API route not found. The generate-invite-link endpoint may not be deployed yet. Status: ${response.status}`);
        }
        // Try to parse as JSON
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `Failed to generate invite link (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('API route not found')) {
          throw parseError;
        }
        throw new Error(`Failed to generate invite link: ${response.status} ${response.statusText}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<!')) {
        throw new Error('API route returned HTML instead of JSON. The route may not be deployed yet.');
      }
      throw new Error(`Invalid response type: ${contentType}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data || !result.data.magicLink) {
      console.error('Invalid response from generate-invite-link:', result);
      return { success: false, error: result.error || 'Failed to generate invite link' };
    }

    // Return the magic link so it can be included in a custom email
    return { 
      success: true, 
      error: null,
      magicLink: result.data.magicLink
    };
  } catch (error: any) {
    console.error('Error in inviteUser:', error);
    return { success: false, error: error.message || 'Failed to invite user' };
  }
}

/**
 * Send magic link to existing user
 */
export async function sendMagicLink(email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'https://www.apcmcrm.co.uk/'
      }
    });

    if (error) {
      console.error('Error sending magic link:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error in sendMagicLink:', error);
    return { success: false, error: error.message || 'Failed to send magic link' };
  }
}

/**
 * Update user
 */
export async function updateUser(userId: string, updates: Partial<User>): Promise<{ user: User | null; error: string | null }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) {
      // Email update will be synced to auth.users via database trigger
      // (see sync_user_email_to_auth.sql migration)
      updateData.email = updates.email;
    }
    if (updates.role !== undefined) updateData.role = updates.role;
    // Note: status column should be added via migration add_status_to_users.sql
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.daily_quota !== undefined) updateData.daily_quota = updates.daily_quota;
    if ((updates as any).weekly_quota !== undefined) updateData.weekly_quota = (updates as any).weekly_quota;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return { user: null, error: error.message };
    }

    // Email changes are automatically synced to auth.users via database trigger
    // If email was updated, the user should use the new email for future logins

    return {
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status || 'Active',
        created_at: data.created_at,
        updated_at: data.updated_at,
        daily_quota: data.daily_quota,
        weekly_quota: data.weekly_quota
      },
      error: null
    };
  } catch (error: any) {
    console.error('Error in updateUser:', error);
    return { user: null, error: error.message || 'Failed to update user' };
  }
}

/**
 * Delete user from both public.users and auth.users
 * Uses Supabase Edge Function to delete from both tables
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error: string | null; warning?: string }> {
  try {
    // Call Supabase Edge Function to delete user from both tables
    const functionUrl = getSupabaseFunctionUrl('delete-user');
    const supabaseKey = getSupabaseAnonKey();

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      // Try to get error details
      let errorText = '';
      try {
        errorText = await response.text();
        // Check if it's HTML (means route doesn't exist)
        if (errorText.trim().startsWith('<!')) {
          throw new Error(`API route not found. The delete-user endpoint may not be deployed yet. Status: ${response.status}`);
        }
        // Try to parse as JSON
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `Failed to delete user (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('API route not found')) {
          throw parseError;
        }
        throw new Error(`Failed to delete user: ${response.status} ${response.statusText}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim().startsWith('<!')) {
        throw new Error('API route returned HTML instead of JSON. The route may not be deployed yet.');
      }
      throw new Error(`Invalid response type: ${contentType}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete user' };
    }

    // Return success, with warning if auth deletion failed
    return {
      success: true,
      error: null,
      warning: result.warning || undefined
    };
  } catch (error: any) {
    console.error('Error in deleteUser:', error);
    return { success: false, error: error.message || 'Failed to delete user' };
  }
}
