import React, { useState } from 'react';
import { Sparkles, Loader2, Download, RefreshCw, Building2, TrendingUp, Users, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ThemeCount {
  theme: string;
  count: number;
}

interface AIInsightsProps {
  companyName: string;
  companyId: string;
  programType: 'SCALE' | 'GROW';
  timeWindowDays: number; // 30, 90, 180, or 365
  // Session data
  totalSessions: number;
  uniqueParticipants: number;
  adoptionRate: number;
  avgSessionsPerUser: number;
  // Theme data
  themes: {
    leadership: ThemeCount[];
    communication: ThemeCount[];
    wellbeing: ThemeCount[];
    other: ThemeCount[];
  };
  // Survey data
  nps: number | null;
  coachSatisfaction: number | null;
  surveyCount: number;
  feedbackHighlights: string[];
  // Competency data (GROW only)
  competencyChanges?: { name: string; preScore: number; postScore: number; change: number }[];
  // Wellbeing data
  wellbeingBaseline?: { satisfaction: number; productivity: number; workLifeBalance: number };
  wellbeingCurrent?: { satisfaction: number; productivity: number; workLifeBalance: number };
}

const AIInsights: React.FC<AIInsightsProps> = ({
  companyName,
  companyId,
  programType,
  timeWindowDays,
  totalSessions,
  uniqueParticipants,
  adoptionRate,
  avgSessionsPerUser,
  themes,
  nps,
  coachSatisfaction,
  surveyCount,
  feedbackHighlights,
  competencyChanges,
  wellbeingBaseline,
  wellbeingCurrent
}) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyContext, setCompanyContext] = useState<string | null>(null);

  const buildInternalDataSummary = (): string => {
    const topLeadershipThemes = themes.leadership.slice(0, 5).map(t => `${t.theme} (${t.count} sessions)`).join(', ');
    const topWellbeingThemes = themes.wellbeing.slice(0, 5).map(t => `${t.theme} (${t.count} sessions)`).join(', ');
    const topCommunicationThemes = themes.communication.slice(0, 5).map(t => `${t.theme} (${t.count} sessions)`).join(', ');
    
    // Calculate date range for context
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeWindowDays);
    
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const timeWindowLabel = timeWindowDays === 30 ? 'Last 30 Days' 
      : timeWindowDays === 90 ? 'Last 90 Days (Quarter)'
      : timeWindowDays === 180 ? 'Last 6 Months'
      : 'Last 12 Months';
    
    const dateRangeStr = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    
    let summary = `
## Boon Coaching Program Data for ${companyName}

### Time Period: ${timeWindowLabel}
Date Range: ${dateRangeStr}

### Program Overview
- Program Type: ${programType}
- Total Coaching Sessions: ${totalSessions} (during this period)
- Unique Participants: ${uniqueParticipants}
- Adoption Rate: ${adoptionRate.toFixed(1)}%
- Average Sessions per Active User: ${avgSessionsPerUser.toFixed(1)}

### Coaching Session Themes (What employees are working on - THIS TIME PERIOD)
- Leadership & Management: ${topLeadershipThemes || 'No data'}
- Mental Well-being: ${topWellbeingThemes || 'No data'}
- Communication Skills: ${topCommunicationThemes || 'No data'}

### Satisfaction Metrics (PROGRAM-WIDE / ALL-TIME - not specific to this time period)
- Net Promoter Score (NPS): ${nps !== null ? nps : 'Not available'}
- Coach Satisfaction: ${coachSatisfaction !== null ? `${coachSatisfaction.toFixed(1)}/10` : 'Not available'}
- Total Survey Responses: ${surveyCount}
`;

    if (wellbeingBaseline && wellbeingCurrent) {
      const satChange = wellbeingCurrent.satisfaction - wellbeingBaseline.satisfaction;
      const prodChange = wellbeingCurrent.productivity - wellbeingBaseline.productivity;
      const wlbChange = wellbeingCurrent.workLifeBalance - wellbeingBaseline.workLifeBalance;
      
      const satPct = wellbeingBaseline.satisfaction > 0 ? ((satChange / wellbeingBaseline.satisfaction) * 100).toFixed(0) : 'N/A';
      const prodPct = wellbeingBaseline.productivity > 0 ? ((prodChange / wellbeingBaseline.productivity) * 100).toFixed(0) : 'N/A';
      const wlbPct = wellbeingBaseline.workLifeBalance > 0 ? ((wlbChange / wellbeingBaseline.workLifeBalance) * 100).toFixed(0) : 'N/A';
      
      summary += `
### Personal Effectiveness Gains (PROGRAM-WIDE / ALL-TIME - Baseline → Current, scale 1-10)
- Job Satisfaction: ${wellbeingBaseline.satisfaction.toFixed(1)} → ${wellbeingCurrent.satisfaction.toFixed(1)} (${satChange >= 0 ? '+' : ''}${satPct}% improvement)
- Productivity: ${wellbeingBaseline.productivity.toFixed(1)} → ${wellbeingCurrent.productivity.toFixed(1)} (${prodChange >= 0 ? '+' : ''}${prodPct}% improvement)
- Work-Life Balance: ${wellbeingBaseline.workLifeBalance.toFixed(1)} → ${wellbeingCurrent.workLifeBalance.toFixed(1)} (${wlbChange >= 0 ? '+' : ''}${wlbPct}% improvement)
`;
    }

    if (competencyChanges && competencyChanges.length > 0) {
      const topImprovements = competencyChanges
        .filter(c => c.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);
      
      if (topImprovements.length > 0) {
        summary += `
### Competency Growth (Pre → Post Assessment)
${topImprovements.map(c => `- ${c.name}: ${c.preScore.toFixed(1)} → ${c.postScore.toFixed(1)} (+${(c.change * 100).toFixed(0)}%)`).join('\n')}
`;
      }
    }

    if (feedbackHighlights.length > 0) {
      summary += `
### Sample Participant Feedback
${feedbackHighlights.slice(0, 5).map(f => `- "${f.substring(0, 200)}${f.length > 200 ? '...' : ''}"`).join('\n')}
`;
    }

    return summary;
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const internalData = buildInternalDataSummary();
      
      // Get the session for auth
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://nbwwqreqmxakevkwzmij.supabase.co'}/functions/v1/ai-generate-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            companyName,
            companyId,
            internalData
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate insights');
      }
      
      setInsights(data.insights);
      setCompanyContext(data.companyContext);
      
    } catch (err: any) {
      console.error('Error generating insights:', err);
      setError(err.message || 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  const downloadInsights = () => {
    if (!insights) return;
    
    const content = `# AI-Generated Coaching Insights
## ${companyName}
Generated: ${new Date().toLocaleDateString()}

${insights}

---
${companyContext ? `\n## Company Context Used\n${companyContext}\n` : ''}
---
Generated by Boon Health Analytics powered by Claude AI
`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/\s+/g, '_')}_AI_Insights_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">AI-Powered Insights</h3>
            <p className="text-sm text-gray-500">Executive summary with recommendations</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {insights && (
            <button
              onClick={downloadInsights}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            onClick={generateInsights}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : insights ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Insights
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Failed to generate insights</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {!insights && !loading && !error && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Ready to Generate Insights</h4>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Click "Generate Insights" to analyze your coaching data combined with recent company news and industry context.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Company context
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Theme analysis
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Engagement data
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Feedback synthesis
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Data...</h4>
          <p className="text-sm text-gray-500">
            Searching for company context and generating executive insights...
          </p>
          <p className="text-xs text-gray-400 mt-2">
            This may take 15-30 seconds
          </p>
        </div>
      )}

      {insights && !loading && (
        <div className="prose prose-indigo max-w-none">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-indigo-100">
            {insights.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0 border-b border-gray-100 pb-2">{line.replace('## ', '')}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={i} className="text-lg font-semibold text-gray-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
              }
              if (line.match(/^\d+\.\s+\*\*/)) {
                // Numbered item with bold title
                const match = line.match(/^(\d+\.)\s+\*\*(.+?)\*\*(.*)$/);
                if (match) {
                  return (
                    <div key={i} className="mb-4 pl-4 border-l-3 border-indigo-300 bg-indigo-50/50 p-3 rounded-r-lg">
                      <span className="font-bold text-indigo-700">{match[1]} {match[2]}</span>
                      <span className="text-gray-700">{match[3]}</span>
                    </div>
                  );
                }
              }
              if (line.match(/^\d+\./)) {
                return <p key={i} className="text-gray-700 mb-3 pl-4 border-l-2 border-indigo-200">{line}</p>;
              }
              if (line.startsWith('- ')) {
                return <p key={i} className="text-gray-700 mb-2 pl-4 flex items-start gap-2"><span className="text-indigo-500">•</span>{line.replace('- ', '')}</p>;
              }
              if (line.trim() === '') {
                return <div key={i} className="h-2" />;
              }
              return <p key={i} className="text-gray-700 mb-3">{line}</p>;
            })}
          </div>
          
          {companyContext && companyContext !== 'No external context available.' && (
            <details className="mt-4">
              <summary className="text-sm text-indigo-600 cursor-pointer hover:text-indigo-800 font-medium">
                View company context used in analysis
              </summary>
              <div className="mt-2 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-200">
                {companyContext}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default AIInsights;