import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardSessions, getEmployeeRoster, getSurveyResponses, CompanyFilter, buildCompanyFilter } from '../lib/dataFetcher';
import { SessionWithEmployee, Employee, SurveyResponse } from '../types';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, 
  Calendar, 
  Search, 
  Filter, 
  AlertCircle,
  Database,
  Code,
  CheckCircle2,
  Copy,
  TrendingUp,
  Clock,
  ArrowUp,
  X,
  Info,
  Layers,
  LayoutDashboard,
  Star,
  Heart,
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

// --- Helper to check if session is canceled (should be excluded) ---
const isCanceledSession = (status: string): boolean => {
  const statusLower = (status || '').toLowerCase();
  // "Canceled" sessions should be hidden, but "Late Cancel" should show as no-show
  return statusLower === 'canceled' || statusLower === 'cancelled';
};

interface SessionDashboardProps {
  filterType: 'program' | 'cohort' | 'all';
  filterValue: string;
}

const SessionDashboard: React.FC<SessionDashboardProps> = ({ filterType, filterValue }) => {
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [welcomeSurveys, setWelcomeSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  
  const [selectedStat, setSelectedStat] = useState<any>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<'name' | 'program' | 'completed' | 'noshow' | 'scheduled' | 'total'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Program filter state (local to this page)
  const [programFilter, setProgramFilter] = useState<string>('All');

  // Persistence for hidden employees
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
        
        // Get company from auth
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const ADMIN_EMAILS = ['asimmons@boon-health.com', 'alexsimm95@gmail.com', 'hello@boon-health.com'];
        const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
        
        let company = session?.user?.app_metadata?.company || '';
        let companyId = session?.user?.app_metadata?.company_id || '';
        let accName = session?.user?.app_metadata?.account_name || '';
        
        // Check for admin override
        if (isAdmin) {
          try {
            const stored = localStorage.getItem('boon_admin_company_override');
            if (stored) {
              const override = JSON.parse(stored);
              company = override.name;
              companyId = override.id || companyId;
              accName = override.account_name || accName;
            }
          } catch {}
        }

        // Build company filter using helper
        const companyFilter = buildCompanyFilter(companyId, accName, company);

        console.log('SessionDashboard using company filter:', companyFilter);
        
        const [sessionsData, rosterData, surveyData] = await Promise.all([
          getDashboardSessions(companyFilter),
          getEmployeeRoster(companyFilter),
          getSurveyResponses(companyFilter)
        ]);
        
        // Fetch welcome survey data
        let welcomeSurveyData: any[] = [];
        if (accName) {
          // Use account_name for grouped companies
          const { data: wsData } = await supabase
            .from('welcome_survey_baseline')
            .select('id, email, first_name, last_name, account, program_title, company_id, created_at')
            .ilike('account', `%${accName}%`);
          welcomeSurveyData = wsData || [];
        } else if (companyId) {
          const { data: wsData } = await supabase
            .from('welcome_survey_baseline')
            .select('id, email, first_name, last_name, account, program_title, company_id, created_at')
            .eq('company_id', companyId);
          welcomeSurveyData = wsData || [];
        } else if (company) {
          const { data: wsData } = await supabase
            .from('welcome_survey_baseline')
            .select('id, email, first_name, last_name, account, program_title, company_id, created_at')
            .ilike('account', `%${company.split(' - ')[0]}%`);
          welcomeSurveyData = wsData || [];
        }
        
        // Use accountName for filtering if set
        const filterBase = accName || company.split(' - ')[0];
        
        // Helper to check if a value matches the company
        const matchesCompany = (value: string | undefined | null, programTitle?: string | null): boolean => {
          if (!filterBase) return false;
          const companyBase = filterBase.toLowerCase();
          
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
          
          return valueBase.includes(companyBase) || companyBase.includes(valueBase.split(' - ')[0]);
        };
        
        if (mounted) {
          // Filter by company AND exclude canceled sessions
          const filteredSessions = sessionsData.filter(s => {
            // For account_name queries, use matchesCompany
            if (accName) {
              const matchesCompanyFilter = matchesCompany((s as any).account_name, (s as any).program_title);
              const isNotCanceled = !isCanceledSession(s.status || '');
              return matchesCompanyFilter && isNotCanceled;
            }
            // Prefer company_id match if available
            if (companyId && (s as any).company_id === companyId) {
              return !isCanceledSession(s.status || '');
            }
            const matchesCompanyFilter = matchesCompany((s as any).account_name, (s as any).program_title);
            const isNotCanceled = !isCanceledSession(s.status || '');
            return matchesCompanyFilter && isNotCanceled;
          });
          const filteredEmployees = rosterData.filter(e => {
            if (accName) {
              return matchesCompany((e as any).company_name) || matchesCompany((e as any).company);
            }
            if (companyId && (e as any).company_id === companyId) return true;
            return matchesCompany((e as any).company_name) || matchesCompany((e as any).company);
          });
          const filteredSurveys = surveyData.filter(s => matchesCompany((s as any).account_name, (s as any).program_title));
          
          setSessions(filteredSessions || []);
          setEmployees(filteredEmployees || []);
          setSurveys(filteredSurveys || []);
          setWelcomeSurveys(welcomeSurveyData || []);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Dashboard Load Error:", err);
          const errorMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          setError(errorMessage);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
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

  // --- Fuzzy Name Matching Helpers ---
  // Normalize name for fuzzy matching (handles Brad/Bradley, Eddie/Edward, etc.)
  const normalizeNameForMatching = (name: string): string => {
    const lower = name.toLowerCase().trim();
    
    // Common nickname mappings
    // Fix: Removed duplicate keys that were causing TS errors
    const nicknames: Record<string, string> = {
      'brad': 'bradley',
      'ed': 'edward',
      'eddie': 'edward',
      'ted': 'theodore',
      'teddy': 'theodore',
      'mike': 'michael',
      'bill': 'william',
      'bob': 'robert',
      'rob': 'robert',
      'jim': 'james',
      'jimmy': 'james',
      'joe': 'joseph',
      'joey': 'joseph',
      'tom': 'thomas',
      'tommy': 'thomas',
      'dick': 'richard',
      'rick': 'richard',
      'rich': 'richard',
      'dan': 'daniel',
      'danny': 'daniel',
      'dave': 'david',
      'davy': 'david',
      'steve': 'steven',
      'chris': 'christopher',
      'matt': 'matthew',
      'pat': 'patrick',
      'nick': 'nicholas',
      'tony': 'anthony',
      'andy': 'andrew',
      'drew': 'andrew',
      'alex': 'alexander',
      'sam': 'samuel',
      'sammy': 'samuel',
      'ben': 'benjamin',
      'benny': 'benjamin',
      'charlie': 'charles',
      'chuck': 'charles',
      'frank': 'francis',
      'frankie': 'francis',
      'jack': 'john',
      'johnny': 'john',
      'ken': 'kenneth',
      'kenny': 'kenneth',
      'larry': 'lawrence',
      'pete': 'peter',
      'will': 'william',
      'willy': 'william',
      'liz': 'elizabeth',
      'beth': 'elizabeth',
      'kate': 'katherine',
      'katie': 'katherine',
      'kathy': 'katherine',
      'jen': 'jennifer',
      'jenny': 'jennifer',
      'sue': 'susan',
      'suzy': 'susan',
      'meg': 'margaret',
      'peggy': 'margaret',
      'maggie': 'margaret',
      'vicky': 'victoria',
      'vic': 'victoria',
      'debbie': 'deborah',
      'deb': 'deborah',
      'becky': 'rebecca',
      'kim': 'kimberly',
      'kimmy': 'kimberly',
      'nik': 'nikolas',
      'steph': 'stephanie',
      'josh': 'joshua',
      'zach': 'zachary',
      'zack': 'zachary',
      'greg': 'gregory',
      'tim': 'timothy',
      'timmy': 'timothy',
      'jon': 'jonathan',
      'jonny': 'jonathan',
      'ron': 'ronald',
      'ronny': 'ronald',
      'don': 'donald',
      'donny': 'donald',
      'ray': 'raymond',
    };
    
    // Split into parts
    const parts = lower.split(/\s+/);
    const normalizedParts = parts.map(part => nicknames[part] || part);
    
    return normalizedParts.join(' ');
  };

  // Calculate similarity between two strings (for last name typos like Sorenson/Sorensen)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    // Simple Levenshtein-based similarity
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    const longerLength = longer.length;
    if (longerLength === 0) return 1;
    
    // Calculate edit distance
    const costs: number[] = [];
    for (let i = 0; i <= shorter.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (shorter[i - 1] !== longer[j - 1]) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[longer.length] = lastValue;
    }
    
    return (longerLength - costs[longer.length]) / longerLength;
  };

  // Check if two names likely refer to the same person
  const isSamePerson = (name1: string, name2: string): boolean => {
    const norm1 = normalizeNameForMatching(name1);
    const norm2 = normalizeNameForMatching(name2);
    
    // Exact match after normalization
    if (norm1 === norm2) return true;
    
    // Split into first/last
    const parts1 = norm1.split(/\s+/);
    const parts2 = norm2.split(/\s+/);
    
    if (parts1.length < 2 || parts2.length < 2) return false;
    
    const first1 = parts1[0];
    const last1 = parts1[parts1.length - 1];
    const first2 = parts2[0];
    const last2 = parts2[parts2.length - 1];
    
    // First names match (after nickname normalization) and last names are very similar
    if (first1 === first2 && calculateSimilarity(last1, last2) > 0.8) return true;
    
    // Last names match exactly and first names are similar
    if (last1 === last2 && calculateSimilarity(first1, first2) > 0.8) return true;
    
    // Last names match exactly and one first name is a prefix of the other (min 3 chars)
    // This catches cases like "Nik" vs "Nikolas" that aren't in the nickname map
    if (last1 === last2) {
      const shorter = first1.length < first2.length ? first1 : first2;
      const longer = first1.length < first2.length ? first2 : first1;
      if (shorter.length >= 3 && longer.startsWith(shorter)) {
        return true;
      }
    }
    
    return false;
  };

  // Find existing key that matches by email first, then by name
  const findMatchingKey = (statsMap: Map<string, any>, email?: string, name?: string): string | null => {
    // Email match is most reliable
    if (email) {
      const emailKey = email.toLowerCase();
      if (statsMap.has(emailKey)) return emailKey;
      
      // Check if any existing entry has this email
      for (const [key, entry] of statsMap.entries()) {
        if (entry.email && entry.email.toLowerCase() === emailKey) {
          return key;
        }
      }
    }
    
    // Fall back to name matching if no email
    if (name) {
      const nameKey = name.toLowerCase();
      if (statsMap.has(nameKey)) return nameKey;
      
      // Fuzzy name match
      for (const existingKey of statsMap.keys()) {
        const existingName = statsMap.get(existingKey)?.name || existingKey;
        if (isSamePerson(name, existingName)) {
          return existingKey;
        }
      }
    }
    
    return null;
  };

  // --- Aggregation Logic ---
  const aggregatedStats = useMemo(() => {
    const statsMap = new Map<string, {
      id: string | number;
      name: string;
      program: string;
      cohort: string;
      avatar_url?: string;
      completed: number;
      noshow: number;
      scheduled: number;
      total: number;
      latestSession: Date | null;
      email?: string;
      status?: 'active' | 'pending_match';
      welcomeSurveyDate?: Date;
    }>();

    // Track emails that have sessions
    const emailsWithSessions = new Set<string>();

    // 1. Initialize from Employees (Roster)
    employees.forEach(emp => {
      const name = emp.full_name || emp.employee_name || emp.name || 'Unknown';
      const email = emp.email || emp.company_email;
      
      if (name.toLowerCase() === 'kimberly genes') return;
      if (hiddenEmployees.has(String(emp.id))) return;

      // Use email as primary key, fall back to name
      const existingKey = findMatchingKey(statsMap, email, name);
      
      if (existingKey) {
        // Merge with existing - prefer the one with a program assigned
        const existing = statsMap.get(existingKey)!;
        const newProgram = (emp as any).program_title || emp.program || emp.program_name || 'Unassigned';
        if (existing.program === 'Unassigned' && newProgram !== 'Unassigned') {
          existing.program = newProgram;
          existing.cohort = emp.cohort || emp.program_name || existing.cohort;
        }
        // Always update email if we have one
        if (email && !existing.email) {
          existing.email = email;
        }
        // Update name only if existing has no sessions (prefer name from record with sessions)
        if (existing.total === 0 && name) {
          existing.name = name;
        }
      } else {
        // Use email as key if available, otherwise name
        const key = email ? email.toLowerCase() : name.toLowerCase();
        statsMap.set(key, {
          id: emp.id,
          name: name,
          program: (emp as any).program_title || emp.program || emp.program_name || 'Unassigned',
          cohort: emp.cohort || emp.program_name || '', 
          avatar_url: emp.avatar_url,
          completed: 0,
          noshow: 0,
          scheduled: 0,
          total: 0,
          latestSession: null,
          email: email,
          status: 'active'
        });
      }
    });

    // 2. Process Sessions (already filtered to exclude canceled in loadData)
    sessions.forEach(session => {
      const emp = session.employee_manager;
      const name = emp?.full_name || emp?.first_name 
                   ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                   : (session.employee_name || 'Unknown Employee');
      const email = emp?.email || emp?.company_email || (session as any).employee_email;
      
      if (email) emailsWithSessions.add(email.toLowerCase());
      
      if (name.toLowerCase() === 'kimberly genes') return;
      if (session.employee_id && hiddenEmployees.has(String(session.employee_id))) return;
      
      const sessionProgram = (session as any).program_title || session.program_name || session.program || '';
      const sessionCohort = session.cohort || session.program_name || '';

      let includeSession = true;
      if (filterType === 'program' && sessionProgram !== filterValue) includeSession = false;
      if (filterType === 'cohort' && sessionCohort !== filterValue) includeSession = false;

      // Use email-first matching to find existing entry
      let matchedKey = findMatchingKey(statsMap, email, name);
      
      if (!matchedKey) {
        if (hiddenEmployees.has(String(session.employee_id || session.id))) return;

        // Use email as key if available, otherwise name
        const key = email ? email.toLowerCase() : name.toLowerCase();
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
          email: email,
          status: 'active'
        });
        matchedKey = key;
      }

      const entry = statsMap.get(matchedKey)!;
      if (!entry.cohort && sessionCohort) entry.cohort = sessionCohort;
      if (entry.program === 'Unassigned' && sessionProgram) entry.program = sessionProgram;
      if (!entry.email && email) entry.email = email;
      entry.status = 'active';
      // Session data takes precedence for name (since it has sessions tied to it)
      if (name && name !== 'Unknown Employee') {
        entry.name = name;
      }

      if (includeSession) {
        entry.total += 1;
        const statusRaw = (session.status || '').toLowerCase();
        const sessionDate = new Date(session.session_date);
        const isPast = sessionDate < new Date();

        if (statusRaw.includes('no show') || statusRaw.includes('noshow') || statusRaw.includes('late cancel') || statusRaw.includes('client no show')) {
          entry.noshow += 1;
        } else if (statusRaw.includes('completed') || (statusRaw === '' && isPast) || (statusRaw === 'no label' && isPast)) {
          entry.completed += 1;
        } else {
          entry.scheduled += 1;
        }

        if (!entry.latestSession || sessionDate > entry.latestSession) {
          entry.latestSession = sessionDate;
        }
      }
    });

    // 3. Add welcome survey respondents who haven't had sessions yet (PENDING MATCH)
    welcomeSurveys.forEach(ws => {
      const email = ws.email?.toLowerCase();
      const name = `${ws.first_name || ''} ${ws.last_name || ''}`.trim() || 'Unknown';
      
      if (!email) return;
      if (hiddenEmployees.has(String(ws.id))) return;
      
      // Skip if they already have sessions
      if (emailsWithSessions.has(email)) return;
      
      // Check if already in statsMap
      const existingKey = findMatchingKey(statsMap, email, name);
      
      if (existingKey) {
        // Already exists - just mark them and add welcome survey date
        const existing = statsMap.get(existingKey)!;
        if (existing.total === 0) {
          existing.status = 'pending_match';
          existing.welcomeSurveyDate = new Date(ws.created_at);
          if (existing.program === 'Unassigned' && ws.program_title) {
            existing.program = ws.program_title;
          }
        }
      } else {
        // New entry - they completed survey but aren't in employee roster yet
        const key = email;
        statsMap.set(key, {
          id: `ws-${ws.id}`,
          name: name,
          program: ws.program_title || 'Unassigned',
          cohort: '',
          completed: 0,
          noshow: 0,
          scheduled: 0,
          total: 0,
          latestSession: null,
          email: email,
          status: 'pending_match',
          welcomeSurveyDate: new Date(ws.created_at)
        });
      }
    });

    return Array.from(statsMap.values());
  }, [sessions, employees, welcomeSurveys, filterType, filterValue, hiddenEmployees]);

  // Get unique programs for filter dropdown
  const availablePrograms = useMemo(() => {
    const programs = [...new Set(aggregatedStats.map(s => s.program).filter(Boolean))];
    return ['All', ...programs.sort()];
  }, [aggregatedStats]);

  // --- Filtering and Sorting Displayed Employees ---
  const filteredData = useMemo(() => {
    let result = aggregatedStats.filter(stat => {
      // Show employees who have sessions OR are pending match (completed welcome survey)
      if (stat.total === 0 && stat.status !== 'pending_match') return false;
      
      const matchesSearch = stat.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Program filter (local dropdown)
      const matchesProgram = programFilter === 'All' || stat.program === programFilter;
      
      let matchesContext = true;
      if (filterType === 'program') matchesContext = (stat.program === filterValue);
      else if (filterType === 'cohort') matchesContext = (stat.cohort === filterValue);

      return matchesSearch && matchesContext && matchesProgram;
    });
    
    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      // Handle string vs number sorting
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
    
    return result;
  }, [aggregatedStats, searchTerm, filterType, filterValue, programFilter, sortField, sortDirection]);
  
  // Handle column header click for sorting
  const handleSort = (field: 'name' | 'program' | 'completed' | 'noshow' | 'scheduled' | 'total') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // --- Survey Metrics Logic ---
  const surveyMetrics = useMemo(() => {
    const validEmails = new Set(filteredData.map(e => e.email?.toLowerCase()).filter(Boolean));
    
    const filteredSurveys = surveys.filter(s => {
        if (filterType === 'all') return true;
        return s.email && validEmails.has(s.email.toLowerCase());
    });

    const npsScores = filteredSurveys.filter(r => r.nps !== null && r.nps !== undefined).map(r => r.nps!);
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = npsScores.length > 0 
        ? Math.round(((promoters - detractors) / npsScores.length) * 100) 
        : null;

    const satScores = filteredSurveys.filter(r => r.coach_satisfaction !== null && r.coach_satisfaction !== undefined).map(r => r.coach_satisfaction!);
    const avgSat = satScores.length > 0 
        ? (satScores.reduce((a,b) => a+b, 0) / satScores.length).toFixed(1) 
        : null;
        
    return { nps, avgSat };
  }, [surveys, filteredData, filterType]);

  // --- Derived KPIs ---
  const totalEmployees = employees.length; // Total eligible employees
  const totalSessions = filteredData.reduce((acc, curr) => acc + curr.total, 0);
  const totalCompleted = filteredData.reduce((acc, curr) => acc + curr.completed, 0);
  
  // FIX: avg sessions = (completed + no-shows) / employees with sessions
  const employeesWithSessions = filteredData.filter(e => e.total > 0).length;
  const totalCompletedAndNoShows = filteredData.reduce((acc, curr) => acc + curr.completed + curr.noshow, 0);
  const avgSessions = employeesWithSessions > 0 
    ? (totalCompletedAndNoShows / employeesWithSessions).toFixed(1) 
    : '0.0';

  // Utilization = (welcome survey completions) / (total employees in roster)
  const surveyCompletions = welcomeSurveys.length;
  const adoptionRate = totalEmployees > 0 
    ? Math.round((surveyCompletions / totalEmployees) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl mt-8"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-xl shadow-sm border border-boon-red/20 max-w-7xl mx-auto mt-8">
        <AlertCircle className="w-16 h-16 text-boon-red mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Connection Error</h2>
        <p className="text-gray-600 mb-6 max-w-2xl font-mono text-sm bg-gray-50 p-4 rounded border border-gray-200 break-all">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-boon-blue text-white font-bold rounded-lg hover:bg-boon-darkBlue transition shadow-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

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
             const idMatch = s.employee_id && selectedStat.id && String(s.employee_id) === String(selectedStat.id) && !String(selectedStat.id).startsWith('gen-');
             
             let matchesFilter = true;
             const sessionProgram = s.program_name || s.program || '';
             const sessionCohort = s.cohort || s.program_name || '';

             if (filterType === 'program') matchesFilter = sessionProgram === filterValue;
             if (filterType === 'cohort') matchesFilter = sessionCohort === filterValue;
             
             return (nameMatch || idMatch) && matchesFilter;
          })}
          onClose={() => setSelectedStat(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
            <h1 className="text-2xl md:text-4xl font-extrabold text-boon-dark tracking-tight uppercase">{displayTitle}</h1>
            {filterType !== 'all' && (
              <span className="bg-boon-blue/10 text-boon-blue px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-sm">
                 <Layers size={14} className="md:w-4 md:h-4" />
                 <span className="truncate max-w-[200px]">{displaySubtitle}</span>
              </span>
            )}
          </div>
          <p className="text-gray-500 font-medium flex flex-wrap items-center gap-2 text-xs md:text-sm">
             Viewing {totalEmployees} employees in {filterType === 'all' ? 'total' : 'this program'}
             <span className="text-gray-300 hidden md:inline">|</span>
             <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {totalSessions} total sessions
             </span>
          </p>
        </div>
      </div>

      {/* ExecutiveSignals hidden for now
      <ExecutiveSignals context="Sessions" data={{ filteredData, totalSessions, totalCompleted, avgSessions, adoptionRate, ...surveyMetrics }} />
      */}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPICard 
          title="TOTAL EMPLOYEES" 
          value={totalEmployees} 
          color="bg-boon-blue" 
          icon={<Users className="w-6 h-6 text-white/50" />}
        />
        
        <AdoptionMetricCard 
          rate={adoptionRate} 
          engaged={surveyCompletions} 
          total={totalEmployees} 
        />

        <KPICard 
          title="TOTAL SESSIONS" 
          value={totalSessions} 
          color="bg-boon-red" 
          icon={<Calendar className="w-6 h-6 text-white/50" />}
        />
        <KPICard 
          title="COMPLETED" 
          value={totalCompleted} 
          color="bg-boon-green" 
          icon={<CheckCircle2 className="w-6 h-6 text-white/50" />}
        />
        <KPICard 
          title="AVG SESSIONS" 
          value={avgSessions} 
          color="bg-boon-yellow" 
          icon={<TrendingUp className="w-6 h-6 text-white/50" />}
          textColor="text-boon-dark"
        />
        
        {/* Conditional NPS & CSAT Cards - Fix: hide if no data */}
        {surveyMetrics.nps !== null && (
          <KPICard 
            title="NPS SCORE" 
            value={surveyMetrics.nps > 0 ? `+${surveyMetrics.nps}` : surveyMetrics.nps} 
            color="bg-boon-coral" 
            icon={<Users className="w-6 h-6 text-white/50" />}
          />
        )}
        {surveyMetrics.avgSat !== null && (
          <KPICard 
            title="CSAT SCORE" 
            value={`${surveyMetrics.avgSat}/10`} 
            color="bg-boon-darkBlue" 
            icon={<Star className="w-6 h-6 text-white/50" />}
          />
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <h3 className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 md:mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-boon-blue" />
          Completed Sessions Trend
        </h3>
        <div className="h-36 md:h-64 w-full overflow-x-auto">
           <div className="min-w-[600px] h-full">
              <SimpleTrendChart sessions={sessions} filterType={filterType} filterValue={filterValue} programFilter={programFilter} />
           </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96 bg-boon-bg rounded-lg group focus-within:ring-2 ring-boon-blue/30 transition">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-boon-blue" />
          <input 
            type="text" 
            placeholder="Search name..." 
            className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-transparent border-none focus:outline-none text-base md:text-sm font-medium text-gray-700 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="px-3 py-2 bg-boon-bg border-none rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-boon-blue/30"
          >
            {availablePrograms.map(prog => (
              <option key={prog} value={prog}>{prog === 'All' ? 'All Programs' : prog}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Employee Name
                    {sortField === 'name' && (
                      <span className="text-boon-blue">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSort('program')}
                >
                  <div className="flex items-center gap-1">
                    Program
                    {sortField === 'program' && (
                      <span className="text-boon-blue">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSort('completed')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Completed
                    {sortField === 'completed' && (
                      <span className="text-boon-blue">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSort('noshow')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Missed
                    {sortField === 'noshow' && (
                      <span className="text-boon-blue">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSort('scheduled')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Scheduled
                    {sortField === 'scheduled' && (
                      <span className="text-boon-blue">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Total
                    {sortField === 'total' && (
                      <span className="text-boon-blue">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length > 0 ? (
                filteredData.map((emp) => (
                  <tr 
                    key={emp.id} 
                    onClick={() => setSelectedStat(emp)}
                    className={`hover:bg-boon-blue/5 transition-colors group cursor-pointer ${emp.status === 'pending_match' ? 'bg-amber-50/50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 ${emp.status === 'pending_match' ? 'bg-amber-100 text-amber-600' : 'bg-boon-lightBlue text-boon-blue'}`}>
                            {emp.avatar_url ? (
                              <img src={emp.avatar_url} alt="" className="w-full h-full object-cover"/>
                            ) : (
                              emp.name.substring(0,2).toUpperCase()
                            )}
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-gray-800 text-sm whitespace-nowrap">{emp.name}</span>
                           {emp.status === 'pending_match' && (
                             <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Pending Coach Match</span>
                           )}
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex w-fit items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${emp.status === 'pending_match' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-boon-blue/10 text-boon-blue border border-boon-blue/20'}`}>
                        {emp.status === 'pending_match' ? 'PENDING MATCH' : getDisplayName(emp.program)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-6 rounded-full font-bold text-sm ${emp.completed > 0 ? 'bg-boon-green/20 text-boon-green' : 'text-gray-300'}`}>
                        {emp.completed || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {emp.noshow > 0 ? (
                        <span className="text-boon-red font-bold text-sm">{emp.noshow}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                       {emp.scheduled > 0 ? (
                        <span className="text-gray-600 font-medium text-sm">{emp.scheduled}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-black text-base ${emp.total > 0 ? 'text-boon-dark' : 'text-gray-300'}`}>{emp.total || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={(e) => handleHideEmployee(e, emp.id, emp.name)}
                        className="p-2 text-gray-300 hover:text-boon-red hover:bg-red-50 rounded-lg transition-colors"
                      >
                         <EyeOff size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                 <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                      No employees found matching your criteria.
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

const AdoptionMetricCard = ({ rate, engaged, total }: { rate: number, engaged: number, total: number }) => {
  const size = 64;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(rate, 100) / 100) * circumference;

  return (
    <div className="bg-boon-purple text-white rounded-2xl p-5 relative overflow-visible shadow-lg shadow-gray-200 transition-transform hover:-translate-y-1 group hover:z-50 w-full h-full flex flex-col justify-between">
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        <div className="relative z-10 flex justify-between items-start h-full">
            <div className="flex flex-col justify-between h-full min-h-[80px]">
                <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-90 mb-1 flex items-center gap-1.5 cursor-help w-fit">
                    UTILIZATION
                    <div className="group/tooltip relative">
                        <Info className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
                        <div className="absolute left-0 top-full mt-2 w-72 bg-boon-dark text-white text-xs p-4 rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[100] border border-gray-600 pointer-events-none hidden md:block">
                            <div className="font-bold text-sm text-boon-yellow mb-2">Program Utilization</div>
                            <p className="mb-3 leading-relaxed text-gray-300">
                                <span className="text-white font-bold">{engaged}</span> of <span className="text-white font-bold">{total}</span> eligible employees have completed the welcome survey and started onboarding.
                            </p>
                        </div>
                    </div>
                </h4>
                <span className="text-4xl font-extrabold tracking-tight mt-1">{Math.min(rate, 100)}%</span>
                <div className="w-8 h-1 rounded-full mt-auto bg-white/30"></div>
            </div>
            <div className="relative mt-2">
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth} fill="none" />
                    <circle 
                        cx={size/2} cy={size/2} r={radius} 
                        stroke="white" 
                        strokeWidth={strokeWidth} 
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        </div>
    </div>
  );
};

const SimpleTrendChart = ({ sessions, filterType, filterValue, programFilter }: { sessions: SessionWithEmployee[], filterType: string, filterValue: string, programFilter: string }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{x: number, y: number, value: number, label: string} | null>(null);

  const chartData = useMemo(() => {
    const monthlyCounts: Record<string, number> = {};
    if (sessions.length === 0) return [];

    const filteredSessions = sessions.filter(s => {
      if (filterType === 'all' && programFilter === 'All') return true;
      
      // Use program_title for filtering
      const sessionProgram = (s as any).program_title || s.program_name || s.program || '';
      
      // Check sidebar filter
      if (filterType === 'program' && sessionProgram !== filterValue) return false;
      
      // Check dropdown filter
      if (programFilter !== 'All' && sessionProgram !== programFilter) return false;
      
      const sessionCohort = s.cohort || s.program_name;
      if (filterType === 'cohort' && sessionCohort !== filterValue) return false;
      
      return true;
    });

    filteredSessions.forEach(s => {
      const status = (s.status || '').toLowerCase();
      const sessionDate = new Date(s.session_date);
      const isPast = sessionDate < new Date();
      
      const isNoShow = status.includes('no show') || status.includes('noshow') || status.includes('late cancel') || status.includes('client no show');
      const isCompleted = status.includes('completed') || (status === '' && isPast) || (status === 'no label' && isPast);

      if (!isNoShow && isCompleted) {
         const key = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}`;
         monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
      }
    });

    const sortedKeys = Object.keys(monthlyCounts).sort();
    if (sortedKeys.length === 0) return [];

    return sortedKeys.map(key => {
       const [year, month] = key.split('-');
       const date = new Date(parseInt(year), parseInt(month)-1);
       return {
         label: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
         value: monthlyCounts[key]
       };
    });
  }, [sessions, filterType, filterValue, programFilter]);

  if (chartData.length === 0) {
     return <div className="flex items-center justify-center h-full text-gray-400 text-xs uppercase font-bold">No completed sessions found</div>;
  }

  const width = 1000;
  const height = 260; 
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 50; 
  
  const values = chartData.map(d => d.value);
  const maxVal = Math.max(...values, 5) * 1.2;
  const minVal = 0;

  const points = chartData.map((d, i) => {
    const xRatio = chartData.length > 1 ? i / (chartData.length - 1) : 0.5;
    const x = paddingX + xRatio * (width - 2 * paddingX);
    const graphHeight = (height - paddingBottom) - paddingTop;
    const y = (height - paddingBottom) - ((d.value - minVal) / (maxVal - minVal)) * graphHeight;
    return { x, y, ...d };
  });

  const pathD = points.length > 1 
    ? `M${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L${p.x},${p.y}`).join(' ')
    : points.length === 1 
      ? `M${paddingX},${points[0].y} L${width-paddingX},${points[0].y}` 
      : "";

  const areaD = points.length > 0 
    ? `${pathD} L${points[points.length-1].x},${height - paddingBottom} L${points[0].x},${height - paddingBottom} Z`
    : "";

  return (
    <div className="w-full h-full relative group">
      {hoveredPoint && (
        <div 
          className="absolute z-20 bg-boon-dark text-white text-xs rounded-lg py-2 px-3 shadow-xl transform -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-75 border border-white/10"
          style={{ left: hoveredPoint.x, top: hoveredPoint.y - 12 }}
        >
           <div className="font-bold text-lg leading-none mb-1">{hoveredPoint.value}</div>
           <div className="text-boon-lightBlue text-[10px] uppercase font-bold tracking-wider">{hoveredPoint.label}</div>
           <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-boon-dark border-r border-b border-white/10 rotate-45"></div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
         <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#466FF6" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#466FF6" stopOpacity="0"/>
            </linearGradient>
          </defs>

         <line x1="0" y1={height - paddingBottom} x2={width} y2={height - paddingBottom} stroke="#f3f4f6" strokeWidth="1" />
         <line x1="0" y1={paddingTop} x2={width} y2={paddingTop} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />

         <path d={areaD} fill="url(#chartGradient)" />
         <path d={pathD} fill="none" stroke="#466FF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

         {points.map((p, i) => (
            <g key={i} 
               onMouseEnter={() => setHoveredPoint(p)}
               onMouseLeave={() => setHoveredPoint(null)}
               className="cursor-pointer"
            >
               <circle cx={p.x} cy={p.y} r="20" fill="transparent" />
               <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r={hoveredPoint?.label === p.label ? 6 : 4} 
                  fill="white" 
                  stroke="#466FF6" 
                  strokeWidth={hoveredPoint?.label === p.label ? 3 : 2} 
                  className="transition-all duration-200"
               />
            </g>
         ))}
         
         {points.map((p, i) => {
             const showLabel = points.length <= 12 || i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0;
             if (!showLabel) return null;
             return (
               <text key={i} x={p.x} y={height - paddingBottom} dy="25" textAnchor="middle" className="text-[10px] fill-gray-400 font-bold uppercase">
                 {p.label}
               </text>
             )
         })}
      </svg>
    </div>
  );
}

const SetupGuide = () => {
  const sqlCode = `-- Make sure program_name column exists:
select distinct program_name from session_tracking;
`;

  return (
    <div className="bg-boon-dark text-white p-6 rounded-xl shadow-xl border border-gray-700 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-boon-blue/20 rounded-lg">
          <Code className="w-6 h-6 text-boon-blue" />
        </div>
        <div>
          <h3 className="text-lg font-bold">SQL Schema Assistant</h3>
          <p className="text-gray-400 text-sm">Run this to check your data structure.</p>
        </div>
      </div>
      <div className="relative group">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => navigator.clipboard.writeText(sqlCode)} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs flex items-center gap-1">
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
        <pre className="bg-black/50 p-4 rounded-lg border border-gray-700 overflow-x-auto text-xs font-mono text-gray-300 leading-relaxed">{sqlCode}</pre>
      </div>
    </div>
  );
}

const KPICard = ({ 
  title, 
  value, 
  color, 
  icon, 
  textColor 
}: { 
  title: string, 
  value: string | number, 
  color: string, 
  icon: React.ReactNode, 
  textColor?: string 
}) => {
    const isPrimaryColor = color.startsWith('bg-');
    const valueColor = textColor || (isPrimaryColor ? "text-white" : "text-gray-800");
    const titleColor = textColor ? "text-boon-dark/60" : (isPrimaryColor ? "text-white/70" : "text-gray-400");

    return (
        <div className={`${color} rounded-2xl p-6 shadow-sm border border-transparent relative overflow-hidden w-full h-full flex flex-col justify-between`}>
            {isPrimaryColor && <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>}
            
            <div className="flex items-center gap-4 relative z-10">
              <div className={`p-3 rounded-xl backdrop-blur-sm shadow-sm ${isPrimaryColor ? 'bg-white/20' : 'bg-gray-50'}`}>
                  {icon}
              </div>
              <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${titleColor}`}>{title}</p>
                  <p className={`text-3xl font-black ${valueColor}`}>{value}</p>
              </div>
            </div>
        </div>
    );
};

const EmployeeDetailModal = ({ 
  employee, 
  sessions, 
  onClose 
}: { 
  employee: any, 
  sessions: SessionWithEmployee[], 
  onClose: () => void 
}) => {
  // Filter out canceled sessions and sort by date
  const displaySessions = sessions
    .filter(s => !isCanceledSession(s.status || ''))
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  // Recalculate counts based on filtered sessions
  const completedCount = displaySessions.filter(s => {
    const statusLower = (s.status || '').toLowerCase();
    const isPast = new Date(s.session_date) < new Date();
    return statusLower.includes('completed') || (!s.status && isPast) || (statusLower === 'no label' && isPast);
  }).length;
  
  const noShowCount = displaySessions.filter(s => {
    const statusLower = (s.status || '').toLowerCase();
    return statusLower.includes('no show') || statusLower.includes('noshow') || statusLower.includes('late cancel') || statusLower.includes('client no show');
  }).length;
  
  const scheduledCount = displaySessions.filter(s => {
    const statusLower = (s.status || '').toLowerCase();
    const isPast = new Date(s.session_date) < new Date();
    const isCompleted = statusLower.includes('completed') || (!s.status && isPast) || (statusLower === 'no label' && isPast);
    const isNoShow = statusLower.includes('no show') || statusLower.includes('noshow') || statusLower.includes('late cancel') || statusLower.includes('client no show');
    return !isCompleted && !isNoShow;
  }).length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-boon-dark/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
       <div 
         className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200"
         onClick={e => e.stopPropagation()}
       >
          {/* Modal Header */}
          <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-boon-blue flex items-center justify-center text-white font-bold text-lg sm:text-xl overflow-hidden shadow-md border-2 border-white ring-2 ring-boon-blue/10">
                    {employee.avatar_url ? (
                        <img src={employee.avatar_url} alt={employee.name} className="w-full h-full object-cover"/>
                    ) : (
                        employee.name.substring(0,2).toUpperCase()
                    )}
                </div>
                <div>
                   <h2 className="text-lg sm:text-xl font-black text-boon-dark">{employee.name}</h2>
                   <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mt-0.5">
                      <span className="text-boon-blue bg-boon-blue/10 px-2 py-0.5 rounded text-xs uppercase tracking-wide font-bold">
                        {getDisplayName(employee.program)}
                      </span>
                   </div>
                </div>
             </div>
             <button 
               onClick={onClose} 
               className="p-3 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-colors touch-manipulation"
             >
               <X className="w-6 h-6" />
             </button>
          </div>
          
          {/* KPI Row inside Modal - use recalculated counts */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-white">
              <div className="p-3 sm:p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Completed</div>
                  <div className="text-xl sm:text-2xl font-black text-boon-green">{completedCount}</div>
              </div>
              <div className="p-3 sm:p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Scheduled</div>
                  <div className="text-xl sm:text-2xl font-black text-gray-700">{scheduledCount}</div>
              </div>
              <div className="p-3 sm:p-4 text-center">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Missed</div>
                  <div className="text-xl sm:text-2xl font-black text-boon-red">{noShowCount}</div>
              </div>
          </div>
          
          {/* Session List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/30">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Calendar className="w-3.5 h-3.5" />
               Session History
             </h3>
             
             {displaySessions.length > 0 ? (
               <div className="space-y-3">
                  {displaySessions.map((session) => {
                     const statusLower = (session.status || '').toLowerCase();
                     const sessionDate = new Date(session.session_date);
                     const isPast = sessionDate < new Date();
                     const isCompleted = statusLower.includes('completed') || (!session.status && isPast) || (statusLower === 'no label' && isPast);
                     const isNoShow = statusLower.includes('no show') || statusLower.includes('noshow') || statusLower.includes('late cancel') || statusLower.includes('client no show');
                     
                     return (
                       <div key={session.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex flex-col">
                                <span className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                   {new Date(session.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {session.duration_minutes && (
                                   <div className="text-xs text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3" /> {session.duration_minutes} min
                                   </div>
                                )}
                             </div>
                             
                             {isNoShow ? (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-boon-red border border-red-100 uppercase tracking-wide">
                                   {session.status || 'No Show'}
                                </span>
                             ) : isCompleted ? (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-boon-green border border-green-100 uppercase tracking-wide">
                                   Completed
                                </span>
                             ) : (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-boon-blue border border-blue-100 uppercase tracking-wide">
                                   Scheduled
                                </span>
                             )}
                          </div>
                          
                          {session.notes && (
                             <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                {session.notes}
                             </div>
                          )}
                       </div>
                     );
                  })}
               </div>
             ) : (
               <div className="text-center p-8 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                  No session history available.
               </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default SessionDashboard;