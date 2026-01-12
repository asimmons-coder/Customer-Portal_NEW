import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  getDashboardSessions, 
  getSurveyResponses, 
  getEmployeeRoster,
  getWelcomeSurveyScaleData,
  CompanyFilter,
  buildCompanyFilter
} from '../lib/dataFetcher';
import { 
  SessionWithEmployee, 
  SurveyResponse, 
  Employee 
} from '../types';
import { 
  Zap, 
  Users, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Info,
  LayoutDashboard,
  Briefcase,
  Sparkles,
  ArrowRight,
  MessageSquareQuote,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import AIInsights from './AIInsights';
import { CountUp, AnimatedProgressBar, HoverCard } from './Animations';

const categorizeRole = (jobTitle: string | undefined | null): string => {
  if (!jobTitle) return 'Unknown';
  const title = jobTitle.toLowerCase();
  
  if (title.includes('chief') || title.includes('ceo') || title.includes('cfo') || 
      title.includes('coo') || title.includes('cto') || title.includes('president') ||
      title.includes('vp') || title.includes('vice president')) {
    return 'Executive';
  }
  if (title.includes('director')) return 'Director';
  if (title.includes('manager') || title.includes('supervisor') || title.includes('lead') ||
      title.includes('head of')) return 'Manager';
  if (title.includes('senior') || title.includes('sr.') || title.includes('principal')) return 'Senior';
  if (title.includes('junior') || title.includes('jr.') || title.includes('assistant') ||
      title.includes('associate') || title.includes('coordinator') || title.includes('entry')) return 'Entry-Level';
  return 'Individual Contributor';
};

const ROLE_COLORS: Record<string, string> = {
  'Executive': '#6366F1',
  'Director': '#8B5CF6',
  'Manager': '#EC4899',
  'Senior': '#F59E0B',
  'Individual Contributor': '#10B981',
  'Entry-Level': '#06B6D4',
  'Unknown': '#9CA3AF'
};

const ROLE_ORDER = ['Executive', 'Director', 'Manager', 'Senior', 'Individual Contributor', 'Entry-Level', 'Unknown'];

const ScaleDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const windowDays = parseInt(searchParams.get('windowDays') || '365', 10);
  const selectedProgram = searchParams.get('program') || 'All Programs';
  
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [welcomeSurveys, setWelcomeSurveys] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [programDropdownOpen, setProgramDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const ADMIN_EMAILS = ['asimmons@boon-health.com', 'alexsimm95@gmail.com', 'hello@boon-health.com'];
        const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
        
        let company = session?.user?.app_metadata?.company || '';
        let compId = session?.user?.app_metadata?.company_id || '';
        let accName = session?.user?.app_metadata?.account_name || '';
        
        // Check for admin override
        if (isAdmin) {
          try {
            const stored = localStorage.getItem('boon_admin_company_override');
            if (stored) {
              const override = JSON.parse(stored);
              company = override.name;
              compId = override.id || compId;
              accName = override.account_name || accName;
            }
          } catch {}
        }
        
        setCompanyName(company);
        setCompanyId(compId);
        setAccountName(accName);

        // Build company filter using helper
        // For multi-location accounts (like Media Arts Lab), accName filters to specific location
        // For single-company accounts (like MacKenzie-Childs), compId gets all company data
        const companyFilter = buildCompanyFilter(compId, accName, company);

        console.log('ScaleDashboard using company filter:', companyFilter);

        const [sessData, survData, empData, welcomeData] = await Promise.all([
          getDashboardSessions(companyFilter),
          getSurveyResponses(companyFilter),
          getEmployeeRoster(companyFilter),
          getWelcomeSurveyScaleData(companyFilter)
        ]);
        setSessions(sessData);
        setSurveys(survData);
        setEmployees(empData);
        setWelcomeSurveys(welcomeData);
      } catch (err) {
        console.error("Scale Dashboard Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const setWindow = (days: number) => {
    setSearchParams({ windowDays: days.toString(), program: selectedProgram });
  };

  const setProgram = (program: string) => {
    setSearchParams({ windowDays: windowDays.toString(), program });
    setProgramDropdownOpen(false);
  };

  // Get unique programs from sessions
  const availablePrograms = useMemo(() => {
    const programs = new Set<string>();
    sessions.forEach(s => {
      const pt = (s as any).program_title;
      if (pt) programs.add(pt);
    });
    return ['All Programs', ...Array.from(programs).sort()];
  }, [sessions]);

  const metrics = useMemo(() => {
    if (loading) return null;

    const normalize = (s: string) => s?.toLowerCase().trim() || '';
    // Use accountName if set (for multi-company accounts like Media Arts Lab)
    // Otherwise fall back to company name
    const currentAccount = normalize(
      accountName || 
      companyName
        .split(' - ')[0]
        .replace(/\s+(SCALE|GROW|EXEC)$/i, '')
        .trim()
    );

    // Debug logging
    console.log('Session Debug:', {
      companyName,
      currentAccount,
      selectedProgram,
      totalSessionsFetched: sessions.length,
      sampleSessionAccounts: sessions.slice(0, 5).map(s => (s as any).account_name)
    });

    // Filter by program if selected
    const programFilteredSessions = selectedProgram === 'All Programs' 
      ? sessions 
      : sessions.filter(s => (s as any).program_title === selectedProgram);

    const programFilteredEmployees = selectedProgram === 'All Programs'
      ? employees
      : employees.filter(e => (e as any).program_title === selectedProgram || (e as any).coaching_program === selectedProgram);

    const programFilteredWelcomeSurveys = selectedProgram === 'All Programs'
      ? welcomeSurveys
      : welcomeSurveys.filter(w => w.program_title === selectedProgram);

    const eligibleEmployees = programFilteredEmployees.filter(e => 
      e.status !== 'Inactive' && normalize(e.company_name || e.company).includes(currentAccount)
    );

    const employeeLookup = new Map<string, Employee>();
    eligibleEmployees.forEach(e => {
      const name = normalize(e.employee_name || e.full_name || e.name || `${e.first_name} ${e.last_name}`);
      if (name) employeeLookup.set(name, e);
    });

    // Include only sessions that actually happened (exclude scheduled and coach no show)
    const completedSessions = programFilteredSessions.filter(s => {
      const status = normalize(s.status || '');
      const account = normalize(
        (s as any).account_name || 
        s.employee_manager?.company_name || 
        s.employee_manager?.company || 
        ''
      );
      // Exclude "scheduled" and "coach no show"
      const isValidStatus = status !== 'coach no show' && status !== 'scheduled';
      return isValidStatus && account.includes(currentAccount);
    });

    const now = new Date();
    const windowStart = new Date();
    windowStart.setDate(now.getDate() - windowDays);
    
    const priorWindowStart = new Date();
    priorWindowStart.setDate(now.getDate() - (windowDays * 2));

    const currentPeriodSessions = completedSessions.filter(s => new Date(s.session_date) >= windowStart);
    const priorPeriodSessions = completedSessions.filter(s => {
      const d = new Date(s.session_date);
      return d >= priorWindowStart && d < windowStart;
    });

    const getUniqueEmployees = (sess: SessionWithEmployee[]) => {
      const uniqueIds = new Set();
      sess.forEach(s => {
        const id = s.employee_id || s.employee_name || s.employee_manager?.full_name;
        if (id) uniqueIds.add(id);
      });
      return uniqueIds.size;
    };

    const activeInPeriod = getUniqueEmployees(currentPeriodSessions);
    const activeInPrior = getUniqueEmployees(priorPeriodSessions);
    
    const adoptionRate = eligibleEmployees.length > 0 ? (activeInPeriod / eligibleEmployees.length) * 100 : 0;
    const priorAdoptionRate = eligibleEmployees.length > 0 ? (activeInPrior / eligibleEmployees.length) * 100 : 0;

    const repeatUsers = currentPeriodSessions.reduce((acc, s) => {
      const id = s.employee_id || s.employee_name || s.employee_manager?.full_name;
      if (id) acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activeWithTwoPlus = Object.values(repeatUsers).filter(c => c >= 2).length;
    const engagementRate = activeInPeriod > 0 ? (activeWithTwoPlus / activeInPeriod) * 100 : 0;
    const avgSessionsPerActive = activeInPeriod > 0 ? (currentPeriodSessions.length / activeInPeriod) : 0;

    const mau = activeInPeriod;
    const mauPrior = activeInPrior;

    const parseThemes = (sessions: SessionWithEmployee[], field: keyof SessionWithEmployee) => {
      const counts: Record<string, number> = {};
      let totalTags = 0;
      sessions.forEach(s => {
        const val = s[field] as string;
        if (val) {
          totalTags++;
          val.split(';').map(t => t.trim()).filter(Boolean).forEach(t => {
            counts[t] = (counts[t] || 0) + 1;
          });
        }
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
      const pct = sessions.length > 0 ? (totalTags / sessions.length) * 100 : 0;
      return { pct, top: sorted };
    };

    const themes = {
      leadership: parseThemes(currentPeriodSessions, 'leadership_management_skills'),
      comms: parseThemes(currentPeriodSessions, 'communication_skills'),
      wellbeing: parseThemes(currentPeriodSessions, 'mental_well_being')
    };

    // Monthly sessions by role for stacked bar chart
    // Show full months that overlap with the window period
    const monthlySessionsByRole: { month: string; monthLabel: string; roles: Record<string, number>; total: number }[] = [];
    
    const months: Date[] = [];
    const tempDate = new Date(windowStart);
    tempDate.setDate(1); // Start of the month containing windowStart
    while (tempDate <= now) {
      months.push(new Date(tempDate));
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    months.forEach(monthStart => {
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      // Use completedSessions (all sessions) not currentPeriodSessions, to show full month data
      const monthSessions = completedSessions.filter(s => {
        const d = new Date(s.session_date);
        return d >= monthStart && d < monthEnd;
      });

      const roles: Record<string, number> = {};
      monthSessions.forEach(s => {
        const empName = normalize(s.employee_name || '');
        const employee = employeeLookup.get(empName);
        const jobTitle = employee?.company_role || employee?.job_title;
        const role = categorizeRole(jobTitle);
        roles[role] = (roles[role] || 0) + 1;
      });

      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
      
      monthlySessionsByRole.push({
        month: monthKey,
        monthLabel,
        roles,
        total: monthSessions.length
      });
    });

    // Filter surveys by account - extract first word for matching since accounts may differ
    // e.g., user company "Seubert & Associates" should match survey account "Seubert"
    const accountFirstWord = currentAccount.split(/[\s&]/)[0]; // Get first word before space or &
    
    // Debug logging
    console.log('Survey Debug:', {
      companyName,
      currentAccount,
      accountFirstWord,
      totalSurveys: surveys.length,
      sampleSurveyAccounts: surveys.slice(0, 5).map(s => (s as any).account_name)
    });
    
    const cohortSurveys = surveys.filter(s => {
      const surveyAccount = normalize((s as any).account_name || '');
      const match = surveyAccount.includes(accountFirstWord) || accountFirstWord.includes(surveyAccount);
      return match;
    });
    
    console.log('Matched surveys:', cohortSurveys.length);
    
    const npsScores = cohortSurveys.map(s => s.nps).filter((s): s is number => s !== null && s !== undefined);
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : null;
    
    const satScores = cohortSurveys.map(s => s.coach_satisfaction).filter((s): s is number => s !== null && s !== undefined);
    const avgSat = satScores.length > 0 ? (satScores.reduce((a,b) => a+b,0) / satScores.length).toFixed(1) : null;

    // Impact calculations - baseline vs post-session wellbeing
    // Baseline from welcome surveys
    const baselineSatisfaction = welcomeSurveys.length > 0
      ? welcomeSurveys.reduce((sum, s) => sum + (s.satisfaction || 0), 0) / welcomeSurveys.length
      : null;
    const baselineProductivity = welcomeSurveys.length > 0
      ? welcomeSurveys.reduce((sum, s) => sum + (s.productivity || 0), 0) / welcomeSurveys.length
      : null;
    const baselineWorkLifeBalance = welcomeSurveys.length > 0
      ? welcomeSurveys.reduce((sum, s) => sum + (s.work_life_balance || 0), 0) / welcomeSurveys.length
      : null;

    // Post-session from survey_responses_unified (wellbeing fields)
    const postSatisfactionScores = cohortSurveys
      .map(s => (s as any).wellbeing_satisfaction)
      .filter((s): s is number => s !== null && s !== undefined);
    const postProductivityScores = cohortSurveys
      .map(s => (s as any).wellbeing_productivity)
      .filter((s): s is number => s !== null && s !== undefined);
    const postWorkLifeScores = cohortSurveys
      .map(s => (s as any).wellbeing_balance)
      .filter((s): s is number => s !== null && s !== undefined);

    const postSatisfaction = postSatisfactionScores.length > 0
      ? postSatisfactionScores.reduce((a, b) => a + b, 0) / postSatisfactionScores.length
      : null;
    const postProductivity = postProductivityScores.length > 0
      ? postProductivityScores.reduce((a, b) => a + b, 0) / postProductivityScores.length
      : null;
    const postWorkLifeBalance = postWorkLifeScores.length > 0
      ? postWorkLifeScores.reduce((a, b) => a + b, 0) / postWorkLifeScores.length
      : null;

    const impact = {
      satisfaction: {
        baseline: baselineSatisfaction,
        post: postSatisfaction,
        change: baselineSatisfaction && postSatisfaction ? ((postSatisfaction - baselineSatisfaction) / baselineSatisfaction) * 100 : null
      },
      productivity: {
        baseline: baselineProductivity,
        post: postProductivity,
        change: baselineProductivity && postProductivity ? ((postProductivity - baselineProductivity) / baselineProductivity) * 100 : null
      },
      workLifeBalance: {
        baseline: baselineWorkLifeBalance,
        post: postWorkLifeBalance,
        change: baselineWorkLifeBalance && postWorkLifeBalance ? ((postWorkLifeBalance - baselineWorkLifeBalance) / baselineWorkLifeBalance) * 100 : null
      }
    };

    return {
      eligibleCount: eligibleEmployees.length,
      activeInPeriod,
      currentSessionsCount: currentPeriodSessions.length,
      priorSessionsCount: priorPeriodSessions.length,
      adoptionRate,
      priorAdoptionRate,
      engagementRate,
      avgSessionsPerActive,
      mau,
      mauPrior,
      activeWithTwoPlus,
      themes,
      monthlySessionsByRole,
      nps,
      avgSat,
      surveyCount: cohortSurveys.length,
      impact,
      // For AI Insights - pass raw theme counts
      rawThemes: {
        leadership: parseThemes(currentPeriodSessions, 'leadership_management_skills'),
        comms: parseThemes(currentPeriodSessions, 'communication_skills'),
        wellbeing: parseThemes(currentPeriodSessions, 'mental_well_being')
      },
      feedbackHighlights: cohortSurveys
        .flatMap(s => [(s as any).feedback_suggestions, (s as any).feedback_coach_description])
        .filter(f => f && typeof f === 'string' && f.length > 20)
    };
  }, [sessions, surveys, employees, welcomeSurveys, windowDays, companyName, loading, selectedProgram]);

  // Prepare data for AI Insights
  const aiInsightsData = useMemo(() => {
    if (!metrics) return null;
    
    // Transform themes from {pct, top} format to {theme, count} format for AI
    const transformThemes = (themeData: { pct: number; top: string[] }) => {
      // We need actual counts, not just percentages
      // For now, estimate based on total sessions and percentage
      const totalSessions = metrics.currentSessionsCount;
      return themeData.top.map((theme, idx) => ({
        theme,
        count: Math.round((themeData.pct / 100) * totalSessions / (idx + 1)) // Rough estimate
      }));
    };

    return {
      totalSessions: metrics.currentSessionsCount,
      uniqueParticipants: metrics.activeInPeriod,
      adoptionRate: metrics.adoptionRate,
      avgSessionsPerUser: metrics.avgSessionsPerActive,
      themes: {
        leadership: transformThemes(metrics.themes.leadership),
        communication: transformThemes(metrics.themes.comms),
        wellbeing: transformThemes(metrics.themes.wellbeing),
        other: []
      },
      nps: metrics.nps,
      coachSatisfaction: metrics.avgSat ? parseFloat(metrics.avgSat) : null,
      surveyCount: metrics.surveyCount,
      feedbackHighlights: metrics.feedbackHighlights || [],
      wellbeingBaseline: metrics.impact.satisfaction.baseline ? {
        satisfaction: metrics.impact.satisfaction.baseline,
        productivity: metrics.impact.productivity.baseline || 0,
        workLifeBalance: metrics.impact.workLifeBalance.baseline || 0
      } : undefined,
      wellbeingCurrent: metrics.impact.satisfaction.post ? {
        satisfaction: metrics.impact.satisfaction.post,
        productivity: metrics.impact.productivity.post || 0,
        workLifeBalance: metrics.impact.workLifeBalance.post || 0
      } : undefined
    };
  }, [metrics]);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse max-w-7xl mx-auto">
        <div className="h-20 bg-gray-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-gray-200 rounded-2xl"></div>
          <div className="h-48 bg-gray-200 rounded-2xl"></div>
          <div className="h-48 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const m = metrics!;
  const maxMonthlyTotal = Math.max(...m.monthlySessionsByRole.map(d => d.total), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Available to: <span className="text-boon-dark">{m.eligibleCount} employees</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-boon-blue" />
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active this period: <span className="text-boon-dark">{m.activeInPeriod} employees</span></span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Program Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProgramDropdownOpen(!programDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition min-w-[200px] justify-between"
            >
              <span className="truncate">{selectedProgram}</span>
              <ChevronDown size={16} className={`transition-transform ${programDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {programDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProgramDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-80 overflow-y-auto">
                  {availablePrograms.map(program => (
                    <button
                      key={program}
                      onClick={() => setProgram(program)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition ${
                        selectedProgram === program ? 'bg-boon-blue/10 text-boon-blue font-bold' : 'text-gray-700'
                      }`}
                    >
                      {program}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-50 p-1 rounded-xl flex items-center border border-gray-100">
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => setWindow(d)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${windowDays === d ? 'bg-boon-dark text-white shadow-sm' : 'text-gray-400 hover:text-boon-dark'}`}
              >
                {d === 365 ? '1 Year' : `${d} Days`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HealthCard 
          title="Adoption" 
          subtitle="Window Active / Eligible"
          value={`${m.adoptionRate.toFixed(1)}%`} 
          trend={m.priorAdoptionRate > 0 ? (m.adoptionRate - m.priorAdoptionRate) : null}
          icon={<Zap className="w-5 h-5 text-boon-blue" />}
        />
        <HealthCard 
          title="Sessions" 
          subtitle={`${windowDays === 365 ? 'Last 12 months' : `Last ${windowDays} days`}`}
          value={m.currentSessionsCount} 
          trend={m.priorSessionsCount > 0 ? ((m.currentSessionsCount - m.priorSessionsCount) / m.priorSessionsCount) * 100 : null}
          icon={<Activity className="w-5 h-5 text-boon-coral" />}
          trendLabel="vs prior period"
        />
        <HealthCard 
          title="Engagement" 
          subtitle={`${m.engagementRate.toFixed(0)}% repeat users`}
          value={`${m.avgSessionsPerActive.toFixed(1)}`} 
          label="sessions / user"
          trend={null}
          icon={<BarChart3 className="w-5 h-5 text-boon-purple" />}
        />
        <HealthCard 
          title="Momentum" 
          subtitle={`Unique users in ${windowDays === 365 ? '1 year' : `${windowDays} days`}`}
          value={m.mau} 
          trend={m.mauPrior > 0 ? ((m.mau - m.mauPrior) / m.mauPrior) * 100 : null}
          icon={<TrendingUp className="w-5 h-5 text-boon-green" />}
          trendLabel="vs prior period"
        />
      </div>

      {/* Impact Section */}
      {(m.impact.satisfaction.baseline || m.impact.productivity.baseline || m.impact.workLifeBalance.baseline) && (
        <div className="bg-gradient-to-r from-boon-purple/5 to-boon-blue/5 p-6 rounded-2xl border border-boon-purple/10">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-boon-purple" /> Impact
          </h3>
          <p className="text-sm text-gray-500 mb-6">Comparing baseline (welcome survey) to post-session feedback</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ImpactCard 
              label="Satisfaction"
              baseline={m.impact.satisfaction.baseline}
              post={m.impact.satisfaction.post}
              change={m.impact.satisfaction.change}
            />
            <ImpactCard 
              label="Productivity"
              baseline={m.impact.productivity.baseline}
              post={m.impact.productivity.post}
              change={m.impact.productivity.change}
            />
            <ImpactCard 
              label="Work-Life Balance"
              baseline={m.impact.workLifeBalance.baseline}
              post={m.impact.workLifeBalance.post}
              change={m.impact.workLifeBalance.change}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-boon-purple" /> Sessions by Role
               </h3>
               <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                 {windowDays === 365 ? 'Last 12 Months' : `Last ${windowDays} Days`}
               </span>
            </div>
            
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-right pr-2">
                <span className="text-xs text-gray-400 font-medium">{maxMonthlyTotal}</span>
                <span className="text-xs text-gray-400 font-medium">{Math.round(maxMonthlyTotal / 2)}</span>
                <span className="text-xs text-gray-400 font-medium">0</span>
              </div>
              
              <div className="ml-12 flex items-end gap-3" style={{ height: '280px' }}>
                {m.monthlySessionsByRole.map((monthData) => {
                  const barHeight = maxMonthlyTotal > 0 ? (monthData.total / maxMonthlyTotal) * 240 : 0;
                  
                  return (
                    <div key={monthData.month} className="flex-1 flex flex-col items-center">
                      <div className="text-sm font-bold text-gray-700 mb-1">{monthData.total}</div>
                      
                      <div 
                        className="w-full max-w-16 flex flex-col-reverse rounded-t-lg overflow-hidden"
                        style={{ height: `${barHeight}px`, minHeight: monthData.total > 0 ? '4px' : '0' }}
                      >
                        {ROLE_ORDER.map(role => {
                          const count = monthData.roles[role] || 0;
                          if (count === 0 || monthData.total === 0) return null;
                          return (
                            <div
                              key={role}
                              className="w-full transition-all duration-300 hover:opacity-80 cursor-pointer"
                              style={{ 
                                flex: `${count} 0 0%`,
                                backgroundColor: ROLE_COLORS[role]
                              }}
                              title={`${role}: ${count} sessions (${((count / monthData.total) * 100).toFixed(0)}%)`}
                            />
                          );
                        })}
                      </div>
                      
                      <div className="mt-3 text-sm font-semibold text-gray-600">{monthData.monthLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-4 mt-4 border-t border-gray-100">
              {ROLE_ORDER.filter(role => 
                m.monthlySessionsByRole.some(md => (md.roles[role] || 0) > 0)
              ).map(role => (
                <div key={role} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded" 
                    style={{ backgroundColor: ROLE_COLORS[role] }}
                  />
                  <span className="text-sm font-medium text-gray-600">{role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-boon-blue" /> Why Employees Book Coaching
               </h3>
               <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Self-selected focus</span>
            </div>
            
            <div className="space-y-8">
               <ThemeRow label="Leadership & Management" pct={m.themes.leadership.pct} sub={m.themes.leadership.top} color="bg-boon-purple" />
               <ThemeRow label="Communication" pct={m.themes.comms.pct} sub={m.themes.comms.top} color="bg-boon-coral" />
               <ThemeRow label="Mental Well-being" pct={m.themes.wellbeing.pct} sub={m.themes.wellbeing.top} color="bg-boon-blue" />
            </div>
          </div>
          
          <div className="bg-gray-50 border border-dashed border-gray-200 p-4 rounded-xl flex items-start gap-3">
             <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
             <p className="text-xs text-gray-500 leading-relaxed font-medium">
               <strong>Utilization Note:</strong> {m.currentSessionsCount} sessions were completed in this {windowDays === 365 ? '1-year' : `${windowDays}-day`} window. 
               This reflects employee-led demand for growth resources rather than a mandatory curriculum.
             </p>
          </div>
        </div>

        <div className="space-y-6">
           <HoverCard className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Benefit Sentiment</h3>
              <div className="space-y-6">
                 <div>
                    <div className="text-3xl font-black text-boon-dark">
                      {m.nps !== null ? (
                        <>{m.nps > 0 ? '+' : ''}<CountUp end={m.nps} duration={1500} decimals={0} /></>
                      ) : 'n/a'}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Promoter Score</div>
                 </div>
                 <div>
                    <div className="text-3xl font-black text-boon-dark">
                      {m.avgSat ? <CountUp end={parseFloat(m.avgSat)} duration={1500} decimals={1} /> : 'n/a'}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Coach Satisfaction</div>
                 </div>
                 <div className="pt-4 border-t border-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                       <span>Total Responses</span>
                       <span className="text-boon-dark font-bold">{m.surveyCount}</span>
                    </div>
                 </div>
              </div>
           </HoverCard>

           <div className="bg-boon-dark text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
              <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">Activity Band</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/70">Period Total</span>
                    <span className="text-lg font-bold"><CountUp end={m.currentSessionsCount} duration={1500} decimals={0} /> sessions</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/70">Repeat Users</span>
                    <span className="text-lg font-bold"><CountUp end={m.activeWithTwoPlus} duration={1500} decimals={0} /></span>
                 </div>
              </div>
           </div>
        </div>

      </div>
      
      {/* AI Insights Section */}
      {aiInsightsData && (
        <AIInsights
          companyName={companyName}
          companyId={companyId}
          programType="SCALE"
          timeWindowDays={windowDays}
          totalSessions={aiInsightsData.totalSessions}
          uniqueParticipants={aiInsightsData.uniqueParticipants}
          adoptionRate={aiInsightsData.adoptionRate}
          avgSessionsPerUser={aiInsightsData.avgSessionsPerUser}
          themes={aiInsightsData.themes}
          nps={aiInsightsData.nps}
          coachSatisfaction={aiInsightsData.coachSatisfaction}
          surveyCount={aiInsightsData.surveyCount}
          feedbackHighlights={aiInsightsData.feedbackHighlights}
          wellbeingBaseline={aiInsightsData.wellbeingBaseline}
          wellbeingCurrent={aiInsightsData.wellbeingCurrent}
        />
      )}
      
      {/* Testimonials Section */}
      <ScaleTestimonialsSection 
        surveys={surveys} 
        companyName={companyName}
        expandedTheme={expandedTheme}
        setExpandedTheme={setExpandedTheme}
      />
    </div>
  );
};

const HealthCard = ({ title, value, label, trend, icon, subtitle, trendLabel }: any) => {
  const isPositive = (trend || 0) > 0;
  const isZero = (trend || 0) === 0;
  
  // Parse numeric value for animation
  const numericValue = typeof value === 'string' ? parseFloat(value.replace('%', '')) : value;
  const isPercentage = typeof value === 'string' && value.includes('%');
  const isDecimal = typeof value === 'string' && value.includes('.');

  return (
    <HoverCard className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-gray-50 rounded-xl">{icon}</div>
        {trend !== null && !isZero && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'text-boon-green bg-boon-green/5' : 'text-boon-red bg-boon-red/5'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-black text-boon-dark leading-none">
          <CountUp 
            end={numericValue} 
            duration={1500} 
            decimals={isDecimal ? 1 : 0} 
            suffix={isPercentage ? '%' : ''} 
          />
          {label && <span className="text-sm font-bold text-gray-300 ml-1">{label}</span>}
        </div>
        <div className="text-xs font-bold text-boon-dark mt-2 uppercase tracking-wide">{title}</div>
        <p className="text-[10px] text-gray-400 font-medium mt-1 truncate">{subtitle} {trend !== null && trendLabel && <span className="text-gray-300 ml-1">- {trendLabel}</span>}</p>
      </div>
    </HoverCard>
  );
};

const ThemeRow = ({ label, pct, sub, color }: any) => (
  <div>
    <div className="flex justify-between items-end mb-3">
      <div>
        <h4 className="text-sm font-bold text-gray-800">{label}</h4>
        <div className="flex flex-wrap gap-2 mt-1.5">
           {sub.length > 0 ? sub.map((s: string) => (
             <span key={s} className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{s}</span>
           )) : <span className="text-[10px] text-gray-300 italic">No specific sub-themes tagged</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-black text-boon-dark">
          <CountUp end={pct} duration={1200} decimals={0} suffix="%" />
        </div>
        <div className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Frequency</div>
      </div>
    </div>
    <AnimatedProgressBar value={pct} max={100} color={color} height="h-1.5" />
  </div>
);

const ImpactCard = ({ label, baseline, post, change }: { 
  label: string; 
  baseline: number | null; 
  post: number | null; 
  change: number | null;
}) => {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  
  if (baseline === null && post === null) return null;

  return (
    <HoverCard className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{label}</div>
      
      <div className="flex items-center gap-3 mb-3">
        <div className="text-center">
          <div className="text-2xl font-black text-gray-400">
            {baseline !== null ? <CountUp end={baseline} duration={1200} decimals={1} /> : 'n/a'}
          </div>
          <div className="text-[10px] text-gray-400 font-medium">Baseline</div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-300" />
        <div className="text-center">
          <div className="text-2xl font-black text-boon-dark">
            {post !== null ? <CountUp end={post} duration={1200} decimals={1} /> : 'n/a'}
          </div>
          <div className="text-[10px] text-gray-500 font-medium">Current</div>
        </div>
      </div>
      
      {change !== null && (
        <div className={`flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-sm font-bold ${
          isPositive ? 'bg-green-50 text-green-600' : 
          isNegative ? 'bg-amber-50 text-amber-600' : 
          'bg-gray-50 text-gray-500'
        }`}>
          {isPositive ? <TrendingUp size={14} /> : isNegative ? <TrendingDown size={14} /> : null}
          {isPositive ? '+' : ''}<CountUp end={change} duration={1000} decimals={0} />% change
        </div>
      )}
    </HoverCard>
  );
};

// Testimonials Section for SCALE
const ScaleTestimonialsSection: React.FC<{
  surveys: SurveyResponse[];
  companyName: string;
  expandedTheme: string | null;
  setExpandedTheme: (theme: string | null) => void;
}> = ({ surveys, companyName, expandedTheme, setExpandedTheme }) => {
  
  // SCALE-specific theme categories
  const themeCategories = [
    { 
      name: 'Program Impact', 
      keywords: ['helpful', 'positive effect', 'feel better', 'helped me', 'valuable', 'beneficial', 'worth', 'recommend', 'glad i joined', 'great experience'],
      icon: '✨'
    },
    { 
      name: 'Personal Breakthroughs', 
      keywords: ['confident', 'open up', 'think bigger', 'challenged me', 'tools', 'skills', 'perspective', 'mindset', 'growth', 'breakthrough', 'realized', 'learned'],
      icon: '🚀'
    },
    { 
      name: 'Coach Praise', 
      keywords: ['wonderful', 'great coach', 'exceptional', 'amazing', 'the best', 'appreciate', 'thankful', 'grateful', 'lucky to have', 'love my coach', 'fantastic'],
      icon: '⭐'
    },
    { 
      name: 'Session Feedback', 
      keywords: ['longer', 'shorter', 'more often', '30 min', '45 min', 'more time', 'increase the time', 'frequency', 'duration'],
      icon: '⏱️'
    }
  ];
  
  const normalize = (str: string) => (str || '').toLowerCase().trim();
  const currentAccount = normalize(companyName.split(' - ')[0]);
  const accountFirstWord = currentAccount.split(/[\s&]/)[0];
  
  // Filter surveys by company
  const cohortSurveys = surveys.filter(s => {
    const surveyAccount = normalize((s as any).account_name || '');
    return surveyAccount.includes(accountFirstWord) || accountFirstWord.includes(surveyAccount);
  });
  
  // Get all feedback text from touchpoint and feedback surveys
  const allFeedback = cohortSurveys
    .flatMap(s => [
      (s as any).feedback_suggestions,
      (s as any).feedback_coach_description,
      (s as any).feedback_learned,
      (s as any).feedback_insight
    ])
    .filter(f => f && typeof f === 'string' && f.trim().length > 20);
  
  if (allFeedback.length === 0) return null;
  
  // Categorize feedback by theme
  const categorizedFeedback = themeCategories.map(theme => {
    const quotes = allFeedback.filter(feedback => {
      const lower = feedback.toLowerCase();
      return theme.keywords.some(kw => lower.includes(kw));
    });
    return { ...theme, quotes };
  }).filter(theme => theme.quotes.length > 0);
  
  // Add "Other" category for uncategorized feedback
  const categorizedQuotes = new Set(categorizedFeedback.flatMap(t => t.quotes));
  const otherQuotes = allFeedback.filter(f => !categorizedQuotes.has(f));
  if (otherQuotes.length > 0) {
    categorizedFeedback.push({
      name: 'Other Insights',
      keywords: [],
      icon: '💡',
      quotes: otherQuotes
    });
  }
  
  if (categorizedFeedback.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 mt-8">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <MessageSquareQuote className="w-4 h-4 text-boon-purple" />
        Participant Voices
      </h3>
      <p className="text-gray-500 text-sm mb-6">
        What participants are focusing on and learning through their coaching experience.
      </p>
      
      <div className="space-y-3">
        {categorizedFeedback.map((theme) => (
          <div key={theme.name} className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedTheme(expandedTheme === theme.name ? null : theme.name)}
              className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{theme.icon}</span>
                <span className="font-bold text-gray-800">{theme.name}</span>
                <span className="text-xs bg-boon-blue/10 text-boon-blue px-2 py-1 rounded-full font-semibold">
                  {theme.quotes.length} {theme.quotes.length === 1 ? 'quote' : 'quotes'}
                </span>
              </div>
              {expandedTheme === theme.name ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedTheme === theme.name && (
              <div className="p-5 space-y-4 bg-white">
                {theme.quotes.slice(0, 10).map((quote, idx) => (
                  <div key={idx} className="pl-4 border-l-2 border-boon-blue/30">
                    <p className="text-gray-700 text-sm italic leading-relaxed">
                      "{quote}"
                    </p>
                  </div>
                ))}
                {theme.quotes.length > 10 && (
                  <p className="text-xs text-gray-400 italic">
                    + {theme.quotes.length - 10} more responses
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <p className="text-xs text-gray-400 mt-6 italic">
        Based on {allFeedback.length} responses from coaching feedback surveys
      </p>
    </div>
  );
};

export default ScaleDashboard;