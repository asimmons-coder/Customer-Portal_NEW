import React, { useState } from 'react';
import { Sparkles, Loader2, Download, RefreshCw, Building2, TrendingUp, Users, MessageSquare, AlertCircle, Target } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface CompetencyGrowth {
  name: string;
  avgPre: number;
  avgPost: number;
  pct: number;
}

interface AIInsightsGrowProps {
  companyName: string;
  companyId: string;
  cohortName: string;
  // Program timing
  programStartDate: Date | null;
  programEndDate?: Date | null;
  progressPct: number;
  isCompleted: boolean;
  // Participants
  totalParticipants: number;
  participantsWithScores: number;
  // Session data
  completedSessions: number;
  targetSessions: number;
  // Competency data
  competencyGrowth: CompetencyGrowth[];
  overallGrowthPct: number;
  // Focus areas (what participants wanted to work on)
  topFocusAreas: { topic: string; count: number; pct: number }[];
  // Session themes (what they actually worked on)
  sessionThemes: { topic: string; count: number; pct: number }[];
  // Survey data
  nps: number | null;
  coachSatisfaction: number | null;
  // Baseline data
  baselineMetrics?: { satisfaction: number; productivity: number; balance: number };
  // Testimonials
  feedbackHighlights: string[];
}

const AIInsightsGrow: React.FC<AIInsightsGrowProps> = ({
  companyName,
  companyId,
  cohortName,
  programStartDate,
  programEndDate,
  progressPct,
  isCompleted,
  totalParticipants,
  participantsWithScores,
  completedSessions,
  targetSessions,
  competencyGrowth,
  overallGrowthPct,
  topFocusAreas,
  sessionThemes,
  nps,
  coachSatisfaction,
  baselineMetrics,
  feedbackHighlights
}) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyContext, setCompanyContext] = useState<string | null>(null);

  // Calculate program phase
  const getProgramPhase = (): { phase: string; weeksIn: number; description: string } => {
    // For "All Cohorts" view, don't show a specific phase
    if (cohortName === 'All Cohorts' || !programStartDate) {
      return { phase: 'Overview', weeksIn: 0, description: 'Aggregated view across all cohorts' };
    }
    
    const now = new Date();
    const start = new Date(programStartDate);
    const weeksIn = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    if (isCompleted || progressPct >= 95) {
      return { phase: 'Completed', weeksIn, description: 'Program has concluded with full pre/post assessment data' };
    }
    if (weeksIn <= 2) {
      return { phase: 'Launch', weeksIn, description: 'Program just started, baseline data being collected' };
    }
    if (weeksIn <= 4) {
      return { phase: 'Early', weeksIn, description: 'Early stages, initial coaching sessions underway' };
    }
    if (progressPct < 50) {
      return { phase: 'Mid-Early', weeksIn, description: 'Building momentum, coaching themes emerging' };
    }
    if (progressPct < 75) {
      return { phase: 'Mid-Program', weeksIn, description: 'Active development phase, skill building in progress' };
    }
    return { phase: 'Late', weeksIn, description: 'Approaching completion, consolidating learnings' };
  };

  const buildInternalDataSummary = (): string => {
    const { phase, weeksIn, description } = getProgramPhase();
    
    const formatDate = (d: Date | null) => d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set';
    
    let summary = `
## Boon GROW Leadership Development Program: ${cohortName}
### Company: ${companyName}

### Program Phase: ${phase}
- ${description}
- Weeks since launch: ${weeksIn}
- Program start date: ${formatDate(programStartDate)}
${programEndDate ? `- Program end date: ${formatDate(programEndDate)}` : ''}
- Overall progress: ${progressPct}% complete
- Sessions completed: ${completedSessions} of ${targetSessions} target

### Participants
- Total enrolled: ${totalParticipants}
- Participants with pre/post assessments: ${participantsWithScores}
`;

    // Competency growth (the key GROW metric)
    if (competencyGrowth.length > 0 && overallGrowthPct > 0) {
      summary += `
### Leadership Competency Growth (Pre → Post Assessment)
**Overall improvement: +${overallGrowthPct.toFixed(0)}%**

Top competency gains:
${competencyGrowth.slice(0, 5).map(c => `- ${c.name}: ${c.avgPre.toFixed(1)} → ${c.avgPost.toFixed(1)} (+${c.pct.toFixed(0)}% improvement)`).join('\n')}
`;
    } else if (phase === 'Launch' || phase === 'Early') {
      summary += `
### Leadership Competency Growth
Post-assessment data not yet available (program in ${phase.toLowerCase()} phase). Baseline assessments collected.
`;
    }

    // Focus areas (what they wanted to work on)
    if (topFocusAreas.length > 0) {
      summary += `
### Participant Focus Areas (Selected at program start)
${topFocusAreas.slice(0, 5).map(f => `- ${f.topic}: ${f.count} participants (${f.pct.toFixed(0)}%)`).join('\n')}
`;
    }

    // Session themes (what they actually worked on)
    if (sessionThemes.length > 0) {
      summary += `
### Coaching Session Themes (What participants are working on)
${sessionThemes.slice(0, 5).map(t => `- ${t.topic}: ${t.count} sessions (${t.pct.toFixed(0)}% of sessions)`).join('\n')}
`;
    }

    // Satisfaction metrics (program-wide)
    summary += `
### Satisfaction Metrics (Program-wide)
- Net Promoter Score (NPS): ${nps !== null ? nps : 'Not yet available'}
- Coach Satisfaction: ${coachSatisfaction !== null ? `${coachSatisfaction}/10` : 'Not yet available'}
`;

    // Baseline wellbeing (if available)
    if (baselineMetrics && (baselineMetrics.satisfaction > 0 || baselineMetrics.productivity > 0)) {
      summary += `
### Baseline Wellbeing (Collected at program start, scale 1-10)
- Job Satisfaction: ${baselineMetrics.satisfaction.toFixed(1)}
- Productivity: ${baselineMetrics.productivity.toFixed(1)}
- Work-Life Balance: ${baselineMetrics.balance.toFixed(1)}
`;
    }

    // Feedback highlights
    if (feedbackHighlights.length > 0) {
      summary += `
### Participant Feedback Highlights
${feedbackHighlights.slice(0, 3).map(f => `- "${f.substring(0, 200)}${f.length > 200 ? '...' : ''}"`).join('\n')}
`;
    }

    return summary;
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const internalData = buildInternalDataSummary();
      const { phase } = getProgramPhase();
      
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
            internalData,
            programType: 'GROW',
            programPhase: phase
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
    
    const content = `# AI-Generated Leadership Development Insights
## ${companyName} - ${cohortName}
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
    a.download = `${companyName.replace(/\s+/g, '_')}_${cohortName.replace(/\s+/g, '_')}_Insights_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { phase } = getProgramPhase();

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">AI-Powered Insights</h3>
            <p className="text-sm text-gray-500">
              {cohortName} • {phase} Phase
            </p>
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
            Analyze your GROW program data with company context to generate executive-ready insights about leadership development progress.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              Competency growth
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Skill development
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Participant progress
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Company context
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Program Data...</h4>
          <p className="text-sm text-gray-500">
            Evaluating competency growth and generating executive insights...
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

export default AIInsightsGrow;