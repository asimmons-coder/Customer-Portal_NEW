import React, { useEffect, useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from '../lib/supabaseClient';
import { SessionWithEmployee, CompetencyScore, SurveyResponse, WelcomeSurveyEntry, Employee } from '../types';
import { Loader2, AlertCircle, Sparkles, TrendingUp, Lightbulb } from 'lucide-react';

interface ExecutiveSignalsProps {
  sessions?: SessionWithEmployee[];
  competencies?: CompetencyScore[];
  surveys?: SurveyResponse[];
  baselineData?: WelcomeSurveyEntry[];
  employees?: Employee[];
  selectedCohort?: string;
  accountName?: string; // Add this to pass the current account/client name
  context?: string;
  data?: any;
}

interface SignalsResponse {
  headline: string;
  insights: string[];
  recommendations: string[];
}

interface ProgramConfig {
  account_name: string;
  program_type: string;
  sessions_per_employee: number;
  program_start_date: string;
  program_end_date: string;
  program_status: string;
  context_notes: string;
}

const SYSTEM_PROMPT = `
# Boon Insights AI

You AUDIT coaching program reality against stated intent — comparing what IS happening vs what SHOULD be happening.

## MANDATORY RULES

Program Context is GROUND TRUTH. You must:
1. Reference at least one declared focus area
2. State whether coaching themes ALIGN or DIVERGE from stated goals
3. Reflect program phase (Early/Mid/Late) in your recommendations
4. Be specific to THIS program — generic statements are unacceptable

## Phase Guidance
- **Early (0-33%):** Onboarding momentum, initial engagement, baseline establishment
- **Mid (34-66%):** Progress tracking, theme emergence, mid-course corrections  
- **Late (67-100%):** Completion coverage, consolidation, assessment readiness, closing gaps

## Output Format

**Headline:** One sentence — the key takeaway specific to this program's goals.

**Insights (3-4 bullets):** 
- Lead with alignment check: Are sessions addressing stated focus areas?
- Be specific with numbers
- No fluff

**Recommendations (1-2 bullets):**
- Start with verb
- Relevant to program phase

Keep total output under 250 words. Every sentence must earn its place.
`;

const ExecutiveSignals: React.FC<ExecutiveSignalsProps> = ({
  sessions,
  competencies,
  surveys,
  baselineData,
  employees,
  selectedCohort = 'All Cohorts',
  accountName,
  context = 'Dashboard',
  data
}) => {
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [programConfig, setProgramConfig] = useState<ProgramConfig | null>(null);

  // Fetch program config when accountName changes
  useEffect(() => {
    const fetchProgramConfig = async () => {
      if (!accountName) return;
      
      try {
        // Try exact match first
        let { data: configData, error: configError } = await supabase
          .from('program_config')
          .select('*')
          .eq('account_name', accountName)
          .single();
        
        // If no exact match, try a fuzzy match
        if (configError || !configData) {
          const { data: fuzzyData } = await supabase
            .from('program_config')
            .select('*')
            .ilike('account_name', `%${accountName}%`)
            .limit(1);
          
          if (fuzzyData && fuzzyData.length > 0) {
            configData = fuzzyData[0];
          }
        }
        
        if (configData) {
          setProgramConfig(configData);
        }
      } catch (err) {
        console.error('Error fetching program config:', err);
      }
    };

    fetchProgramConfig();
  }, [accountName]);

  useEffect(() => {
    // According to guidelines, API key must be accessed via process.env.API_KEY
    if (!process.env.API_KEY) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const generateSignals = async () => {
      // Check if we have any data to analyze
      const hasData = data || (sessions && sessions.length > 0) || (employees && employees.length > 0) || (competencies && competencies.length > 0);
      
      if (!hasData) {
        if (mounted) {
          setLoading(false);
          setSignals(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Helper to safely stringify potentially circular or large objects
        const safeStringify = (obj: any) => {
          const cache = new Set();
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (cache.has(value)) {
                return;
              }
              cache.add(value);
            }
            if (typeof value === 'string' && value.length > 2000) {
              return value.substring(0, 2000) + '...';
            }
            if (key.startsWith('_')) return undefined;
            return value;
          });
        };

        // Build program context section
        let programContextSection = '';
        if (programConfig) {
          const today = new Date();
          const startDate = programConfig.program_start_date ? new Date(programConfig.program_start_date) : null;
          const endDate = programConfig.program_end_date ? new Date(programConfig.program_end_date) : null;
          
          let programPhase = 'Unknown';
          let progressPercent = 0;
          let timeContext = '';
          
          if (startDate && endDate) {
            const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            const elapsedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            const remainingDays = (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            progressPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
            
            // Determine phase
            if (progressPercent <= 33) {
              programPhase = 'Early';
            } else if (progressPercent <= 66) {
              programPhase = 'Mid';
            } else {
              programPhase = 'Late';
            }
            
            if (remainingDays > 0) {
              timeContext = `${Math.round(progressPercent)}% through timeline, ${Math.round(remainingDays)} days remaining`;
            } else {
              timeContext = `Program ended ${Math.abs(Math.round(remainingDays))} days ago`;
            }
          }

          programContextSection = `
PROGRAM CONTEXT (GROUND TRUTH):
Account: ${programConfig.account_name} | Type: ${programConfig.program_type || 'N/A'} | Phase: ${programPhase} (${timeContext})
Sessions Target: ${programConfig.sessions_per_employee || 'N/A'} per employee

FOCUS AREAS & NOTES:
${programConfig.context_notes || 'None'}

---
`;
        }

        const payload = {
          context,
          selectedCohort,
          accountName,
          summary: data ? data : {
            sessionCount: sessions?.length || 0,
            employeeCount: employees?.length || 0,
            surveyCount: surveys?.length || 0,
            competencyCount: competencies?.length || 0,
            recentSessionsSample: sessions?.slice(0, 5),
            competencySample: competencies?.slice(0, 5)
          }
        };

        const jsonPayload = safeStringify(payload);

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: "One sentence summary capturing the key takeaway." },
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3–5 key insights. Bullets, each 1–2 sentences."
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "1–2 recommendations. Bullets starting with a verb."
            }
          },
          required: ["headline", "insights", "recommendations"]
        };

        const userPrompt = `${programContextSection}Analyze the following dataset and generate insights based on the system instructions.\n\nDATA CONTEXT:\n${jsonPayload}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });

        if (mounted) {
          if (response.text) {
            let cleanText = response.text.trim();
            // Basic cleanup if model wraps in code blocks despite MIME type
            if (cleanText.startsWith('```json')) {
              cleanText = cleanText.replace(/^```json\s?/, '').replace(/\s?```$/, '');
            } else if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```\s?/, '').replace(/\s?```$/, '');
            }

            try {
              const result = JSON.parse(cleanText);
              setSignals({
                headline: result.headline || "Analysis Complete",
                insights: result.insights || [],
                recommendations: result.recommendations || []
              });
            } catch (parseErr) {
              console.error("JSON Parse Error:", parseErr);
              setSignals(null);
            }
          } else {
            setSignals(null);
          }
        }
      } catch (err: any) {
        console.error("Executive Signals Error:", err);
        if (mounted) {
          const msg = err.message || '';
          if (msg.includes('429')) setError("High traffic - Analysis temporarily unavailable");
          else if (msg.includes('API key')) setError("Configuration Error: Invalid API Key");
          else if (msg.includes('404')) setError("Model unavailable");
          else setError(msg || "Analysis unavailable");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    generateSignals();

    return () => { mounted = false; };
  }, [sessions, competencies, surveys, baselineData, employees, selectedCohort, context, data, programConfig]);

  // Use process.env.API_KEY check
  if (!process.env.API_KEY) {
    return null;
  }

  if (error) {
    return (
      <div className="bg-white border border-red-100 rounded-xl p-6 mb-8 shadow-sm">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gray-400" /> Boon Insights AI
        </h3>
        <p className="text-sm text-red-400 italic flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm transition-all duration-300">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6 flex items-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-boon-blue" /> : <Sparkles className="w-4 h-4 text-boon-blue" />}
        Boon Insights AI
      </h3>
      
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-gray-100 rounded-lg w-full mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-5/6"></div>
              <div className="h-3 bg-gray-100 rounded w-4/5"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      ) : signals ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* Headline */}
          <div className="bg-boon-blue/5 p-4 rounded-lg border border-boon-blue/10">
             <h4 className="text-lg font-bold text-boon-dark leading-snug">{signals.headline}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            {/* Key Insights */}
            <div className="space-y-3">
               <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-gray-100">
                 <TrendingUp className="w-4 h-4 text-boon-blue" /> Key Insights
               </h5>
               <ul className="space-y-3">
                 {signals.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-boon-blue rounded-full shrink-0"></span>
                       {insight}
                    </li>
                 ))}
                 {signals.insights.length === 0 && (
                   <li className="text-sm text-gray-400 italic">No significant insights detected.</li>
                 )}
               </ul>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
               <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-gray-100">
                 <Lightbulb className="w-4 h-4 text-boon-yellow" /> Recommendations
               </h5>
               <ul className="space-y-3">
                 {signals.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-boon-yellow rounded-full shrink-0"></span>
                       {rec}
                    </li>
                 ))}
                 {signals.recommendations.length === 0 && (
                   <li className="text-sm text-gray-400 italic">No immediate recommendations.</li>
                 )}
               </ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm italic">Analysis could not be generated at this time.</p>
      )}
    </div>
  );
};

export default ExecutiveSignals;