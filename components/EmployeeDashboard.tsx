import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, 
  Search, 
  Plus,
  Edit2,
  UserX,
  Upload,
  Download,
  X,
  Check,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Trash2
} from 'lucide-react';

interface Employee {
  id: string | number;
  first_name: string;
  last_name: string;
  company_email: string;
  company_name: string;
  program: string;
  program_title?: string;
  salesforce_program_id?: string;
  department: string;
  job_title: string;
  company_role: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

type ModalMode = 'add' | 'edit' | 'terminate' | 'delete' | null;

const EmployeeDashboard: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('All');
  const [sortField, setSortField] = useState<keyof Employee>('last_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [showBatchUpload, setShowBatchUpload] = useState(false);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        
        // Get company name from user metadata
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const ADMIN_EMAILS = ['asimmons@boon-health.com', 'alexsimm95@gmail.com', 'hello@boon-health.com'];
        const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
        
        let company = session?.user?.app_metadata?.company || '';
        let compId = session?.user?.app_metadata?.company_id || '';
        let accName = session?.user?.app_metadata?.account_name || '';
        
        // Check for admin override
        if (isAdmin) {
          try {
            const stored = localStorage.getItem('boon_admin_company_override');
            if (stored) {
              const override = JSON.parse(stored);
              company = override.name;
              compId = override.id || compId;
              accName = override.account_name || accName;
            }
          } catch {}
        }
        
        setCompanyName(accName || company);
        setCompanyId(compId);

        // Fetch employees - use account_name for grouped companies, otherwise company_id
        let empResult;
        
        if (accName) {
          // Use account_name for multi-company accounts (like Media Arts Lab)
          empResult = await supabase
            .from('employee_manager')
            .select('*')
            .ilike('company_name', `%${accName}%`)
            .neq('company_email', 'asimmons@boon-health.com')
            .order('last_name', { ascending: true });
        } else if (compId) {
          // Use exact company_id match (preferred)
          empResult = await supabase
            .from('employee_manager')
            .select('*')
            .eq('company_id', compId)
            .neq('company_email', 'asimmons@boon-health.com')
            .order('last_name', { ascending: true });
        } else {
          // Fall back to fetching all and filtering by name (legacy)
          empResult = await supabase
            .from('employee_manager')
            .select('*')
            .neq('company_email', 'asimmons@boon-health.com')
            .order('last_name', { ascending: true });
        }

        if (empResult.error) throw empResult.error;
        
        // If we used company_id, no need to filter; otherwise filter by company name
        let filteredData = empResult.data || [];
        
        if (!compId && company) {
          // Legacy fallback: filter by exact company name match to avoid partial matches
          filteredData = filteredData.filter(e => {
            const empCompany = (e.company_name || e.company || '').toLowerCase();
            const targetCompany = company.split(' - ')[0].toLowerCase();
            // Use exact match instead of includes to avoid "Vita" matching "VitalSkin"
            return empCompany === targetCompany || 
                   empCompany.split(' - ')[0] === targetCompany ||
                   empCompany === company.toLowerCase();
          });
        }
        
        // Map program_title from existing fields
        filteredData = filteredData.map(e => ({
          ...e,
          program_title: e.coaching_program || e.program || undefined,
          program: e.coaching_program || e.program
        }));
        
        setEmployees(filteredData);
      } catch (err: any) {
        console.error('Error fetching employees:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Get unique programs for filter (prefer program_title)
  const programs = useMemo(() => {
    const uniquePrograms = [...new Set(employees.map(e => e.program_title || e.program).filter(Boolean))];
    return ['All', ...uniquePrograms.sort()];
  }, [employees]);

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    return employees
      .filter(emp => {
        const matchesSearch = 
          `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.company_email?.toLowerCase().includes(searchTerm.toLowerCase());
        const empProgram = emp.program_title || emp.program;
        const matchesProgram = filterProgram === 'All' || empProgram === filterProgram;
        return matchesSearch && matchesProgram;
      })
      .sort((a, b) => {
        const aVal = a[sortField] || '';
        const bVal = b[sortField] || '';
        if (sortDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
  }, [employees, searchTerm, filterProgram, sortField, sortDirection]);

  // Stats
  const activeCount = employees.filter(e => e.status !== 'Inactive' && !e.end_date).length;
  const inactiveCount = employees.filter(e => e.status === 'Inactive' || e.end_date).length;

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setModalMode('add');
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('edit');
  };

  const handleTerminateEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('terminate');
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('delete');
  };

  const handleModalClose = () => {
    setModalMode(null);
    setSelectedEmployee(null);
  };

  const handleSaveSuccess = (employee: Employee, action: 'create' | 'update' | 'delete') => {
    if (action === 'create') {
      setEmployees([...employees, employee]);
    } else if (action === 'update') {
      setEmployees(employees.map(e => e.id === employee.id ? employee : e));
    } else if (action === 'delete') {
      setEmployees(employees.filter(e => e.id !== employee.id));
    }
    handleModalClose();
  };

  const handleBatchUploadSuccess = (newEmployees: Employee[]) => {
    setEmployees([...employees, ...newEmployees]);
    setShowBatchUpload(false);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Employees</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 md:pb-12 font-sans">
      {/* Modal */}
      {modalMode && (
        <EmployeeModal
          mode={modalMode}
          employee={selectedEmployee}
          companyName={companyName}
          companyId={companyId}
          programs={programs.filter(p => p !== 'All')}
          onClose={handleModalClose}
          onSave={handleSaveSuccess}
        />
      )}

      {/* Batch Upload Modal */}
      {showBatchUpload && (
        <BatchUploadModal
          companyName={companyName}
          companyId={companyId}
          onClose={() => setShowBatchUpload(false)}
          onSuccess={handleBatchUploadSuccess}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-boon-dark tracking-tight uppercase">Employee Manager</h1>
          <p className="text-gray-500 font-medium text-sm mt-2">
            Manage roster, coaching programs, and employment status.
          </p>
        </div>
        
        {/* Desktop Add Button */}
        <button
          onClick={handleAddEmployee}
          className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-boon-blue text-white font-bold rounded-xl hover:bg-boon-darkBlue transition shadow-lg shadow-boon-blue/20"
        >
          <Plus size={20} />
          Add Employee
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-boon-blue/10 rounded-xl">
              <Users className="w-6 h-6 text-boon-blue" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Employees</p>
              <p className="text-3xl font-black text-boon-dark">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-boon-green/10 rounded-xl">
              <Check className="w-6 h-6 text-boon-green" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Active</p>
              <p className="text-3xl font-black text-boon-green">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-xl">
              <UserX className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inactive</p>
              <p className="text-3xl font-black text-gray-400">{inactiveCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96 bg-gray-50 rounded-lg group focus-within:ring-2 ring-boon-blue/30 transition">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Find by name or email..." 
            className="w-full pl-10 pr-4 py-2.5 bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 ring-boon-blue/30"
          >
            {programs.map(prog => (
              <option key={prog} value={prog}>{prog === 'All' ? 'All Programs' : prog}</option>
            ))}
          </select>

          <button 
            onClick={() => setShowBatchUpload(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
          >
            <Upload size={16} />
            Batch Upload
          </button>
        </div>
      </div>

      {/* Mobile Add Button - Fixed Bottom */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-40">
        <button
          onClick={handleAddEmployee}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-boon-blue text-white font-bold rounded-2xl shadow-xl shadow-boon-blue/30 active:scale-95 transition-transform"
        >
          <Plus size={20} />
          Add Employee
        </button>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-gray-100">
           {filteredEmployees.length > 0 ? (
             filteredEmployees.map((emp) => {
               const isInactive = emp.status === 'Inactive' || emp.end_date;
               return (
                 <div key={emp.id} className={`p-4 ${isInactive ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <h3 className="font-bold text-gray-800">{emp.first_name} {emp.last_name}</h3>
                          <p className="text-sm text-gray-500">{emp.job_title || 'No Title'}</p>
                       </div>
                       {isInactive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-boon-green/10 text-boon-green">
                            Active
                          </span>
                        )}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3 space-y-1">
                       <p className="truncate">{emp.company_email}</p>
                       <div className="flex items-center gap-2">
                          {(emp.program_title || emp.program) && (
                             <span className="px-2 py-0.5 rounded text-xs font-bold bg-boon-blue/10 text-boon-blue">
                               {emp.program_title || emp.program}
                             </span>
                          )}
                          <span className="text-gray-400">•</span>
                          <span>{emp.department || 'No Dept'}</span>
                       </div>
                    </div>

                    <div className="flex gap-2">
                       <button
                          onClick={() => handleEditEmployee(emp)}
                          className="flex-1 py-2 text-sm font-bold text-gray-600 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100"
                        >
                          Edit
                        </button>
                        {!isInactive && (
                          <button
                            onClick={() => handleTerminateEmployee(emp)}
                            className="px-4 py-2 text-gray-400 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-boon-dark"
                            title="Deactivate"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                        <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className="px-4 py-2 text-gray-400 bg-gray-50 rounded-lg border border-gray-200 hover:bg-red-50 hover:text-red-500"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                        </button>
                    </div>
                 </div>
               );
             })
           ) : (
             <div className="p-8 text-center text-gray-400 italic">
                No employees found.
             </div>
           )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader 
                  label="First Name" 
                  field="first_name" 
                  currentSort={sortField} 
                  direction={sortDirection} 
                  onSort={handleSort} 
                />
                <SortableHeader 
                  label="Last Name" 
                  field="last_name" 
                  currentSort={sortField} 
                  direction={sortDirection} 
                  onSort={handleSort} 
                />
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Program</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const isInactive = emp.status === 'Inactive' || emp.end_date;
                  return (
                    <tr 
                      key={emp.id} 
                      className={`hover:bg-gray-50 transition-colors ${isInactive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-800 text-sm">{emp.first_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800 text-sm">{emp.last_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{emp.company_email || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {(emp.program_title || emp.program) ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-boon-blue/10 text-boon-blue">
                            {emp.program_title || emp.program}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{emp.department || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{emp.job_title || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {isInactive ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-boon-green/10 text-boon-green">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditEmployee(emp)}
                            className="p-2 text-gray-400 hover:text-boon-blue hover:bg-boon-blue/10 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!isInactive && (
                            <button
                              onClick={() => handleTerminateEmployee(emp)}
                              className="p-2 text-gray-400 hover:text-boon-dark hover:bg-gray-200 rounded-lg transition"
                              title="Deactivate (Set Inactive)"
                            >
                              <UserX size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-2 text-gray-400 hover:text-boon-red hover:bg-boon-red/10 rounded-lg transition"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
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

// Sortable Header Component
const SortableHeader = ({ 
  label, 
  field, 
  currentSort, 
  direction, 
  onSort 
}: { 
  label: string; 
  field: keyof Employee; 
  currentSort: keyof Employee; 
  direction: 'asc' | 'desc'; 
  onSort: (field: keyof Employee) => void;
}) => (
  <th 
    className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {currentSort === field && (
        direction === 'asc' ? <ArrowUp size={14} className="text-boon-blue" /> : <ArrowDown size={14} className="text-boon-blue" />
      )}
    </div>
  </th>
);

// Employee Modal Component
const EmployeeModal = ({
  mode,
  employee,
  companyName,
  companyId,
  programs,
  onClose,
  onSave
}: {
  mode: ModalMode;
  employee: Employee | null;
  companyName: string;
  companyId: string;
  programs: string[];
  onClose: () => void;
  onSave: (employee: Employee, action: 'create' | 'update' | 'delete') => void;
}) => {
  const [formData, setFormData] = useState({
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    company_email: employee?.company_email || '',
    program: employee?.program || '',
    department: employee?.department || '',
    job_title: employee?.job_title || '',
    company_role: employee?.company_role || '',
    start_date: employee?.start_date || new Date().toISOString().split('T')[0],
    end_date: employee?.end_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProgramName, setNewProgramName] = useState('');

  const isDelete = mode === 'delete';
  const isTerminate = mode === 'terminate';
  const isEdit = mode === 'edit';
  const isAdd = mode === 'add';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Clean up form data
    const cleanedData = {
      ...formData,
      program: formData.program === '__new__' ? newProgramName : formData.program,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };

    try {
      if (isDelete) {
        // Hard Delete - Use select() to ensure row was actually removed
        const { data, error } = await supabase
            .from('employee_manager')
            .delete()
            .eq('id', employee!.id)
            .select();

        if (error) throw error;
        
        // Check if deletion actually occurred
        if (!data || data.length === 0) {
           throw new Error('Record not found or already deleted. Please refresh.');
        }

        // Pass the deleted employee back so UI can filter it out
        onSave(employee!, 'delete');

      } else if (isAdd) {
        // Insert new employee with company_id
        const { data, error } = await supabase
          .from('employee_manager')
          .insert({
            ...cleanedData,
            company_name: companyName,
            company_id: companyId || null,
            status: 'Active'
          })
          .select()
          .single();

        if (error) throw error;
        onSave(data, 'create');
      } else if (isEdit) {
        // Update existing employee
        const { data, error } = await supabase
          .from('employee_manager')
          .update(cleanedData)
          .eq('id', employee!.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data, 'update');
      } else if (isTerminate) {
        // Terminate employee
        const { data, error } = await supabase
          .from('employee_manager')
          .update({
            end_date: formData.end_date || new Date().toISOString().split('T')[0],
            status: 'Inactive'
          })
          .eq('id', employee!.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data, 'update');
      }
    } catch (err: any) {
      console.error('Error saving employee:', err);
      // Supabase FK constraint errors usually contain the table name
      if (err.message?.includes('foreign key constraint') || err.code === '23503') {
         setError('Cannot delete this employee because they have associated sessions or data. Please contact support.');
      } else {
         setError(err.message || 'Failed to save employee');
      }
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = isDelete 
    ? 'Delete Employee' 
    : isAdd 
      ? 'Add Employee' 
      : isEdit 
        ? 'Edit Employee' 
        : 'Terminate Employee';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-boon-dark/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className={`text-2xl font-black uppercase tracking-tight ${isDelete ? 'text-boon-red' : 'text-boon-dark'}`}>
              {modalTitle}
            </h2>
            {isTerminate && (
              <p className="text-sm text-gray-500 mt-1">
                Set an end date to deactivate this employee's coaching access.
              </p>
            )}
             {isDelete && (
              <p className="text-sm text-gray-500 mt-1">
                Permanently remove this record from the database.
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {isDelete ? (
             <div className="space-y-4">
                 <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                     <p className="font-bold text-gray-800 text-lg mb-1">
                        Are you sure you want to delete {employee?.first_name} {employee?.last_name}?
                     </p>
                     <p className="text-gray-600">
                        This action <strong>cannot be undone</strong>. This will permanently remove the employee record. 
                        If they have associated sessions, you may not be able to delete them without removing sessions first.
                     </p>
                 </div>
                 <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-wide mb-1">Employee Details</p>
                    <p className="text-gray-800">{employee?.first_name} {employee?.last_name}</p>
                    <p className="text-gray-600 text-sm">{employee?.company_email}</p>
                 </div>
             </div>
          ) : isTerminate ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-bold text-gray-800">{employee?.first_name} {employee?.last_name}</p>
                <p className="text-sm text-gray-500">{employee?.company_email}</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="Smith"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Company Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.company_email}
                  onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="john.smith@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Program
                </label>
                <select
                  value={formData.program}
                  onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                >
                  <option value="">Select a program</option>
                  <option value="GROW">GROW</option>
                  <option value="EXEC">EXEC</option>
                  <option value="Scale">Scale</option>
                  {programs.filter(p => !['GROW', 'EXEC', 'Scale'].includes(p)).map(prog => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                  <option value="__new__">+ Add new program</option>
                </select>
                {formData.program === '__new__' && (
                  <input
                    type="text"
                    value={newProgramName}
                    onChange={(e) => setNewProgramName(e.target.value)}
                    placeholder="Enter new program name"
                    className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="Engineering"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="Senior Manager"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value={formData.company_role}
                  onChange={(e) => setFormData({ ...formData, company_role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="People Manager"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                />
              </div>

              {isEdit && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-3 font-bold rounded-xl transition flex items-center gap-2 ${
                isDelete 
                  ? 'bg-boon-red text-white hover:bg-red-600'
                  : isTerminate 
                    ? 'bg-gray-800 text-white hover:bg-gray-900' 
                    : 'bg-boon-blue text-white hover:bg-boon-darkBlue'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDelete 
                ? 'Delete Permanently' 
                : isTerminate 
                  ? 'Deactivate Employee' 
                  : isEdit 
                    ? 'Save Changes' 
                    : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Batch Upload Modal Component
const BatchUploadModal = ({
  companyName,
  companyId,
  onClose,
  onSuccess
}: {
  companyName: string;
  companyId: string;
  onClose: () => void;
  onSuccess: (employees: Employee[]) => void;
}) => {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [dragActive, setDragActive] = useState(false);

  const requiredFields = ['first_name', 'last_name', 'company_email'];
  const optionalFields = ['program', 'department', 'job_title', 'company_role', 'start_date'];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row');
        return;
      }

      const headerRow: string[] = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setHeaders(headerRow);

      const dataRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headerRow.forEach((header: string, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });

      setCsvData(dataRows);
      
      // Auto-map obvious fields
      const autoMapping: Record<string, string> = {};
      headerRow.forEach((header: string) => {
        const lowerHeader = header.toLowerCase().replace(/[_\s]/g, '');
        if (lowerHeader.includes('firstname') || lowerHeader === 'first') {
          autoMapping['first_name'] = header;
        } else if (lowerHeader.includes('lastname') || lowerHeader === 'last') {
          autoMapping['last_name'] = header;
        } else if (lowerHeader.includes('email')) {
          autoMapping['company_email'] = header;
        } else if (lowerHeader.includes('program')) {
          autoMapping['program'] = header;
        } else if (lowerHeader.includes('department') || lowerHeader === 'dept') {
          autoMapping['department'] = header;
        } else if (lowerHeader.includes('title') || lowerHeader.includes('jobtitle')) {
          autoMapping['job_title'] = header;
        } else if (lowerHeader.includes('role')) {
          autoMapping['company_role'] = header;
        } else if (lowerHeader.includes('start') || lowerHeader.includes('hiredate')) {
          autoMapping['start_date'] = header;
        }
      });
      setMapping(autoMapping);
      setStep('map');
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const getMappedData = () => {
    return csvData.map((row: any) => {
      const mapped: Record<string, any> = {
        company_name: companyName,
        company_id: companyId || null,
        status: 'Active'
      };
      Object.entries(mapping).forEach(([field, csvHeader]) => {
        const headerKey = csvHeader as string;
        if (headerKey && row[headerKey]) {
          mapped[field] = row[headerKey];
        }
      });
      return mapped;
    }).filter((row: any) => row.first_name && row.last_name && row.company_email);
  };

  const handleUpload = async () => {
    const mappedData = getMappedData();
    if (mappedData.length === 0) {
      setError('No valid rows to upload. Ensure first_name, last_name, and company_email are mapped.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('employee_manager')
        .insert(mappedData)
        .select();

      if (error) throw error;
      onSuccess(data || []);
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setError(err.message || 'Failed to upload employees');
    } finally {
      setUploading(false);
    }
  };

  const validRows = getMappedData();
  const missingRequired = requiredFields.filter(f => !mapping[f]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-boon-dark/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black text-boon-dark uppercase tracking-tight">
              Batch Upload Employees
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload a CSV file to add multiple employees at once
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition ${
                dragActive ? 'border-boon-blue bg-boon-blue/5' : 'border-gray-200'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">Drag and drop your CSV file here</p>
              <p className="text-gray-400 text-sm mb-4">or</p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-boon-blue text-white font-bold rounded-xl hover:bg-boon-darkBlue transition cursor-pointer">
                <Upload size={18} />
                Choose File
                <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
              </label>
              <p className="text-gray-400 text-xs mt-4">
                Required columns: first_name, last_name, company_email
              </p>
              <button 
                onClick={() => {
                  const csvContent = 'first_name,last_name,company_email,department,job_title,company_role\nJohn,Doe,john.doe@company.com,Engineering,Software Engineer,Individual Contributor\nJane,Smith,jane.smith@company.com,Marketing,Marketing Manager,Manager';
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'employee_upload_template.csv';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1 text-xs text-boon-blue hover:underline mt-2"
              >
                <Download size={14} />
                Download template
              </button>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Required Fields</h3>
                  {requiredFields.map(field => (
                    <div key={field} className="mb-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {field.replace(/_/g, ' ')} *
                      </label>
                      <select
                        value={mapping[field] || ''}
                        onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          !mapping[field] ? 'border-red-300' : 'border-gray-200'
                        }`}
                      >
                        <option value="">-- Select column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Optional Fields</h3>
                  {optionalFields.map(field => (
                    <div key={field} className="mb-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {field.replace(/_/g, ' ')}
                      </label>
                      <select
                        value={mapping[field] || ''}
                        onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="">-- Skip --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={() => { setStep('upload'); setCsvData([]); setHeaders([]); }}
                  className="text-gray-500 font-medium hover:text-gray-700"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={missingRequired.length > 0}
                  className={`px-5 py-2.5 font-bold rounded-xl transition ${
                    missingRequired.length > 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-boon-blue text-white hover:bg-boon-darkBlue'
                  }`}
                >
                  Preview ({validRows.length} rows)
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-boon-green">{validRows.length}</span> employees ready to upload
                </p>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Program</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {validRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{row.first_name} {row.last_name}</td>
                        <td className="px-4 py-2 text-gray-600">{row.company_email}</td>
                        <td className="px-4 py-2 text-gray-600">{row.program || '-'}</td>
                        <td className="px-4 py-2 text-gray-600">{row.department || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validRows.length > 50 && (
                <p className="text-xs text-gray-400 text-center">Showing first 50 of {validRows.length} rows</p>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={() => setStep('map')}
                  className="text-gray-500 font-medium hover:text-gray-700"
                >
                  ← Back to Mapping
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-3 bg-boon-green text-white font-bold rounded-xl hover:bg-green-600 transition flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Upload {validRows.length} Employees
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;