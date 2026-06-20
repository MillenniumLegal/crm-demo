import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Loader2, AlertTriangle, Info, CheckCircle, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchNotificationsForUser,
  NotificationItem,
} from '@/services/notificationsService';

interface TopNavProps {
  onMenuToggle: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onMenuToggle }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const storageKey = user?.id ? `mlcrm-read-notifications-${user.id}` : null;

  const loadNotifications = async () => {
    if (!user) return;
    setIsLoading(true);
    const role =
      user.role === 'Admin' || user.role === 'Manager' || user.role === 'Agent'
        ? (user.role as 'Admin' | 'Manager' | 'Agent')
        : 'Agent';
    const data = await fetchNotificationsForUser(user.id, role);
    const storedKey = user.id ? `mlcrm-read-notifications-${user.id}` : null;
    let storedIds: Set<string> | null = null;
    if (storedKey) {
      const stored = localStorage.getItem(storedKey);
      if (stored) {
        try {
          storedIds = new Set(JSON.parse(stored) as string[]);
        } catch {
          storedIds = null;
        }
      }
    }
    if (storedIds) {
      const newIds = data.filter((n) => n.createdAt && !storedIds!.has(n.id));
      if (newIds.length > 0 && storedKey) {
        const combined = new Set(storedIds);
        newIds.forEach((n) => combined.add(n.id));
        localStorage.setItem(storedKey, JSON.stringify(Array.from(combined)));
        setReadNotifications(combined);
      } else {
        setReadNotifications(storedIds);
      }
    }
    setNotifications(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const initiate = async () => {
      setIsLoading(true);
      const role =
        user.role === 'Admin' || user.role === 'Manager' || user.role === 'Agent'
          ? (user.role as 'Admin' | 'Manager' | 'Agent')
          : 'Agent';
      const data = await fetchNotificationsForUser(user.id, role);
      if (isMounted) {
        setNotifications(data);
        setIsLoading(false);
      }
    };

    initiate();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') initiate();
    }, 120_000); // refresh every 2 min, only when tab visible (reduces Supabase load)

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!storageKey) {
      setReadNotifications(new Set());
      return;
    }

    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed: string[] = JSON.parse(stored);
        setReadNotifications(new Set(parsed));
      } catch (error) {
        console.error('Failed to parse read notifications from storage', error);
      }
    } else {
      setReadNotifications(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(readNotifications)));
  }, [readNotifications, storageKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const actionableCount = useMemo(
    () =>
      notifications.filter(
        (n) => n.severity !== 'info' && !readNotifications.has(n.id)
      ).length,
    [notifications, readNotifications]
  );

  const getSeverityStyles = (severity: NotificationItem['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          badge: 'bg-red-100 text-red-800',
          icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
        };
      case 'warning':
        return {
          badge: 'bg-yellow-100 text-yellow-800',
          icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
        };
      case 'info':
      default:
        return {
          badge: 'bg-[#9164CC]/15 text-[#9164CC]',
          icon: <Info className="h-4 w-4 text-[#9164CC]" />,
        };
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const handleMarkAsRead = (id: string) => {
    setReadNotifications((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    setReadNotifications((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      return next;
    });
  };

  const unreadExists = notifications.some((n) => !readNotifications.has(n.id));

  return (
    <header className="bg-[#F8F8F9] border-b border-white/50">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center space-x-3">
          {/* Mobile hamburger menu - only visible on mobile */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 text-[#011E41] hover:bg-[#9164CC]/10 rounded-lg transition-colors duration-200"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <h2 className="text-lg font-semibold text-[#011E41]">
            Millennium Legal Conveyancing Ltd
          </h2>
        </div>

        <div className="flex items-center">
          {/* Notifications */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="relative p-2 text-[#011E41]/70 hover:text-[#011E41] hover:bg-[#9164CC]/10 rounded-lg transition-colors duration-200"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {actionableCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500 text-white">
                  {actionableCount}
                </span>
              )}
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-96 bg-white rounded-lg shadow-xl border border-[#E4E4EB] z-20">
                <div className="px-4 py-3 border-b border-[#EDEDF3] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#011E41]">
                      Notifications
                    </p>
                    <p className="text-xs text-[#6F6F76]">
                      Stay on top of overdue tasks and important events
                    </p>
                  </div>
                  <button
                    className="text-xs text-[#9164CC] hover:text-[#011E41] font-medium"
                    onClick={loadNotifications}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                  {notifications.length > 0 && (
                    <button
                      className="text-xs text-[#9164CC] hover:text-[#011E41] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleMarkAllAsRead}
                      disabled={!unreadExists}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-[#6F6F76]">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Loading notifications…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-[#A3A3B1]">
                      <CheckCircle className="h-8 w-8 mb-2" />
                      <p className="text-sm">You&apos;re all caught up!</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const severity = getSeverityStyles(notification.severity);
                      const isRead = readNotifications.has(notification.id);
                      return (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-[#EDEDF3] last:border-b-0 transition-colors ${
                            isRead
                              ? 'bg-white hover:bg-[#F8F8F9]'
                              : 'bg-[#F8F8F9]/80 hover:bg-[#EDEDF3]'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`mt-0.5 ${isRead ? 'opacity-60' : ''}`}>
                              {severity.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-[#011E41]">
                                  {notification.title}
                                </p>
                                <span className="text-[11px] text-[#A3A3B1]">
                                  {formatRelativeTime(notification.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-[#6F6F76] mt-1">
                                {notification.message}
                              </p>
                              <div className="mt-2 flex items-center justify-between">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${severity.badge}`}
                                >
                                  {notification.severity === 'critical'
                                    ? 'Critical'
                                    : notification.severity === 'warning'
                                    ? 'Warning'
                                    : 'Info'}
                                </span>
                                <div className="flex items-center gap-2">
                                  {notification.actionUrl && (
                                    <a
                                      href={notification.actionUrl}
                                      className="text-xs font-semibold text-[#9164CC] hover:text-[#011E41]"
                                      onClick={() => handleMarkAsRead(notification.id)}
                                    >
                                      {notification.actionLabel || 'View'}
                                    </a>
                                  )}
                                  {!isRead && (
                                    <button
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      className="text-xs text-[#011E41]/70 hover:text-[#011E41] font-medium"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
