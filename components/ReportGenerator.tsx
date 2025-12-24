import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FileDown, Loader2, X, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReportGeneratorProps {
  companyName: string;
  clientLogo: string | null;
  programType: 'GROW' | 'Scale' | 'Exec' | null;
}

interface ReportData {
  sessions: {
    total: number;
    completed: number;
    employees: number;
    utilization: number;
  };
  impact: {
    overallGrowth: number;
    topCompetencies: { name: string; change: number }[];
    participantCount: number;
  };
  satisfaction: {
    nps: number;
    csat: number;
  };
  testimonials: string[];
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

  // Fetch available programs when modal opens
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
        setPrograms(data.map(p => p.program_title).filter(Boolean));
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const fetchReportData = async (): Promise<ReportData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const company = session?.user?.app_metadata?.company || '';
    const companyBase = company.split(' - ')[0].toLowerCase();
    
    // Fetch session data
    setProgress('Fetching session data...');
    const { data: sessionData } = await supabase
      .from('session_data')
      .select('*')
      .or(`account.ilike.%${companyBase}%,program_title.ilike.twc%`);
    
    const sessions = sessionData || [];
    const completedSessions = sessions.filter(s => s.status === 'Completed');
    const uniqueEmployees = new Set(sessions.map(s => s.employee_email?.toLowerCase())).size;
    
    // Fetch competency scores
    setProgress('Analyzing competency growth...');
    const { data: compData } = await supabase
      .from('competency_scores_grow')
      .select('*')
      .or(`account.ilike.%${companyBase}%,program_title.ilike.twc%`);
    
    const scores = compData || [];
    
    // Calculate competency changes
    const competencyKeys = [
      'comp_conflict_resolution',
      'comp_time_management_and_productivity', 
      'comp_collaboration',
      'comp_strategic_thinking',
      'comp_influencing_others',
      'comp_emotional_intelligence',
      'comp_change_management'
    ];
    
    const competencyNames: Record<string, string> = {
      'comp_conflict_resolution': 'Conflict Resolution',
      'comp_time_management_and_productivity': 'Time Management',
      'comp_collaboration': 'Collaboration',
      'comp_strategic_thinking': 'Strategic Thinking',
      'comp_influencing_others': 'Influencing Others',
      'comp_emotional_intelligence': 'Emotional Intelligence',
      'comp_change_management': 'Change Management'
    };
    
    const competencyStats = competencyKeys.map(key => {
      const preKey = `${key}_pre`;
      const postKey = `${key}_post`;
      
      const validScores = scores.filter(s => 
        s[preKey] != null && s[postKey] != null && 
        s[preKey] > 0 && s[postKey] > 0
      );
      
      if (validScores.length === 0) return null;
      
      const avgPre = validScores.reduce((sum, s) => sum + Number(s[preKey]), 0) / validScores.length;
      const avgPost = validScores.reduce((sum, s) => sum + Number(s[postKey]), 0) / validScores.length;
      const change = ((avgPost - avgPre) / avgPre) * 100;
      
      return {
        name: competencyNames[key] || key,
        change: Math.round(change)
      };
    }).filter(Boolean) as { name: string; change: number }[];
    
    competencyStats.sort((a, b) => b.change - a.change);
    
    const overallGrowth = competencyStats.length > 0 
      ? competencyStats.reduce((sum, c) => sum + c.change, 0) / competencyStats.length 
      : 0;
    
    // Fetch satisfaction data
    setProgress('Gathering satisfaction scores...');
    const { data: surveyData } = await supabase
      .from('survey_responses_unified')
      .select('nps_score, coach_rating')
      .or(`account.ilike.%${companyBase}%,program_title.ilike.twc%`);
    
    const surveys = surveyData || [];
    const npsScores = surveys.map(s => s.nps_score).filter(n => n != null);
    const csatScores = surveys.map(s => s.coach_rating).filter(n => n != null);
    
    const promoters = npsScores.filter(n => n >= 9).length;
    const detractors = npsScores.filter(n => n <= 6).length;
    const nps = npsScores.length > 0 
      ? Math.round(((promoters - detractors) / npsScores.length) * 100)
      : 0;
    
    const csat = csatScores.length > 0
      ? csatScores.reduce((a, b) => a + b, 0) / csatScores.length
      : 0;
    
    // Fetch testimonials
    setProgress('Collecting testimonials...');
    const { data: feedbackData } = await supabase
      .from('survey_responses_unified')
      .select('feedback_learned, feedback_insight')
      .or(`account.ilike.%${companyBase}%,program_title.ilike.twc%`)
      .not('feedback_learned', 'is', null);
    
    const testimonials = (feedbackData || [])
      .flatMap(f => [f.feedback_learned, f.feedback_insight])
      .filter(t => t && t.length > 50)
      .slice(0, 3);
    
    return {
      sessions: {
        total: sessions.length,
        completed: completedSessions.length,
        employees: uniqueEmployees,
        utilization: uniqueEmployees > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0
      },
      impact: {
        overallGrowth: Math.round(overallGrowth * 10) / 10,
        topCompetencies: competencyStats.slice(0, 3),
        participantCount: scores.length
      },
      satisfaction: {
        nps,
        csat: Math.round(csat * 10) / 10
      },
      testimonials
    };
  };

  const generatePDF = async () => {
    setLoading(true);
    
    try {
      const data = await fetchReportData();
      setProgress('Generating PDF...');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let y = margin;
      
      // Helper functions
      const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color: string = '#1F2937') => {
        pdf.setFontSize(size);
        pdf.setFont('helvetica', style);
        const rgb = hexToRgb(color);
        pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      };
      
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
        const rgb = hexToRgb(color);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.roundedRect(x, y, w, h, r, r, 'F');
      };
      
      // === HEADER ===
      // Gradient header bar
      drawRoundedRect(0, 0, pageWidth, 45, 0, '#466FF6');
      
      // Title
      addText('Coaching Impact Report', 24, 'bold', '#FFFFFF');
      pdf.text('Coaching Impact Report', margin, 25);
      
      // Subtitle with company name
      addText(companyName || 'Executive Summary', 12, 'normal', '#FFFFFF');
      pdf.text(companyName || 'Executive Summary', margin, 35);
      
      // Date
      const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      addText(today, 10, 'normal', '#FFFFFF');
      pdf.text(today, pageWidth - margin - 40, 35);
      
      y = 60;
      
      // === EXECUTIVE SUMMARY ===
      addText('Executive Summary', 16, 'bold', '#1F2937');
      pdf.text('Executive Summary', margin, y);
      y += 10;
      
      // Summary box
      drawRoundedRect(margin, y, pageWidth - 2 * margin, 25, 3, '#F0F9FF');
      addText(`Your team showed a ${data.impact.overallGrowth}% overall improvement in leadership competencies, with ${data.sessions.completed} coaching sessions completed across ${data.sessions.employees} participants.`, 10, 'normal', '#1E40AF');
      const summaryLines = pdf.splitTextToSize(
        `Your team showed a ${data.impact.overallGrowth}% overall improvement in leadership competencies, with ${data.sessions.completed} coaching sessions completed across ${data.sessions.employees} participants.`,
        pageWidth - 2 * margin - 10
      );
      pdf.text(summaryLines, margin + 5, y + 10);
      y += 35;
      
      // === KEY METRICS ===
      addText('Key Metrics', 16, 'bold', '#1F2937');
      pdf.text('Key Metrics', margin, y);
      y += 10;
      
      // Metric cards
      const cardWidth = (pageWidth - 2 * margin - 15) / 4;
      const cardHeight = 35;
      const metrics = [
        { label: 'Sessions', value: data.sessions.completed.toString(), color: '#466FF6' },
        { label: 'Participants', value: data.sessions.employees.toString(), color: '#10B981' },
        { label: 'NPS Score', value: `+${data.satisfaction.nps}`, color: '#8B5CF6' },
        { label: 'Coach Rating', value: `${data.satisfaction.csat}/10`, color: '#F59E0B' }
      ];
      
      metrics.forEach((metric, i) => {
        const x = margin + i * (cardWidth + 5);
        drawRoundedRect(x, y, cardWidth, cardHeight, 3, metric.color);
        
        addText(metric.value, 18, 'bold', '#FFFFFF');
        pdf.text(metric.value, x + cardWidth / 2, y + 15, { align: 'center' });
        
        addText(metric.label, 9, 'normal', '#FFFFFF');
        pdf.text(metric.label, x + cardWidth / 2, y + 25, { align: 'center' });
      });
      y += cardHeight + 15;
      
      // === COMPETENCY GROWTH ===
      addText('Top Areas of Growth', 16, 'bold', '#1F2937');
      pdf.text('Top Areas of Growth', margin, y);
      y += 10;
      
      data.impact.topCompetencies.forEach((comp, i) => {
        // Background bar
        drawRoundedRect(margin, y, pageWidth - 2 * margin, 12, 2, '#F3F4F6');
        
        // Progress bar
        const progressWidth = Math.min((comp.change / 15) * (pageWidth - 2 * margin - 60), pageWidth - 2 * margin - 60);
        drawRoundedRect(margin, y, progressWidth, 12, 2, '#10B981');
        
        // Label
        addText(comp.name, 10, 'normal', '#1F2937');
        pdf.text(comp.name, margin + 5, y + 8);
        
        // Percentage
        addText(`+${comp.change}%`, 10, 'bold', '#10B981');
        pdf.text(`+${comp.change}%`, pageWidth - margin - 15, y + 8);
        
        y += 16;
      });
      y += 10;
      
      // === TESTIMONIALS ===
      if (data.testimonials.length > 0) {
        addText('What Participants Are Saying', 16, 'bold', '#1F2937');
        pdf.text('What Participants Are Saying', margin, y);
        y += 10;
        
        data.testimonials.forEach((quote, i) => {
          // Quote box
          drawRoundedRect(margin, y, pageWidth - 2 * margin, 30, 3, '#FEF3C7');
          
          // Quote mark
          addText('"', 24, 'bold', '#F59E0B');
          pdf.text('"', margin + 5, y + 12);
          
          // Quote text (truncated)
          const truncatedQuote = quote.length > 200 ? quote.substring(0, 200) + '...' : quote;
          addText(truncatedQuote, 9, 'normal', '#78350F');
          const quoteLines = pdf.splitTextToSize(truncatedQuote, pageWidth - 2 * margin - 20);
          pdf.text(quoteLines.slice(0, 3), margin + 15, y + 10);
          
          y += 35;
          
          if (y > pageHeight - 40) {
            pdf.addPage();
            y = margin;
          }
        });
      }
      
      // === FOOTER ===
      addText('Generated by Boon Health', 8, 'normal', '#9CA3AF');
      pdf.text('Generated by Boon Health', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Save
      const fileName = `${companyName?.replace(/\s+/g, '_') || 'Coaching'}_Impact_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setProgress('');
      setIsOpen(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setProgress('Error generating report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm"
      >
        <FileDown className="w-4 h-4" />
        Export Report
      </button>
      
      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Generate Report</h2>
              <p className="text-sm text-gray-500 mt-1">
                Create a PDF summary of your coaching program's impact.
              </p>
            </div>
            
            {/* Options */}
            <div className="space-y-4 mb-6">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Period
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Time</option>
                  <option value="ytd">Year to Date</option>
                  <option value="q4">Q4 2024</option>
                  <option value="q3">Q3 2024</option>
                </select>
              </div>
              
              {/* Program Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program
                </label>
                <select
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Programs</option>
                  {programs.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Progress indicator */}
            {progress && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">{progress}</span>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={generatePDF}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
            
            {/* Preview note */}
            <p className="text-xs text-gray-400 text-center mt-4">
              Report includes: Key metrics, competency growth, and testimonials
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportGenerator;
