import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { FloatingTaskBox } from '@/components/FloatingTaskBox';
import { ApcmAdvisor } from '@/components/ApcmAdvisor';
import { useAuth } from '@/context/AuthContext';
import { fetchOutlookStatus } from '@/services/outlookService';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isManuallyToggled, setIsManuallyToggled] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isWideWorkspace = location.pathname.startsWith('/lead-management');

  const toggleSidebar = () => {
    setIsManuallyToggled(true);
    setSidebarOpen(!sidebarOpen);
  };

  // Reset manual toggle when sidebar is closed
  useEffect(() => {
    if (!sidebarOpen && isManuallyToggled) {
      // Reset manual toggle after a delay to re-enable hover
      const timer = setTimeout(() => {
        setIsManuallyToggled(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [sidebarOpen, isManuallyToggled]);

  // Handle mouse movement near left edge (only on desktop)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only trigger on desktop (lg breakpoint)
      if (window.innerWidth < 1024) return;
      
      // Don't auto-expand if user manually toggled
      if (isManuallyToggled) return;

      const leftEdgeZone = 50; // 50px from left edge for easier hover
      
      if (e.clientX <= leftEdgeZone && !sidebarOpen) {
        // Mouse is near left edge, expand sidebar
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setSidebarOpen(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [sidebarOpen, isManuallyToggled]);

  const handleSidebarMouseEnter = () => {
    // Expand sidebar when mouse enters (only if not manually toggled)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (!isManuallyToggled) {
      setSidebarOpen(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    // Collapse sidebar when mouse leaves (only if not manually toggled)
    if (isManuallyToggled) return;
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setSidebarOpen(false);
    }, 500); // Delay before collapsing to allow moving back
  };

  // Background Outlook token refresh service
  // Note: This only works when the server is running. For 24/7 refresh, use the cron job setup.
  // See OUTLOOK-AUTO-REFRESH-SETUP.md for cron job configuration.
  useEffect(() => {
    if (!user) return; // Only run when user is logged in

    let isMounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const refreshOutlookToken = async () => {
      try {
        // Call the status endpoint which triggers token refresh on the server
        const status = await fetchOutlookStatus();
        
        if (!isMounted) return;

        if (status.connected) {
          // Token is valid, schedule next refresh in 30 minutes
          // (tokens typically last 1 hour, so 30 min ensures we refresh before expiry)
          if (refreshInterval) {
            clearInterval(refreshInterval);
          }
          refreshInterval = setTimeout(refreshOutlookToken, 30 * 60 * 1000); // 30 minutes
        } else {
          // Connection lost, retry more frequently (every 5 minutes) to catch reconnection
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }
          retryTimeout = setTimeout(refreshOutlookToken, 5 * 60 * 1000); // 5 minutes
        }
      } catch (error) {
        // Silently handle connection errors (server might not be running)
        // The cron job will handle refresh when server is available
        if (!isMounted) return;
        
        // On error, retry in 10 minutes (but don't spam errors if server is down)
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
        retryTimeout = setTimeout(refreshOutlookToken, 10 * 60 * 1000); // 10 minutes
      }
    };

    // Initial refresh after 1 minute (to avoid immediate refresh on page load)
    const initialTimeout = setTimeout(() => {
      refreshOutlookToken();
    }, 60 * 1000); // 1 minute

    return () => {
      isMounted = false;
      if (refreshInterval) {
        clearTimeout(refreshInterval);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      clearTimeout(initialTimeout);
    };
  }, [user]);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#011E41]/5 via-[#F8F8F9] to-[#9164CC]/10">
      <div 
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      </div>
      
      <div className="flex-1 flex flex-col bg-[#F8F8F9]">
        <TopNav onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 py-6">
          <div className={`${isWideWorkspace ? 'max-w-[1800px]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8`}>
            {children}
          </div>
        </main>
      </div>

      {/* Floating Task Box */}
      <FloatingTaskBox />

      {/* APCM AI page-advisor — context-aware popup with a cost readout, floats above the task box */}
      <ApcmAdvisor />
    </div>
  );
};







