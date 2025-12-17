import { supabase } from './supabaseClient';
import { Employee, Session, DashboardStats, SessionWithEmployee, CompetencyScore, SurveyResponse, WelcomeSurveyEntry, ProgramConfig } from '../types';

/**
 * Fetches all employees from the 'employee_manager' table (formerly 'employees').
 */
export const getEmployeeRoster = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employee_manager')
    .select('*')
    // Filter out known test accounts
    .neq('company_email', 'asimmons@boon-health.com')
    .order('last_name', { ascending: true });

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  // Ensure derived fields are populated if needed
  return data.map((d: any) => ({
    ...d,
    full_name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
    name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
    employee_name: d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.email,
  })) as Employee[];
};

// Alias for backwards compatibility
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
    return [];
  }

  return data as SessionWithEmployee[];
};

export const fetchSessions = async (): Promise<Session[]> => {
    // Cast to compatible type
    return (await getDashboardSessions()) as unknown as Session[];
}

/**
 * Fetches competency scores.
 */
export const getCompetencyScores = async (): Promise<CompetencyScore[]> => {
  // Corrected table name to 'competency_scores_grow' as per migration data source
  const { data, error } = await supabase
    .from('competency_scores_grow') 
    .select('*');

  if (error) {
    console.error('Error fetching competency scores:', error);
    return [];
  }

  // Ensure numeric parsing for pre/post scores to prevent string concatenation issues
  return data.map((d: any) => ({
    ...d,
    pre: d.pre !== null && d.pre !== undefined ? Number(d.pre) : 0,
    post: d.post !== null && d.post !== undefined ? Number(d.post) : 0
  })) as CompetencyScore[];
};

/**
 * Fetches survey responses.
 */
export const getSurveyResponses = async (): Promise<SurveyResponse[]> => {
  const { data, error } = await supabase
    .from('survey_responses_unified')
    .select('*');

  if (error) {
    console.error('Error fetching survey responses:', error);
    return [];
  }

  return data as SurveyResponse[];
};

/**
 * Fetches welcome survey baseline data.
 */
export const getWelcomeSurveyData = async (): Promise<WelcomeSurveyEntry[]> => {
  const { data, error } = await supabase
    .from('welcome_survey_baseline')
    .select('*');

  if (error) {
    console.error('Error fetching welcome survey data:', error);
    return [];
  }

  return data as WelcomeSurveyEntry[];
};

/**
 * Fetches program configuration.
 */
export const getProgramConfig = async (): Promise<ProgramConfig[]> => {
  const { data, error } = await supabase
    .from('program_config')
    .select('*');

  if (error) {
    console.error('Error fetching program config:', error);
    return [];
  }

  return data as ProgramConfig[];
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