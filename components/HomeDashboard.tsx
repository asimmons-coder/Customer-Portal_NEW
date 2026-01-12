import { ADMIN_EMAILS } from '../constants';
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  CountUp, 
  CountUpPercentage, 
  CountUpNPS, 
  CountUpRating,
  HoverCard,
  AnimatedProgressBar,
  SkeletonDashboard
} from './Animations';
import { 
  getDashboardSessions, 
  getCompetencyScores, 
  getSurveyResponses, 
  getEmployeeRoster,
  getWelcomeSurveyData,
  getProgramConfig,
  getFocusAreaSelections,
  CompanyFilter,
  buildCompanyFilter
} from '../lib/dataFetcher';
import { 
  SessionWithEmployee, 
  CompetencyScore, 
  SurveyResponse, 
  Employee,
  WelcomeSurveyEntry,
  ProgramConfig,
  FocusAreaSelection
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
import AIInsightsGrow from './AIInsightsGrow';

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
  const [welcomeSurveys, setWelcomeSurveys] = useState<any[]>([]);
  const [baselineData, setBaselineData] = useState<WelcomeSurveyEntry[]>([]);
  const [focusAreas, setFocusAreas] = useState<FocusAreaSelection[]>([]);
  const [programConfig, setProgramConfig] = useState<ProgramConfig[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [benchmarks, setBenchmarks] = useState<{satisfaction: number, productivity: number, balance: number, motivation: number, inclusion: number}>({
    satisfaction: 0, productivity: 0, balance: 0, motivation: 0, inclusion: 0
  });

  // UI State
  const selectedCohort = searchParams.get('cohort') || 'All Cohorts';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch Auth Session for Company Name and First Name
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        // ADMIN_EMAILS imported from constants
        const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
        
        // DEBUG - admin check
        console.log('DEBUG ADMIN CHECK:', {
          email,
          emailLower: email?.toLowerCase(),
          isAdmin,
          ADMIN_EMAILS_length: ADMIN_EMAILS.length,
          ADMIN_EMAILS: ADMIN_EMAILS
        });
        
        let company = session?.user?.app_metadata?.company || '';
        let compId = session?.user?.app_metadata?.company_id || '';
        let accName = session?.user?.app_metadata?.account_name || '';
        
        // DEBUG - before override
        console.log('DEBUG BEFORE OVERRIDE:', { company, compId, accName });
        
        // Check for admin override
        if (isAdmin) {
          try {
            const stored = localStorage.getItem('boon_admin_company_override');
            console.log('DEBUG OVERRIDE stored:', stored);
            if (stored) {
              const override = JSON.parse(stored);
              console.log('DEBUG OVERRIDE parsed:', override);
              company = override.name;
              compId = override.id || compId;
              accName = override.account_name || accName;
            }
          } catch (e) {
            console.log('DEBUG OVERRIDE error:', e);
          }
        } else {
          console.log('DEBUG: Not admin, skipping override check');
        }
        
        // DEBUG - after override
        console.log('DEBUG AFTER OVERRIDE:', { company, compId, accName });
        
        if (company) {
          setCompanyName(company);
        }
        if (compId) {
          setCompanyId(compId);
        }
        if (accName) {
          setAccountName(accName);
        }
        if (session?.user?.app_metadata?.first_name || session?.user?.user_metadata?.first_name) {
          setFirstName(session.user.app_metadata?.first_name || session.user.user_metadata?.first_name);
        }

        // Build company filter using helper
        const companyFilter = buildCompanyFilter(compId, accName, company);

        console.log('HomeDashboard using company filter:', companyFilter);

        const [sessData, compData, survData, empData, baseData, focusData, configData, benchmarkData] = await Promise.all([
          getDashboardSessions(companyFilter),
          getCompetencyScores(companyFilter),
          getSurveyResponses(companyFilter),
          getEmployeeRoster(companyFilter),
          getWelcomeSurveyData(companyFilter),
          getFocusAreaSelections(companyFilter),
          getProgramConfig(companyFilter),
          supabase.from('boon_benchmarks').select('*').eq('program_type', 'GROW')
        ]);

        // Fetch welcome survey completions for utilization calculation
        let welcomeSurveyData: any[] = [];
        if (accName) {
          // Use account_name for grouped company queries
          const { data: wsData } = await supabase
            .from('welcome_survey_baseline')
            .select('id, email, first_name, last_name, account, program_title, company_id, created_at')
            .ilike('account', `%${accName}%`);
          welcomeSurveyData = wsData || [];
        } else if (compId) {
          const { data: wsData } = await supabase
            .from('welcome_survey_baseline')
            .select('id, email, first_name, last_name, account, program_title, company_id, created_at')
            .eq('company_id', compId);
          welcomeSurveyData = wsData || [];
        } else if (company) {
          const { data: wsData } = await supabase
            .from('welcome_survey_baseline')
            .select('id, email, first_name, last_name, account, program_title, company_id, created_at')
            .ilike('account', `%${company.split(' - ')[0]}%`);
          welcomeSurveyData = wsData || [];
        }

        // DEBUG - remove after fixing
        console.log('DEBUG W&P surveys:', survData.filter(s => s.account_name?.includes('W&P')));
        console.log('DEBUG survey program_titles:', [...new Set(survData.map(s => s.program_title))].slice(0, 20));
        console.log('DEBUG first_session surveys:', survData.filter(s => s.survey_type === 'first_session'));
        console.log('DEBUG programConfig:', configData);
        
        // Set benchmarks
        const benchmarkRows = benchmarkData.data || [];
        const getBenchmark = (metric: string) => {
          const row = benchmarkRows.find((b: any) => b.metric_name === metric);
          return row?.avg_value || 0;
        };
        setBenchmarks({
          satisfaction: getBenchmark('baseline_satisfaction'),
          productivity: getBenchmark('baseline_productivity'),
          balance: getBenchmark('baseline_work_life_balance'),
          motivation: getBenchmark('baseline_motivation') || getBenchmark('baseline_satisfaction'),
          inclusion: getBenchmark('baseline_inclusion') || getBenchmark('baseline_satisfaction')
        });
        
        // Helper to check if a value matches the company/account (case-insensitive, partial match)
        const matchesCompany = (value: string | undefined | null, programTitle?: string | null): boolean => {
          // If we have an account_name, use that for matching (groups multiple companies)
          if (accName) {
            const accNameLower = accName.toLowerCase();
            if (!value) return false;
            const valueLower = value.toLowerCase();
            // Match if account_name appears in the value
            return valueLower.includes(accNameLower) || accNameLower.includes(valueLower.split(' - ')[0]);
          }
          
          // Fallback to original company matching logic
          if (!company) {
            console.log('DEBUG matchesCompany: company is empty');
            return false;
          }
          const companyBase = company.split(' - ')[0].toLowerCase();
          
          // Check if program_title starts with TWC (for Wonderful Company)
          if (companyBase.includes('wonderful') && programTitle && programTitle.toLowerCase().startsWith('twc')) {
            return true;
          }
          
          if (!value) return false;
          const valueBase = value.toLowerCase();
          
          // Special case: Wonderful Orchards is part of The Wonderful Company
          if (companyBase.includes('wonderful') && valueBase.includes('wonderful')) {
            return true;
          }
          
          const matches = valueBase.includes(companyBase) || companyBase.includes(valueBase.split(' - ')[0]);
          return matches;
        };
        
        // Filter all data by company
        const filteredSessions = sessData.filter(s => matchesCompany((s as any).account_name, (s as any).program_title));
        console.log('DEBUG filtering - company:', company, 'sessData count:', sessData.length, 'filteredSessions count:', filteredSessions.length);
        if (sessData.length > 0 && filteredSessions.length === 0) {
          console.log('DEBUG sample session account_names:', sessData.slice(0, 5).map((s: any) => s.account_name));
        }
        const filteredEmployees = empData.filter(e => matchesCompany((e as any).company_name) || matchesCompany((e as any).company));
        const filteredCompetencies = compData.filter(c => matchesCompany((c as any).account_name, (c as any).program_title));
        const filteredSurveys = survData.filter(s => matchesCompany((s as any).account_name, (s as any).program_title));
        const filteredBaseline = baseData.filter(b => matchesCompany((b as any).account_name, (b as any).program_title));
        const filteredFocusAreas = focusData.filter(f => matchesCompany(f.account_name, f.program_title));
        const filteredConfig = configData.filter(p => matchesCompany((p as any).account_name, (p as any).program_title));
        
        setSessions(filteredSessions);
        setCompetencies(filteredCompetencies);
        setSurveys(filteredSurveys);
        setEmployees(filteredEmployees);
        setWelcomeSurveys(welcomeSurveyData);
        setBaselineData(filteredBaseline);
        setFocusAreas(filteredFocusAreas);
        setProgramConfig(filteredConfig);
        
        // Fallback to data inference if auth metadata is missing
        if (!company && empData.length > 0 && empData[0].company) {
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

  // --- Derived Cohort List (sorted by program start date, most recent first) ---
  const cohorts = useMemo(() => {
    // Build a map of program_title -> start_date from programConfig
    const startDateMap = new Map<string, Date>();
    programConfig.forEach(p => {
      if (p.program_title && p.program_start_date) {
        startDateMap.set(p.program_title, new Date(p.program_start_date));
      }
    });
    
    // Get unique programs from sessions - normalize to display names before deduplication
    const sessionCohorts = sessions
      .map(s => {
        const raw = ((s as any).program_title || s.program_name || s.cohort || s.program || '').trim();
        return PROGRAM_DISPLAY_NAMES[raw] || raw;  // Convert CP codes to display names
      })
      .filter(Boolean) as string[];
    const unique = Array.from(new Set(sessionCohorts));
    
    // Sort by start date (most recent first), then alphabetically for those without dates
    unique.sort((a, b) => {
      const dateA = startDateMap.get(a);
      const dateB = startDateMap.get(b);
      if (dateA && dateB) return dateB.getTime() - dateA.getTime();
      if (dateA) return -1; // a has date, b doesn't -> a first
      if (dateB) return 1;  // b has date, a doesn't -> b first
      return a.localeCompare(b); // Both no dates -> alphabetical
    });
    
    return ['All Cohorts', ...unique];
  }, [sessions, programConfig]);

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
        const pTitle = normalize((s as any).program_title || '');
        const pName = normalize(s.program_name || '');
        const cName = normalize(s.cohort || '');
        const pCode = normalize(s.program || '');
        return pTitle === selNorm || pName === selNorm || cName === selNorm || pCode === selNorm;
    });

    // 2. Get total employees from roster (not just those with sessions)
    const enrolledEmployees = employees.filter(e => {
        if (isAll) return true;
        const pt = normalize((e as any).program_title || '');
        const p = normalize(e.program || '');
        const pn = normalize(e.program_name || '');
        const c = normalize(e.cohort || '');
        return pt === selNorm || p === selNorm || pn === selNorm || c === selNorm;
    });
    
    // Total employees from roster (this is the denominator for utilization)
    const totalEmployeesCount = enrolledEmployees.length;
    
    // 3. Filter welcome surveys for this cohort
    const cohortWelcomeSurveys = welcomeSurveys.filter(ws => {
        if (isAll) return true;
        const wsPt = normalize(ws.program_title || '');
        return wsPt === selNorm;
    });
    
    // Utilization = welcome survey completions / total employees in roster
    const welcomeSurveyCount = cohortWelcomeSurveys.length;
    const utilizationRate = totalEmployeesCount > 0 
        ? Math.min(100, Math.round((welcomeSurveyCount / totalEmployeesCount) * 100))
        : 0;

    // --- Metrics Calculation ---
    
    // Count completed sessions (for display)
    const completedSessionsCount = cohortSessions.filter(s => {
        const status = (s.status || '').toLowerCase();
        const isPast = new Date(s.session_date) < new Date();
        return !status.includes('no show') && !status.includes('cancel') && (status.includes('completed') || (!status && isPast) || (status === 'no label' && isPast));
    }).length;
    
    // Count no-shows/late cancels (these count as "used" sessions for progress)
    const noShowSessionsCount = cohortSessions.filter(s => {
        const status = (s.status || '').toLowerCase();
        return status.includes('no show') || status.includes('noshow') || status.includes('late cancel') || status.includes('client no show');
    }).length;
    
    // Sessions used = completed + no-shows (for progress calculation)
    const sessionsUsedCount = completedSessionsCount + noShowSessionsCount;
    
    const scheduledSessionsCount = cohortSessions.length;

    // Filter competencies
    const cohortCompetencies = competencies.filter(c => {
        if (isAll) return true;
        const pt = normalize((c as any).program_title || '');
        const p = normalize(c.program || '');
        return pt === selNorm || p === selNorm;
    });

    // Determine if Cohort is Completed - count only participants with BOTH pre AND post scores
    const participantsWithBothScores = cohortCompetencies.filter(c => c.pre > 0 && c.post > 0);
    const participantCount = new Set(participantsWithBothScores.map(c => c.email)).size;
    
    // DEBUG - competency filtering
    console.log('DEBUG competencies:', {
      selectedCohort,
      selNorm,
      totalCompetencies: competencies.length,
      cohortCompetencies: cohortCompetencies.length,
      participantsWithBothScores: participantsWithBothScores.length,
      participantCount,
      sampleCompetency: competencies[0],
      sampleCohortCompetency: cohortCompetencies[0]
    });
    
    // Also check for end_of_program surveys as an indicator of completion
    const endOfProgramSurveys = surveys.filter(s => {
        if ((s as any).survey_type !== 'end_of_program') return false;
        if (isAll) return true;
        const surveyProgram = normalize((s as any).program_title || '');
        // Match by program_title or account_name
        if (surveyProgram && surveyProgram === selNorm) return true;
        const surveyAccount = normalize((s as any).account_name || '');
        if (surveyAccount && surveyAccount === selNorm) return true;
        return false;
    });
    const hasEndOfProgramSurveys = endOfProgramSurveys.length >= 3;
    
    const isCompleted = !isAll && (participantCount >= 5 || hasEndOfProgramSurveys);

    // Get Session Count from Config - IMPROVED MATCHING LOGIC
    const currentAccountName = companyName.split(' - ')[0]; // Remove suffix if present
    
    // First try exact program_title match
    let config = programConfig.find(p => {
      const normalizedTitle = normalize(p.program_title || '');
      return normalizedTitle === selNorm;
    });
    
    // If no exact match and looking at "All Cohorts", try flexible account_name matching
    if (!config && isAll) {
      config = programConfig.find(p => {
        const configAccount = normalize(p.account_name || '');
        const currentNorm = normalize(currentAccountName);
        const companyNorm = normalize(companyName);
        return configAccount === currentNorm || 
               configAccount === companyNorm ||
               configAccount.includes(currentNorm) ||
               currentNorm.includes(configAccount) ||
               companyNorm.includes(configAccount) ||
               configAccount.includes(companyNorm.split(' - ')[0]);
      });
    }
    
    // Final fallback: if there's only one program_config for this company, use it
    if (!config && programConfig.length === 1) {
      config = programConfig[0];
    }
    
    // Additional fallback: if still no config, try to find any config that partially matches
    if (!config && programConfig.length > 0) {
      const currentNorm = normalize(currentAccountName);
      config = programConfig.find(p => {
        const configAccount = normalize(p.account_name || '');
        // Check if either contains the other (partial match)
        return configAccount.split(' ')[0] === currentNorm.split(' ')[0];
      });
    }
    
    const sessionsPerEmployee = config?.sessions_per_employee || 5;
    
    // Debug log for config matching
    console.log('DEBUG config matching:', {
      selectedCohort,
      companyName,
      currentAccountName,
      programConfigCount: programConfig.length,
      programConfigs: programConfig.map(p => ({ account_name: p.account_name, program_title: p.program_title, sessions: p.sessions_per_employee })),
      matchedConfig: config ? { account_name: config.account_name, sessions: config.sessions_per_employee } : null,
      sessionsPerEmployee
    });

    const targetSessions = totalEmployeesCount * sessionsPerEmployee;
    const progressPct = targetSessions > 0 ? Math.min(100, Math.round((sessionsUsedCount / targetSessions) * 100)) : 0;

    // Calculate growth from competency scores (only using rows with BOTH pre AND post)
    const totalPre = participantsWithBothScores.reduce((acc, curr) => acc + curr.pre, 0);
    const totalPost = participantsWithBothScores.reduce((acc, curr) => acc + curr.post, 0);
    const growthPct = totalPre > 0 ? ((totalPost - totalPre) / totalPre) * 100 : 0;

    // DEBUG - growth calculation
    console.log('DEBUG growth:', {
      selectedCohort,
      totalPre,
      totalPost,
      growthPct,
      participantCount,
      sampleScores: participantsWithBothScores.slice(0, 3).map(c => ({ email: c.email, pre: c.pre, post: c.post }))
    });

    // Filter surveys by program_title (for accurate NPS/CSAT per cohort)
    const validEmails = new Set(
        enrolledEmployees.map(e => e.email?.toLowerCase()).filter(Boolean)
    );

    const cohortSurveys = surveys.filter(s => {
        // For "All Cohorts", include all surveys
        if (isAll) return true;

        // First try to match by program_title (works for first_session surveys without email)
        const surveyProgram = normalize((s as any).program_title || '');
        if (surveyProgram && surveyProgram === selNorm) return true;
        
        // Fallback to email matching if no program_title match
        if (!s.email) return false; // Only require email for fallback matching
        if (employees.length === 0) return true; 
        if (enrolledEmployees.length < totalEmployeesCount) {
             // Check if email belongs to this cohort's employees
             return validEmails.has(s.email.toLowerCase());
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
        const bPt = normalize((b as any).program_title || '');
        const bCoh = normalize(b.cohort);
        const bComp = normalize(b.company);
        // Fix: Only check selNorm.includes(bCoh) if bCoh is non-empty
        return bPt === selNorm || bCoh === selNorm || bComp === selNorm || (bCoh && selNorm.includes(bCoh));
    });

    // Filter focus areas by cohort using the new focus_area_selections table
    const cohortFocusAreas = focusAreas.filter(f => {
        if (isAll) return true;
        const fPt = normalize(f.program_title || '');
        return fPt === selNorm;
    });

    // Calculate focus area counts from the new normalized table
    const focusCounts: Record<string, number> = {};
    cohortFocusAreas.forEach(f => {
      if (f.selected) {
        const label = f.focus_area_name;
        focusCounts[label] = (focusCounts[label] || 0) + 1;
      }
    });
    
    const topFocusAreas = Object.entries(focusCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const compMap = new Map<string, { sumPre: number, sumPost: number, count: number }>();
    // Only use competency records with BOTH pre AND post scores
    participantsWithBothScores.forEach(c => {
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
    }).filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3); // Only show positive growth

    const themeCounts: Record<string, number> = { mental: 0, leadership: 0, comms: 0 };
    const subThemeCounts: Record<string, number> = {};
    
    cohortSessions.forEach(s => {
       // Count broad themes
       if (s.mental_well_being) themeCounts.mental++;
       if (s.leadership_management_skills) themeCounts.leadership++;
       if (s.communication_skills) themeCounts.comms++;
       
       // Parse and count sub-themes from each category
       const parseSubThemes = (value: any) => {
         if (!value || typeof value !== 'string' || value === 'true' || value === 'false') return;
         value.split(/[;,]/).map((t: string) => t.trim()).filter(Boolean).forEach((theme: string) => {
           subThemeCounts[theme] = (subThemeCounts[theme] || 0) + 1;
         });
       };
       
       parseSubThemes(s.mental_well_being);
       parseSubThemes(s.leadership_management_skills);
       parseSubThemes(s.communication_skills);
    });
    const totalThemes = themeCounts.mental + themeCounts.leadership + themeCounts.comms;
    
    // Get top sub-themes sorted by count
    const topSessionSubThemes = Object.entries(subThemeCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count, pct: (count / cohortSessions.length) * 100 }));
    
    const baselineStats = {
        satisfaction: 0, productivity: 0, balance: 0, motivation: 0, inclusion: 0
    };
    if (cohortBaseline.length > 0) {
        const getScaledAvg = (key: string) => {
            const values = cohortBaseline
                .map(r => Number((r as any)[key]))
                .filter(v => !isNaN(v) && v > 0);
            if (values.length === 0) return 0;
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            // Scale 1-5 data to 1-10 if max value <= 5
            const maxVal = Math.max(...values);
            return maxVal <= 5 ? avg * 2 : avg;
        };
        baselineStats.satisfaction = getScaledAvg('satisfaction');
        baselineStats.productivity = getScaledAvg('productivity');
        baselineStats.balance = getScaledAvg('work_life_balance');
        baselineStats.motivation = getScaledAvg('motivation');
        baselineStats.inclusion = getScaledAvg('inclusion');
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

    // Analyze sub-topic selections from welcome survey
    const subTopicMap: Record<string, string> = {
      sub_active_listening: 'Active Listening',
      sub_articulating_ideas_clearly: 'Articulating Ideas Clearly',
      sub_conflict_resolution: 'Conflict Resolution',
      sub_communication_in_teams: 'Communication in Teams',
      sub_building_rapport_and_relationships: 'Building Rapport & Relationships',
      sub_building_credibility_and_trust: 'Building Credibility & Trust',
      sub_influence_without_authority: 'Influence Without Authority',
      sub_gaining_buy_in_for_ideas: 'Gaining Buy-in for Ideas',
      sub_developing_a_growth_mindset: 'Developing a Growth Mindset',
      sub_leading_through_change: 'Leading Through Change',
      sub_building_emotional_resilience: 'Building Emotional Resilience',
      sub_strategic_decision_making: 'Strategic Decision Making',
      sub_self_awareness: 'Self Awareness',
      sub_empathy_and_compassion: 'Empathy & Compassion',
      sub_collaboration_and_teamwork: 'Collaboration & Teamwork',
      sub_overcoming_imposter_syndrome: 'Overcoming Imposter Syndrome',
      sub_effective_delegation_techniques: 'Effective Delegation',
      sub_setting_clear_expectations: 'Setting Clear Expectations',
      sub_giving_effective_feedback: 'Giving Effective Feedback',
      sub_receiving_feedback_gracefully: 'Receiving Feedback Gracefully',
      sub_defining_clear_achievable_goals: 'Defining Clear Goals',
      sub_managing_distractions_interruptions: 'Managing Distractions',
      sub_balancing_work_and_personal_life: 'Work-Life Balance',
    };
    
    const subTopicCounts: { topic: string, count: number, pct: number }[] = [];
    const totalParticipants = cohortBaseline.length;
    
    if (totalParticipants > 0) {
      // First check for sub_* boolean fields (GROW surveys)
      for (const [key, label] of Object.entries(subTopicMap)) {
        const count = cohortBaseline.filter(e => {
          const val = (e as any)[key];
          return val === true || val === 'true' || val === 1;
        }).length;
        if (count > 0) {
          subTopicCounts.push({ topic: label, count, pct: (count / totalParticipants) * 100 });
        }
      }
      
      // If no sub_* fields found, check for leader_essentials_topics (comma-separated string)
      if (subTopicCounts.length === 0) {
        const leTopicCounts: Record<string, number> = {};
        cohortBaseline.forEach(e => {
          const topics = (e as any).leader_essentials_topics;
          if (topics && typeof topics === 'string') {
            topics.split(',').map((t: string) => t.trim()).filter(Boolean).forEach((topic: string) => {
              leTopicCounts[topic] = (leTopicCounts[topic] || 0) + 1;
            });
          }
        });
        for (const [topic, count] of Object.entries(leTopicCounts)) {
          subTopicCounts.push({ topic, count, pct: (count / totalParticipants) * 100 });
        }
      }
      
      subTopicCounts.sort((a, b) => b.count - a.count);
    }
    
    // Use sub-topics from welcome survey if available, otherwise use focus_area_selections
    const topFocusAreasFromSurvey = subTopicCounts.slice(0, 5);

    const getQualityQuotes = (data: any[]) => {
      // Only use feedback_learned and feedback_insight (positive feedback)
      // Exclude feedback_suggestions (improvement/criticism)
      const allQuotes = data
        .flatMap(d => [d.feedback_learned, d.feedback_insight].filter(Boolean))
        .filter(text => {
            if (!text || text.length < 50) return false;
            const lower = text.toLowerCase();
            // Filter out low-quality responses
            if (lower.includes("i don't know") || lower.includes("not sure") || lower.includes("nothing") || lower.includes("n/a")) return false;
            if (lower.match(/^(great|good|nice|helpful|none|no|null|na)\.?$/i)) return false;
            return true;
        });
      
      // Deduplicate quotes
      const uniqueQuotes = [...new Set(allQuotes)];
      
      // Score and sort by quality (positive action words, length, specificity)
      return uniqueQuotes
        .map(text => {
            const lower = text.toLowerCase();
            let score = 0;
            
            // Positive action words (high value)
            const positiveWords = ['learned', 'improved', 'helped', 'valuable', 'great', 'excellent', 'amazing', 'love', 'appreciate', 'thankful', 'growth', 'better', 'successful', 'insightful', 'effective', 'fantastic', 'recommended'];
            score += positiveWords.filter(w => lower.includes(w)).length * 3;
            
            // Action/insight words (medium value)
            const actionWords = ['now', 'started', 'stopped', 'realized', 'developed', 'changed', 'understand', 'able to', 'confident', 'equipped', 'techniques', 'strategies'];
            score += actionWords.filter(w => lower.includes(w)).length * 2;
            
            // Penalize negative/critical feedback
            const negativeWords = ['wish', 'would be better', 'didn\'t', 'wasn\'t', 'couldn\'t', 'should have', 'more time', 'too short', 'longer'];
            score -= negativeWords.filter(w => lower.includes(w)).length * 3;
            
            // Bonus for good length (not too short, not too long)
            if (text.length >= 100 && text.length <= 500) score += 2;
            
            return { text, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(q => q.text);
    };

    // Always use surveys for feedback quotes (that's where feedback text is stored)
    let quotes: string[] = getQualityQuotes(cohortSurveys);

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
    
    // Get program start date from config
    const programStartDate = config?.program_start_date ? new Date(config.program_start_date) : null;
    const programEndDate = config?.program_end_date ? new Date(config.program_end_date) : null;

    return {
        isCompleted,
        completedSessionsCount,
        sessionsUsedCount,
        scheduledSessionsCount,
        targetSessions,
        totalEmployeesCount,
        welcomeSurveyCount,
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
        topFocusAreasFromSurvey,
        topSessionSubThemes,
        selectedCohortName: getCohortDisplayName(selectedCohort),
        sessionsPerEmployee,
        programStartDate,
        programEndDate
    };
  }, [sessions, competencies, surveys, employees, welcomeSurveys, baselineData, focusAreas, selectedCohort, programConfig, companyName]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 font-sans">
      
      {/* Header with Cohort Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
           <h1 className="text-xl text-gray-500 font-medium">Welcome back, <span className="text-boon-dark font-bold">{firstName || companyName.split(' - ')[0]}</span></h1>
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

      {/* ExecutiveSignals hidden for now - only showing in PDF reports
      <ExecutiveSignals 
        context="Dashboard"
        data={stats}
        selectedCohort={selectedCohort}
      />
      */}

      {/* Hero Section */}
      {/* Show improvement hero if we have competency data with growth, otherwise show progress */}
      {stats.participantCount >= 3 && stats.growthPct > 0 ? (
        // IMPROVEMENT HERO - Show when we have competency data
        <HoverCard className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-boon-green"></div>
            <h2 className="text-xl md:text-2xl text-gray-600 font-medium mb-4">Your team improved</h2>
            <div className="text-6xl md:text-8xl font-black text-boon-green tracking-tight mb-4">
                <CountUpPercentage value={stats.growthPct} className="" />
            </div>
            <p className="text-xl md:text-2xl text-gray-600 font-medium">in leadership competencies</p>
            <p className="text-sm text-gray-400 mt-6 font-medium">
                Based on {stats.participantCount} participants completing pre/post assessments
            </p>
        </HoverCard>
      ) : (
        // IN-PROGRESS HERO - Show progress percentage when no competency data yet
        <HoverCard className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-boon-blue"></div>
            <h2 className="text-xl md:text-2xl text-gray-600 font-medium mb-4">Your team is</h2>
            <div className="text-6xl md:text-8xl font-black text-boon-blue tracking-tight mb-4">
                <CountUp end={stats.progressPct} duration={1500} suffix="%" />
            </div>
            <p className="text-xl md:text-2xl text-gray-600 font-medium">through the program</p>
            <p className="text-sm text-gray-400 mt-6 font-medium">
                {stats.sessionsUsedCount} of {stats.targetSessions} expected sessions used ({stats.totalEmployeesCount} employees × {stats.sessionsPerEmployee} sessions)
            </p>
        </HoverCard>
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
              subtext={`${stats.welcomeSurveyCount} of ${stats.totalEmployeesCount} enrolled`}
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

            {/* Show Growth Areas if we have competency improvement data, otherwise show Focus Areas */}
            {stats.participantCount >= 3 && stats.growthPct > 0 ? (
                // HAS COMPETENCY DATA: Growth Areas
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
                                <HoverCard key={skill.name} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between">
                                    <div className="text-3xl font-bold text-boon-green mb-1">
                                        <CountUpPercentage value={skill.pct} />
                                    </div>
                                    <div className="font-bold text-gray-800 text-sm leading-tight mb-3">{skill.name}</div>
                                    <div className="text-xs font-semibold text-gray-400">
                                        {skill.avgPre.toFixed(1)} <span className="mx-1">→</span> {skill.avgPost.toFixed(1)}
                                    </div>
                                </HoverCard>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-8 italic">Data pending...</div>
                    )}
                </div>
            ) : (
                // NO COMPETENCY DATA YET: Focus Areas from Welcome Survey
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-boon-dark flex items-center gap-2">
                           <Lightbulb className="w-5 h-5 text-boon-yellow" /> What Your Team is Working On
                        </h3>
                        <button onClick={() => navigate('/baseline')} className="text-sm font-bold text-boon-blue hover:underline">View baseline →</button>
                    </div>
                    
                    <div className="space-y-4">
                        {stats.topFocusAreasFromSurvey && stats.topFocusAreasFromSurvey.length > 0 ? (
                            // First priority: sub-topics from welcome survey
                            stats.topFocusAreasFromSurvey.slice(0, 3).map((area, index) => (
                                <ThemeBar 
                                    key={area.topic} 
                                    label={area.topic} 
                                    count={area.count} 
                                    total={stats.totalEmployeesCount || 1} 
                                    color={index === 0 ? 'bg-boon-purple' : index === 1 ? 'bg-boon-coral' : 'bg-boon-blue'} 
                                />
                            ))
                        ) : stats.topSessionSubThemes && stats.topSessionSubThemes.length > 0 ? (
                            // Second priority: sub-themes parsed from session tracking fields
                            stats.topSessionSubThemes.slice(0, 3).map((area, index) => (
                                <ThemeBar 
                                    key={area.topic} 
                                    label={area.topic} 
                                    count={area.count} 
                                    total={stats.completedSessionsCount || 1} 
                                    color={index === 0 ? 'bg-boon-purple' : index === 1 ? 'bg-boon-coral' : 'bg-boon-blue'} 
                                />
                            ))
                        ) : stats.topFocusAreas && stats.topFocusAreas.length > 0 ? (
                            // Third priority: granular focus areas from focus_area_selections
                            stats.topFocusAreas.slice(0, 3).map(([label, count], index) => (
                                <ThemeBar 
                                    key={label} 
                                    label={label} 
                                    count={count as number} 
                                    total={stats.totalEmployeesCount || 1} 
                                    color={index === 0 ? 'bg-boon-purple' : index === 1 ? 'bg-boon-coral' : 'bg-boon-blue'} 
                                />
                            ))
                        ) : (
                            // Fallback: broad session themes
                            <>
                                <ThemeBar label="Leadership Skills" count={stats.themes.counts.leadership} total={stats.themes.total} color="bg-boon-purple" />
                                <ThemeBar label="Communication" count={stats.themes.counts.comms} total={stats.themes.total} color="bg-boon-coral" />
                                <ThemeBar label="Mental Well-being" count={stats.themes.counts.mental} total={stats.themes.total} color="bg-boon-blue" />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Baseline Snapshot - show when no competency improvement data yet AND there's baseline data to show */}
            {!(stats.participantCount >= 3 && stats.growthPct > 0) && 
             (stats.baseline.competencies.length > 0 || stats.baseline.metrics.satisfaction > 0 || stats.baseline.metrics.productivity > 0 || stats.baseline.metrics.balance > 0) && (
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

                    {/* Only show wellbeing baseline if at least one metric has data */}
                    {(stats.baseline.metrics.satisfaction > 0 || stats.baseline.metrics.productivity > 0 || stats.baseline.metrics.balance > 0) && (
                    <div className="pt-6 border-t border-gray-100">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Wellbeing Baseline (1-10)</h4>
                        <div className="grid grid-cols-5 gap-2 text-center">
                            {stats.baseline.metrics.satisfaction > 0 && <BaselineMetric label="Satisfac." value={stats.baseline.metrics.satisfaction} benchmark={benchmarks.satisfaction} />}
                            {stats.baseline.metrics.productivity > 0 && <BaselineMetric label="Product." value={stats.baseline.metrics.productivity} benchmark={benchmarks.productivity} />}
                            {stats.baseline.metrics.balance > 0 && <BaselineMetric label="Balance" value={stats.baseline.metrics.balance} benchmark={benchmarks.balance} />}
                            {stats.baseline.metrics.motivation > 0 && <BaselineMetric label="Motivat." value={stats.baseline.metrics.motivation} benchmark={benchmarks.motivation} />}
                            {stats.baseline.metrics.inclusion > 0 && <BaselineMetric label="Inclusion" value={stats.baseline.metrics.inclusion} benchmark={benchmarks.inclusion} />}
                        </div>
                    </div>
                    )}
                 </div>
            )}

            {/* Quotes Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-boon-dark mb-6 flex items-center gap-2">
                   <MessageSquare className="w-5 h-5 text-boon-blue" /> 
                   {(stats.participantCount >= 3 && stats.growthPct > 0) ? "In Their Own Words" : "Early Feedback"}
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
      
      {/* AI Insights Section - Full Width */}
      <AIInsightsGrow
        companyName={companyName}
        companyId={companyId}
        cohortName={stats.selectedCohortName}
        programStartDate={stats.programStartDate}
        programEndDate={stats.programEndDate}
        progressPct={stats.progressPct}
        isCompleted={stats.isCompleted}
        totalParticipants={stats.totalEmployeesCount}
        participantsWithScores={stats.participantCount}
        completedSessions={stats.completedSessionsCount}
        targetSessions={stats.targetSessions}
        competencyGrowth={stats.topSkills}
        overallGrowthPct={stats.growthPct}
        topFocusAreas={stats.topFocusAreasFromSurvey.length > 0 ? stats.topFocusAreasFromSurvey : stats.topFocusAreas.map(([topic, count]) => ({ topic, count, pct: (count / stats.totalEmployeesCount) * 100 }))}
        sessionThemes={stats.topSessionSubThemes}
        nps={stats.nps}
        coachSatisfaction={stats.avgSat ? parseFloat(stats.avgSat) : null}
        baselineMetrics={stats.baseline.metrics}
        feedbackHighlights={stats.quotes}
      />
    </div>
  );
};

// --- Sub Components ---

const MetricCard = ({ value, label, icon, subtext }: { value: string | number, label: string, icon: React.ReactNode, subtext?: string }) => {
    // Determine if value is numeric for count-up animation
    const isNumeric = typeof value === 'number';
    const isNPS = label.toLowerCase().includes('nps');
    const isRating = label.toLowerCase().includes('satisfaction') && String(value).includes('/');
    const isPercentage = String(value).includes('%');
    
    const renderValue = () => {
        if (isNumeric) {
            if (isNPS) {
                return <CountUpNPS value={value as number} className="text-3xl font-black text-boon-dark" />;
            }
            return <CountUp end={value as number} duration={1200} className="text-3xl font-black text-boon-dark" />;
        }
        if (isRating) {
            const num = parseFloat(String(value).split('/')[0]);
            return <CountUpRating value={num} className="text-3xl font-black text-boon-dark" />;
        }
        if (isPercentage) {
            const num = parseFloat(String(value).replace('%', ''));
            return <CountUp end={num} duration={1200} suffix="%" className="text-3xl font-black text-boon-dark" />;
        }
        // For NPS with + prefix like "+69"
        if (String(value).startsWith('+')) {
            const num = parseFloat(String(value).replace('+', ''));
            return <CountUpNPS value={num} className="text-3xl font-black text-boon-dark" />;
        }
        return <span className="text-3xl font-black text-boon-dark">{value}</span>;
    };
    
    return (
        <HoverCard className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-3">
                {icon}
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
            </div>
            <div>
               <div>{renderValue()}</div>
               {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
            </div>
        </HoverCard>
    );
};

const ThemeBar = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-sm font-bold mb-1">
                <span className="text-gray-700">{label}</span>
                <span className="text-gray-900">{pct}%</span>
            </div>
            <AnimatedProgressBar value={pct} color={color} height="h-2" />
        </div>
    );
};

const BaselineMetric = ({ label, value, benchmark }: { label: string, value: number, benchmark?: number }) => {
    const diff = benchmark && value ? value - benchmark : null;
    const showBenchmark = benchmark && benchmark > 0 && diff !== null && value > 0;
    
    return (
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-gray-800">{value > 0 ? value.toFixed(1) : '-'}</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 truncate w-full">{label}</span>
            {showBenchmark && (
                <span className={`text-[9px] font-bold mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {diff >= 0 ? '↑' : '↓'} {Math.abs((diff / benchmark) * 100).toFixed(0)}% vs avg
                </span>
            )}
        </div>
    );
};

export default HomeDashboard;