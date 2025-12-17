import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  getDashboardSessions, 
  getCompetencyScores, 
  getSurveyResponses, 
  getEmployeeRoster,
  getWelcomeSurveyData,
  getProgramConfig
} from '../lib/dataFetcher';
import { 
  SessionWithEmployee, 
  CompetencyScore, 
  SurveyResponse, 
  Employee,
  WelcomeSurveyEntry,
  ProgramConfig
} from '../types';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Star, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare,
  Activity,
  Lightbulb,
  ClipboardList,
  Smile,
  ChevronDown,
  Target
} from 'lucide-react';
import ExecutiveSignals from './ExecutiveSignals';

const PROGRAM_DISPLAY_NAMES: Record<string, string> = {
  'CP-0028': 'GROW - Cohort 1',
  'CP-0117': 'GROW - Cohort 2',
};

const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyScore[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [baselineData, setBaselineData] = useState<WelcomeSurveyEntry[]>([]);
  const [programConfig, setProgramConfig] = useState<ProgramConfig[]>([]);
  const [companyName, setCompanyName] = useState('');

  // UI State
  const selectedCohort = searchParams.get('cohort') || 'All Cohorts';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch Auth Session for Company Name
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.app_metadata?.company) {
          setCompanyName(session.user.app_metadata.company);
        }

        const [sessData, compData, survData, empData, baseData, configData] = await Promise.all([
          getDashboardSessions(),
          getCompetencyScores(),
          getSurveyResponses(),
          getEmployeeRoster(),
          getWelcomeSurveyData(),
          getProgramConfig()
        ]);
        setSessions(sessData);
        setCompetencies(compData);
        setSurveys(survData);
        setEmployees(empData);
        setBaselineData(baseData);
        setProgramConfig(configData);
        
        // Fallback to data inference if auth metadata is missing
        if (!session?.user?.app_metadata?.company && empData.length > 0 && empData[0].company) {
             setCompanyName(empData[0].company);
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Derived Cohort List ---
  const cohorts = useMemo(() => {
    const sessionCohorts = sessions.map(s => s.program_name || s.cohort || s.program).filter(Boolean);
    const unique = Array.from(new Set(sessionCohorts)).sort();
    return ['All Cohorts', ...unique];
  }, [sessions]);

  const handleCohortChange = (cohort: string) => {
    setSearchParams({ cohort });
  };

  const getCohortDisplayName = (name: string) => PROGRAM_DISPLAY_NAMES[name] || name;

  // --- Calculations ---
  const stats = useMemo(() => {
    const isAll = selectedCohort === 'All Cohorts';
    const normalize = (str: string) => (str || '').toLowerCase().trim();
    const selNorm = normalize(selectedCohort);
    
    // 1. Filter sessions to the selected cohort
    const cohortSessions = sessions.filter(s => {
        if (isAll) return true;
        const pName = normalize(s.program_name || '');
        const cName = normalize(s.cohort || '');
        const pCode = normalize(s.program || '');
        return pName === selNorm || cName === selNorm || pCode === selNorm;
    });

    // 2. Identify employees who have sessions in this cohort (Active Participants)
    const cohortEmployeeIds = new Set(
      cohortSessions.map(s => s.employee_id || s.employee_name || s.employee_manager?.full_name).filter(Boolean)
    );
    
    const totalEmployeesCount = cohortEmployeeIds.size;
    
    // 3. Roster for Surveys/Other lookups
    const enrolledEmployees = employees.filter(e => {
        if (isAll) return true;
        const p = normalize(e.program || '');
        const pn = normalize(e.program_name || '');
        const c = normalize(e.cohort || '');
        return p === selNorm || pn === selNorm || c === selNorm;
    });

    // --- Metrics Calculation ---
    
    const completedSessionsCount = cohortSessions.filter(s => {
        const status = (s.status || '').toLowerCase();
        const isPast = new Date(s.session_date) < new Date();
        return !status.includes('no show') && !status.includes('cancel') && (status.includes('completed') || (!status && isPast));
    }).length;
    
    const scheduledSessionsCount = cohortSessions.length;

    // Filter competencies
    const cohortCompetencies = competencies.filter(c => {
        if (isAll) return true;
        return normalize(c.program) === selNorm;
    });

    // Determine if Cohort is Completed
    const participantCount = new Set(cohortCompetencies.map(c => c.email)).size;
    const isCompleted = !isAll && participantCount >= 5;

    // Get Session Count from Config
    const currentAccountName = companyName.split(' - ')[0]; // Remove suffix if present
    const config = programConfig.find(p => 
        (p.account_name && p.account_name === currentAccountName) || 
        (p.account_name && p.account_name === companyName)
    );
    const sessionsPerEmployee = config?.sessions_per_employee || 12;

    const targetSessions = totalEmployeesCount * sessionsPerEmployee;
    const progressPct = targetSessions > 0 ? Math.min(100, Math.round((completedSessionsCount / targetSessions) * 100)) : 0;

    const totalPre = cohortCompetencies.reduce((acc, curr) => acc + (curr.pre || 0), 0);
    const totalPost = cohortCompetencies.reduce((acc, curr) => acc + (curr.post || 0), 0);
    const growthPct = totalPre > 0 ? ((totalPost - totalPre) / totalPre) * 100 : 0;

    const utilizationRate = 100; 

    // Filter surveys
    const validEmails = new Set(
        enrolledEmployees.map(e => e.email?.toLowerCase()).filter(Boolean)
    );

    const cohortSurveys = surveys.filter(s => {
        if (!s.email) return false;
        
        // Fix: Show all surveys in "All Cohorts" view even if they don't match the current roster
        if (isAll) return true;

        if (employees.length === 0) return true; 
        
        // If roster is incomplete (less than session participants), we include all matching surveys 
        // to avoid hiding data for employees not yet in the roster table.
        // This applies to both specific cohorts and "All Cohorts".
        if (enrolledEmployees.length < totalEmployeesCount) {
             return true; 
        }
        return validEmails.has(s.email.toLowerCase());
    });

    const npsScores = cohortSurveys.filter(r => r.nps !== null && r.nps !== undefined).map(r => r.nps!);
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = npsScores.length > 0 
        ? Math.round(((promoters - detractors) / npsScores.length) * 100) 
        : null;

    const satScores = cohortSurveys.filter(r => r.coach_satisfaction !== null && r.coach_satisfaction !== undefined).map(r => r.coach_satisfaction!);
    const avgSat = satScores.length > 0 
        ? (satScores.reduce((a,b) => a+b, 0) / satScores.length).toFixed(1) 
        : null;

    
    const cohortBaseline = baselineData.filter(b => {
        if (isAll) return true;
        const bCoh = normalize(b.cohort);
        const bComp = normalize(b.company);
        return bCoh === selNorm || bComp === selNorm || selNorm.includes(bCoh);
    });

    const focusMapping: Record<string, string> = {
      'Active Listening': 'sub_active_listening',
      'Articulating Ideas Clearly': 'sub_articulating_ideas_clearly',
      'Conflict Resolution': 'sub_conflict_resolution',
      'Giving Effective Feedback': 'sub_giving_effective_feedback',
      'Developing Feedback Skills': 'sub_developing_feedback_skills',
      'Effective Delegation Techniques': 'sub_effective_delegation_techniques',
      'Developing Delegation Skills': 'sub_developing_delegation_skills',
      'Handling Difficult Feedback': 'sub_handling_difficult_feedback',
      'Building Accountability': 'sub_building_accountability',
      'Aligning Strategy with Execution': 'sub_aligning_strategy_with_execution',
      'Communication in Teams': 'sub_communication_in_teams',
      'Monitoring & Providing Feedback': 'sub_monitoring_and_providing_feedback',
      'Handling Delegation Challenges': 'sub_handling_challenges_in_delegation'
    };

    const focusCounts: Record<string, number> = {};
    Object.keys(focusMapping).forEach(label => focusCounts[label] = 0);

    cohortBaseline.forEach(b => {
      Object.entries(focusMapping).forEach(([label, key]) => {
         if (b[key]) {
            focusCounts[label] = (focusCounts[label] || 0) + 1;
         }
      });
    });
    
    const topFocusAreas = Object.entries(focusCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const compMap = new Map<string, { sumPre: number, sumPost: number, count: number }>();
    cohortCompetencies.forEach(c => {
        if (!compMap.has(c.competency)) compMap.set(c.competency, { sumPre: 0, sumPost: 0, count: 0});
        const entry = compMap.get(c.competency)!;
        entry.sumPre += c.pre;
        entry.sumPost += c.post;
        entry.count++;
    });
    
    const topSkills = Array.from(compMap.entries()).map(([name, data]) => {
        const avgPre = data.sumPre / data.count;
        const avgPost = data.sumPost / data.count;
        const pct = avgPre > 0 ? ((avgPost - avgPre) / avgPre) * 100 : 0;
        return { name, avgPre, avgPost, pct };
    }).sort((a, b) => b.pct - a.pct).slice(0, 3);

    const themeCounts: Record<string, number> = { mental: 0, leadership: 0, comms: 0 };
    cohortSessions.forEach(s => {
       if (s.mental_well_being) themeCounts.mental++;
       if (s.leadership_management_skills) themeCounts.leadership++;
       if (s.communication_skills) themeCounts.comms++;
    });
    const totalThemes = themeCounts.mental + themeCounts.leadership + themeCounts.comms;
    
    const baselineStats = {
        satisfaction: 0, productivity: 0, balance: 0, motivation: 0, inclusion: 0
    };
    if (cohortBaseline.length > 0) {
        const sum = (key: keyof WelcomeSurveyEntry) => cohortBaseline.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
        baselineStats.satisfaction = sum('satisfaction') / cohortBaseline.length;
        baselineStats.productivity = sum('productivity') / cohortBaseline.length;
        baselineStats.balance = sum('work_life_balance') / cohortBaseline.length;
        baselineStats.motivation = sum('motivation') / cohortBaseline.length;
        baselineStats.inclusion = sum('inclusion') / cohortBaseline.length;
    }
    
    const compFields = [
      { key: 'comp_giving_and_receiving_feedback', label: 'Giving & Receiving Feedback' },
      { key: 'comp_delegation_and_accountability', label: 'Delegation & Accountability' },
      { key: 'comp_persuasion_and_influence', label: 'Persuasion & Influence' },
      { key: 'comp_time_management_and_productivity', label: 'Time Management' },
      { key: 'comp_self_confidence_and_imposter_syndrome', label: 'Self Confidence' },
      { key: 'comp_effective_communication', label: 'Effective Communication' },
      { key: 'comp_strategic_thinking', label: 'Strategic Thinking' },
      { key: 'comp_emotional_intelligence', label: 'Emotional Intelligence' },
      { key: 'comp_adaptability_and_resilience', label: 'Adaptability & Resilience' },
      { key: 'comp_building_relationships_at_work', label: 'Building Relationships' },
      { key: 'comp_effective_planning_and_execution', label: 'Effective Planning' },
      { key: 'comp_change_management', label: 'Change Management' },
    ];
    
    const baselineCompetencies = compFields.map(({ key, label }) => {
      const values = cohortBaseline
        .map(r => Number(r[key]))
        .filter(v => !isNaN(v) && v > 0);
      const avg = values.length > 0 
        ? values.reduce((a, b) => a + b, 0) / values.length 
        : 0;
      return { label, avg: Math.round(avg * 10) / 10 };
    })
    .filter(c => c.avg > 0)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5);

    const getQualityQuotes = (data: any[]) => {
      const positiveKeywords = ['help', 'learn', 'better', 'insight', 'valu', 'support', 'guid', 'great', 'lov', 'amaz', 'chang', 'grow', 'confiden', 'clarity', 'understand', 'perspect', 'progress', 'thank', 'appreciat', 'impact', 'positive', 'enjoy', 'goal', 'motivat'];
      const negativeKeywords = ["i don't know", "not sure", "nothing", "n/a", "none", "issue", "problem", "waste", "bad", "difficult", "boring"];

      return data
        .filter(d => {
            const text = d.feedback_learned || d.feedback_insight || d.feedback_suggestions;
            if (!text || text.length < 20) return false;
            const lower = text.toLowerCase();
            
            // Exclude negative/dismissive responses
            if (negativeKeywords.some(w => lower.includes(w))) return false;

            // Ensure response contains positive indicators
            if (!positiveKeywords.some(w => lower.includes(w))) return false;
            
            return true;
        })
        .map(d => d.feedback_learned || d.feedback_insight || d.feedback_suggestions)
        .sort((a, b) => {
            const actionWords = ['learned', 'now', 'started', 'stopped', 'realized', 'developed', 'changed', 'improved'];
            const aScore = actionWords.filter(w => a.toLowerCase().includes(w)).length;
            const bScore = actionWords.filter(w => b.toLowerCase().includes(w)).length;
            return bScore - aScore;
        })
        .slice(0, 3);
    };

    let quotes: string[] = [];
    if (isCompleted) {
        quotes = getQualityQuotes(cohortCompetencies);
    } else {
        quotes = getQualityQuotes(cohortSurveys);
    }

    const getRecentActivity = (sessions: SessionWithEmployee[]) => {
        const sorted = sessions
          .filter(s => {
              const status = (s.status || '').toLowerCase();
              return status.includes('completed') || (!status && new Date(s.session_date) < new Date());
          })
          .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
        
        const deduped: SessionWithEmployee[] = [];
        const seen = new Set();
        
        for (const session of sorted) {
          const key = session.employee_id || session.employee_name || session.employee_manager?.full_name;
          if (key && !seen.has(key)) {
            deduped.push(session);
            seen.add(key);
            if (deduped.length >= 5) break;
          }
        }
        return deduped;
    };

    const recentSessions = getRecentActivity(cohortSessions);

    return {
        isCompleted,
        completedSessionsCount,
        scheduledSessionsCount,
        targetSessions,
        totalEmployeesCount,
        utilizationRate,
        nps,
        avgSat,
        progressPct,
        growthPct,
        participantCount,
        topSkills,
        themes: { counts: themeCounts, total: totalThemes },
        baseline: { metrics: baselineStats, competencies: baselineCompetencies },
        quotes,
        recentSessions,
        topFocusAreas,
        selectedCohortName: getCohortDisplayName(selectedCohort),
        sessionsPerEmployee
    };
  }, [sessions, competencies, surveys, employees, baselineData, selectedCohort, programConfig, companyName]);

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-48 bg-gray-100 rounded-2xl w-full mb-8"></div>
        <div className="grid grid-cols-4 gap-6 mb-8">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 font-sans">
      
      {/* Header with Cohort Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
           <h1 className="text-xl text-gray-500 font-medium">Welcome back, <span className="text-boon-dark font-bold">{companyName.split(' - ')[0]}</span></h1>
           <div className="flex flex-wrap items-center gap-2 mt-1">
             <span className="text-3xl font-bold text-boon-dark">GROW Program Overview</span>
             
             {/* Cohort Dropdown */}
             <div className="relative group ml-0 md:ml-2">
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-boon-blue pointer-events-none" />
                <select 
                  value={selectedCohort}
                  onChange={(e) => handleCohortChange(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-1.5 bg-boon-blue/10 text-boon-blue font-bold rounded-lg border border-transparent hover:border-boon-blue/30 focus:outline-none focus:ring-2 ring-boon-blue/20 cursor-pointer text-lg transition-all"
                >
                  {cohorts.map(c => (
                    <option key={c} value={c}>{getCohortDisplayName(c)}</option>
                  ))}
                </select>
             </div>
           </div>
        </div>
      </div>

      <ExecutiveSignals 
        context="Dashboard"
        data={stats}
        selectedCohort={selectedCohort}
      />

      {/* Hero Section */}
      {stats.isCompleted ? (
        // COMPLETED HERO
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-boon-green"></div>
            <h2 className="text-xl md:text-2xl text-gray-600 font-medium mb-4">Your team improved</h2>
            <div className="text-6xl md:text-8xl font-black text-boon-green tracking-tight mb-4">
                +{stats.growthPct.toFixed(0)}%
            </div>
            <p className="text-xl md:text-2xl text-gray-600 font-medium">in leadership competencies</p>
            <p className="text-sm text-gray-400 mt-6 font-medium">
                Based on {stats.participantCount} participants completing pre/post assessments
            </p>
        </div>
      ) : (
        // IN-PROGRESS HERO
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-boon-blue"></div>
            <h2 className="text-xl md:text-2xl text-gray-600 font-medium mb-4">Your team is</h2>
            <div className="text-6xl md:text-8xl font-black text-boon-blue tracking-tight mb-4">
                {stats.progressPct}%
            </div>
            <p className="text-xl md:text-2xl text-gray-600 font-medium">through the program</p>
            <p className="text-sm text-gray-400 mt-6 font-medium">
                {stats.completedSessionsCount} of {stats.targetSessions} expected sessions completed ({stats.totalEmployeesCount} employees × {stats.sessionsPerEmployee} sessions)
            </p>
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.completedSessionsCount > 0 && (
          <MetricCard 
              value={stats.completedSessionsCount} 
              label="Sessions Completed" 
              icon={<CheckCircle2 className="w-5 h-5 text-boon-blue" />}
          />
        )}
        {/* Always show utilization if count is available */}
        {stats.totalEmployeesCount > 0 && (
          <MetricCard 
              value={`${stats.utilizationRate}%`} 
              label="Utilization" 
              icon={<Activity className="w-5 h-5 text-boon-purple" />}
              subtext="Participating employees"
          />
        )}
        {stats.nps !== null && (
          <MetricCard 
              value={stats.nps > 0 ? `+${stats.nps}` : stats.nps} 
              label="NPS Score" 
              icon={<Users className="w-5 h-5 text-boon-coral" />}
          />
        )}
        {stats.avgSat !== null && (
          <MetricCard 
              value={`${stats.avgSat}/10`} 
              label="Coach Satisfaction" 
              icon={<Star className="w-5 h-5 text-boon-yellow" />}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* Focus Competency Section (Welcome Survey) */}
            {stats.topFocusAreas.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-boon-dark flex items-center gap-2">
                       <Target className="w-5 h-5 text-boon-red" /> What Your Team Wants to Focus On
                    </h3>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Welcome Survey</div>
                 </div>
                 <div className="space-y-3">
                    {stats.topFocusAreas.map(([comp, count], index) => (
                       <div key={comp}>
                          <div className="flex justify-between text-sm font-bold mb-1">
                             <span className="text-gray-700">{comp}</span>
                             <span className="text-gray-500">{count} employees</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                             <div 
                               className="h-full rounded-full bg-boon-red opacity-80" 
                               style={{ width: `${(count / stats.topFocusAreas[0][1]) * 100}%` }}
                             ></div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            {stats.isCompleted ? (
                // COMPLETED: Growth Areas
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-boon-dark flex items-center gap-2">
                           <TrendingUp className="w-5 h-5 text-boon-green" /> Biggest Areas of Growth
                        </h3>
                        <button onClick={() => navigate('/impact')} className="text-sm font-bold text-boon-blue hover:underline">View impact →</button>
                    </div>
                    {stats.topSkills.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {stats.topSkills.map((skill) => (
                                <div key={skill.name} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between">
                                    <div className="text-3xl font-bold text-boon-green mb-1">+{skill.pct.toFixed(0)}%</div>
                                    <div className="font-bold text-gray-800 text-sm leading-tight mb-3">{skill.name}</div>
                                    <div className="text-xs font-semibold text-gray-400">
                                        {skill.avgPre.toFixed(1)} <span className="mx-1">→</span> {skill.avgPost.toFixed(1)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-8 italic">Data pending...</div>
                    )}
                </div>
            ) : (
                // IN-PROGRESS: Themes Snapshot
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-boon-dark flex items-center gap-2">
                           <Lightbulb className="w-5 h-5 text-boon-yellow" /> What Your Team is Working On
                        </h3>
                        <button onClick={() => navigate('/themes')} className="text-sm font-bold text-boon-blue hover:underline">View all themes →</button>
                    </div>
                    
                    <div className="space-y-4">
                        <ThemeBar label="Leadership Skills" count={stats.themes.counts.leadership} total={stats.themes.total} color="bg-boon-purple" />
                        <ThemeBar label="Communication" count={stats.themes.counts.comms} total={stats.themes.total} color="bg-boon-coral" />
                        <ThemeBar label="Mental Well-being" count={stats.themes.counts.mental} total={stats.themes.total} color="bg-boon-blue" />
                    </div>
                </div>
            )}

            {/* Baseline Snapshot (Reordered: Competencies First) */}
            {!stats.isCompleted && (
                 <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-boon-dark flex items-center gap-2">
                           <ClipboardList className="w-5 h-5 text-gray-400" /> Where Your Team Started
                        </h3>
                        <button onClick={() => navigate('/baseline')} className="text-sm font-bold text-boon-blue hover:underline">View baseline →</button>
                    </div>

                    {stats.baseline.competencies.length > 0 && (
                        <div className="mb-6">
                             <h4 className="text-sm font-medium text-gray-500 mb-2">TOP OPPORTUNITIES FOR GROWTH</h4>
                             <p className="text-xs text-gray-400 mb-5">
                               Self-rated: Learning (1) → Growing (2) → Applying (3) → Excelling (4) → Mastery (5)
                             </p>
                             
                             <div className="space-y-4">
                                {stats.baseline.competencies.map(comp => (
                                    <div key={comp.label} className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-bold text-gray-700 w-1/2 truncate" title={comp.label}>{comp.label}</span>
                                      <div className="flex items-center gap-3 flex-1 justify-end">
                                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-boon-blue rounded-full" 
                                            style={{ width: `${(comp.avg / 5) * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-sm font-bold text-boon-dark w-8 text-right">{comp.avg.toFixed(1)}</span>
                                      </div>
                                    </div>
                                ))}
                             </div>

                             <p className="text-xs text-gray-400 mt-5 leading-relaxed">
                               Participants in completed cohorts showed measurable improvement across all competencies.
                             </p>
                        </div>
                    )}

                    <div className="pt-6 border-t border-gray-100">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Wellbeing Baseline (1-10)</h4>
                        <div className="grid grid-cols-5 gap-2 text-center">
                            <BaselineMetric label="Satisfac." value={stats.baseline.metrics.satisfaction} />
                            <BaselineMetric label="Product." value={stats.baseline.metrics.productivity} />
                            <BaselineMetric label="Balance" value={stats.baseline.metrics.balance} />
                            <BaselineMetric label="Motivat." value={stats.baseline.metrics.motivation} />
                            <BaselineMetric label="Inclusion" value={stats.baseline.metrics.inclusion} />
                        </div>
                    </div>
                 </div>
            )}

            {/* Quotes Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-boon-dark mb-6 flex items-center gap-2">
                   <MessageSquare className="w-5 h-5 text-boon-blue" /> 
                   {stats.isCompleted ? "In Their Own Words" : "Early Feedback"}
                </h3>
                {stats.quotes.length > 0 ? (
                    <div className="space-y-4">
                        {stats.quotes.map((quote, i) => (
                            <div key={i} className="bg-gray-50 p-4 rounded-r-xl border-l-4 border-boon-blue">
                                <p className="text-gray-600 italic leading-relaxed text-sm">"{quote}"</p>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-2">— Program Participant</p>
                            </div>
                        ))}
                    </div>
                ) : (
                     <div className="p-8 text-center text-gray-400 italic">
                        Feedback will appear here as employees complete surveys.
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Activity */}
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-boon-dark">Recent Activity</h3>
                <button 
                    onClick={() => navigate('/sessions')}
                    className="text-sm font-bold text-boon-blue hover:text-boon-darkBlue flex items-center gap-1"
                >
                    View all <ArrowRight className="w-4 h-4" />
                </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                {stats.recentSessions.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {stats.recentSessions.map((session) => {
                            const empName = session.employee_manager?.full_name || session.employee_name || 'Employee';
                            const dateStr = new Date(session.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            return (
                                <div key={session.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-boon-blue/10 rounded-full shrink-0">
                                            <CheckCircle2 className="w-4 h-4 text-boon-blue" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-800 leading-snug">
                                                <span className="font-bold">{empName}</span> completed session with their coach.
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-400 italic text-sm">
                        No recent sessions found for this cohort.
                    </div>
                )}
            </div>
            
            {/* Quick Actions */}
             <div className="space-y-3">
                <button 
                    onClick={() => navigate('/employees')}
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:border-boon-blue hover:text-boon-blue transition-colors text-left flex justify-between items-center group"
                >
                    Manage Employees
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-boon-blue" />
                </button>
                <button 
                    onClick={() => navigate('/impact')}
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:border-boon-blue hover:text-boon-blue transition-colors text-left flex justify-between items-center group"
                >
                    Full Impact Report
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-boon-blue" />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

// --- Sub Components ---

const MetricCard = ({ value, label, icon, subtext }: { value: string | number, label: string, icon: React.ReactNode, subtext?: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
          <div className="text-3xl font-black text-gray-800 tracking-tight">{value}</div>
          <div className="p-2.5 bg-gray-50 rounded-xl text-gray-600">{icon}</div>
      </div>
      <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</div>
          {subtext && <div className="text-[10px] text-gray-400 font-medium mt-1">{subtext}</div>}
      </div>
  </div>
);

const ThemeBar = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => (
    <div>
        <div className="flex justify-between text-xs font-bold mb-1.5">
            <span className="text-gray-700">{label}</span>
            <span className="text-gray-400">{Math.round((count/total)*100)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(count/total)*100}%` }}></div>
        </div>
    </div>
);

const BaselineMetric = ({ label, value }: { label: string, value: number }) => (
    <div className="flex flex-col items-center gap-1">
        <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center font-bold text-gray-700 text-xs shadow-sm">
            {value.toFixed(1)}
        </div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{label}</div>
    </div>
);

export default HomeDashboard;
