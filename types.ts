
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
}

export interface SurveyResponse {
  email: string;
  nps?: number;
  coach_satisfaction?: number;
  feedback_learned?: string;
  feedback_insight?: string;
  feedback_suggestions?: string;
}

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
  
  // Focus areas (Main)
  focus_effective_communication?: boolean;
  focus_persuasion_and_influence?: boolean;
  focus_adaptability_and_resilience?: boolean;
  focus_strategic_thinking?: boolean;
  focus_emotional_intelligence?: boolean;
  focus_building_relationships_at_work?: boolean;
  focus_self_confidence_and_imposter_syndrome?: boolean;
  focus_delegation_and_accountability?: boolean;
  focus_giving_and_receiving_feedback?: boolean;
  focus_effective_planning_and_execution?: boolean;
  focus_change_management?: boolean;
  focus_time_management_and_productivity?: boolean;

  // Focus areas (Sub-topics)
  sub_active_listening?: boolean;
  sub_articulating_ideas_clearly?: boolean;
  sub_conflict_resolution?: boolean;
  sub_giving_effective_feedback?: boolean;
  sub_developing_feedback_skills?: boolean;
  sub_effective_delegation_techniques?: boolean;
  sub_developing_delegation_skills?: boolean;
  sub_handling_difficult_feedback?: boolean;
  sub_building_accountability?: boolean;
  sub_aligning_strategy_with_execution?: boolean;
  sub_communication_in_teams?: boolean;
  sub_monitoring_and_providing_feedback?: boolean;
  sub_handling_challenges_in_delegation?: boolean;
  
  [key: string]: any;
}

export interface ProgramConfig {
  id?: number | string;
  account_name: string;
  sessions_per_employee: number;
  program_name?: string;
}

export interface DashboardStats {
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
}