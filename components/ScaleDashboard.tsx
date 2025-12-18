
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  getDashboardSessions, 
  getSurveyResponses, 
  getEmployeeRoster 
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
  Calendar,
  Star,
  ArrowRight,
  BarChart3,
  Info,
  Clock,
  LayoutDashboard
} from 'lucide-react';

const ScaleDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const windowDays = parseInt(searchParams.get('windowDays') || '90', 10);
  
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const company = session?.user?.app_metadata?.company || '';
        setCompanyName(company);

        const [sessData, survData, empData] = await Promise.all([
          getDashboardSessions(),
          getSurveyResponses(),
          getEmployeeRoster()
        ]);
        setSessions(sessData);
        setSurveys(survData);
        setEmployees(empData);
      } catch (err) {
        console.error("Scale Dashboard Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const setWindow = (days: number) => {
    setSearchParams({ windowDays: days.toString() });
  };

  const metrics = useMemo(() => {
    if (loading) return null;

    const normalize = (s: string) => s?.toLowerCase().trim() || '';
    const currentAccount = normalize(companyName.split(' - ')[0]);

    // 1. Eligible (Active Employees)
    const eligibleEmployees = employees.filter(e => 
      e.status !== 'Inactive' && normalize(e.company_name || e.company).includes(currentAccount)
    );

    // 2. Completed Sessions in the current account
    const completedSessions = sessions.filter(s => {
      const status = normalize(s.status || '');
      // Fix: Use employee_manager company info as account_name does not exist on SessionWithEmployee
      const account = normalize(s.employee_manager?.company_name || s.employee_manager?.company || '');
      return status === 'completed' && account.includes(currentAccount);
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

    // Momentum (Current Calendar Month)
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const thisMonthSessions = completedSessions.filter(s => new Date(s.session_date) >= startOfCurrentMonth);
    const lastMonthSessions = completedSessions.filter(s => {
      const d = new Date(s.session_date);
      return d >= startOfLastMonth && d < startOfCurrentMonth;
    });

    const mau = getUniqueEmployees(thisMonthSessions);
    const mauPrior = getUniqueEmployees(lastMonthSessions);

    // Theme Analysis
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

    // Feedback
    // Fix: Filter surveys by matching emails from the current account's eligible roster since 'account' does not exist on SurveyResponse
    const eligibleEmails = new Set(eligibleEmployees.map(e => normalize(e.company_email || e.email)).filter(Boolean));
    const cohortSurveys = surveys.filter(s => s.email && eligibleEmails.has(normalize(s.email)));
    
    const npsScores = cohortSurveys.map(s => s.nps).filter((s): s is number => s !== null && s !== undefined);
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : null;
    
    const satScores = cohortSurveys.map(s => s.coach_satisfaction).filter((s): s is number => s !== null && s !== undefined);
    const avgSat = satScores.length > 0 ? (satScores.reduce((a,b) => a+b,0) / satScores.length).toFixed(1) : null;

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
      nps,
      avgSat,
      surveyCount: cohortSurveys.length
    };
  }, [sessions, surveys, employees, windowDays, companyName, loading]);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 font-sans">
      
      {/* Global Context Bar */}
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
        
        <div className="bg-gray-50 p-1 rounded-xl flex items-center border border-gray-100">
          {[30, 90, 180].map(d => (
            <button
              key={d}
              onClick={() => setWindow(d)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${windowDays === d ? 'bg-boon-dark text-white shadow-sm' : 'text-gray-400 hover:text-boon-dark'}`}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* Hero Cards: Resource Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthCard 
          title="Adoption" 
          subtitle={`Window Active / Eligible`}
          value={`${m.adoptionRate.toFixed(1)}%`} 
          trend={m.priorAdoptionRate > 0 ? (m.adoptionRate - m.priorAdoptionRate) : null}
          icon={<Zap className="w-5 h-5 text-boon-blue" />}
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
          subtitle="Unique users this month"
          value={m.mau} 
          trend={m.mauPrior > 0 ? (m.mau - m.mauPrior) : null}
          icon={<TrendingUp className="w-5 h-5 text-boon-green" />}
          trendLabel="vs last month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Why Employees Book Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-boon-blue" /> Why Employees Book Coaching
               </h3>
               <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Self-selected focus</span>
            </div>
            
            <div className="space-y-8">
               <ThemeRow 
                label="Leadership & Management" 
                pct={m.themes.leadership.pct} 
                sub={m.themes.leadership.top} 
                color="bg-boon-purple" 
               />
               <ThemeRow 
                label="Communication" 
                pct={m.themes.comms.pct} 
                sub={m.themes.comms.top} 
                color="bg-boon-coral" 
               />
               <ThemeRow 
                label="Mental Well-being" 
                pct={m.themes.wellbeing.pct} 
                sub={m.themes.wellbeing.top} 
                color="bg-boon-blue" 
               />
            </div>
          </div>
          
          <div className="bg-gray-50 border border-dashed border-gray-200 p-4 rounded-xl flex items-start gap-3">
             <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
             <p className="text-xs text-gray-500 leading-relaxed font-medium">
               <strong>Utilization Note:</strong> {m.currentSessionsCount} sessions were completed in this {windowDays}-day window. 
               This reflects employee-led demand for growth resources rather than a mandatory curriculum.
             </p>
          </div>
        </div>

        {/* Sidebar Column: Feedback & Utilization */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Benefit Sentiment</h3>
              <div className="space-y-6">
                 <div>
                    <div className="text-3xl font-black text-boon-dark">{m.nps !== null ? (m.nps > 0 ? `+${m.nps}` : m.nps) : 'n/a'}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Promoter Score</div>
                 </div>
                 <div>
                    <div className="text-3xl font-black text-boon-dark">{m.avgSat || 'n/a'}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg Coach Satisfaction</div>
                 </div>
                 <div className="pt-4 border-t border-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
                       <span>Total Responses</span>
                       <span className="text-boon-dark font-bold">{m.surveyCount}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-boon-dark text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
              <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">Activity Band</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/70">Period Total</span>
                    <span className="text-lg font-bold">{m.currentSessionsCount} sessions</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white/70">Repeat Users</span>
                    <span className="text-lg font-bold">{m.activeWithTwoPlus}</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

// Sub-components

const HealthCard = ({ title, value, label, trend, icon, subtitle, trendLabel }: any) => {
  const isPositive = (trend || 0) > 0;
  const isZero = (trend || 0) === 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:border-boon-blue/20 transition-colors">
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
          {value} <span className="text-sm font-bold text-gray-300">{label}</span>
        </div>
        <div className="text-xs font-bold text-boon-dark mt-2 uppercase tracking-wide">{title}</div>
        <p className="text-[10px] text-gray-400 font-medium mt-1 truncate">{subtitle} {trend !== null && trendLabel && <span className="text-gray-300 ml-1">· {trendLabel}</span>}</p>
      </div>
    </div>
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
        <div className="text-lg font-black text-boon-dark">{pct.toFixed(0)}%</div>
        <div className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Frequency</div>
      </div>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
       <div 
        className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} 
        style={{ width: `${pct}%`, opacity: 0.8 }}
       ></div>
    </div>
  </div>
);

export default ScaleDashboard;
