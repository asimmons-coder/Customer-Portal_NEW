import * as Sentry from '@sentry/react';
import { supabase } from './supabaseClient';
import { 
  Employee, 
  Session, 
  DashboardStats, 
  SessionWithEmployee, 
  CompetencyScore, 
  SurveyResponse, 
  WelcomeSurveyEntry, 
  ProgramConfig,
  SurveySubmission,
  CompetencyPrePost,
  CompetencyScoreRecord,
  FocusAreaSelection
} from '../types';

// ============================================
// COMPANY FILTER CONTEXT
// ============================================

/**
 * Filter options for company-scoped queries.
 * 
 * For single-company accounts (most customers):
 *   - Use companyId for exact company match
 * 
 * For multi-location accounts (e.g., Media Arts Lab):
 *   - Use companyId to get ALL locations
 *   - Use accountName to filter to a specific location
 *   - Use programTitle to filter to a specific program
 * 
 * Priority: companyId > accountName (companyId is preferred when both are set)
 */
export interface CompanyFilter {
  companyId?: string;      // UUID - exact company match, gets ALL locations for that company
  accountName?: string;    // Display name - partial match with ilike for specific location
  programTitle?: string;   // Optional: filter to specific program within the company
}

// ============================================
// EMPLOYEE & SESSION QUERIES
// ============================================

/**
 * Fetches employees from the 'employee_manager' table, filtered by company.
 * For multi-location accounts: accountName takes precedence to filter to specific location.
 */
export const getEmployeeRoster = async (filter?: CompanyFilter): Promise<Employee[]> => {
  let query = supabase
    .from('employee_manager')
    .select('*')
    .neq('company_email', 'asimmons@boon-health.com');

  // Apply company filter at query level
  // For multi-location: accountName takes precedence if set
  if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  } else if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  }

  // Optional program title filter
  if (filter?.programTitle) {
    query = query.eq('program_title', filter.programTitle);
  }

  const { data, error } = await query.order('last_name', { ascending: true });

  if (error) {
    console.error('Error fetching employees:', error);
    Sentry.captureException(error, { tags: { query: 'getEmployeeRoster' } });
    return [];
  }

  console.log(`Fetched ${data?.length || 0} employees for company filter:`, filter);

  return (data || []).map((d: any) => ({
    ...d,
    full_name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
    name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
    employee_name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
  })) as Employee[];
};

export const fetchEmployees = getEmployeeRoster;

/**
 * Fetches sessions from 'session_tracking', filtered by company.
 * Uses batch fetching to avoid Supabase 1000 row limit.
 * 
 * For multi-location accounts: if accountName is provided, it takes precedence
 * to filter to that specific location even if companyId is also set.
 */
export const getDashboardSessions = async (filter?: CompanyFilter): Promise<SessionWithEmployee[]> => {
  let allData: any[] = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('session_tracking')
      .select('*');

    // Apply company filter at query level
    // For multi-location: accountName takes precedence if set (filters to specific location)
    // For single-company: use companyId for exact match
    if (filter?.accountName) {
      // Multi-location account - filter to specific location
      query = query.ilike('account_name', `%${filter.accountName}%`);
    } else if (filter?.companyId) {
      // Single company account - get all data for this company
      query = query.eq('company_id', filter.companyId);
    }

    // Optional program title filter
    if (filter?.programTitle) {
      query = query.eq('program_title', filter.programTitle);
    }

    const { data, error } = await query
      .order('session_date', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Error fetching sessions:', error);
      Sentry.captureException(error, { tags: { query: 'getDashboardSessions' } });
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allData.length} total sessions for company filter:`, filter);
  return allData as SessionWithEmployee[];
};

export const fetchSessions = async (filter?: CompanyFilter): Promise<Session[]> => {
    return (await getDashboardSessions(filter)) as unknown as Session[];
}

// ============================================
// NEW SCHEMA QUERIES
// ============================================

/**
 * Fetches all survey submissions from the unified survey_submissions table.
 */
export const getSurveySubmissions = async (surveyType?: 'baseline' | 'end_of_program', filter?: CompanyFilter): Promise<SurveySubmission[]> => {
  let query = supabase.from('survey_submissions').select('*');
  
  if (surveyType) {
    query = query.eq('survey_type', surveyType);
  }

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching survey submissions:', error);
    Sentry.captureException(error, { tags: { query: 'getSurveySubmissions', surveyType } });
    return [];
  }

  return data as SurveySubmission[];
};

/**
 * Fetches competency pre/post comparison data from the view.
 * This is the primary source for competency growth calculations.
 */
export const getCompetencyPrePost = async (filter?: CompanyFilter): Promise<CompetencyPrePost[]> => {
  let query = supabase
    .from('competency_pre_post')
    .select('*');

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching competency pre/post:', error);
    Sentry.captureException(error, { tags: { query: 'getCompetencyPrePost' } });
    return [];
  }

  return data as CompetencyPrePost[];
};

/**
 * Fetches focus area selections.
 */
export const getFocusAreaSelections = async (filter?: CompanyFilter): Promise<FocusAreaSelection[]> => {
  let query = supabase
    .from('focus_area_selections')
    .select('*')
    .eq('selected', true);

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching focus area selections:', error);
    Sentry.captureException(error, { tags: { query: 'getFocusAreaSelections' } });
    return [];
  }

  return data as FocusAreaSelection[];
};

/**
 * Fetches baseline competency scores from competency_scores table.
 * Used for baseline dashboard competency averages.
 */
export const getBaselineCompetencyScores = async (filter?: CompanyFilter): Promise<CompetencyScoreRecord[]> => {
  let query = supabase
    .from('competency_scores')
    .select('*')
    .eq('score_type', 'baseline');

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching baseline competency scores:', error);
    Sentry.captureException(error, { tags: { query: 'getBaselineCompetencyScores' } });
    return [];
  }

  return data as CompetencyScoreRecord[];
};

// ============================================
// LEGACY-COMPATIBLE QUERIES
// These fetch from new tables but return data in old format
// ============================================

/**
 * Fetches competency scores in legacy format.
 * Uses competency_pre_post view and maps to CompetencyScore interface.
 */
export const getCompetencyScores = async (filter?: CompanyFilter): Promise<CompetencyScore[]> => {
  let query = supabase
    .from('competency_pre_post')
    .select('*');

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching competency scores:', error);
    Sentry.captureException(error, { tags: { query: 'getCompetencyScores' } });
    return [];
  }

  // Map competency_pre_post view to legacy CompetencyScore format
  return data.map((d: any) => ({
    email: d.email,
    program: d.salesforce_program_id || '',
    competency: d.competency_name,
    pre: d.pre_score !== null && d.pre_score !== undefined ? Number(d.pre_score) : 0,
    post: d.post_score !== null && d.post_score !== undefined ? Number(d.post_score) : 0,
    program_title: d.program_title,
    account_name: d.account_name,
    company_id: d.company_id,
    // Note: feedback fields need to come from survey_submissions if needed
  })) as CompetencyScore[];
};

/**
 * Fetches survey responses with NPS/CSAT data.
 * Includes end_of_program, feedback (every-other-session), first_session, AND touchpoint surveys.
 */
export const getSurveyResponses = async (filter?: CompanyFilter): Promise<SurveyResponse[]> => {
  // Supabase has a 1000 row default limit. We need to paginate to get all records.
  const allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    let query = supabase
      .from('survey_submissions')
      .select('*')
      .in('survey_type', ['end_of_program', 'feedback', 'first_session', 'touchpoint']);

    // Apply company filter
    if (filter?.companyId) {
      query = query.eq('company_id', filter.companyId);
    } else if (filter?.accountName) {
      query = query.ilike('account_name', `%${filter.accountName}%`);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching survey responses:', error);
      Sentry.captureException(error, { tags: { query: 'getSurveyResponses' } });
      break;
    }

    if (!data || data.length === 0) break;
    
    allData.push(...data);
    
    if (data.length < pageSize) break; // Last page
    from += pageSize;
  }

  // Filter to records that have NPS OR feedback OR wellbeing data
  const filteredData = allData.filter(d => 
    d.nps !== null || 
    d.feedback_learned || 
    d.feedback_insight ||
    d.wellbeing_satisfaction !== null ||
    d.wellbeing_productivity !== null ||
    d.wellbeing_balance !== null
  );

  // Map to legacy SurveyResponse format
  return filteredData.map((d: any) => ({
    email: d.email,
    nps: d.nps,
    coach_satisfaction: d.coach_satisfaction,
    feedback_learned: d.feedback_learned,
    feedback_insight: d.feedback_insight,
    feedback_suggestions: d.feedback_suggestions,
    program_title: d.program_title,
    account_name: d.account_name,
    company_id: d.company_id,
    survey_type: d.survey_type,
    // Wellbeing fields for impact calculations
    wellbeing_satisfaction: d.wellbeing_satisfaction,
    wellbeing_productivity: d.wellbeing_productivity,
    wellbeing_balance: d.wellbeing_balance,
  })) as SurveyResponse[];
};

/**
 * Fetches welcome survey baseline data in legacy format.
 * Uses welcome_survey_baseline table which has comp_* competency fields.
 */
export const getWelcomeSurveyData = async (filter?: CompanyFilter): Promise<WelcomeSurveyEntry[]> => {
  let query = supabase
    .from('welcome_survey_baseline')
    .select('*');

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching welcome survey data:', error);
    Sentry.captureException(error, { tags: { query: 'getWelcomeSurveyData' } });
    return [];
  }

  // Map to WelcomeSurveyEntry format - spread all fields to include sub_* columns
  return data.map((d: any) => ({
    ...d, // Include ALL fields from database (including sub_* columns)
    // Override/normalize specific fields
    email: d.email,
    cohort: d.cohort || d.program_title || '',
    company: d.company || d.account || '',
    role: d.role,
    satisfaction: d.satisfaction,
    productivity: d.productivity,
    work_life_balance: d.work_life_balance,
    motivation: d.motivation,
    inclusion: d.inclusion,
    age_range: d.age_range,
    tenure: d.tenure,
    years_experience: d.years_experience,
    previous_coaching: d.previous_coaching ? '1' : '0',
    coaching_goals: d.coaching_goals,
    program_title: d.program_title,
    account_name: d.account,
    company_id: d.company_id,
    account: d.account,
  })) as WelcomeSurveyEntry[];
};

/**
 * Fetches welcome survey data for Scale programs.
 * For now, falls back to legacy table until Scale data is migrated.
 */
export const getWelcomeSurveyScaleData = async (filter?: CompanyFilter): Promise<WelcomeSurveyEntry[]> => {
  // TODO: Update when Scale data is migrated to survey_submissions
  let query = supabase
    .from('welcome_survey_scale')
    .select('*');

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching Scale welcome survey data:', error);
    Sentry.captureException(error, { tags: { query: 'getWelcomeSurveyScaleData' } });
    return [];
  }

  return data as WelcomeSurveyEntry[];
};

/**
 * Fetches welcome survey data based on program type.
 */
export const getWelcomeSurveyByProgramType = async (programType: 'scale' | 'grow' = 'grow', filter?: CompanyFilter): Promise<WelcomeSurveyEntry[]> => {
  if (programType === 'scale') {
    return getWelcomeSurveyScaleData(filter);
  }
  return getWelcomeSurveyData(filter);
};

// ============================================
// CONFIG & BENCHMARK QUERIES
// ============================================

/**
 * Fetches program configuration from program_config table.
 */
export const getProgramConfig = async (filter?: CompanyFilter): Promise<ProgramConfig[]> => {
  let query = supabase
    .from('program_config')
    .select('*');

  // Apply company filter
  if (filter?.companyId) {
    query = query.eq('company_id', filter.companyId);
  } else if (filter?.accountName) {
    query = query.ilike('account_name', `%${filter.accountName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching program config:', error);
    Sentry.captureException(error, { tags: { query: 'getProgramConfig' } });
    return [];
  }

  return data as ProgramConfig[];
};

/**
 * Fetches benchmark data for comparisons.
 */
export const getBenchmarks = async (programType: 'Scale' | 'GROW' = 'Scale'): Promise<Record<string, {
  avg: number;
  p25: number;
  p75: number;
  sampleSize: number;
}>> => {
  const { data, error } = await supabase
    .from('boon_benchmarks')
    .select('*')
    .eq('program_type', programType);

  if (error) {
    console.error('Error fetching benchmarks:', error);
    Sentry.captureException(error, { tags: { query: 'getBenchmarks', programType } });
    return {};
  }

  const benchmarks: Record<string, any> = {};
  data?.forEach((b: any) => {
    benchmarks[b.metric_name] = {
      avg: b.avg_value,
      p25: b.percentile_25,
      p75: b.percentile_75,
      sampleSize: b.sample_size
    };
  });

  return benchmarks;
};

/**
 * Calculates basic stats from an array of sessions.
 */
export const calculateStats = (sessions: Session[]): DashboardStats => {
  const now = new Date();
  
  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter(s => {
       const status = (s.status || '').toLowerCase();
       return status.includes('completed');
    }).length,
    upcomingSessions: sessions.filter(s => {
      const date = new Date(s.session_date);
      const status = (s.status || '').toLowerCase();
      return status === 'scheduled' && date >= now;
    }).length,
  };
};

// ============================================
// HELPER: BUILD COMPANY FILTER FROM USER CONTEXT
// ============================================

/**
 * Builds the appropriate CompanyFilter based on user metadata.
 * 
 * Logic:
 * - If user has account_name in JWT → they're part of a multi-location company
 *   → Use accountName to filter to their specific location
 * - If user only has company_id → single company account
 *   → Use companyId to get all their company data
 * - Fallback: use company name with partial matching
 * 
 * @param companyId - UUID from app_metadata.company_id
 * @param accountName - Location name from app_metadata.account_name (for multi-location)
 * @param companyName - Company name from app_metadata.company (fallback)
 * @returns CompanyFilter configured for the user's access level
 */
export const buildCompanyFilter = (
  companyId?: string,
  accountName?: string,
  companyName?: string
): CompanyFilter => {
  // Multi-location account: user has specific account_name
  if (accountName) {
    return { accountName };
  }
  
  // Single company account: use company_id
  if (companyId) {
    return { companyId };
  }
  
  // Fallback: use company name with cleaning
  if (companyName) {
    const cleanName = companyName
      .split(' - ')[0]
      .replace(/\s+(SCALE|GROW|EXEC)$/i, '')
      .trim();
    return { accountName: cleanName };
  }
  
  // No filter - will return all data (should not happen in practice)
  return {};
};