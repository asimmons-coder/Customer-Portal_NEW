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
// EMPLOYEE & SESSION QUERIES (unchanged)
// ============================================

/**
 * Fetches all employees from the 'employee_manager' table.
 */
export const getEmployeeRoster = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employee_manager')
    .select('*')
    .neq('company_email', 'asimmons@boon-health.com')
    .order('last_name', { ascending: true });

  if (error) {
    console.error('Error fetching employees:', error);
    Sentry.captureException(error, { tags: { query: 'getEmployeeRoster' } });
    return [];
  }

  return data.map((d: any) => ({
    ...d,
    full_name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
    name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
    employee_name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
  })) as Employee[];
};

export const fetchEmployees = getEmployeeRoster;

/**
 * Fetches all sessions from 'session_tracking'.
 */
export const getDashboardSessions = async (): Promise<SessionWithEmployee[]> => {
  const { data, error } = await supabase
    .from('session_tracking')
    .select('*')
    .order('session_date', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    Sentry.captureException(error, { tags: { query: 'getDashboardSessions' } });
    return [];
  }

  return data as SessionWithEmployee[];
};

export const fetchSessions = async (): Promise<Session[]> => {
    return (await getDashboardSessions()) as unknown as Session[];
}

// ============================================
// NEW SCHEMA QUERIES
// ============================================

/**
 * Fetches all survey submissions from the unified survey_submissions table.
 */
export const getSurveySubmissions = async (surveyType?: 'baseline' | 'end_of_program'): Promise<SurveySubmission[]> => {
  let query = supabase.from('survey_submissions').select('*');
  
  if (surveyType) {
    query = query.eq('survey_type', surveyType);
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
export const getCompetencyPrePost = async (): Promise<CompetencyPrePost[]> => {
  const { data, error } = await supabase
    .from('competency_pre_post')
    .select('*');

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
export const getFocusAreaSelections = async (): Promise<FocusAreaSelection[]> => {
  const { data, error } = await supabase
    .from('focus_area_selections')
    .select('*')
    .eq('selected', true);

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
export const getBaselineCompetencyScores = async (): Promise<CompetencyScoreRecord[]> => {
  const { data, error } = await supabase
    .from('competency_scores')
    .select('*')
    .eq('score_type', 'baseline');

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
export const getCompetencyScores = async (): Promise<CompetencyScore[]> => {
  const { data, error } = await supabase
    .from('competency_pre_post')
    .select('*');

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
 * Includes end_of_program, feedback (every-other-session), and first_session surveys.
 */
export const getSurveyResponses = async (): Promise<SurveyResponse[]> => {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .in('survey_type', ['end_of_program', 'feedback', 'first_session'])
    .not('nps', 'is', null)
    .limit(10000);  // Override default 1000 limit

  if (error) {
    console.error('Error fetching survey responses:', error);
    Sentry.captureException(error, { tags: { query: 'getSurveyResponses' } });
    return [];
  }

  // Map to legacy SurveyResponse format
  return data.map((d: any) => ({
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
  })) as SurveyResponse[];
};

/**
 * Fetches welcome survey baseline data in legacy format.
 * Uses survey_submissions table filtered by survey_type='baseline'.
 */
export const getWelcomeSurveyData = async (): Promise<WelcomeSurveyEntry[]> => {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .eq('survey_type', 'baseline');

  if (error) {
    console.error('Error fetching welcome survey data:', error);
    Sentry.captureException(error, { tags: { query: 'getWelcomeSurveyData' } });
    return [];
  }

  // Map to legacy WelcomeSurveyEntry format
  return data.map((d: any) => ({
    email: d.email,
    cohort: d.cohort || d.program_title || '',
    company: d.account_name || '',
    role: d.role,
    satisfaction: d.wellbeing_satisfaction,
    productivity: d.wellbeing_productivity,
    work_life_balance: d.wellbeing_balance,
    motivation: d.wellbeing_motivation,
    inclusion: d.wellbeing_inclusion,
    age_range: d.age_range,
    tenure: d.tenure,
    years_experience: d.years_experience,
    previous_coaching: d.previous_coaching ? '1' : '0',
    coaching_goals: d.coaching_goals,
    program_title: d.program_title,
    account_name: d.account_name,
    company_id: d.company_id,
    account: d.account_name, // alias for backward compatibility
  })) as WelcomeSurveyEntry[];
};

/**
 * Fetches welcome survey data for Scale programs.
 * For now, falls back to legacy table until Scale data is migrated.
 */
export const getWelcomeSurveyScaleData = async (): Promise<WelcomeSurveyEntry[]> => {
  // TODO: Update when Scale data is migrated to survey_submissions
  const { data, error } = await supabase
    .from('welcome_survey_scale')
    .select('*');

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
export const getWelcomeSurveyByProgramType = async (programType: 'scale' | 'grow' = 'grow'): Promise<WelcomeSurveyEntry[]> => {
  if (programType === 'scale') {
    return getWelcomeSurveyScaleData();
  }
  return getWelcomeSurveyData();
};

// ============================================
// CONFIG & BENCHMARK QUERIES (unchanged)
// ============================================

/**
 * Fetches program configuration.
 */
export const getProgramConfig = async (): Promise<ProgramConfig[]> => {
  const { data, error } = await supabase
    .from('program_config')
    .select('*');

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