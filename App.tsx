import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import LoginPage from './components/LoginPage'; 
import ProtectedRoute from './components/ProtectedRoute'; 

import HomeDashboard from './components/HomeDashboard';
import SessionDashboard from './components/SessionDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import ImpactDashboard from './components/ImpactDashboard';
import ThemesDashboard from './components/ThemesDashboard';
import BaselineDashboard from './components/BaselineDashboard';

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
  ClipboardList
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// --- Program Display Name Mapping ---
const programDisplayNames: Record<string, string> = {
  'CP-0028': 'GROW - Cohort 1',
  'CP-0117': 'GROW - Cohort 2',
  // Add more program mappings as needed
};

const getDisplayName = (program: string): string => {
  return programDisplayNames[program] || program;
};

// --- Main Portal Layout with Dynamic Program Tabs ---
const MainPortalLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sessions' | 'employees' | 'impact' | 'themes' | 'baseline'>('dashboard');
  
  // New Filter State
  const [filterType, setFilterType] = useState<'program' | 'cohort' | 'all'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const [programs, setPrograms] = useState<string[]>([]);
  
  const [companyName, setCompanyName] = useState<string>('');
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch programs for the current company
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const company = session?.user?.app_metadata?.company || '';
        setCompanyName(company);

        // FIXED: Fetch program_name instead of program
        const { data, error } = await supabase
          .from('session_tracking')
          .select('program_name');

        if (error) throw error;

        if (data) {
          const uniquePrograms = [...new Set(
            data.map(d => d.program_name)
              .filter(p => p && p.trim().length > 0)
          )] as string[];
          setPrograms(uniquePrograms.sort());
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };

    fetchMetadata();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login'); 
  };

  // Parse company name for display (remove program suffix if present)
  const displayCompanyName = companyName.split(' - ')[0] || companyName;

  // Helper to handle navigation and close mobile menu
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
            {displayCompanyName && (
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate max-w-[150px]">
                {displayCompanyName}
              </span>
            )}
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg active:bg-gray-200 transition touch-manipulation"
          aria-label="Toggle menu"
        >
           {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Responsive */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 lg:h-screen lg:sticky lg:top-0
        ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        {/* Desktop Header */}
        <div className="hidden lg:block p-6 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <img 
              src="https://res.cloudinary.com/djbo6r080/image/upload/v1764863780/Wordmark_Blue_16_aw7lvc.png" 
              alt="Boon Logo" 
              className="h-5 w-auto object-contain"
            />
            {displayCompanyName && (
              <>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate">
                  {displayCompanyName}
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
          
          {/* Dashboard (Home) */}
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => handleNavClick('dashboard')}
            icon={<Home size={20} />} 
            label="Dashboard" 
          />

          {/* Sessions - Expandable */}
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
                {/* All Sessions Link */}
                <button
                    onClick={() => handleSessionFilterClick('all', '')}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-all duration-200
                      ${activeTab === 'sessions' && filterType === 'all'
                        ? 'bg-boon-blue/10 text-boon-blue font-bold' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-boon-dark font-medium'
                      }`}
                  >
                    <span className="truncate text-left">All Sessions</span>
                </button>

                {/* Dynamic Program List with Display Names */}
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
                    <span className="truncate text-left">{getDisplayName(program)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <NavItem 
            active={activeTab === 'themes'} 
            onClick={() => handleNavClick('themes')}
            icon={<Lightbulb size={20} />} 
            label="Coaching Themes" 
          />

          <NavItem 
            active={activeTab === 'impact'} 
            onClick={() => handleNavClick('impact')}
            icon={<TrendingUp size={20} />} 
            label="Impact" 
          />

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

          <div className="pt-4 mt-4 border-t border-gray-100">
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
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/sessions" element={<SessionDashboard filterType={filterType} filterValue={filterValue} />} />
            <Route path="/employees" element={<EmployeeDashboard />} />
            <Route path="/impact" element={<ImpactDashboard />} />
            <Route path="/themes" element={<ThemesDashboard />} />
            <Route path="/baseline" element={<BaselineDashboard />} />
            {/* Fallback to Dashboard */}
            <Route path="*" element={<HomeDashboard />} />
          </Routes>
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

// --- NavItem Component ---
const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold
      ${active 
        ? 'bg-boon-blue text-white shadow-md shadow-boon-blue/20' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-boon-dark'
      }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);


// --- Root App Component with Security Routes ---
const App: React.FC = () => {
  return (
    <Router>
      <Analytics />
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

export default App;
