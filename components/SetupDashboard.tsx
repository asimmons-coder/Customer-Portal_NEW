import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  ChevronRight, 
  Calendar, 
  Upload, 
  Download, 
  ExternalLink,
  CheckCircle2,
  Clock,
  Users,
  MessageSquare,
  FileText,
  Shield,
  CreditCard,
  Rocket,
  Loader2
} from 'lucide-react';

// Task definitions
const TASK_CATEGORIES = [
  {
    id: 'account_setup',
    label: 'Account Setup',
    icon: Users,
    tasks: [
      { id: 'upload_roster', label: 'Upload employee roster', actionLabel: 'Upload CSV', actionType: 'link', actionUrl: '/employees' },
      { id: 'upload_eap', label: 'Share EAP/mental health benefits info (optional)', actionLabel: 'Upload', actionType: 'upload' },
    ]
  },
  {
    id: 'program_config',
    label: 'Program Configuration',
    icon: FileText,
    tasks: [
      { id: 'confirm_competencies', label: 'Confirm competency framework', actionLabel: 'View', actionType: 'modal' },
      { id: 'select_focus_areas', label: 'Select focus areas for program (or let employees choose)', actionLabel: 'Configure', actionType: 'modal' },
      { id: 'set_goals', label: 'Set program goals & success metrics', actionLabel: 'Set Goals', actionType: 'modal' },
      { id: 'company_context', label: 'Provide company context for coaches', actionLabel: 'Add Context', actionType: 'modal' },
    ]
  },
  {
    id: 'security_comms',
    label: 'Security & Comms',
    icon: Shield,
    tasks: [
      { id: 'share_allowlist', label: 'Share Allow List with IT department', actionLabel: 'Download', actionType: 'download', downloadUrl: '/files/boon-allow-list.pdf' },
      { id: 'trusted_senders', label: 'Add boon-health.com to trusted senders', actionLabel: null, actionType: 'checkbox' },
      { id: 'test_emails', label: 'Provide 2 test emails for deliverability check', actionLabel: 'Add Emails', actionType: 'modal' },
      { id: 'confirm_comms_channel', label: 'Confirm internal comms channel (Slack/Teams/Email)', actionLabel: null, actionType: 'checkbox' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: CreditCard,
    tasks: [
      { id: 'invoicing_email', label: 'Provide invoicing email', actionLabel: 'Add Email', actionType: 'modal' },
      { id: 'payment_details', label: 'Share payment details with Finance', actionLabel: 'Download', actionType: 'download', downloadUrl: '/files/boon-payment-details.pdf' },
    ]
  },
  {
    id: 'launch_prep',
    label: 'Launch Prep',
    icon: Rocket,
    tasks: [
      { id: 'schedule_launch', label: 'Schedule launch date', actionLabel: 'Pick Date', actionType: 'date' },
      { id: 'review_welcome_email', label: 'Review employee welcome email', actionLabel: 'Preview', actionType: 'modal' },
      { id: 'send_announcement', label: 'Send company-wide announcement (optional)', actionLabel: 'View Template', actionType: 'modal' },
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
            .select('program_start_date')
            .eq('company_id', compId)
            .maybeSingle();
          
          if (programData?.program_start_date) {
            setLaunchDate(programData.program_start_date);
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
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition