import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FileDown, Loader2, X } from 'lucide-react';
import jsPDF from 'jspdf';

interface ReportGeneratorProps {
  companyName: string;
  clientLogo: string | null;
  programType: 'GROW' | 'Scale' | 'Exec' | null;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ 
  companyName, 
  clientLogo,
  programType 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'q4' | 'q3' | 'ytd'>('all');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [programs, setPrograms] = useState<string[]>([]);

  const handleOpen = async () => {
    setIsOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const company = session?.user?.app_metadata?.company || '';
      
      const { data } = await supabase
        .from('program_config')
        .select('program_title')
        .ilike('account_name', `%${company.split(' - ')[0]}%`);
      
      if (data) {
        setPrograms([...new Set(data.map(p => p.program_title).filter(Boolean))] as string[]);
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const generatePDF = async () => {
    setLoading(true);
    setProgress('Fetching data...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const company = session?.user?.app_metadata?.company || '';
      const companyBase = company.split(' - ')[0].toLowerCase();
      
      // Fetch session data
      const { data: sessionData } = await supabase
        .from('session_tracking')
        .select('*')
        .or(`account_name.ilike.%${companyBase}%,program_title.ilike.twc%`);
      
      const sessions = sessionData || [];
      const completedSessions = sessions.filter(s => {
        const status = (s.status || '').toLowerCase();
        return status.includes('completed');
      });
      
      const uniqueEmployees = new Set(sessions.map(s => {
        const emp = s.employee_manager;
        return emp?.email || s.employee_email || s.employee_name;
      }).filter(Boolean)).size;
      
      // Fetch competency scores
      setProgress('Analyzing growth...');
      const { data: compData } = await supabase
        .from('competency_scores_grow')
        .select('*')
        .or(`account.ilike.%${companyBase}%,program_title.ilike.twc%`);
      
      const scores = compData || [];
      
      // Fetch satisfaction
      const { data: surveyData } = await supabase
        .from('survey_responses_unified')
        .select('*')
        .or(`account.ilike.%${companyBase}%,program_title.ilike.twc%`);
      
      const surveys = surveyData || [];
      const npsScores = surveys.map(s => s.nps).filter(n => n != null);
      const csatScores = surveys.map(s => s.coach_satisfaction).filter(n => n != null);
      
      const promoters = npsScores.filter(n => n >= 9).length;
      const detractors = npsScores.filter(n => n <= 6).length;
      const nps = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : 0;
      const csat = csatScores.length > 0 ? (csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(1) : '0';
      
      // Generate PDF
      setProgress('Creating PDF...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      
      // Header
      pdf.setFillColor(70, 111, 246); // Boon Blue
      pdf.rect(0, 0, pageWidth, 45, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Coaching Impact Report', margin, 25);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(companyName || 'Executive Summary', margin, 35);
      
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(today, pageWidth - margin - 40, 35);
      
      // Metrics
      let y = 60;
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Metrics', margin, y);
      y += 15;
      
      const metrics = [
        { label: 'Sessions Completed', value: completedSessions.length.toString() },
        { label: 'Total Participants', value: uniqueEmployees.toString() },
        { label: 'Net Promoter Score', value: `${nps > 0 ? '+' : ''}${nps}` },
        { label: 'Coach Satisfaction', value: `${csat}/10` }
      ];
      
      pdf.setFontSize(12);
      metrics.forEach((m, i) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(m.value, margin, y + (i * 12));
        pdf.setFont('helvetica', 'normal');
        pdf.text(` - ${m.label}`, margin + 40, y + (i * 12));
      });
      
      y += 60;
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Program Impact', margin, y);
      y += 10;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text('This report summarizes the overall engagement and satisfaction of the program', margin, y);
      y += 6;
      pdf.text('participants. Continued tracking will provide deeper insights into behavioral changes.', margin, y);

      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text('Generated by Boon Health Dashboard', pageWidth / 2, 287, { align: 'center' });
      
      const fileName = `${companyName?.replace(/\s+/g, '_') || 'Boon'}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setIsOpen(false);
    } catch (err) {
      console.error('Error:', err);
      setProgress('Error generating report');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-gray-500 hover:bg-gray-50 hover:text-boon-dark w-full"
      >
        <FileDown size={20} />
        <span>Export Report</span>
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition">
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-black text-boon-dark uppercase tracking-tight mb-2">Generate Report</h2>
            <p className="text-sm text-gray-500 mb-8">Create a PDF executive summary of your coaching program.</p>
            
            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Time Period</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 ring-boon-blue/20">
                  <option value="all">All Time</option>
                  <option value="ytd">Year to Date</option>
                  <option value="q4">Q4 2024</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Program Cohort</label>
                <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 ring-boon-blue/20">
                  <option value="all">All Programs</option>
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            
            {progress && (
              <div className="mb-6 p-4 bg-boon-blue/5 rounded-xl flex items-center gap-3 border border-boon-blue/10">
                <Loader2 className="w-5 h-5 text-boon-blue animate-spin" />
                <span className="text-sm font-bold text-boon-blue">{progress}</span>
              </div>
            )}
            
            <div className="flex gap-4">
              <button 
                onClick={() => setIsOpen(false)} 
                className="flex-1 px-6 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={generatePDF} 
                disabled={loading} 
                className="flex-1 px-6 py-3 bg-boon-blue rounded-xl text-sm font-bold text-white hover:bg-boon-darkBlue disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-boon-blue/20"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><FileDown className="w-4 h-4" />Download PDF</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportGenerator;