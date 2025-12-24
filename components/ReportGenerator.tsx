import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getDashboardSessions, getCompetencyScores, getSurveyResponses } from '../lib/dataFetcher';
import { FileDown, Loader2, X } from 'lucide-react';
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
    monthlyTrend: { month: string; count: number }[];
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
  themes: { name: string; count: number }[];
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
    
    const matchesCompany = (value: string | undefined | null, programTitle?: string | null): boolean => {
      if (!company) return false;
      if (companyBase.includes('wonderful') && programTitle && programTitle.toLowerCase().startsWith('twc')) {
        return true;
      }
      if (!value) return false;
      const valueBase = value.toLowerCase();
      if (companyBase.includes('wonderful') && valueBase.includes('wonderful')) {
        return true;
      }
      return valueBase.includes(companyBase) || companyBase.includes(valueBase.split(' - ')[0]);
    };
    
    // Fetch session data
    setProgress('Fetching session data...');
    const allSessions = await getDashboardSessions();
    const sessions = allSessions.filter(s => matchesCompany((s as any).account_name, (s as any).program_title));
    
    const completedSessions = sessions.filter(s => (s as any).status === 'Completed');
    const uniqueEmployees = new Set(sessions.map(s => (s as any).employee_name?.toLowerCase()).filter(Boolean)).size;
    
    // Calculate monthly trend (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const monthlyMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap.set(key, 0);
    }
    
    completedSessions.forEach(s => {
      const date = new Date((s as any).session_date);
      if (date >= sixMonthsAgo) {
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyMap.has(key)) {
          monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
        }
      }
    });
    
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count }));
    
    // Extract coaching themes
    setProgress('Analyzing coaching themes...');
    const themeCounts = new Map<string, number>();
    
    sessions.forEach(s => {
      const leadership = (s as any).leadership_management_skills || '';
      const communication = (s as any).communication_skills || '';
      const wellbeing = (s as any).mental_well_being || '';
      
      [leadership, communication, wellbeing].forEach(field => {
        if (field) {
          field.split(';').forEach((theme: string) => {
            const t = theme.trim();
            if (t && t.length > 2) {
              themeCounts.set(t, (themeCounts.get(t) || 0) + 1);
            }
          });
        }
      });
    });
    
    const themes = Array.from(themeCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Fetch competency scores
    setProgress('Analyzing competency growth...');
    const allScores = await getCompetencyScores();
    const scores = allScores.filter(c => matchesCompany((c as any).account, (c as any).program_title));
    
    const competencyMap = new Map<string, { preSum: number; postSum: number; count: number }>();
    
    scores.forEach(s => {
      const comp = (s as any).competency;
      const pre = Number((s as any).pre);
      const post = Number((s as any).post);
      
      if (!comp || isNaN(pre) || isNaN(post) || pre <= 0 || post <= 0) return;
      
      if (!competencyMap.has(comp)) {
        competencyMap.set(comp, { preSum: 0, postSum: 0, count: 0 });
      }
      const entry = competencyMap.get(comp)!;
      entry.preSum += pre;
      entry.postSum += post;
      entry.count += 1;
    });
    
    const competencyStats = Array.from(competencyMap.entries())
      .map(([name, data]) => {
        const avgPre = data.preSum / data.count;
        const avgPost = data.postSum / data.count;
        const change = ((avgPost - avgPre) / avgPre) * 100;
        return { name, change: Math.round(change) };
      })
      .filter(c => !isNaN(c.change))
      .sort((a, b) => b.change - a.change);
    
    const overallGrowth = competencyStats.length > 0 
      ? competencyStats.reduce((sum, c) => sum + c.change, 0) / competencyStats.length 
      : 0;
    
    // Fetch satisfaction data
    setProgress('Gathering satisfaction scores...');
    const allSurveys = await getSurveyResponses();
    const surveys = allSurveys.filter(s => matchesCompany((s as any).account, (s as any).program_title));
    
    const npsScores = surveys.map(s => (s as any).nps).filter(n => n != null);
    const csatScores = surveys.map(s => (s as any).coach_satisfaction).filter(n => n != null);
    
    const promoters = npsScores.filter(n => n >= 9).length;
    const detractors = npsScores.filter(n => n <= 6).length;
    const nps = npsScores.length > 0 
      ? Math.round(((promoters - detractors) / npsScores.length) * 100)
      : 0;
    
    const csat = csatScores.length > 0
      ? csatScores.reduce((a, b) => a + b, 0) / csatScores.length
      : 0;
    
    // Get BETTER testimonials - filter for impactful quotes
    setProgress('Selecting best testimonials...');
    const allTestimonials = surveys
      .flatMap(s => [(s as any).feedback_learned, (s as any).feedback_insight])
      .filter(t => t && typeof t === 'string')
      .filter(t => {
        // Must be substantial (150+ chars)
        if (t.length < 150) return false;
        // Must be a complete thought (has punctuation)
        if (!/[.!?]/.test(t)) return false;
        return true;
      })
      .sort((a, b) => {
        // Score testimonials - prefer ones with impact words
        const impactWords = ['helped', 'learned', 'improved', 'transformed', 'valuable', 'breakthrough', 'grateful', 'recommend', 'excellent', 'amazing', 'coach'];
        const scoreA = impactWords.filter(w => a.toLowerCase().includes(w)).length;
        const scoreB = impactWords.filter(w => b.toLowerCase().includes(w)).length;
        return (scoreB + b.length / 100) - (scoreA + a.length / 100);
      })
      .slice(0, 5);
    
    return {
      sessions: {
        total: sessions.length,
        completed: completedSessions.length,
        employees: uniqueEmployees,
        utilization: sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0,
        monthlyTrend
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
      themes,
      testimonials: allTestimonials
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
      
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      const drawRect = (x: number, y: number, w: number, h: number, color: string, radius?: number) => {
        const rgb = hexToRgb(color);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        if (radius) {
          pdf.roundedRect(x, y, w, h, radius, radius, 'F');
        } else {
          pdf.rect(x, y, w, h, 'F');
        }
      };
      
      // === PAGE 1 ===
      
      // Header
      drawRect(0, 0, pageWidth, 40, '#466FF6');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Coaching Impact Report', margin, 22);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(companyName || 'Executive Summary', margin, 32);
      
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(today, pageWidth - margin - 45, 32);
      
      y = 52;
      
      // Executive Summary
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Executive Summary', margin, y);
      y += 8;
      
      drawRect(margin, y, pageWidth - 2 * margin, 20, '#EFF6FF', 3);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const rgb = hexToRgb('#1E40AF');
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      const summaryText = `Your team showed a ${Math.round(data.impact.overallGrowth)}% overall improvement in leadership competencies, with ${data.sessions.completed} coaching sessions completed across ${data.sessions.employees} participants.`;
      const summaryLines = pdf.splitTextToSize(summaryText, pageWidth - 2 * margin - 10);
      pdf.text(summaryLines, margin + 5, y + 8);
      y += 28;
      
      // Key Metrics
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Metrics', margin, y);
      y += 8;
      
      const cardWidth = (pageWidth - 2 * margin - 15) / 4;
      const cardHeight = 28;
      const metrics = [
        { label: 'Sessions', value: data.sessions.completed.toString(), color: '#466FF6' },
        { label: 'Participants', value: data.sessions.employees.toString(), color: '#10B981' },
        { label: 'NPS Score', value: `+${data.satisfaction.nps}`, color: '#8B5CF6' },
        { label: 'Coach Rating', value: `${data.satisfaction.csat}/10`, color: '#F59E0B' }
      ];
      
      metrics.forEach((metric, i) => {
        const x = margin + i * (cardWidth + 5);
        drawRect(x, y, cardWidth, cardHeight, metric.color, 4);
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(metric.value, x + cardWidth / 2, y + 12, { align: 'center' });
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(metric.label, x + cardWidth / 2, y + 20, { align: 'center' });
      });
      y += cardHeight + 12;
      
      // Session Trend Chart
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Session Trend (Last 6 Months)', margin, y);
      y += 8;
      
      const chartHeight = 35;
      const chartWidth = pageWidth - 2 * margin;
      const barSpacing = chartWidth / 6;
      const singleBarWidth = 18;
      const maxCount = Math.max(...data.sessions.monthlyTrend.map(m => m.count), 1);
      
      drawRect(margin, y, chartWidth, chartHeight, '#F9FAFB', 3);
      
      data.sessions.monthlyTrend.forEach((m, i) => {
        const barHeight = (m.count / maxCount) * (chartHeight - 18);
        const centerX = margin + (i * barSpacing) + (barSpacing / 2);
        const barX = centerX - (singleBarWidth / 2);
        const barY = y + chartHeight - 10 - barHeight;
        
        // Bar
        if (barHeight > 0) {
          drawRect(barX, barY, singleBarWidth, barHeight, '#466FF6', 2);
        }
        
        // Count label (centered above bar)
        if (m.count > 0) {
          pdf.setTextColor(70, 111, 246);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.text(m.count.toString(), centerX, barY - 2, { align: 'center' });
        }
        
        // Month label (centered below)
        pdf.setTextColor(107, 114, 128);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(m.month, centerX, y + chartHeight - 2, { align: 'center' });
      });
      y += chartHeight + 12;
      
      // Top Areas of Growth
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Areas of Growth', margin, y);
      y += 8;
      
      data.impact.topCompetencies.forEach((comp) => {
        drawRect(margin, y, pageWidth - 2 * margin, 10, '#F3F4F6', 2);
        
        const progressWidth = Math.min((comp.change / 15) * (pageWidth - 2 * margin - 50), pageWidth - 2 * margin - 50);
        drawRect(margin, y, progressWidth, 10, '#10B981', 2);
        
        pdf.setTextColor(31, 41, 55);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(comp.name, margin + 4, y + 7);
        
        pdf.setTextColor(16, 185, 129);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`+${comp.change}%`, pageWidth - margin - 12, y + 7);
        
        y += 13;
      });
      y += 5;
      
      // === PAGE 2 ===
      pdf.addPage();
      y = margin;
      
      // Top Coaching Themes (moved to page 2)
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Coaching Themes', margin, y);
      y += 10;
      
      if (data.themes.length > 0) {
        const totalThemes = data.themes.reduce((sum, t) => sum + t.count, 0);
        const themeColors = ['#466FF6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
        
        data.themes.slice(0, 5).forEach((theme, i) => {
          const pct = Math.round((theme.count / totalThemes) * 100);
          const maxBarWidth = pageWidth - 2 * margin - 80;
          const barW = (pct / 100) * maxBarWidth;
          
          drawRect(margin, y, barW, 8, themeColors[i % themeColors.length], 2);
          
          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          
          // Full theme name (more space now)
          const displayName = theme.name.length > 40 ? theme.name.substring(0, 40) + '...' : theme.name;
          pdf.text(displayName, margin + maxBarWidth + 8, y + 6);
          
          pdf.setTextColor(107, 114, 128);
          pdf.text(`${pct}%`, pageWidth - margin - 8, y + 6);
          
          y += 12;
        });
      } else {
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(9);
        pdf.text('No theme data available', margin, y + 5);
        y += 12;
      }
      
      y += 8;
      
      // Testimonials Header
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('What Participants Are Saying', margin, y);
      y += 10;
      
      if (data.testimonials.length > 0) {
        data.testimonials.forEach((quote) => {
          // Calculate height needed
          pdf.setFontSize(9);
          const quoteLines = pdf.splitTextToSize(quote, pageWidth - 2 * margin - 20);
          const boxHeight = Math.min(quoteLines.length * 5 + 12, 50);
          
          drawRect(margin, y, pageWidth - 2 * margin, boxHeight, '#FEF3C7', 4);
          
          // Quote mark
          pdf.setTextColor(245, 158, 11);
          pdf.setFontSize(18);
          pdf.setFont('helvetica', 'bold');
          pdf.text('"', margin + 6, y + 12);
          
          // Quote text
          const quoteRgb = hexToRgb('#78350F');
          pdf.setTextColor(quoteRgb.r, quoteRgb.g, quoteRgb.b);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.text(quoteLines.slice(0, 6), margin + 16, y + 10);
          
          y += boxHeight + 8;
        });
      } else {
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(9);
        pdf.text('No testimonials available', margin, y + 5);
      }
      
      // Footer on page 2
      pdf.setTextColor(156, 163, 175);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated by Boon  •  Page 2 of 2', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Footer on page 1
      pdf.setPage(1);
      pdf.setTextColor(156, 163, 175);
      pdf.setFontSize(8);
      pdf.text('Generated by Boon  •  Page 1 of 2', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
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
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm w-full"
      >
        <FileDown className="w-4 h-4" />
        Export Report
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Generate Report</h2>
              <p className="text-sm text-gray-500 mt-1">
                Create a PDF summary of your coaching program's impact.
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
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
            
            {progress && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">{progress}</span>
              </div>
            )}
            
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
            
            <p className="text-xs text-gray-400 text-center mt-4">
              Includes: metrics, session trends, growth areas, themes & testimonials
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportGenerator;
