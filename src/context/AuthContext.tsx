import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, LoginCredentials } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const session = data.session;
        if (session) {
          // Check if user is inactive during initialization
          try {
            await fetchUserProfile(session.user.id);
          } catch (profileError: any) {
            // If user is inactive, they'll be logged out by fetchUserProfile
            // The periodic check will handle redirect
            if (profileError.message !== 'INACTIVE_USER') {
              console.error('Error fetching user profile during init:', profileError);
            }
          }
        } else if (isMounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking auth session:', error);
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Listen for profile update events
    const handleProfileUpdate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchUserProfile(session.user.id);
      }
    };

    window.addEventListener('user-profile-updated', handleProfileUpdate);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
    };
  }, []);

  // Periodically check if logged-in user's status has changed to inactive
  useEffect(() => {
    if (!user) return;

    const checkUserStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('users')
          .select('status')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Error checking user status:', error);
          return;
        }

        // If user is inactive, automatically log them out
        if (data && data.status === 'Inactive') {
          const userEmail = user?.email || session?.user?.email || 'Unknown';
          console.warn('User status changed to inactive, auto-logging out:', userEmail);
          
          // Store message in sessionStorage to display on login page
          sessionStorage.setItem('inactiveMessage', 'Your profile is inactive. Please contact the admin.');
          
          // Sign out the user
          await supabase.auth.signOut();
          setUser(null);
          
          // Redirect to login page
          window.location.href = '/login?inactive=true';
        }
      } catch (error) {
        console.error('Error in status check:', error);
      }
    };

    // Check status every 2 min, only when tab visible (reduces Supabase load)
    const statusCheckInterval = setInterval(() => {
      if (document.visibilityState === 'visible') checkUserStatus();
    }, 120000);

    // Also check immediately when user logs in
    checkUserStatus();

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [user]);

  const fetchUserProfile = async (userId: string, throwOnInactive: boolean = false) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }

      if (data) {
        // Check if user is inactive
        if (data.status === 'Inactive') {
          console.warn('User is inactive, logging out:', data.email);
          
          // Store message in sessionStorage to display on login page
          sessionStorage.setItem('inactiveMessage', 'Your profile is inactive. Please contact the admin.');
          
          // Sign out the user
          await supabase.auth.signOut();
          setUser(null);
          
          // Redirect to login page (if not already there)
          if (window.location.pathname !== '/login') {
            window.location.href = '/login?inactive=true';
          }
          
          if (throwOnInactive) {
            throw new Error('INACTIVE_USER');
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          token: session?.access_token || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      // If user profile not found or inactive, clear user state
      if (error.message === 'INACTIVE_USER') {
        throw error;
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      console.log('Attempting login for:', credentials.email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        console.error('Supabase login error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        setIsLoading(false);
        
        // Check if the error is due to unverified email
        // Supabase returns error.code === 'email_not_confirmed' for unverified emails
        const errorMessage = error.message?.toLowerCase() || '';
        const errorCode = (error as any).code?.toLowerCase() || '';
        const isEmailNotVerified = 
          errorCode === 'email_not_confirmed' ||
          errorMessage.includes('email not confirmed') ||
          errorMessage.includes('email_not_confirmed') ||
          errorMessage.includes('not verified') ||
          errorMessage.includes('verify your email') ||
          errorMessage.includes('email verification') ||
          (error.status === 400 && errorMessage.includes('email'));
        
        if (isEmailNotVerified) {
          return { 
            success: false, 
            error: 'Your email address has not been verified. Please check your email for a verification link, or contact your administrator for assistance.' 
          };
        }
        
        return { success: false, error: 'Invalid email or password. Please try again.' };
      }

      if (data.user) {
        console.log('Login successful, fetching user profile for:', data.user.id);
        try {
          await fetchUserProfile(data.user.id, true); // throwOnInactive = true
          return { success: true };
        } catch (profileError: any) {
          if (profileError.message === 'INACTIVE_USER') {
            setIsLoading(false);
            return { 
              success: false, 
              error: 'Your profile is inactive. Please contact the admin.' 
            };
          }
          setIsLoading(false);
          return { success: false, error: 'Failed to load user profile. Please try again.' };
        }
      }

      console.warn('Login successful but no user data returned');
      setIsLoading(false);
      return { success: false, error: 'Invalid email or password. Please try again.' };
    } catch (error: any) {
      console.error('Unexpected login error:', error);
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};





