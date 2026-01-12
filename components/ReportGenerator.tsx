import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getDashboardSessions, getCompetencyScores, getSurveyResponses, getProgramConfig, CompanyFilter, buildCompanyFilter } from '../lib/dataFetcher';
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
  programsForPeriod: { name: string; startDate: string }[];
  programPeriodLabel: string;
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
      // Get company info from auth
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || '';
      const ADMIN_EMAILS = ['asimmons@boon-health.com', 'alexsimm95@gmail.com', 'hello@boon-health.com'];
      const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
      
      let company = session?.user?.app_metadata?.company || '';
      let companyId = session?.user?.app_metadata?.company_id || '';
      let accName = session?.user?.app_metadata?.account_name || '';
      
      // Check for admin override
      if (isAdmin) {
        try {
          const stored = localStorage.getItem('boon_admin_company_override');
          if (stored) {
            const override = JSON.parse(stored);
            company = override.name;
            companyId = override.id || companyId;
            accName = override.account_name || accName;
          }
        } catch {}
      }

      // Build company filter for query
      let query = supabase
        .from('session_tracking')
        .select('program_title');
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else if (accName || company) {
        const companyBase = (accName || company.split(' - ')[0]).replace(/\s+(SCALE|GROW|EXEC)$/i, '').trim();
        query = query.ilike('account_name', `%${companyBase}%`);
      }

      const { data } = await query;
      
      if (data) {
        const uniquePrograms = [...new Set(
          data.map(p => p.program_title).filter(Boolean)
        )] as string[];
        setPrograms(uniquePrograms.sort());
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const fetchReportData = async (): Promise<ReportData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || '';
    const ADMIN_EMAILS = ['asimmons@boon-health.com', 'alexsimm95@gmail.com', 'hello@boon-health.com'];
    const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase());
    
    let company = session?.user?.app_metadata?.company || '';
    let companyId = session?.user?.app_metadata?.company_id || '';
    let accName = session?.user?.app_metadata?.account_name || '';
    
    // Check for admin override
    if (isAdmin) {
      try {
        const stored = localStorage.getItem('boon_admin_company_override');
        if (stored) {
          const override = JSON.parse(stored);
          company = override.name;
          companyId = override.id || companyId;
          accName = override.account_name || accName;
        }
      } catch {}
    }

    // Build company filter using helper
    const companyFilter = buildCompanyFilter(companyId, accName, company);

    console.log('ReportGenerator using company filter:', companyFilter);
    
    // Calculate date range filter
    const now = new Date();
    let startDate: Date | null = null;
    
    if (dateRange === 'ytd') {
      startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    } else if (dateRange === 'q4') {
      startDate = new Date(2024, 9, 1); // Oct 1, 2024
    } else if (dateRange === 'q3') {
      startDate = new Date(2024, 6, 1); // Jul 1, 2024
    }
    
    const matchesProgram = (programTitle: string | undefined | null): boolean => {
      if (selectedProgram === 'all') return true;
      if (!programTitle) return false;
      return programTitle === selectedProgram;
    };
    
    const matchesDateRange = (dateStr: string | undefined | null): boolean => {
      if (!startDate) return true; // 'all' time
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= startDate;
    };
    
    // Fetch session data - already filtered by company at query level
    setProgress('Fetching session data...');
    const allSessions = await getDashboardSessions(companyFilter);
    const sessions = allSessions.filter(s => 
      matchesProgram((s as any).program_title) &&
      matchesDateRange((s as any).session_date)
    );
    
    const completedSessions = sessions.filter(s => (s as any).status === 'Completed');
    const uniqueEmployees = new Set(sessions.map(s => (s as any).employee_name?.toLowerCase()).filter(Boolean)).size;
    
    // Calculate monthly trend (last 6 months)
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
    
    // Fetch competency scores - already filtered by company at query level
    setProgress('Analyzing competency growth...');
    const allScores = await getCompetencyScores(companyFilter);
    const scores = allScores.filter(c => 
      matchesProgram((c as any).program_title)
    );
    
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
    
    // Fetch satisfaction data - already filtered by company at query level
    setProgress('Gathering satisfaction scores...');
    const allSurveys = await getSurveyResponses(companyFilter);
    const surveys = allSurveys.filter(s => 
      matchesProgram((s as any).program_title)
    );
    
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
    
    // Fetch programs based on date range
    setProgress('Loading program data...');
    const allPrograms = await getProgramConfig();
    const programsFiltered = allPrograms.filter(p => matchesCompany((p as any).account_name, (p as any).program_title));
    
    // Filter programs based on selected date range
    let programsForPeriod: { name: string; startDate: string }[] = [];
    let programPeriodLabel = '';
    
    if (selectedProgram === 'all') {
      if (dateRange === 'all') {
        // All time - show all programs
        programsForPeriod = programsFiltered
          .filter(p => (p as any).program_start_date)
          .map(p => ({
            name: (p as any).program_title || 'Unknown Program',
            startDate: (p as any).program_start_date
          }));
        programPeriodLabel = 'All Programs';
      } else if (dateRange === 'ytd') {
        // Year to date - show 2025 programs only
        programsForPeriod = programsFiltered
          .filter(p => {
            const startDate = (p as any).program_start_date;
            if (!startDate) return false;
            return new Date(startDate).getFullYear() === now.getFullYear();
          })
          .map(p => ({
            name: (p as any).program_title || 'Unknown Program',
            startDate: (p as any).program_start_date
          }));
        programPeriodLabel = `Programs Launched in ${now.getFullYear()}`;
      } else if (dateRange === 'q4') {
        // Q4 2024
        programsForPeriod = programsFiltered
          .filter(p => {
            const startDate = (p as any).program_start_date;
            if (!startDate) return false;
            const d = new Date(startDate);
            return d.getFullYear() === 2024 && d.getMonth() >= 9; // Oct-Dec
          })
          .map(p => ({
            name: (p as any).program_title || 'Unknown Program',
            startDate: (p as any).program_start_date
          }));
        programPeriodLabel = 'Programs Launched in Q4 2024';
      } else if (dateRange === 'q3') {
        // Q3 2024
        programsForPeriod = programsFiltered
          .filter(p => {
            const startDate = (p as any).program_start_date;
            if (!startDate) return false;
            const d = new Date(startDate);
            return d.getFullYear() === 2024 && d.getMonth() >= 6 && d.getMonth() <= 8; // Jul-Sep
          })
          .map(p => ({
            name: (p as any).program_title || 'Unknown Program',
            startDate: (p as any).program_start_date
          }));
        programPeriodLabel = 'Programs Launched in Q3 2024';
      }
      
      // Sort by start date
      programsForPeriod.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }
    // If single program selected, programsForPeriod stays empty (won't show section)
    
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
      testimonials: allTestimonials,
      programsForPeriod,
      programPeriodLabel
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
      
      // Header - compact
      drawRect(0, 0, pageWidth, 32, '#466FF6');
      
      // Load and add Boon logo (left side)
      const loadImageAsBase64 = (url: string): Promise<string | null> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };
      
      // Try to load Boon logo
      try {
        const boonLogoData = await loadImageAsBase64('https://storage.googleapis.com/boon-public-assets/Wordmark_White.png');
        if (boonLogoData) {
          pdf.addImage(boonLogoData, 'PNG', margin, 8, 28, 14);
        } else {
          // Fallback to text
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('boon', margin, 20);
        }
      } catch {
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('boon', margin, 20);
      }
      
      // Try to load client logo (right side)
      if (clientLogo) {
        try {
          const clientLogoData = await loadImageAsBase64(clientLogo);
          if (clientLogoData) {
            pdf.addImage(clientLogoData, 'PNG', pageWidth - margin - 25, 6, 25, 20);
          }
        } catch {
          // Skip if fails
        }
      }
      
      // Title (centered)
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Coaching Impact Report', pageWidth / 2, 13, { align: 'center' });
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(`${companyName || ''}  •  ${today}`, pageWidth / 2, 23, { align: 'center' });
      
      y = 40;
      
      // Programs section - compact
      if (data.programsForPeriod.length > 0 && data.programPeriodLabel) {
        pdf.setTextColor(107, 114, 128);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${data.programPeriodLabel}:`, margin, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(70, 111, 246);
        const programNames = data.programsForPeriod.map(p => p.name).join('  •  ');
        const programLines = pdf.splitTextToSize(programNames, pageWidth - 2 * margin);
        pdf.text(programLines, margin, y + 4);
        y += (programLines.length * 3.5) + 8;
      }
      
      // Key Metrics - smaller cards
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Metrics', margin, y);
      y += 6;
      
      const cardWidth = (pageWidth - 2 * margin - 12) / 4;
      const cardHeight = 22;
      const metrics = [
        { label: 'Sessions', value: data.sessions.completed.toString(), color: '#466FF6' },
        { label: 'Participants', value: data.sessions.employees.toString(), color: '#10B981' },
        { label: 'NPS Score', value: `+${data.satisfaction.nps}`, color: '#8B5CF6' },
        { label: 'Coach Rating', value: `${data.satisfaction.csat}/10`, color: '#F59E0B' }
      ];
      
      metrics.forEach((metric, i) => {
        const x = margin + i * (cardWidth + 4);
        drawRect(x, y, cardWidth, cardHeight, metric.color, 3);
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(metric.value, x + cardWidth / 2, y + 10, { align: 'center' });
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(metric.label, x + cardWidth / 2, y + 17, { align: 'center' });
      });
      y += cardHeight + 8;
      
      // Session Trend Chart - smaller
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Session Trend (Last 6 Months)', margin, y);
      y += 5;
      
      const chartHeight = 28;
      const chartWidth = pageWidth - 2 * margin;
      const barSpacing = chartWidth / 6;
      const singleBarWidth = 16;
      const maxCount = Math.max(...data.sessions.monthlyTrend.map(m => m.count), 1);
      
      drawRect(margin, y, chartWidth, chartHeight, '#F9FAFB', 3);
      
      data.sessions.monthlyTrend.forEach((m, i) => {
        const barHeight = (m.count / maxCount) * (chartHeight - 14);
        const centerX = margin + (i * barSpacing) + (barSpacing / 2);
        const barX = centerX - (singleBarWidth / 2);
        const barY = y + chartHeight - 8 - barHeight;
        
        if (barHeight > 0) {
          drawRect(barX, barY, singleBarWidth, barHeight, '#466FF6', 2);
        }
        
        if (m.count > 0) {
          pdf.setTextColor(70, 111, 246);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.text(m.count.toString(), centerX, barY - 1, { align: 'center' });
        }
        
        pdf.setTextColor(107, 114, 128);
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.text(m.month, centerX, y + chartHeight - 2, { align: 'center' });
      });
      y += chartHeight + 8;
      
      // Top Areas of Growth - compact
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Areas of Growth', margin, y);
      y += 6;
      
      data.impact.topCompetencies.forEach((comp) => {
        drawRect(margin, y, pageWidth - 2 * margin, 8, '#F3F4F6', 2);
        const progressWidth = Math.min((comp.change / 15) * (pageWidth - 2 * margin - 40), pageWidth - 2 * margin - 40);
        drawRect(margin, y, progressWidth, 8, '#10B981', 2);
        
        pdf.setTextColor(31, 41, 55);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(comp.name, margin + 3, y + 6);
        
        pdf.setTextColor(16, 185, 129);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`+${comp.change}%`, pageWidth - margin - 10, y + 6);
        
        y += 10;
      });
      y += 6;
      
      // Top Coaching Themes - on page 1
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Coaching Themes', margin, y);
      y += 6;
      
      if (data.themes.length > 0) {
        const totalThemes = data.themes.reduce((sum, t) => sum + t.count, 0);
        const themeColors = ['#466FF6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
        const barMaxWidth = pageWidth - 2 * margin - 45;
        
        data.themes.slice(0, 5).forEach((theme, i) => {
          const pct = Math.round((theme.count / totalThemes) * 100);
          const barW = (pct / 100) * barMaxWidth;
          
          // Theme name
          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          const displayName = theme.name.length > 40 ? theme.name.substring(0, 40) + '...' : theme.name;
          pdf.text(displayName, margin, y);
          y += 4;
          
          // Bars
          drawRect(margin, y, barMaxWidth, 5, '#E5E7EB', 2);
          if (barW > 0) {
            drawRect(margin, y, barW, 5, themeColors[i % themeColors.length], 2);
          }
          
          // Percentage
          const rgb = hexToRgb(themeColors[i % themeColors.length]);
          pdf.setTextColor(rgb.r, rgb.g, rgb.b);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text(`${pct}%`, pageWidth - margin, y + 4, { align: 'right' });
          
          y += 9;
        });
      }
      
      // === PAGE 2 - Testimonials only ===
      pdf.addPage();
      y = margin;
      
      // Testimonials Header
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('What Participants Are Saying', margin, y);
      y += 8;
      
      const footerSpace = 20;
      
      if (data.testimonials.length > 0) {
        data.testimonials.forEach((quote) => {
          pdf.setFontSize(8);
          const quoteLines = pdf.splitTextToSize(quote, pageWidth - 2 * margin - 20);
          const boxHeight = Math.min(quoteLines.length * 3.5 + 10, 38);
          
          // Check if we need a new page (shouldn't happen with 5 quotes on full page)
          if (y + boxHeight > pageHeight - footerSpace) {
            pdf.addPage();
            y = margin;
            pdf.setTextColor(31, 41, 55);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('What Participants Are Saying (continued)', margin, y);
            y += 8;
          }
          
          drawRect(margin, y, pageWidth - 2 * margin, boxHeight, '#FEF3C7', 3);
          
          // Quote mark
          pdf.setTextColor(245, 158, 11);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('"', margin + 4, y + 8);
          
          // Quote text
          const quoteRgb = hexToRgb('#78350F');
          pdf.setTextColor(quoteRgb.r, quoteRgb.g, quoteRgb.b);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'italic');
          pdf.text(quoteLines.slice(0, 8), margin + 12, y + 6);
          
          y += boxHeight + 4;
        });
      } else {
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(9);
        pdf.text('No testimonials available', margin, y + 5);
      }
      
      // Add footer to all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setTextColor(156, 163, 175);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Generated by Boon  •  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
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