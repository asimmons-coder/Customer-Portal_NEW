import * as Sentry from "@sentry/react";
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import LoginPage from './components/LoginPage'; 
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
  Zap
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

// --- Main Portal Layout with Dynamic Program Tabs ---
const MainPortalLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sessions' | 'employees' | 'impact' | 'themes' | 'baseline'>('dashboard');
  
  // Program Type State
  const [programType, setProgramType] = useState<'GROW' | 'Scale' | 'Exec' | null>(null);
  const [programTypeLoading, setProgramTypeLoading] = useState(true);
  
  // New Filter State
  const [filterType, setFilterType] = useState<'program' | 'cohort' | 'all'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const [programs, setPrograms] = useState<string[]>([]);
  
  const [companyName, setCompanyName] = useState<string>('');
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const company = session?.user?.app_metadata?.company || '';
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
        const companyBase = company.split(' - ')[0];
        const { data: logoData } = await supabase
          .from('company_logos')
          .select('logo_url')
          .ilike('company_name', `%${companyBase}%`)
          .single();
        
        if (logoData?.logo_url) {
          setClientLogo(logoData.logo_url);
        }

        // Fetch program type from program_config
        const { data: configData, error: configError } = await supabase
          .from('program_config')
          .select('program_type')
          .ilike('account_name', `%${company.split(' - ')[0]}%`)
          .limit(1)
          .single();

        if (configData?.program_type) {
          setProgramType(configData.program_type as 'GROW' | 'Scale' | 'Exec');
          Sentry.setTag('program_type', configData.program_type);
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
        setProgramTypeLoading(false);

        // Fetch program titles for sidebar from sessions data (RLS handles account filtering)
        let foundPrograms: string[] = [];
        try {
          const { data: sessionPrograms, error: sessionError } = await supabase
            .from('session_tracking')
            .select('program_title');

          console.log('Session programs query:', { sessionPrograms, sessionError });

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
        
        // Fallback to program_config if no programs found from sessions
        if (foundPrograms.length === 0) {
          console.log('No programs from sessions, trying program_config...');
          const { data, error } = await supabase
            .from('program_config')
            .select('program_title, program_start_date')
            .ilike('account_name', `%${company.split(' - ')[0]}%`)
            .order('program_start_date', { ascending: false, nullsFirst: false });

          console.log('Program config query:', { data, error });

          if (!error && data) {
            foundPrograms = [...new Set(
              data.map(d => d.program_title)
                .filter(p => p && p.trim().length > 0)
            )] as string[];
            console.log('Unique programs found from config:', foundPrograms);
            
            if (foundPrograms.length > 0) {
              console.log('Setting programs state from config to:', foundPrograms);
              setPrograms(foundPrograms);
            }
          }
        }
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

  const handleNavClick = (tab: 'dashboard' | 'sessions' | 'employees' | 'impact' | 'themes' | 'baseline') => {
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

  // Scale-specific navigation
  const isScale = programType === 'Scale';

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
                  className="h-7 w-auto object-contain max-w-[100px]"
                />
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
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