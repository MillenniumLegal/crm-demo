import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Settings,
  LogOut,
  X,
  Phone,
  Target,
  Calendar,
  Clock,
  Building2,
  Zap,
  Hand,
  DollarSign,
  GitCompareArrows,
  CheckCircle,
  Headphones,
  Brain,
  Activity,
  ListChecks,
  Wallet,
  Briefcase,
  PieChart,
  Trophy,
  Megaphone,
  Mail,
  ShieldCheck,
  CircleUser,
  MessagesSquare,
  Milestone,
  Coins,
  ShieldAlert,
  Store,
  ClipboardList,
  Gauge,
  Heart,
  Rocket,
  Scale,
  LineChart,
  CalendarClock,
  Sparkles,
  ChevronDown,
  Search,
  MapPin,
  Tags
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UserAvatar } from '@/components/UserAvatar';
import { APCM_AI_ENABLED } from '@/lib/featureFlags';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

type UserRole = 'Admin' | 'Manager' | 'Agent';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigationGroups: NavigationGroup[] = [
    {
      label: 'Workspace',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Daily Pipeline', href: '/daily-pipeline', icon: ListChecks, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'My Workspace', href: '/my-workspace', icon: CircleUser, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Pipeline Pulse', href: '/pipeline-pulse', icon: Activity, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Lead Management', href: '/lead-management', icon: Users, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Pick Unassigned Lead', href: '/lead-management?stage=unassigned', icon: Hand, roles: ['Agent'] },
        { name: 'Diary & Tasks', href: '/diary', icon: Calendar, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Contact Attempts', href: '/contact-attempts', icon: Phone, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Conversations', href: '/conversations', icon: MessagesSquare, roles: ['Admin', 'Manager', 'Agent'] },
      ],
    },
    {
      label: 'Money',
      items: [
        { name: 'Finance', href: '/finance', icon: Wallet, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Quotes', href: '/quotes', icon: FileText, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Matters', href: '/matters', icon: Briefcase, roles: ['Admin', 'Manager', 'Agent'] },
        { name: 'Revenue Boost', href: '/revenue-boost', icon: Coins, roles: ['Admin', 'Manager'] },
        { name: 'Lead Resale', href: '/lead-resale', icon: Store, roles: ['Admin', 'Manager'] },
        { name: 'Resale Queue', href: '/lead-resale-queue', icon: ClipboardList, roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Calls & AI',
      items: [
        ...(APCM_AI_ENABLED ? [{ name: 'APCM AI', href: '/apcm-ai', icon: Brain, roles: ['Admin', 'Manager'] as UserRole[] }] : []),
        { name: 'Call Analysis', href: '/call-analysis', icon: Headphones, roles: ['Admin', 'Manager'] },
        { name: 'Call Intel', href: '/call-intel', icon: ShieldCheck, roles: ['Admin', 'Manager'] },
        { name: 'Call Insights', href: '/call-insights', icon: Sparkles, roles: ['Admin', 'Manager'] },
        { name: 'Best Time to Call', href: '/timing', icon: CalendarClock, roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Performance',
      items: [
        { name: 'Analytics', href: '/analytics', icon: PieChart, roles: ['Admin', 'Manager'] },
        { name: 'Lead Analytics', href: '/lead-analytics', icon: Search, roles: ['Admin', 'Manager'] },
        { name: 'Lead Enrichment', href: '/lead-enrichment', icon: MapPin, roles: ['Admin', 'Manager'] },
        { name: 'Lead Categories', href: '/lead-categories', icon: Tags, roles: ['Admin', 'Manager'] },
        { name: 'Team', href: '/team', icon: Trophy, roles: ['Admin', 'Manager'] },
        { name: 'Sales Velocity', href: '/sales-velocity', icon: Rocket, roles: ['Admin', 'Manager'] },
        { name: 'Capacity', href: '/capacity', icon: Scale, roles: ['Admin', 'Manager'] },
        { name: 'Client Experience', href: '/client-experience', icon: Heart, roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Conveyancing',
      items: [
        { name: 'Matter Progression', href: '/matter-progression', icon: Milestone, roles: ['Admin', 'Manager'] },
        { name: 'Compliance', href: '/compliance', icon: ShieldAlert, roles: ['Admin', 'Manager'] },
        { name: 'Ops Health', href: '/ops-health', icon: Gauge, roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Growth',
      items: [
        { name: 'Marketing', href: '/marketing', icon: Megaphone, roles: ['Admin', 'Manager'] },
        { name: 'Email', href: '/email', icon: Mail, roles: ['Admin', 'Manager'] },
        { name: 'Comparison Leads', href: '/comparison-leads', icon: GitCompareArrows, roles: ['Manager'] },
        { name: 'Forecast', href: '/forecast', icon: LineChart, roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Reports',
      items: [
        { name: 'Pipeline Reports', href: '/reports', icon: BarChart3, roles: ['Admin', 'Manager'] },
        { name: 'Instructions Report', href: '/reports/instructions', icon: CheckCircle, roles: ['Admin', 'Manager'] },
        { name: 'Lead Time Tracking', href: '/lead-time-tracking', icon: Clock, roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Admin',
      items: [
        { name: 'Solicitor Firms', href: '/solicitor-firms', icon: Building2, roles: ['Admin', 'Manager'] },
        { name: 'Firm Price Lists', href: '/firm-price-lists', icon: DollarSign, roles: ['Admin', 'Manager'] },
        { name: 'Outcome Codes', href: '/outcome-codes', icon: Target, roles: ['Admin', 'Manager'] },
        { name: 'Automation', href: '/automation', icon: Zap, roles: ['Admin', 'Manager'] },
        { name: 'Settings', href: '/settings', icon: Settings, roles: ['Admin', 'Manager', 'Agent'] },
      ],
    },
  ];

  const visibleNavigationGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => user && item.roles.includes(user.role)),
    }))
    .filter(group => group.items.length > 0);

  const isNavItemActive = (href: string) => {
    const [path, query] = href.split('?');

    if (query) {
      return location.pathname === path && location.search === `?${query}`;
    }

    if (path === '/lead-management' && location.search === '?stage=unassigned') {
      return false;
    }

    return location.pathname === path;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isGroupOpen = (group: NavigationGroup) => {
    if (openGroups[group.label] !== undefined) return openGroups[group.label];
    return group.label === 'Workspace' || group.items.some((i) => isNavItemActive(i.href));
  };
  const toggleGroup = (label: string, currentlyOpen: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !currentlyOpen }));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 bg-[#011E41] text-white shadow-lg transform transition-all duration-300 ease-in-out flex flex-col
        ${isOpen ? 'w-64 translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:z-auto
        ${isOpen ? 'lg:w-64' : 'lg:w-16'}
      `}>
        {/* Header */}
        <div className={`flex items-center h-16 border-b border-white/10 flex-shrink-0 ${isOpen ? 'justify-between px-6' : 'justify-center'}`}>
          {isOpen ? (
            <>
              <div className="flex items-center space-x-3">
                <UserAvatar size={40} className="flex-shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-white">Workspace</span>
                  <span className="text-xs text-white/70 truncate">
                    {user?.name || 'Team'}
                  </span>
                </div>
              </div>
              <button
                onClick={onToggle}
                className="p-2 rounded-md text-white/60 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </>
          ) : (
            <button
              onClick={onToggle}
              className="transition-transform duration-200 hover:scale-105"
              title="Open Workspace"
            >
              <UserAvatar size={40} />
            </button>
          )}
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-4">
            {visibleNavigationGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                {isOpen ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label, isGroupOpen(group))}
                    className="flex w-full items-center justify-between px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35 hover:text-white/60"
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isGroupOpen(group) ? '' : '-rotate-90'}`} />
                  </button>
                ) : (
                  <div className="mx-auto my-2 h-px w-7 bg-white/10" />
                )}

                {(!isOpen || isGroupOpen(group)) && group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.href);

                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={`
                        group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200
                        ${isActive
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }
                        ${!isOpen ? 'justify-center' : ''}
                      `}
                      title={!isOpen ? item.name : undefined}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${isOpen ? 'mr-3' : ''}`} />
                      {isOpen && <span className="truncate">{item.name}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* User info and logout - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#011E40]">
          <div className={`flex items-center ${!isOpen ? 'justify-center' : ''}`}>
            {isOpen ? (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {user?.role}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="ml-3 p-2 text-white/60 hover:text-white transition-colors duration-200 flex-shrink-0"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <button
                onClick={logout}
                className="p-2 text-white/60 hover:text-white transition-colors duration-200"
                title={`Logout ${user?.name}`}
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
