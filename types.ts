export interface Employee {
  id: number | string;
  first_name: string;
  last_name: string;
  email: string;
  program: string;
  
  // Extended properties
  avatar_url?: string;
  full_name?: string;
  employee_name?: string;
  name?: string;
  program_name?: string;
  cohort?: string;
  company?: string;
  
  // Optional for dashboard usage
  department?: string;
  job_title?: string;
  company_role?: string;
  start_date?: string;
  end_date?: string | null;
  status?: string;
  company_email?: string;
  company_name?: string;
}

export interface Session {
  id: number | string;
  employee_id: number | string;
  session_date: string;
  status: string; // 'Scheduled' | 'Completed' | 'No Show' | 'Canceled' | string
  notes?: string;
  // Optional joined data
  employee?: {
    first_name: string;
    last_name: string;
  };
}

export interface SessionWithEmployee extends Session {
  created_at?: string;
  duration_minutes?: number;
  employee_manager?: Employee;
  
  // Flattened properties commonly found in views
  program_name?: string;
  program?: string;
  cohort?: string;
  employee_name?: string;
  
  // Themes
  mental_well_being?: string;
  leadership_management_skills?: string;
  communication_skills?: string;
}

// ============================================
// NEW NORMALIZED SCHEMA TYPES
// ============================================

/**
 * Unified survey submission record - replaces welcome_survey_baseline and survey_responses_unified
 */
export interface SurveySubmission {
  id: string;
  created_at: string;
  email: string;
  first_name?: string;
  last_name?: string;
  participant_name?: string;
  account_name: string;
  program_title: string;
  salesforce_program_id: string;
  company_id: string;
  cohort?: string;
  survey_type: 'baseline' | 'end_of_program';
  program_type?: string;
  submitted_at?: string;
  typeform_response_id?: string;
  
  // Demographics
  age_range?: string;
  gender?: string;
  role?: string;
  years_experience?: string;
  tenure?: string;
  previous_coaching?: boolean;
  
  // Wellbeing metrics (baseline)
  wellbeing_satisfaction?: number;
  wellbeing_productivity?: number;
  wellbeing_balance?: number;
  wellbeing_motivation?: number;
  wellbeing_inclusion?: number;
  
  // Satisfaction metrics (end_of_program)
  nps?: number;
  coach_satisfaction?: number;
  coach_name?: string;
  continue_likelihood?: number;
  
  // Feedback text
  feedback_learned?: string;
  feedback_insight?: string;
  feedback_coach_description?: string;
  feedback_suggestions?: string;
  feedback_enjoying?: string;
  feedback_experience?: string;
  coaching_goals?: string;
  
  // Coaching attributes
  attr_safe?: boolean;
  attr_listened?: boolean;
  attr_tools?: boolean;
  attr_challenged?: boolean;
  
  // Benefits
  benefit_productive?: boolean;
  benefit_stress?: boolean;
  benefit_present?: boolean;
  benefit_talents?: boolean;
  benefit_optimistic?: boolean;
}

/**
 * Individual competency score record
 */
export interface CompetencyScoreRecord {
  id: string;
  created_at: string;
  survey_submission_id: string;
  email: string;
  account_name: string;
  program_title: string;
  salesforce_program_id: string;
  company_id: string;
  competency_name: string;
  score: number;
  score_label?: string;
  score_type: 'baseline' | 'end_of_program';
}

/**
 * Pre/post competency comparison from the view
 */
export interface CompetencyPrePost {
  email: string;
  account_name: string;
  program_title: string;
  salesforce_program_id: string;
  company_id: string;
  competency_name: string;
  pre_score: number;
  pre_label?: string;
  post_score: number;
  post_label?: string;
  score_change: number;
  percent_change: number;
}

/**
 * Focus area selection record
 */
export interface FocusAreaSelection {
  id: string;
  created_at: string;
  survey_submission_id: string;
  email: string;
  account_name: string;
  program_title: string;
  salesforce_program_id: string;
  company_id: string;
  focus_area_category: string;
  focus_area_name: string;
  is_primary: boolean;
  selected: boolean;
}

// ============================================
// LEGACY COMPATIBLE TYPES
// These map new schema data to old interfaces for gradual migration
// ============================================

/**
 * Competency score with pre/post - used by dashboard components
 * Maps from CompetencyPrePost view
 */
export interface CompetencyScore {
  id?: number | string;
  email: string;
  program: string;
  competency: string;
  pre: number;
  post: number;
  feedback_learned?: string;
  feedback_insight?: string;
  feedback_suggestions?: string;
  // New fields
  program_title?: string;
  account_name?: string;
  company_id?: string;
}

/**
 * Survey response - used by dashboard components
 * Maps from SurveySubmission with survey_type='end_of_program'
 */
export interface SurveyResponse {
  email: string;
  nps?: number;
  coach_satisfaction?: number;
  feedback_learned?: string;
  feedback_insight?: string;
  feedback_suggestions?: string;
  // New fields
  program_title?: string;
  account_name?: string;
  company_id?: string;
}

/**
 * Welcome survey entry - used by dashboard components
 * Maps from SurveySubmission with survey_type='baseline'
 */
export interface WelcomeSurveyEntry {
  cohort: string;
  company: string;
  role?: string;
  satisfaction?: number;
  productivity?: number;
  work_life_balance?: number;
  motivation?: number;
  inclusion?: number;
  age_range?: string;
  tenure?: string;
  years_experience?: string;
  previous_coaching?: string;
  coaching_goals?: string;
  
  // New fields
  program_title?: string;
  account_name?: string;
  company_id?: string;
  email?: string;
  
  [key: string]: any;
}

export interface ProgramConfig {
  id?: number | string;
  account_name: string;
  sessions_per_employee: number;
  program_name?: string;
  program_title?: string;
  program_start_date?: string;
  program_type?: string;
}

export interface DashboardStats {
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
}
