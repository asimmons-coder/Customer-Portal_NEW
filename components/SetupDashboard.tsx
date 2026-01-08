import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChevronRight, Calendar, Upload, Download, ExternalLink, CheckCircle2, Clock, Users, MessageSquare, FileText, Shield, CreditCard, Rocket } from 'lucide-react';

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
      { id: 'share_allowlist', label: 'Share Allow List with IT department', actionLabel: 'Download', actionType: 'allowlist' },
      { id: 'trusted_senders', label: 'Add boon-health.com to email allowlist (Outlook, Google Workspace, Microsoft 365)', actionLabel: null, actionType: 'checkbox' },
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
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([
    'Visionary Leadership',
    'High-Stakes Decision Making',
    'Building and Leading High-Performing Teams',
    'Influence and Stakeholder Management',
  ]);

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
            .select('program_start_date, program_status, sessions_per_employee, program_type, program_title, context_notes, selected_competencies')
            .eq('company_id', compId);
          
          if (programData && programData.length > 0) {
            // Get earliest launch date from all programs
            const dates = programData
              .map(p => p.program_start_date)
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

            // Load saved competencies
            const compProgram = programData.find(p => p.selected_competencies && p.selected_competencies.length > 0);
            if (compProgram?.selected_competencies) {
              setSelectedCompetencies(compProgram.selected_competencies);
            }
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
                                <TaskActionButton task={task} />
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Development Focus Areas</h2>
                  <p className="text-sm text-gray-500 mt-1">Select 3-5 topics to align with your organizational goals</p>
                </div>
                <div className="text-sm">
                  <span className={`font-medium ${selectedCompetencies.length >= 3 && selectedCompetencies.length <= 5 ? 'text-boon-green' : 'text-amber-500'}`}>
                    {selectedCompetencies.length}/5 selected
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6">
              {programs.some(p => p.type === 'EXEC') && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">EXEC</span>
                    Executive Leadership Topics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {EXEC_COMPETENCIES.map((comp) => {
                      const isSelected = selectedCompetencies.includes(comp);
                      const canSelect = selectedCompetencies.length < 5 || isSelected;
                      return (
                        <button
                          key={comp}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCompetencies(prev => prev.filter(c => c !== comp));
                            } else if (canSelect) {
                              setSelectedCompetencies(prev => [...prev, comp]);
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
                </div>
              )}
              
              {programs.some(p => p.type === 'GROW') && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">GROW</span>
                    Leadership Development Topics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {GROW_COMPETENCIES.map((comp) => {
                      const isSelected = selectedCompetencies.includes(comp);
                      const canSelect = selectedCompetencies.length < 5 || isSelected;
                      return (
                        <button
                          key={comp}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCompetencies(prev => prev.filter(c => c !== comp));
                            } else if (canSelect) {
                              setSelectedCompetencies(prev => [...prev, comp]);
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
                </div>
              )}

              {selectedCompetencies.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Selected Focus Areas</h4>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedCompetencies.map(comp => (
                          <span key={comp} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!companyId) return;
                        setSaving('competencies');
                        try {
                          await supabase
                            .from('program_config')
                            .update({ selected_competencies: selectedCompetencies })
                            .eq('company_id', companyId);
                          // Also mark the task as complete
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
                      disabled={saving === 'competencies' || selectedCompetencies.length < 3}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCompetencies.length >= 3
                          ? 'bg-boon-blue text-white hover:bg-boon-darkBlue'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {saving === 'competencies' ? 'Saving...' : 'Save Selection'}
                    </button>
                  </div>
                </div>
              )}
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
                  {daysUntilLaunch === 0 ? 'Today!' : `${daysUntilLaunch} days from now`}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold mb-1">Not yet scheduled</p>
            )}
            <button className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              {launchDate ? 'Change Date' : 'Schedule Launch'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Your Boon Team</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-boon-blue/10 flex items-center justify-center text-boon-blue font-bold">
                AS
              </div>
              <div>
                <p className="font-semibold text-gray-900">Alex Simmons</p>
                <p className="text-sm text-gray-500">Account Lead</p>
              </div>
            </div>
            <div className="space-y-2">
              <a 
                href="https://calendly.com/asimmons-boon/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2.5 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors text-center"
              >
                Schedule a Call
              </a>
              <a 
                href="mailto:asimmons@boon-health.com"
                className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-center"
              >
                Send a Message
              </a>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Resources</h3>
            <div className="space-y-1">
              <ResourceLink icon={FileText} label="Employee Welcome Email Template" />
              <ResourceLink icon={Users} label="Manager Communication Guide" />
              <ResourceLink icon={Shield} label="IT Security Documentation" />
              <ResourceLink icon={Rocket} label="Program Best Practices" />
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
              <p className="text-sm text-gray-600 leading-relaxed">{contextNotes}</p>
            </div>
          )}
        </div>
      </div>
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

const TaskActionButton: React.FC<{ task: any }> = ({ task }) => {
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
      {task.actionType === 'link' && <ExternalLink size={12} />}
      {task.actionLabel}
    </button>
  );
};

const ResourceLink: React.FC<{ icon: React.FC<any>; label: string }> = ({ icon: Icon, label }) => (
  <a href="#" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-gray-400" />
      <span className="text-sm text-gray-700">{label}</span>
    </div>
    <ExternalLink size={14} className="text-gray-300 group-hover:text-boon-blue transition-colors" />
  </a>
);

export default SetupDashboard;