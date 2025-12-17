import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardSessions, getEmployeeRoster, getSurveyResponses } from '../lib/dataFetcher';
import { SessionWithEmployee, Employee, SurveyResponse } from '../types';
import { 
  Users, 
  Calendar, 
  Search, 
  AlertCircle,
  Code,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowUp,
  X,
  Info,
  Layers,
  Star,
  EyeOff
} from 'lucide-react';
import ExecutiveSignals from './ExecutiveSignals';

// --- Program Display Name Mapping ---
const programDisplayNames: Record<string, string> = {
  'CP-0028': 'GROW - Cohort 1',
  'CP-0117': 'GROW - Cohort 2',
};

const getDisplayName = (program: string): string => {
  return programDisplayNames[program] || program;
};

interface SessionDashboardProps {
  filterType: 'program' | 'cohort' | 'all';
  filterValue: string;
}

const SessionDashboard: React.FC<SessionDashboardProps> = ({ filterType, filterValue }) => {
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [selectedStat, setSelectedStat] = useState<any>(null);

  const [hiddenEmployees, setHiddenEmployees] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('boon_hidden_employees');
        return new Set(saved ? JSON.parse(saved) : []);
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  });

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const [sessionsData, rosterData, surveyData] = await Promise.all([
          getDashboardSessions(),
          getEmployeeRoster(),
          getSurveyResponses()
        ]);
        if (mounted) {
          setSessions(sessionsData || []);
          setEmployees(rosterData || []);
          setSurveys(surveyData || []);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Dashboard Load Error:", err);
          setError(err.message || String(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const handleHideEmployee = (e: React.MouseEvent, id: string | number, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove ${name} from this list?`)) {
      const next = new Set(hiddenEmployees);
      next.add(String(id));
      setHiddenEmployees(next);
      localStorage.setItem('boon_hidden_employees', JSON.stringify(Array.from(next)));
    }
  };

  const aggregatedStats = useMemo(() => {
    const statsMap = new Map<string, any>();
    employees.forEach(emp => {
      const name = emp.full_name || emp.employee_name || emp.name || 'Unknown';
      if (name.toLowerCase() === 'kimberly genes') return;
      if (hiddenEmployees.has(String(emp.id))) return;
      const key = name.toLowerCase();
      statsMap.set(key, {
        id: emp.id,
        name: name,
        program: emp.program || emp.program_name || 'Unassigned',
        cohort: emp.cohort || emp.program_name || '', 
        avatar_url: emp.avatar_url,
        completed: 0,
        noshow: 0,
        scheduled: 0,
        total: 0,
        latestSession: null,
        email: emp.email || emp.company_email
      });
    });

    sessions.forEach(session => {
      const emp = session.employee_manager;
      const name = emp?.full_name || emp?.first_name 
                   ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                   : (session.employee_name || 'Unknown Employee');
      if (name.toLowerCase() === 'kimberly genes') return;
      if (session.employee_id && hiddenEmployees.has(String(session.employee_id))) return;
      const key = name.toLowerCase();
      const sessionProgram = session.program_name || session.program || '';
      const sessionCohort = session.cohort || session.program_name || '';
      let includeSession = true;
      if (filterType === 'program' && sessionProgram !== filterValue) includeSession = false;
      if (filterType === 'cohort' && sessionCohort !== filterValue) includeSession = false;

      if (!statsMap.has(key)) {
        if (hiddenEmployees.has(String(session.employee_id || session.id))) return;
        statsMap.set(key, {
          id: session.employee_id || session.id,
          name: name,
          program: sessionProgram || 'Unassigned',
          cohort: sessionCohort,
          avatar_url: emp?.avatar_url,
          completed: 0,
          noshow: 0,
          scheduled: 0,
          total: 0,
          latestSession: null,
          email: emp?.email || emp?.company_email
        });
      }
      const entry = statsMap.get(key)!;
      if (includeSession) {
        entry.total += 1;
        const statusRaw = (session.status || '').toLowerCase();
        const sessionDate = new Date(session.session_date);
        const isPast = sessionDate < new Date();
        if (statusRaw.includes('no show') || statusRaw.includes('noshow') || statusRaw.includes('late cancel')) {
          entry.noshow += 1;
        } else if (statusRaw.includes('completed') || (statusRaw === '' && isPast)) {
          entry.completed += 1;
        } else {
          entry.scheduled += 1;
        }
      }
    });
    return Array.from(statsMap.values());
  }, [sessions, employees, filterType, filterValue, hiddenEmployees]);

  const filteredData = useMemo(() => {
    return aggregatedStats.filter(stat => {
      const matchesSearch = stat.name.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesContext = false;
      if (stat.total > 0) matchesContext = true;
      else {
        if (filterType === 'all') matchesContext = true;
        else if (filterType === 'program') matchesContext = (stat.program === filterValue);
        else if (filterType === 'cohort') matchesContext = (stat.cohort === filterValue);
      }
      return matchesSearch && matchesContext;
    });
  }, [aggregatedStats, searchTerm, filterType, filterValue]);

  const surveyMetrics = useMemo(() => {
    const validEmails = new Set(filteredData.map(e => e.email?.toLowerCase()).filter(Boolean));
    const filteredSurveys = surveys.filter(s => filterType === 'all' || (s.email && validEmails.has(s.email.toLowerCase())));
    const npsScores = filteredSurveys.filter(r => r.nps !== null && r.nps !== undefined).map(r => r.nps!);
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : null;
    const satScores = filteredSurveys.filter(r => r.coach_satisfaction !== null && r.coach_satisfaction !== undefined).map(r => r.coach_satisfaction!);
    const avgSat = satScores.length > 0 ? (satScores.reduce((a,b) => a+b, 0) / satScores.length).toFixed(1) : null;
    return { nps, avgSat };
  }, [surveys, filteredData, filterType]);

  const kpis = useMemo(() => {
    const totalEmployees = filteredData.length;
    const totalSessions = filteredData.reduce((acc, curr) => acc + curr.total, 0);
    const totalCompleted = filteredData.reduce((acc, curr) => acc + curr.completed, 0);
    const totalCompletedAndNoShow = filteredData.reduce((acc, curr) => acc + curr.completed + curr.noshow, 0);
    const avgSessions = totalEmployees > 0 ? (totalCompletedAndNoShow / totalEmployees).toFixed(1) : '0.0';
    const engagedEmployees = filteredData.filter(e => e.total > 0).length;
    const adoptionRate = totalEmployees > 0 ? Math.round((engagedEmployees / totalEmployees) * 100) : 0;
    return { totalEmployees, totalSessions, totalCompleted, avgSessions, adoptionRate, engagedEmployees };
  }, [filteredData]);

  // Stable data object for AI analysis
  const aiData = useMemo(() => ({
    filteredData,
    ...kpis,
    ...surveyMetrics
  }), [filteredData, kpis, surveyMetrics]);

  if (loading) return (
    <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
      <div className="h-12 bg-gray-200 rounded w-1/4 mb-8"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
      </div>
    </div>
  );

  const displayTitle = filterType === 'all' ? "All Sessions" : "Session Tracking";
  const displaySubtitle = filterType !== 'all' ? getDisplayName(filterValue) : "";

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 md:pb-12 font-sans">
      {selectedStat && (
        <EmployeeDetailModal 
          employee={selectedStat} 
          sessions={sessions.filter(s => {
             const sName = s.employee_name || s.employee_manager?.full_name || '';
             const nameMatch = sName.toLowerCase().trim() === selectedStat.name.toLowerCase().trim();
             const sessionProgram = s.program_name || s.program || '';
             let matchesFilter = filterType === 'all' || (filterType === 'program' && sessionProgram === filterValue);
             return nameMatch && matchesFilter;
          })}
          onClose={() => setSelectedStat(null)}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
            <h1 className="text-2xl md:text-4xl font-extrabold text-boon-dark tracking-tight uppercase">{displayTitle}</h1>
            {filterType !== 'all' && (
              <span className="bg-boon-blue/10 text-boon-blue px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-sm">
                 <Layers size={14} />
                 <span className="truncate max-w-[200px]">{displaySubtitle}</span>
              </span>
            )}
          </div>
          <p className="text-gray-500 font-medium text-xs md:text-sm">
             Viewing {kpis.totalEmployees} employees in {filterType === 'all' ? 'total' : 'this program'}
          </p>
        </div>
        <button onClick={() => setShowSetup(!showSetup)} className="text-xs font-bold text-gray-400 hover:text-boon-blue transition flex items-center gap-1 uppercase tracking-wide">
             <Code className="w-3 h-3" />
             {showSetup ? 'Hide Schema Helper' : 'Schema Helper'}
        </button>
      </div>

      <ExecutiveSignals context="Sessions" data={aiData} />

      {showSetup && <SetupGuide />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPICard title="TOTAL EMPLOYEES" value={kpis.totalEmployees} color="bg-boon-blue" icon={<Users className="w-6 h-6 text-white/50" />} />
        <AdoptionMetricCard rate={kpis.adoptionRate} engaged={kpis.engagedEmployees} total={kpis.totalEmployees} />
        <KPICard title="TOTAL SESSIONS" value={kpis.totalSessions} color="bg-boon-red" icon={<Calendar className="w-6 h-6 text-white/50" />} />
        <KPICard title="COMPLETED" value={kpis.totalCompleted} color="bg-boon-green" icon={<CheckCircle2 className="w-6 h-6 text-white/50" />} />
        <KPICard title="AVG SESSIONS" value={kpis.avgSessions} color="bg-boon-yellow" icon={<TrendingUp className="w-6 h-6 text-white/50" />} textColor="text-boon-dark" />
        {surveyMetrics.nps !== null && (
          <KPICard title="NPS SCORE" value={surveyMetrics.nps > 0 ? `+${surveyMetrics.nps}` : surveyMetrics.nps} color="bg-boon-coral" icon={<Users className="w-6 h-6 text-white/50" />} />
        )}
        {surveyMetrics.avgSat !== null && (
          <KPICard title="CSAT SCORE" value={`${surveyMetrics.avgSat}/10`} color="bg-boon-darkBlue" icon={<Star className="w-6 h-6 text-white/50" />} />
        )}
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <h3 className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-boon-blue" /> Completed Sessions Trend
        </h3>
        <div className="h-36 md:h-64 w-full">
            <SimpleTrendChart sessions={sessions} filterType={filterType} filterValue={filterValue} />
        </div>
      </div>

      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96 bg-boon-bg rounded-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search name..." 
            className="w-full pl-10 pr-4 py-2.5 bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Employee Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Program</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Completed</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">No-Shows</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Total</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((emp) => (
                <tr key={emp.id} onClick={() => setSelectedStat(emp)} className="hover:bg-boon-blue/5 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-boon-lightBlue flex items-center justify-center text-xs font-bold text-boon-blue overflow-hidden">
                          {emp.avatar_url ? <img src={emp.avatar_url} className="w-full h-full object-cover"/> : emp.name.substring(0,2).toUpperCase()}
                       </div>
                       <span className="font-bold text-gray-800 text-sm">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-boon-blue/10 text-boon-blue uppercase">
                      {getDisplayName(emp.program)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-boon-green">{emp.completed}</td>
                  <td className="px-6 py-4 text-center text-sm text-boon-red font-bold">{emp.noshow > 0 ? emp.noshow : '-'}</td>
                  <td className="px-6 py-4 text-center text-sm font-black">{emp.total}</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={(e) => handleHideEmployee(e, emp.id, emp.name)} className="p-2 text-gray-300 hover:text-boon-red transition-colors">
                       <EyeOff size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ title, value, color, icon, textColor = "text-white" }: any) => (
    <div className={`${color} rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">{icon}</div>
          <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/70">{title}</p>
              <p className={`text-3xl font-black ${textColor}`}>{value}</p>
          </div>
        </div>
    </div>
);

const AdoptionMetricCard = ({ rate, engaged, total }: { rate: number, engaged: number, total: number }) => (
    <div className="bg-boon-purple text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-start">
            <div className="flex flex-col">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">UTILIZATION</p>
                <span className="text-3xl font-black">{rate}%</span>
            </div>
            <div className="p-2 bg-white/20 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
        </div>
        <div className="mt-4">
            <div className="w-full bg-white/20 h-1.5 rounded-full"><div className="bg-white h-full rounded-full" style={{width: `${rate}%`}}></div></div>
            <p className="text-[10px] mt-2 font-bold opacity-80">{engaged} / {total} EMPLOYEES</p>
        </div>
    </div>
);

const SimpleTrendChart = ({ sessions, filterType, filterValue }: any) => {
  const chartData = useMemo(() => {
    const monthlyCounts: Record<string, number> = {};
    sessions.forEach((s: any) => {
      const status = (s.status || '').toLowerCase();
      if (!status.includes('completed')) return;
      const d = new Date(s.session_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    });
    return Object.keys(monthlyCounts).sort().map(k => ({ label: k, value: monthlyCounts[k] }));
  }, [sessions]);

  if (chartData.length === 0) return <div className="h-full flex items-center justify-center text-gray-400">No data.</div>;
  const max = Math.max(...chartData.map(d => d.value), 1);

  return (
    <div className="w-full h-full flex items-end gap-2 pb-6">
      {chartData.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
           <div className="w-full bg-boon-blue/20 rounded-t-lg relative group cursor-help" style={{height: `${(d.value/max)*100}%`}}>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-boon-dark text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">{d.value}</div>
           </div>
           <span className="text-[10px] font-bold text-gray-400 uppercase">{d.label.split('-')[1]}</span>
        </div>
      ))}
    </div>
  );
};

const EmployeeDetailModal = ({ employee, sessions, onClose }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-boon-dark/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-boon-blue flex items-center justify-center text-white font-black text-xl border-2 border-white shadow-md">
                        {employee.avatar_url ? <img src={employee.avatar_url} className="w-full h-full object-cover rounded-full"/> : employee.name.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-boon-dark uppercase tracking-tight">{employee.name}</h2>
                        <span className="bg-boon-blue/10 text-boon-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase">{getDisplayName(employee.program)}</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-gray-200 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                   <Calendar size={14} /> Session History
                </h3>
                {sessions.length > 0 ? sessions.sort((a: any, b: any) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()).map((s: any) => (
                    <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex justify-between items-center">
                        <div>
                            <p className="font-bold text-gray-800 text-sm">{new Date(s.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            {s.notes && <p className="text-xs text-gray-500 mt-1 italic">"{s.notes}"</p>}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${s.status?.toLowerCase().includes('completed') ? 'bg-boon-green/10 text-boon-green' : 'bg-gray-100 text-gray-500'}`}>
                            {s.status || 'Completed'}
                        </span>
                    </div>
                )) : <div className="text-center py-12 text-gray-400 italic text-sm">No session records found.</div>}
            </div>
        </div>
    </div>
);

const SetupGuide = () => (
  <div className="bg-boon-dark text-white p-6 rounded-xl shadow-xl border border-gray-700 mb-8">
    <div className="flex items-center gap-3 mb-4">
      <Code className="w-6 h-6 text-boon-blue" />
      <h3 className="text-lg font-bold">SQL Schema Assistant</h3>
    </div>
    <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-[10px] font-mono text-gray-400">
      {`select distinct program_name from session_tracking;`}
    </pre>
  </div>
);

export default SessionDashboard;
