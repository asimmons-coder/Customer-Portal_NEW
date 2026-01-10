import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  MessageSquare, 
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Phone
} from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  company_email: string;
  job_title: string | null;
  department: string | null;
  program: string | null;
  status: string | null;
  start_date: string | null;
}

interface SessionData {
  employee_id: string;
  employee_name: string;
  session_date: string;
  status: string;
}

interface ManagerSurvey {
  id: string;
  employee_id: string;
  survey_type: 'pre' | 'post';
  submitted_at: string;
}

const ManagerDashboard: React.FC = () => {
  const [managerEmail, setManagerEmail] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [surveys, setSurveys] = useState<ManagerSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState<'pre' | 'post' | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        setManagerEmail(email);
        
        // Get manager's name from employee_manager if they exist there
        const { data: managerData } = await supabase
          .from('employee_manager')
          .select('first_name, last_name')
          .eq('company_email', email)
          .single();
        
        if (managerData) {
          setManagerName(`${managerData.first_name} ${managerData.last_name}`);
        }

        // Get all employees where this user is the manager
        const { data: employeeData, error: empError } = await supabase
          .from('employee_manager')
          .select('*')
          .eq('manager_email', email)
          .order('last_name', { ascending: true });

        if (empError) {
          console.error('Error fetching employees:', empError);
        } else {
          setEmployees(employeeData || []);
        }

        // Get session data for these employees
        if (employeeData && employeeData.length > 0) {
          const employeeEmails = employeeData.map(e => e.company_email);
          const employeeNames = employeeData.map(e => `${e.first_name} ${e.last_name}`);
          
          const { data: sessionData } = await supabase
            .from('session_tracking')
            .select('employee_id, employee_name, session_date, status')
            .or(`employee_name.in.(${employeeNames.map(n => `"${n}"`).join(',')})`);
          
          if (sessionData) {
            setSessions(sessionData);
          }
        }

        // Get manager surveys submitted by this manager
        const { data: surveyData } = await supabase
          .from('manager_surveys')
          .select('*')
          .eq('manager_email', email);
        
        if (surveyData) {
          setSurveys(surveyData);
        }

      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getEmployeeSessions = (employeeName: string) => {
    return sessions.filter(s => 
      s.employee_name?.toLowerCase() === employeeName.toLowerCase()
    );
  };

  const getCompletedSessionCount = (employeeName: string) => {
    return getEmployeeSessions(employeeName).filter(s => 
      s.status?.toLowerCase() === 'completed'
    ).length;
  };

  const hasSubmittedSurvey = (employeeId: string, type: 'pre' | 'post') => {
    return surveys.some(s => s.employee_id === employeeId && s.survey_type === type);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'onboarding':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-gray-100 text-gray-700';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <CheckCircle2 size={14} className="text-green-600" />;
      case 'onboarding':
        return <Clock size={14} className="text-blue-600" />;
      case 'paused':
        return <AlertCircle size={14} className="text-yellow-600" />;
      default:
        return <Clock size={14} className="text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-boon-blue"></div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Direct Reports Found</h2>
          <p className="text-gray-500">You don't have any employees assigned to you yet.</p>
        </div>
      </div>
    );
  }

  const activeEmployees = employees.filter(e => e.status?.toLowerCase() === 'active');
  const totalSessions = employees.reduce((acc, e) => 
    acc + getCompletedSessionCount(`${e.first_name} ${e.last_name}`), 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Manager Dashboard</p>
              <h1 className="text-2xl font-bold text-gray-900">
                {managerName ? `Welcome, ${managerName.split(' ')[0]}` : 'Your Team\'s Coaching'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://meetings.hubspot.com/canderson36/boon-scheduling-caitlin-alex-s"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                <Phone size={16} />
                Contact Boon
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Team Members</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active in Coaching</p>
                <p className="text-2xl font-bold text-gray-900">{activeEmployees.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Your Direct Reports</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {employees.map((employee) => {
              const fullName = `${employee.first_name} ${employee.last_name}`;
              const sessionCount = getCompletedSessionCount(fullName);
              const hasPreSurvey = hasSubmittedSurvey(employee.id, 'pre');
              const hasPostSurvey = hasSubmittedSurvey(employee.id, 'post');
              
              return (
                <div
                  key={employee.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedEmployee(employee)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-boon-blue to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {employee.first_name?.[0]}{employee.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{fullName}</p>
                        <p className="text-sm text-gray-500">
                          {employee.job_title || employee.program || 'No title'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{sessionCount} sessions</p>
                        <p className="text-xs text-gray-500">completed</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${getStatusColor(employee.status)}`}>
                        {getStatusIcon(employee.status)}
                        {employee.status || 'Pending'}
                      </div>
                      <ChevronRight size={20} className="text-gray-300" />
                    </div>
                  </div>
                  
                  {/* Survey Status */}
                  <div className="mt-3 flex items-center gap-4 ml-14">
                    <div className={`flex items-center gap-1.5 text-xs ${hasPreSurvey ? 'text-green-600' : 'text-gray-400'}`}>
                      {hasPreSurvey ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      Pre-coaching survey {hasPreSurvey ? 'completed' : 'pending'}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs ${hasPostSurvey ? 'text-green-600' : 'text-gray-400'}`}>
                      {hasPostSurvey ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      Post-coaching survey {hasPostSurvey ? 'completed' : 'pending'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">What you can see</h3>
              <p className="text-sm text-blue-700">
                You can view enrollment status, session progress, and focus areas for your direct reports. 
                Session content and private conversations remain confidential between the employee and their coach.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          sessions={getEmployeeSessions(`${selectedEmployee.first_name} ${selectedEmployee.last_name}`)}
          hasPreSurvey={hasSubmittedSurvey(selectedEmployee.id, 'pre')}
          hasPostSurvey={hasSubmittedSurvey(selectedEmployee.id, 'post')}
          onClose={() => setSelectedEmployee(null)}
          onOpenSurvey={(type) => {
            setShowSurveyModal(type);
          }}
          managerEmail={managerEmail}
        />
      )}

      {/* Survey Modal */}
      {showSurveyModal && selectedEmployee && (
        <ManagerSurveyModal
          type={showSurveyModal}
          employee={selectedEmployee}
          managerEmail={managerEmail}
          onClose={() => setShowSurveyModal(null)}
          onSubmit={() => {
            // Refresh surveys
            setShowSurveyModal(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

// Employee Detail Modal Component
interface EmployeeDetailModalProps {
  employee: Employee;
  sessions: SessionData[];
  hasPreSurvey: boolean;
  hasPostSurvey: boolean;
  onClose: () => void;
  onOpenSurvey: (type: 'pre' | 'post') => void;
  managerEmail: string;
}

const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  sessions,
  hasPreSurvey,
  hasPostSurvey,
  onClose,
  onOpenSurvey,
  managerEmail
}) => {
  const fullName = `${employee.first_name} ${employee.last_name}`;
  const completedSessions = sessions.filter(s => s.status?.toLowerCase() === 'completed');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-boon-blue to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {employee.first_name?.[0]}{employee.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                <p className="text-gray-500">{employee.job_title || employee.program || 'Team Member'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{completedSessions.length}</p>
              <p className="text-sm text-gray-500">Sessions Completed</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{employee.status || 'Pending'}</p>
              <p className="text-sm text-gray-500">Status</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{employee.program || '—'}</p>
              <p className="text-sm text-gray-500">Program</p>
            </div>
          </div>

          {/* Focus Areas */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Focus Areas</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">Leadership Presence</span>
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">Team Communication</span>
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">Strategic Thinking</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Based on welcome survey responses</p>
          </div>

          {/* Manager Surveys */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Your Feedback</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText size={20} className={hasPreSurvey ? 'text-green-600' : 'text-gray-400'} />
                  <div>
                    <p className="font-medium text-gray-900">Pre-Coaching Survey</p>
                    <p className="text-sm text-gray-500">Share initial observations about this employee</p>
                  </div>
                </div>
                {hasPreSurvey ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Completed</span>
                ) : (
                  <button
                    onClick={() => onOpenSurvey('pre')}
                    className="px-4 py-2 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors"
                  >
                    Complete Survey
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText size={20} className={hasPostSurvey ? 'text-green-600' : 'text-gray-400'} />
                  <div>
                    <p className="font-medium text-gray-900">Post-Coaching Survey</p>
                    <p className="text-sm text-gray-500">Share observed changes after coaching</p>
                  </div>
                </div>
                {hasPostSurvey ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Completed</span>
                ) : (
                  <button
                    onClick={() => onOpenSurvey('post')}
                    className="px-4 py-2 bg-boon-blue text-white rounded-lg text-sm font-medium hover:bg-boon-darkBlue transition-colors"
                  >
                    Complete Survey
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Recent Sessions</h3>
            {completedSessions.length > 0 ? (
              <div className="space-y-2">
                {completedSessions.slice(0, 5).map((session, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-600" />
                      <span className="text-sm text-gray-700">Session {idx + 1}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(session.session_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No sessions completed yet</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <a
            href={`mailto:hello@boon-health.com?subject=Coach Alignment Request for ${fullName}&body=Hi Boon team,%0D%0A%0D%0AI'd like to request a coach alignment call to discuss ${employee.first_name}'s coaching progress.%0D%0A%0D%0AManager: ${managerEmail}%0D%0AEmployee: ${fullName}%0D%0A%0D%0APlease let me know available times.%0D%0A%0D%0AThank you`}
            className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Phone size={16} />
            Request Coach Alignment Call
          </a>
        </div>
      </div>
    </div>
  );
};

// Manager Survey Modal Component
interface ManagerSurveyModalProps {
  type: 'pre' | 'post';
  employee: Employee;
  managerEmail: string;
  onClose: () => void;
  onSubmit: () => void;
}

const ManagerSurveyModal: React.FC<ManagerSurveyModalProps> = ({
  type,
  employee,
  managerEmail,
  onClose,
  onSubmit
}) => {
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);

  const preQuestions = [
    { id: 'strengths', label: 'What are this employee\'s key strengths?', type: 'textarea' },
    { id: 'development_areas', label: 'What development areas would you like to see them focus on?', type: 'textarea' },
    { id: 'leadership_rating', label: 'How would you rate their current leadership effectiveness? (1-5)', type: 'rating' },
    { id: 'communication_rating', label: 'How would you rate their communication skills? (1-5)', type: 'rating' },
    { id: 'goals', label: 'What specific goals do you have for this employee\'s coaching?', type: 'textarea' },
  ];

  const postQuestions = [
    { id: 'observed_changes', label: 'What changes have you observed since coaching began?', type: 'textarea' },
    { id: 'leadership_rating', label: 'How would you now rate their leadership effectiveness? (1-5)', type: 'rating' },
    { id: 'communication_rating', label: 'How would you now rate their communication skills? (1-5)', type: 'rating' },
    { id: 'goals_progress', label: 'How much progress have they made on their coaching goals?', type: 'textarea' },
    { id: 'recommend', label: 'Would you recommend coaching for other team members?', type: 'select', options: ['Yes', 'No', 'Maybe'] },
    { id: 'additional_feedback', label: 'Any additional feedback or observations?', type: 'textarea' },
  ];

  const questions = type === 'pre' ? preQuestions : postQuestions;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('manager_surveys')
        .insert({
          employee_id: employee.id,
          manager_email: managerEmail,
          survey_type: type,
          responses: responses,
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;
      onSubmit();
    } catch (err) {
      console.error('Error submitting survey:', err);
      alert('Failed to submit survey. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = `${employee.first_name} ${employee.last_name}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {type === 'pre' ? 'Pre-Coaching Survey' : 'Post-Coaching Survey'}
          </h2>
          <p className="text-gray-500 mt-1">for {fullName}</p>
        </div>

        {/* Questions */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {q.label}
              </label>
              {q.type === 'textarea' && (
                <textarea
                  value={responses[q.id] as string || ''}
                  onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-boon-blue focus:border-boon-blue resize-none"
                  placeholder="Your response..."
                />
              )}
              {q.type === 'rating' && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => setResponses({ ...responses, [q.id]: num })}
                      className={`w-12 h-12 rounded-lg font-semibold transition-colors ${
                        responses[q.id] === num
                          ? 'bg-boon-blue text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
              {q.type === 'select' && (
                <div className="flex gap-2">
                  {q.options?.map((option) => (
                    <button
                      key={option}
                      onClick={() => setResponses({ ...responses, [q.id]: option })}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        responses[q.id] === option
                          ? 'bg-boon-blue text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 bg-boon-blue text-white rounded-lg font-medium hover:bg-boon-darkBlue transition-colors disabled:bg-gray-300"
          >
            {submitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;