import * as Sentry from "@sentry/react";
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { ADMIN_EMAILS } from './constants';
import LoginPage from './components/LoginPage'; 
import ResetPasswordPage from './components/ResetPasswordPage';
import ProtectedRoute from './components/ProtectedRoute'; 

import HomeDashboard from './components/HomeDashboard';
import SessionDashboard from './components/SessionDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import ImpactDashboard from './components/ImpactDashboard';
import ThemesDashboard from './components/ThemesDashboard';
import BaselineDashboard from './components/BaselineDashboard';
import ScaleBaselineDashboard from './components/ScaleBaselineDashboard';
import ScaleDashboard from './components/ScaleDashboard';
import ReportGenerator from './components/ReportGenerator';
import SetupDashboard from './components/SetupDashboard';
import ManagerDashboard from './components/ManagerDashboard';

import { 
  Users, 
  Settings, 
  LogOut, 
  Lightbulb, 
  Menu, 
  X, 
  ChevronDown, 
  Calendar,
  Home,
  TrendingUp,
  ClipboardList,
  Zap,
  Building2,
  ClipboardCheck
} from 'lucide-react';

// --- Sentry Initialization ---
Sentry.init({
  dsn: "https://294c2316c823a2c471d7af41681f837c@o4510574332215296.ingest.us.sentry.io/4510574369112064",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE, // 'development' or 'production'
});

// --- Program Display Name Mapping ---
const programDisplayNames: Record<string, string> = {
  'CP-0028': 'GROW - Cohort 1',
  'CP-0117': 'GROW - Cohort 2',
};

const getDisplayName = (program: string): string => {
  return programDisplayNames[program] || program;
};

// --- Admin Company Switcher ---
const ADMIN_COMPANY_KEY = 'boon_admin_company_override';

const AdminCompanySwitcher: React.FC<{ 
  currentCompany: string;
  onCompanyChange: (company: string, programType: 'GROW' | 'Scale') => void;
}> = ({ currentCompany, onCompanyChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [companies, setCompanies] = useState<{name: string, programType: 'GROW' | 'Scale'}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch distinct account_names from session_tracking (the actual values used for filtering)
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from('session_tracking')
        .select('account_name, program_title')
        .order('account_name');
      
      if (data) {
        // Get unique account_names with their program type
        const uniqueMap = new Map<string, 'GROW' | 'Scale'>();
        data.forEach(row => {
          if (row.account_name && !uniqueMap.has(row.account_name)) {
            const isScale = row.program_title?.toUpperCase().includes('SCALE') || 
                           row.account_name?.toUpperCase().includes('SCALE');
            uniqueMap.set(row.account_name, isScale ? 'Scale' : 'GROW');
          }
        });
        
        const companyList = Array.from(uniqueMap.entries()).map(([name, programType]) => ({
          name,
          programType
        }));
        setCompanies(companyList.sort((a, b) => a.name.localeCompare(b.name)));
      }
    };
    fetchCompanies();
  }, []);

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (company: {name: string, programType: 'GROW' | 'Scale'}) => {
    localStorage.setItem(ADMIN_COMPANY_KEY, JSON.stringify(company));
    onCompanyChange(company.name, company.programType);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    localStorage.removeItem(ADMIN_COMPANY_KEY);
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200 transition"
      >
        <Building2 size={14} />
        <span className="max-w-[120px] truncate">{currentCompany || 'Switch Company'}</span>
        <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCompanies.slice(0, 30).map((company) => (
              <button
                key={company.name}
                onClick={() => handleSelect(company)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-amber-50 flex items-center justify-between ${
                  currentCompany === company.name ? 'bg-amber-100 font-bold' : ''
                }`}
              >
                <span className="truncate">{company.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  company.programType === 'Scale' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {company.programType}
                </span>
              </button>
            ))}
          </div>
          {localStorage.getItem(ADMIN_COMPANY_KEY) && (
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={handleClear}
                className="w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium"
              >
                Clear Override & Use Default
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main Portal Layout with Dynamic Program Tabs ---
const MainPortalLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'setup' | 'dashboard' | 'sessions' | 'employees' | 'impact' | 'themes' | 'baseline'>('dashboard');
  
  // Program Type State
  const [programType, setProgramType] = useState<'GROW' | 'Scale' | 'Exec' | null>(null);
  const [programTypeLoading, setProgramTypeLoading] = useState(true);
  
  // Show Setup tab only during onboarding (before launch_date)
  const [showSetup, setShowSetup] = useState(false);
  
  // New Filter State
  const [filterType, setFilterType] = useState<'program' | 'cohort' | 'all'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const [programs, setPrograms] = useState<string[]>([]);
  
  const [companyName, setCompanyName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'manager'>('admin');
  const navigate = useNavigate();

  const handleCompanyChange = (newCompany: string, newProgramType: 'GROW' | 'Scale') => {
    setCompanyName(newCompany);
    setProgramType(newProgramType);
    window.location.reload();
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        setUserEmail(email);
        
        const adminUser = ADMIN_EMAILS.includes(email?.toLowerCase());
        setIsAdmin(adminUser);
        
        // Check if user is a manager (has employees reporting to them)
        const { data: managerCheck } = await supabase
          .from('employee_manager')
          .select('id')
          .eq('manager_email', email)
          .limit(1);
        
        const isManagerUser = managerCheck && managerCheck.length > 0;
        setIsManager(isManagerUser);
        
        // If user is ONLY a manager (not admin), they'll see ManagerDashboard
        // If admin, they default to admin view but can toggle
        
        // Check for admin override
        let company = session?.user?.app_metadata?.company || '';
        let programTypeFromMeta = session?.user?.app_metadata?.program_type || null;
        
        if (adminUser) {
          try {
            const stored = localStorage.getItem(ADMIN_COMPANY_KEY);
            if (stored) {
              const override = JSON.parse(stored);
              company = override.name;
              programTypeFromMeta = override.programType;
            }
          } catch {}
        }
        
        setCompanyName(company);

        // Set Sentry user context for better error tracking
        if (session?.user) {
          Sentry.setUser({
            id: session.user.id,
            email: session.user.email,
          });
          Sentry.setTag('company', company);
        }

        // Fetch client logo
        const companyBase = company
          .split(' - ')[0]
          .replace(/\s+(SCALE|GROW|EXEC)$/i, '')
          .trim();
        
        if (companyBase) {
          const { data: logoData, error: logoError } = await supabase
            .from('company_logos')
            .select('logo_url')
            .ilike('company_name', `%${companyBase}%`)
            .maybeSingle();
          
          if (logoData?.logo_url) {
            setClientLogo(logoData.logo_url);
          }
        }
        
        // Check program_config to see if this company is in Onboarding status
        // First try to get company_id from admin override or user metadata
        let companyId = session?.user?.app_metadata?.company_id || '';
        
        if (adminUser) {
          try {
            const stored = localStorage.getItem(ADMIN_COMPANY_KEY);
            if (stored) {
              const override = JSON.parse(stored);
              if (override.id) {
                companyId = override.id;
              }
            }
          } catch {}
        }
        
        // If we have a company_id, check program_config for onboarding status
        // Check ALL programs for this company - show Setup only if ANY are in Onboarding
        if (companyId) {
          const { data: programData } = await supabase
            .from('program_config')
            .select('program_status')
            .eq('company_id', companyId);
          
          // Show Setup only if at least one program is in Onboarding status
          const hasOnboarding = programData?.some(p => p.program_status?.toLowerCase() === 'onboarding');
          if (hasOnboarding) {
            setShowSetup(true);
          }
        } else if (companyBase) {
          // Fallback: check by account_name if no company_id
          const { data: programData } = await supabase
            .from('program_config')
            .select('program_status')
            .ilike('account_name', `%${companyBase}%`);
          
          const hasOnboarding = programData?.some(p => p.program_status?.toLowerCase() === 'onboarding');
          if (hasOnboarding) {
            setShowSetup(true);
          }
        }

        setProgramTypeLoading(false);

        // Get program type from JWT app_metadata (no DB query needed - avoids RLS issues)
        if (programTypeFromMeta) {
          // Normalize the program type (handle case variations)
          const normalizedType = programTypeFromMeta.toLowerCase();
          if (normalizedType === 'scale') {
            setProgramType('Scale');
          } else if (normalizedType === 'exec') {
            setProgramType('Exec');
          } else {
            setProgramType('GROW');
          }
          Sentry.setTag('program_type', programTypeFromMeta);
        } else {
          // Fallback: check if company name contains Scale
          if (company.toUpperCase().includes('SCALE')) {
            setProgramType('Scale');
            Sentry.setTag('program_type', 'Scale');
          } else {
            setProgramType('GROW');
            Sentry.setTag('program_type', 'GROW');
          }
        }

        // Fetch program titles for sidebar from sessions data - filtered by company
        let foundPrograms: string[] = [];
        try {
          // Build query with company filter
          let sessionQuery = supabase
            .from('session_tracking')
            .select('program_title');
          
          // Apply company filter at query level
          if (companyId) {
            sessionQuery = sessionQuery.eq('company_id', companyId);
          } else if (companyBase) {
            sessionQuery = sessionQuery.ilike('account_name', `%${companyBase}%`);
          }

          const { data: sessionPrograms, error: sessionError } = await sessionQuery;

          console.log('Session programs query:', { sessionPrograms, sessionError, companyId, companyBase });

          if (!sessionError && sessionPrograms && sessionPrograms.length > 0) {
            foundPrograms = [...new Set(
              sessionPrograms.map(s => s.program_title)
                .filter(p => p && p.trim().length > 0)
            )] as string[];
            console.log('Unique programs found from sessions:', foundPrograms);
            
            // Set programs immediately when found
            if (foundPrograms.length > 0) {
              console.log('Setting programs state to:', foundPrograms.sort());
              setPrograms(foundPrograms.sort());
            }
          }
        } catch (progErr) {
          console.error('Error fetching programs from sessions:', progErr);
        }
        
        // Note: program_config fallback removed due to RLS/API key issues
        // Programs are now sourced only from session_tracking table
      } catch (err) {
        console.error('Error fetching metadata:', err);
        Sentry.captureException(err);
        setProgramTypeLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  const handleSignOut = async () => {
    Sentry.setUser(null); // Clear user context on sign out
    await supabase.auth.signOut();
    navigate('/login'); 
  };

  const displayCompanyName = companyName.split(' - ')[0] || companyName;

  const handleNavClick = (tab: 'setup' | 'dashboard' | 'sessions' | 'employees' | 'impact' | 'themes' | 'baseline') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    navigate(tab === 'dashboard' ? '/' : `/${tab}`);
  };

  const handleSessionFilterClick = (type: 'program' | 'all', value: string) => {
    setActiveTab('sessions');
    setFilterType(type);
    setFilterValue(value);
    setMobileMenuOpen(false);
    navigate('/sessions');
  };

  const toggleMenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  // Show loading while determining program type
  if (programTypeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-boon-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-boon-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is a manager (not admin), show Manager Dashboard
  // If admin with manager role, check viewMode
  if (isManager && (!isAdmin || viewMode === 'manager')) {
    return <ManagerDashboard />;
  }

  // Scale-specific navigation
  const isScale = programType?.toUpperCase() === 'SCALE';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-boon-bg font-sans text-boon-dark">
      
      {/* Mobile Header */}
      <div className="lg:hidden bg-white px-4 py-3 border-b border-gray-100 flex justify-between items-center sticky top-0 z-30 shadow-sm h-[60px]">
        <div className="flex items-center gap-3">
             <img 
              src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png" 
              alt="Boon Logo" 
              className="h-5 w-auto object-contain"
            />
            {clientLogo && (
              <>
                <span className="text-gray-300">×</span>
                <img 
                  src={clientLogo} 
                  alt="Client Logo" 
                  className="h-6 w-auto object-contain max-w-[80px]"
                />
              </>
            )}
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg active:bg-gray-200 transition touch-manipulation"
        >
           {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 lg:h-screen lg:sticky lg:top-0
        ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="hidden lg:block p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <img 
              src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png" 
              alt="Boon Logo" 
              className="h-5 w-auto object-contain"
            />
            {clientLogo && (
              <>
                <span className="text-gray-300">×</span>
                <img 
                  src={clientLogo} 
                  alt="Client Logo" 
                  className="h-7 w-auto object-contain max-w-[100px]"
                />
              </>
            )}
          </div>
          {isAdmin && (
            <AdminCompanySwitcher 
              currentCompany={companyName}
              onCompanyChange={handleCompanyChange}
            />
          )}
          {isAdmin && isManager && (
            <button
              onClick={() => setViewMode(viewMode === 'admin' ? 'manager' : 'admin')}
              className="mt-2 flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold hover:bg-purple-200 transition w-full justify-center"
            >
              <Users size={14} />
              {viewMode === 'admin' ? 'Switch to Manager View' : 'Switch to Admin View'}
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
          {/* Setup - shows only during onboarding (before launch_date) or for admins */}
          {(showSetup || isAdmin) && (
            <NavItem 
              active={activeTab === 'setup'} 
              onClick={() => handleNavClick('setup')}
              icon={<ClipboardCheck size={20} />} 
              label="Setup" 
            />
          )}

          {/* Dashboard - shows Scale or GROW based on program type */}
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => handleNavClick('dashboard')}
            icon={isScale ? <Zap size={20} /> : <Home size={20} />} 
            label={isScale ? 'Scale Benefit' : 'Dashboard'} 
          />

          {/* Sessions - only show for GROW */}
          {!isScale && (
            <div>
              <button
                onClick={() => { toggleMenu('sessions'); handleNavClick('sessions'); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-semibold group
                  ${activeTab === 'sessions' ? 'bg-boon-blue/5 text-boon-blue' : 'text-gray-500 hover:bg-gray-50 hover:text-boon-dark'}`}
              >
                <div className="flex items-center gap-3">
                  <Calendar size={20} className={activeTab === 'sessions' ? 'text-boon-blue' : 'group-hover:text-boon-blue transition-colors'} />
                  <span>Sessions</span>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${expandedMenu === 'sessions' ? 'rotate-180 text-boon-blue' : 'text-gray-400'}`}
                />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedMenu === 'sessions' ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="pl-4 space-y-1 border-l-2 border-gray-100 ml-5 py-1">
                  <button
                      onClick={() => handleSessionFilterClick('all', '')}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-all duration-200
                        ${activeTab === 'sessions' && filterType === 'all'
                          ? 'bg-boon-blue/10 text-boon-blue font-bold' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-boon-dark font-medium'
                        }`}
                    >
                      <span>All Sessions</span>
                  </button>
                  {programs.map(program => (
                    <button
                      key={program}
                      onClick={() => handleSessionFilterClick('program', program)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-all duration-200
                        ${activeTab === 'sessions' && filterType === 'program' && filterValue === program
                          ? 'bg-boon-blue/10 text-boon-blue font-bold' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-boon-dark font-medium'
                        }`}
                    >
                      <span className="truncate">{getDisplayName(program)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <NavItem 
            active={activeTab === 'themes'} 
            onClick={() => handleNavClick('themes')}
            icon={<Lightbulb size={20} />} 
            label="Themes" 
          />

          {/* Impact - only show for GROW */}
          {!isScale && (
            <NavItem 
              active={activeTab === 'impact'} 
              onClick={() => handleNavClick('impact')}
              icon={<TrendingUp size={20} />} 
              label="Impact" 
            />
          )}

          <NavItem 
            active={activeTab === 'baseline'} 
            onClick={() => handleNavClick('baseline')}
            icon={<ClipboardList size={20} />} 
            label="Baseline" 
          />

          <NavItem 
            active={activeTab === 'employees'} 
            onClick={() => handleNavClick('employees')}
            icon={<Users size={20} />} 
            label="Employees" 
          />

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
            <div className="px-4 py-2">
              <ReportGenerator 
                companyName={companyName}
                clientLogo={clientLogo}
                programType={programType}
              />
            </div>
            <NavItem icon={<Settings size={20} />} label="Settings" />
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 text-gray-500 hover:text-boon-red w-full px-4 py-3 rounded-lg hover:bg-red-50 transition font-medium"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden h-[calc(100vh-60px)] lg:h-screen relative z-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
          <Routes>
            {/* Setup route for onboarding */}
            <Route path="/setup" element={<SetupDashboard />} />
            {/* Dashboard route shows Scale or GROW based on program type */}
            <Route path="/" element={isScale ? <ScaleDashboard /> : <HomeDashboard />} />
            <Route path="/sessions" element={<SessionDashboard filterType={filterType} filterValue={filterValue} />} />
            <Route path="/employees" element={<EmployeeDashboard />} />
            <Route path="/impact" element={<ImpactDashboard />} />
            <Route path="/themes" element={<ThemesDashboard />} />
            <Route path="/baseline" element={isScale ? <ScaleBaselineDashboard /> : <BaselineDashboard />} />
            {/* Redirect /scale to / for Scale users, show Scale for GROW users who manually navigate */}
            <Route path="/scale" element={isScale ? <Navigate to="/" replace /> : <ScaleDashboard />} />
            <Route path="*" element={isScale ? <ScaleDashboard /> : <HomeDashboard />} />
          </Routes>
        </div>
      </main>

      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold
      ${active 
        ? 'bg-boon-blue text-white shadow-md' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-boon-dark'
      }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Wrap App with Sentry Error Boundary
const AppContent: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route 
          path="/*"
          element={
            <ProtectedRoute>
              <MainPortalLayout />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
};

const App = Sentry.withErrorBoundary(AppContent, {
  fallback: (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">We've been notified and are working on it.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh Page
        </button>
      </div>
    </div>
  ),
});

export default App;