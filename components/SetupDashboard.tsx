import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChevronRight, Calendar, Upload, Download, ExternalLink, CheckCircle2, Clock, Users, MessageSquare, FileText, Shield, CreditCard, Rocket, X, Copy, Mail, Check } from 'lucide-react';

const TASK_CATEGORIES = [
  {
    id: 'account_setup',
    label: 'Account Setup',
    icon: Users,
    tasks: [
      { id: 'upload_roster', label: 'Upload employee roster', actionLabel: 'Employees', actionType: 'link', actionUrl: '/employees' },
      { id: 'upload_eap', label: 'Share EAP/mental health benefits info (optional)', actionLabel: 'Upload', actionType: 'upload' },
    ]
  },
  {
    id: 'program_config',
    label: 'Program Configuration',
    icon: FileText,
    tasks: [
      { id: 'confirm_competencies', label: 'Confirm competency framework', actionLabel: null, actionType: 'checkbox' },
      { id: 'select_focus_areas', label: 'Select focus areas for program (or let employees choose)', actionLabel: null, actionType: 'checkbox' },
      { id: 'set_goals', label: 'Set program goals & success metrics', actionLabel: null, actionType: 'checkbox' },
      { id: 'company_context', label: 'Provide company context for coaches', actionLabel: null, actionType: 'checkbox' },
    ]
  },
  {
    id: 'security_comms',
    label: 'Security & Comms',
    icon: Shield,
    tasks: [
      { id: 'share_allowlist', label: 'Share Allow List with IT department', actionLabel: 'Setup Guide', actionType: 'allowlist_modal' },
      { id: 'test_emails', label: 'Provide 2 test emails for deliverability check', actionLabel: null, actionType: 'checkbox' },
      { id: 'confirm_comms_channel', label: 'Confirm internal comms channel (Slack, Teams, or Email)', actionLabel: null, actionType: 'checkbox' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: CreditCard,
    tasks: [
      { id: 'invoicing_email', label: 'Provide invoicing email', actionLabel: null, actionType: 'checkbox' },
      { id: 'payment_details', label: 'Share payment details with Finance team', actionLabel: null, actionType: 'checkbox' },
    ]
  },
  {
    id: 'launch_prep',
    label: 'Launch Prep',
    icon: Rocket,
    tasks: [
      { id: 'schedule_launch', label: 'Schedule launch date', actionLabel: null, actionType: 'checkbox' },
      { id: 'review_welcome_email', label: 'Review employee welcome email', actionLabel: null, actionType: 'checkbox' },
      { id: 'send_announcement', label: 'Send company-wide announcement (optional)', actionLabel: null, actionType: 'checkbox' },
    ]
  },
];

const TIMELINE_STEPS = [
  { id: 'kickoff', label: 'Program Kickoff' },
  { id: 'setup', label: 'Account Setup' },
  { id: 'launch', label: 'Launch Coaching' },
  { id: 'checkin', label: 'First Check-in' },
  { id: 'ongoing', label: 'Ongoing Support' },
];

const EXEC_COMPETENCIES = [
  'Visionary Leadership',
  'High-Stakes Decision Making',
  'Driving Organizational Change',
  'Influence and Stakeholder Management',
  'Strategic Agility',
  'Leading Through Uncertainty',
  'Board and Investor Relations',
  'Sustainable Leadership',
  'Inclusive Leadership',
  'Building and Leading High-Performing Teams',
  'Emotional Intelligence',
  'Fostering Innovation and Creativity',
];

const GROW_COMPETENCIES = [
  'Effective Communication',
  'Persuasion and Influence',
  'Adaptability and Resilience',
  'Systems Thinking & Decision Velocity',
  'Time Management and Productivity',
  'Emotional Intelligence',
  'Building Relationships at Work',
  'Self Confidence and Imposter Syndrome',
  'Delegation and Accountability',
  'Giving and Receiving Feedback',
  'Effective Planning and Execution',
  'Leading Through Uncertainty',
];

interface TaskCompletion {
  task_id: string;
  completed: boolean;
  completed_at: string | null;
}

const SetupDashboard: React.FC = () => {
  const [companyId, setCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [taskCompletions, setTaskCompletions] = useState<Record<string, boolean>>({});
  const [expandedCategory, setExpandedCategory] = useState<string>('account_setup');
  const [loading, setLoading] = useState(true);
  const [launchDate, setLaunchDate] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Array<{type: string, sessions: number | null, title: string | null, status: string | null}>>([]);
  const [contextNotes, setContextNotes] = useState<string>('');
  const [execCompetencies, setExecCompetencies] = useState<string[]>([
    'Visionary Leadership',
    'High-Stakes Decision Making',
    'Building and Leading High-Performing Teams',
    'Influence and Stakeholder Management',
  ]);
  const [growCompetencies, setGrowCompetencies] = useState<string[]>([]);
  const [execLetEmployeesChoose, setExecLetEmployeesChoose] = useState(false);
  const [growLetEmployeesChoose, setGrowLetEmployeesChoose] = useState(false);
  const [accountTeam, setAccountTeam] = useState<Array<{
    name: string;
    title: string;
    email: string | null;
    photo_url: string | null;
    calendly_url: string | null;
    is_primary: boolean;
  }>>([]);
  const [showAllowlistModal, setShowAllowlistModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'default' | 'microsoft' | 'google'>('default');
  const [copied, setCopied] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const ADMIN_EMAILS = ['asimmons@boon-health.com', 'alexsimm95@gmail.com', 'hello@boon-health.com'];
        const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
        
        let company = session?.user?.app_metadata?.company || '';
        let compId = session?.user?.app_metadata?.company_id || '';
        
        if (isAdmin) {
          try {
            const stored = localStorage.getItem('boon_admin_company_override');
            if (stored) {
              const override = JSON.parse(stored);
              company = override.name;
              compId = override.id || compId;
            }
          } catch {}
        }
        
        setCompanyName(company);
        setCompanyId(compId);

        if (compId) {
          const { data: completions } = await supabase
            .from('onboarding_tasks')
            .select('task_id, completed, completed_at')
            .eq('company_id', compId);
          
          if (completions) {
            const completionMap: Record<string, boolean> = {};
            completions.forEach((c: TaskCompletion) => {
              completionMap[c.task_id] = c.completed;
            });
            setTaskCompletions(completionMap);
          }

          const { data: programData } = await supabase
            .from('program_config')
            .select('program_start_date, launch_date_override, program_status, sessions_per_employee, program_type, program_title, context_notes, selected_competencies')
            .eq('company_id', compId);
          
          if (programData && programData.length > 0) {
            // Get earliest launch date from all programs (override takes precedence)
            const dates = programData
              .map(p => p.launch_date_override || p.program_start_date)
              .filter(Boolean)
              .sort();
            if (dates.length > 0) {
              setLaunchDate(dates[0]);
            }
            
            // Set all programs
            setPrograms(programData.map(p => ({
              type: p.program_type || '',
              sessions: p.sessions_per_employee || null,
              title: p.program_title || null,
              status: p.program_status || null
            })));
            
            // Get context notes from first program that has them
            const notesProgram = programData.find(p => p.context_notes);
            if (notesProgram?.context_notes) {
              setContextNotes(notesProgram.context_notes);
            }

            // Load saved competencies per program type
            const execProgram = programData.find(p => p.program_type === 'EXEC');
            const growProgram = programData.find(p => p.program_type === 'GROW');
            
            if (execProgram?.selected_competencies && execProgram.selected_competencies.length > 0) {
              if (execProgram.selected_competencies[0] === 'EMPLOYEE_CHOICE') {
                setExecLetEmployeesChoose(true);
                setExecCompetencies([]);
              } else {
                setExecCompetencies(execProgram.selected_competencies);
              }
            }
            
            if (growProgram?.selected_competencies && growProgram.selected_competencies.length > 0) {
              if (growProgram.selected_competencies[0] === 'EMPLOYEE_CHOICE') {
                setGrowLetEmployeesChoose(true);
                setGrowCompetencies([]);
              } else {
                setGrowCompetencies(growProgram.selected_competencies);
              }
            }
          }

          // Fetch account team for this company
          const { data: teamData } = await supabase
            .from('company_account_team')
            .select(`
              is_primary,
              account_team_members (
                name,
                title,
                email,
                photo_url,
                calendly_url
              )
            `)
            .eq('company_id', compId)
            .order('is_primary', { ascending: false });

          if (teamData && teamData.length > 0) {
            setAccountTeam(teamData.map((t: any) => ({
              name: t.account_team_members.name,
              title: t.account_team_members.title,
              email: t.account_team_members.email,
              photo_url: t.account_team_members.photo_url,
              calendly_url: t.account_team_members.calendly_url,
              is_primary: t.is_primary,
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching setup data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleTask = async (taskId: string) => {
    if (!companyId) return;
    
    const newValue = !taskCompletions[taskId];
    setSaving(taskId);
    
    setTaskCompletions(prev => ({ ...prev, [taskId]: newValue }));
    
    try {
      const { error } = await supabase
        .from('onboarding_tasks')
        .upsert({
          company_id: companyId,
          task_id: taskId,
          completed: newValue,
          completed_at: newValue ? new Date().toISOString() : null,
        }, {
          onConflict: 'company_id,task_id'
        });
      
      if (error) {
        console.error('Error saving task:', error);
        setTaskCompletions(prev => ({ ...prev, [taskId]: !newValue }));
      }
    } catch (err) {
      console.error('Error toggling task:', err);
      setTaskCompletions(prev => ({ ...prev, [taskId]: !newValue }));
    } finally {
      setSaving(null);
    }
  };

  const totalTasks = TASK_CATEGORIES.flatMap(c => c.tasks).length;
  const completedTasks = Object.values(taskCompletions).filter(Boolean).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getCurrentStep = () => {
    if (progressPct === 0) return 0;
    if (progressPct < 50) return 1;
    if (progressPct < 100) return 2;
    return 3;
  };
  const currentStep = getCurrentStep();

  const daysUntilLaunch = launchDate 
    ? Math.max(0, Math.ceil((new Date(launchDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded-2xl"></div>
        <div className="h-64 bg-gray-200 rounded-2xl"></div>
      </div>
    );
  }

  const getStepClasses = (index: number) => {
    if (index < currentStep) return 'bg-boon-green text-white';
    if (index === currentStep) return 'bg-boon-blue text-white';
    return 'bg-gray-200 text-gray-500';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Boon! 🎉</h1>
        <p className="text-gray-600">Let's get your coaching program ready to launch. Complete the tasks below and we'll be ready to go.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Launch Timeline</h2>
              <span className="text-sm font-medium text-boon-blue bg-boon-blue/10 px-3 py-1 rounded-full">
                {progressPct}% complete
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              {TIMELINE_STEPS.map((step, i) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${getStepClasses(i)}`}>
                      {i < currentStep ? <CheckCircle2 size={20} /> : i + 1}
                    </div>
                    <span className={`text-xs mt-2 font-medium text-center max-w-[80px] ${i === currentStep ? 'text-boon-blue' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div className={`w-12 lg:w-16 h-1 mx-1 lg:mx-2 rounded transition-colors ${i < currentStep ? 'bg-boon-green' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Setup Checklist</h2>
              <p className="text-sm text-gray-500 mt-1">{completedTasks} of {totalTasks} tasks complete</p>
            </div>
            
            <div className="divide-y divide-gray-100">
              {TASK_CATEGORIES.map((category) => {
                const categoryTasks = category.tasks;
                const categoryComplete = categoryTasks.filter(t => taskCompletions[t.id]).length;
                const isExpanded = expandedCategory === category.id;
                const Icon = category.icon;
                
                return (
                  <div key={category.id}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? '' : category.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight size={18} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        <Icon size={18} className="text-gray-400" />
                        <span className="font-semibold text-gray-900">{category.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{categoryComplete}/{categoryTasks.length}</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-boon-green rounded-full transition-all duration-300"
                            style={{ width: `${(categoryComplete / categoryTasks.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-6 pb-4 space-y-2">
                        {categoryTasks.map((task) => {
                          const isComplete = taskCompletions[task.id];
                          const isSaving = saving === task.id;
                          
                          return (
                            <div 
                              key={task.id}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleTask(task.id)}
                                  disabled={isSaving}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isComplete ? 'bg-boon-green border-boon-green text-white' : 'border-gray-300 hover:border-boon-blue'} ${isSaving ? 'opacity-50' : ''}`}
                                >
                                  {isComplete && <CheckCircle2 size={14} />}
                                </button>
                                <span className={`text-sm ${isComplete ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                                  {task.label}
                                </span>
                              </div>
                              {task.actionLabel && !isComplete && (
                                <TaskActionButton task={task} onAllowlistClick={() => setShowAllowlistModal(true)} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Development Focus Areas */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Development Focus Areas</h2>
              <p className="text-sm text-gray-500 mt-1">Select 3-5 topics per program, or let employees choose their own</p>
            </div>
            <div className="p-6 space-y-8">
              {programs.some(p => p.type === 'EXEC') && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">EXEC</span>
                      Executive Leadership Topics
                    </h3>
                    <div className="flex items-center gap-3">
                      {!execLetEmployeesChoose && (
                        <span className={`text-xs font-medium ${execCompetencies.length >= 3 && execCompetencies.length <= 5 ? 'text-boon-green' : 'text-amber-500'}`}>
                          {execCompetencies.length}/5 selected
                        </span>
                      )}
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={execLetEmployeesChoose}
                          onChange={(e) => {
                            setExecLetEmployeesChoose(e.target.checked);
                            if (e.target.checked) setExecCompetencies([]);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-boon-blue focus:ring-boon-blue"
                        />
                        Let employees choose
                      </label>
                    </div>
                  </div>
                  {!execLetEmployeesChoose ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {EXEC_COMPETENCIES.map((comp) => {
                        const isSelected = execCompetencies.includes(comp);
                        const canSelect = execCompetencies.length < 5 || isSelected;
                        return (
                          <button
                            key={comp}
                            onClick={() => {
                              if (isSelected) {
                                setExecCompetencies(prev => prev.filter(c => c !== comp));
                              } else if (canSelect) {
                                setExecCompetencies(prev => [...prev, comp]);
                              }
                            }}
                            disabled={!canSelect && !isSelected}
                            className={`p-3 rounded-xl text-sm font-medium text-left transition-all ${
                              isSelected 
                                ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md' 
                                : canSelect
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {comp}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
                      <p>Employees will select their own focus areas during onboarding. All 12 executive topics will be available for them to choose from.</p>
                    </div>
                  )}
                </div>
              )}
              
              {programs.some(p => p.type === 'GROW') && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">GROW</span>
                      Leadership Development Topics
                    </h3>
                    <div className="flex items-center gap-3">
                      {!growLetEmployeesChoose && (
                        <span className={`text-xs font-medium ${growCompetencies.length >= 3 && growCompetencies.length <= 5 ? 'text-boon-green' : 'text-amber-500'}`}>
                          {growCompetencies.length}/5 selected
                        </span>
                      )}
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={growLetEmployeesChoose}
                          onChange={(e) => {
                            setGrowLetEmployeesChoose(e.target.checked);
                            if (e.target.checked) setGrowCompetencies([]);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-boon-blue focus:ring-boon-blue"
                        />
                        Let employees choose
                      </label>
                    </div>
                  </div>
                  {!growLetEmployeesChoose ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {GROW_COMPETENCIES.map((comp) => {
                        const isSelected = growCompetencies.includes(comp);
                        const canSelect = growCompetencies.length < 5 || isSelected;
                        return (
                          <button
                            key={comp}
                            onClick={() => {
                              if (isSelected) {
                                setGrowCompetencies(prev => prev.filter(c => c !== comp));
                              } else if (canSelect) {
                                setGrowCompetencies(prev => [...prev, comp]);
                              }
                            }}
                            disabled={!canSelect && !isSelected}
                            className={`p-3 rounded-xl text-sm font-medium text-left transition-all ${
                              isSelected 
                                ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md' 
                                : canSelect
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {comp}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700">
                      <p>Employees will select their own focus areas during onboarding. All 12 leadership topics will be available for them to choose from.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={async () => {
                    if (!companyId) return;
                    setSaving('competencies');
                    try {
                      // Save EXEC competencies
                      const execProgram = programs.find(p => p.type === 'EXEC');
                      if (execProgram) {
                        const execValue = execLetEmployeesChoose ? ['EMPLOYEE_CHOICE'] : execCompetencies;
                        await supabase
                          .from('program_config')
                          .update({ selected_competencies: execValue })
                          .eq('company_id', companyId)
                          .eq('program_type', 'EXEC');
                      }
                      
                      // Save GROW competencies
                      const growProgram = programs.find(p => p.type === 'GROW');
                      if (growProgram) {
                        const growValue = growLetEmployeesChoose ? ['EMPLOYEE_CHOICE'] : growCompetencies;
                        await supabase
                          .from('program_config')
                          .update({ selected_competencies: growValue })
                          .eq('company_id', companyId)
                          .eq('program_type', 'GROW');
                      }
                      
                      // Mark task as complete
                      await supabase
                        .from('onboarding_tasks')
                        .upsert({
                          company_id: companyId,
                          task_id: 'confirm_competencies',
                          completed: true,
                          completed_at: new Date().toISOString(),
                        }, { onConflict: 'company_id,task_id' });
                      setTaskCompletions(prev => ({ ...prev, confirm_competencies: true }));
                    } catch (err) {
                      console.error('Failed to save competencies:', err);
                    }
                    setSaving(null);
                  }}
                  disabled={saving === 'competencies' || (
                    !execLetEmployeesChoose && programs.some(p => p.type === 'EXEC') && (execCompetencies.length < 3 || execCompetencies.length > 5)
                  ) || (
                    !growLetEmployeesChoose && programs.some(p => p.type === 'GROW') && (growCompetencies.length < 3 || growCompetencies.length > 5)
                  )}
                  className="px-6 py-2.5 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {saving === 'competencies' ? 'Saving...' : 'Save Focus Areas'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          
          <div className="bg-gradient-to-br from-boon-blue to-boon-darkBlue rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-blue-200" />
              <span className="font-medium text-blue-100">Target Launch</span>
            </div>
            {launchDate ? (
              <>
                <p className="text-2xl font-bold mb-1">
                  {new Date(launchDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-blue-200 text-sm">
                  {daysUntilLaunch === 0 ? 'Today!' : daysUntilLaunch > 0 ? `${daysUntilLaunch} days from now` : `${Math.abs(daysUntilLaunch)} days ago`}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold mb-1">Not yet scheduled</p>
            )}
            <button 
              onClick={() => {
                setTempDate(launchDate || '');
                setShowDateModal(true);
              }}
              className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              {launchDate ? 'Change Date' : 'Schedule Launch'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Your Boon Team</h3>
            
            {accountTeam.length > 0 ? (
              <>
                <div className="space-y-4 mb-4">
                  {accountTeam.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {member.photo_url ? (
                        <img 
                          src={member.photo_url} 
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-boon-blue/10 flex items-center justify-center text-boon-blue font-bold">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2">
                  {accountTeam.find(m => m.calendly_url) && (
                    <a 
                      href={accountTeam.find(m => m.calendly_url)?.calendly_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-2.5 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors text-center"
                    >
                      Schedule a Call
                    </a>
                  )}
                  {accountTeam.some(m => m.email) && (
                    <a 
                      href={`mailto:${accountTeam.filter(m => m.email).map(m => m.email).join(',')}`}
                      className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-center"
                    >
                      Send a Message
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">No team assigned yet.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Resources</h3>
            <div className="space-y-1">
              {/* Show welcome email template based on program type */}
              {programs.some(p => p.type === 'EXEC') && (
                <ResourceLink 
                  icon={FileText} 
                  label="Welcome Email Template (EXEC)" 
                  href="https://storage.googleapis.com/boon-public-assets/Welcome_Email_Template_EXEC.pdf"
                />
              )}
              {programs.some(p => p.type === 'GROW') && (
                <ResourceLink 
                  icon={FileText} 
                  label="Welcome Email Template (GROW)" 
                  href="https://storage.googleapis.com/boon-public-assets/Welcome_Email_Template_GROW.pdf"
                />
              )}
              {programs.some(p => p.type === 'SCALE') && (
                <ResourceLink 
                  icon={FileText} 
                  label="Welcome Email Template (SCALE)" 
                  href="https://storage.googleapis.com/boon-public-assets/Welcome_Email_Template_SCALE.pdf"
                />
              )}
              <ResourceLink 
                icon={Users} 
                label="Manager Communication Guide" 
                href="https://storage.googleapis.com/boon-public-assets/Manager_Communication_Guide.pdf"
              />
              <ResourceLink 
                icon={Rocket} 
                label="Program Best Practices" 
                href="https://storage.googleapis.com/boon-public-assets/Program_Best_Practices%20(1).pdf"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">Program Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Company</span>
                <span className="font-medium text-gray-900">{companyName.split(' - ')[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Program Type</span>
                <span className="font-medium text-gray-900">
                  {programs.length > 0 
                    ? [...new Set(programs.map(p => p.type))].join(', ') 
                    : 'Not configured'}
                </span>
              </div>
              {programs.length > 0 && programs[0].sessions && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sessions/Person</span>
                  <span className="font-medium text-gray-900">{programs[0].sessions}</span>
                </div>
              )}
              {programs.length > 1 && (
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <span className="text-gray-500 text-xs">Programs:</span>
                  <div className="mt-1 space-y-1">
                    {programs.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-600">{p.title || p.type}</span>
                        <span className={`px-2 py-0.5 rounded-full ${
                          p.status === 'Onboarding' ? 'bg-blue-100 text-blue-700' :
                          p.status === 'In Progress' ? 'bg-green-100 text-green-700' :
                          p.status === 'Planned' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {p.status || 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {contextNotes && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-3">Coach Context</h3>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-2">
                {contextNotes.split('. ').filter(s => s.trim()).map((sentence, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-boon-blue mt-1">•</span>
                    <span>{sentence.trim().replace(/\.$/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Safe Sender Setup Modal */}
      {showAllowlistModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Safe Sender Setup Guide</h2>
                <p className="text-sm text-gray-500 mt-1">Send this to your IT contact to ensure Boon emails land correctly</p>
              </div>
              <button 
                onClick={() => setShowAllowlistModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Provider Selection */}
            <div className="p-6 border-b border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select email provider</label>
              <div className="flex gap-2">
                {[
                  { id: 'default', label: 'Unknown / Other' },
                  { id: 'microsoft', label: 'Microsoft 365 / Outlook' },
                  { id: 'google', label: 'Google Workspace' },
                ].map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setSelectedProvider(provider.id as any);
                      setCopied(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedProvider === provider.id
                        ? 'bg-boon-blue text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Template */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900 font-medium">
                    {SAFE_SENDER_EMAILS[selectedProvider].subject}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email Body</label>
                  <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {SAFE_SENDER_EMAILS[selectedProvider].body}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  const blob = new Blob([ALLOWLIST_CONTENT], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'Boon_Email_Allowlist.txt';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Download Allowlist
              </button>
              <button
                onClick={() => {
                  const template = SAFE_SENDER_EMAILS[selectedProvider];
                  const fullText = `Subject: ${template.subject}\n\n${template.body}`;
                  navigator.clipboard.writeText(fullText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-6 py-2.5 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors flex items-center gap-2"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Email Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Launch Date Modal */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Set Launch Date</h2>
                <p className="text-sm text-gray-500 mt-1">When should the program begin?</p>
              </div>
              <button 
                onClick={() => setShowDateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Date Input */}
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Launch Date</label>
              <input
                type="date"
                value={tempDate}
                onChange={(e) => setTempDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-boon-blue focus:border-boon-blue"
              />
              {tempDate && (
                <p className="mt-2 text-sm text-gray-500">
                  {new Date(tempDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDateModal(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!companyId || !tempDate) return;
                  setSaving('launchDate');
                  try {
                    // Update launch_date_override for all programs for this company
                    // This field takes precedence and syncs back to Salesforce via Zapier
                    await supabase
                      .from('program_config')
                      .update({ launch_date_override: tempDate })
                      .eq('company_id', companyId);
                    
                    setLaunchDate(tempDate);
                    setShowDateModal(false);
                    
                    // Mark the schedule launch task as complete
                    await supabase
                      .from('onboarding_tasks')
                      .upsert({
                        company_id: companyId,
                        task_id: 'schedule_launch',
                        completed: true,
                        completed_at: new Date().toISOString(),
                      }, { onConflict: 'company_id,task_id' });
                    setTaskCompletions(prev => ({ ...prev, schedule_launch: true }));
                  } catch (err) {
                    console.error('Failed to update launch date:', err);
                  }
                  setSaving(null);
                }}
                disabled={!tempDate || saving === 'launchDate'}
                className="px-6 py-2.5 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors disabled:bg-gray-200 disabled:text-gray-400"
              >
                {saving === 'launchDate' ? 'Saving...' : 'Save Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ALLOWLIST_CONTENT = `BOON EMAIL ALLOWLIST

Please add the following domain, emails, and IP addresses to your safe sender list:

DOMAINS
• boon-health.com
• news.boon-health.com

NOTE: If your company uses Outlook, please add the boon-health.com domain to your user's Outlook trusted senders list

IP ADDRESSES
• 54.174.60.0/23
• 143.244.80.0/20
• 158.247.16.0/20
• 54.174.59.0/24
• 54.174.63.0/24
• 3.93.157.0/24
• 54.174.52.0/24
• 139.180.17.0/24
• 54.174.57.0/24
• 158.247.26.128
• 18.208.124.128/25
• 54.174.53.128/30
• 74.125.195.26
• 149.72.90.69
• 149.72.227.216
• 149.72.242.200
• 168.245.51.104
• 198.37.159.6
• 149.72.52.197

IP ADDRESSES ADDED IN 2025
• 141.193.184.64/26
• 141.193.185.128/25
• 18.208.124.128/25
• 141.193.184.128/25
• 141.193.185.64/26
• 216.139.64.0/19
• 108.179.144.0/20
• 3.210.190.0/24
• 141.193.184.32/27
• 141.193.185.32/27
• 3.210.190.215

EMAIL SUBJECT LINES TO ALLOW
• You've been given access to Boon Coaching
• Welcome to Boon! Get started on your personal and professional growth
• Free coaching that really works
• [Name] - We have personalized Boon coaching options ready for you.
• [Name] - Book your first Boon coaching session today!
• [Name] - Your Coaching Session with Jamie is Confirmed!
• [Name] - Your Coaching Session with Boon has been rescheduled!
• Boon Coaching Session Reminder
• Coaching Session Cancellation
`;

const SAFE_SENDER_EMAILS = {
  default: {
    subject: 'Quick IT setup to ensure Boon emails land correctly',
    body: `Hi [Name],

Quick operational ask to make sure Boon program emails and surveys land cleanly for your team.

Could you please forward the attached Boon allow-list one-pager to your IT team and ask them to confirm the following?

1. Boon is allow-listed at the tenant or org level (not just individual inboxes), so emails reach all participants consistently.
2. Boon domains are excluded from link rewriting or scanning that could interfere with survey links.
3. Allow-listed Boon emails bypass quarantine, or IT is notified if anything is flagged.

Once that's in place, we should be set for the remainder of the program.

Happy to connect Boon directly with IT if helpful. Thanks so much.

Best,
[AM Name]`
  },
  microsoft: {
    subject: 'Quick Outlook setup to ensure Boon emails land correctly',
    body: `Hi [Name],

Quick operational ask to make sure Boon program emails and surveys land cleanly for your team, especially in Outlook.

Could you please forward the attached Boon allow-list one-pager to your IT team and ask them to confirm the following?

1. Boon is allow-listed at the Exchange / Defender tenant level, not just individual inboxes.
2. Boon domains are excluded from Outlook Safe Links rewriting, which can occasionally interfere with survey links.
3. Allow-listed Boon emails bypass quarantine, or IT is notified if anything is flagged.

Once that's in place, we should be set for the remainder of the program.

Happy to connect Boon directly with IT if helpful. Thanks so much.

Best,
[AM Name]`
  },
  google: {
    subject: 'Quick email setup to ensure Boon emails land correctly',
    body: `Hi [Name],

Quick operational ask to make sure Boon program emails and surveys land cleanly for your team.

Could you please forward the attached Boon allow-list one-pager to your IT team and ask them to confirm the following?

1. Boon domains are approved / allow-listed at the workspace level, not just per user.
2. Emails from Boon bypass spam and quarantine filtering where possible.
3. IT is notified if any Boon emails are flagged unexpectedly.

Once that's in place, we should be set for the remainder of the program.

Thanks so much,
[AM Name]`
  }
};

const TaskActionButton: React.FC<{ task: any; onAllowlistClick?: () => void }> = ({ task, onAllowlistClick }) => {
  const handleClick = () => {
    if (task.actionType === 'link' && task.actionUrl) {
      window.location.href = task.actionUrl;
    } else if (task.actionType === 'allowlist') {
      // Download allowlist as text file
      const blob = new Blob([ALLOWLIST_CONTENT], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Boon_Email_Allowlist.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (task.actionType === 'allowlist_modal' && onAllowlistClick) {
      onAllowlistClick();
    } else if (task.actionType === 'download' && task.downloadUrl) {
      window.open(task.downloadUrl, '_blank');
    } else {
      console.log('Action clicked:', task.id);
    }
  };

  return (
    <button 
      onClick={handleClick}
      className="px-3 py-1.5 text-xs font-medium text-boon-blue bg-boon-blue/10 rounded-lg hover:bg-boon-blue/20 transition-colors flex items-center gap-1"
    >
      {(task.actionType === 'download' || task.actionType === 'allowlist') && <Download size={12} />}
      {task.actionType === 'allowlist_modal' && <Mail size={12} />}
      {task.actionType === 'link' && <ExternalLink size={12} />}
      {task.actionLabel}
    </button>
  );
};

const ResourceLink: React.FC<{ icon: React.FC<any>; label: string; href?: string }> = ({ icon: Icon, label, href = '#' }) => (
  <a 
    href={href} 
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
  >
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400" />
      <span className="text-sm text-gray-700">{label}</span>
    </div>
    <ExternalLink size={14} className="text-gray-300 group-hover:text-boon-blue transition-colors" />
  </a>
);

export default SetupDashboard;