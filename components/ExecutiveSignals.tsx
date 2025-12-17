import React, { useEffect, useState, useMemo } from 'react';
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
  accountName?: string; 
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

// Helper to safely access process.env.API_KEY in potentially brittle environments
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Silence errors to handle missing process gracefully
  }
  return undefined;
};

const SYSTEM_PROMPT = `
# Boon Insights AI

You AUDIT coaching program reality against stated intent — comparing what IS happening vs what SHOULD be happening.

## MANDATORY RULES

Program Context is GROUND TRUTH. You must:
1. Reference at least one declared focus area
2. State whether coaching themes ALIGN or DIVERGE from stated goals
3. Reflect program phase (Early/Mid/Late) in your recommendations

## Phase Guidance
- **Early (0-33%):** Onboarding momentum, initial engagement, baseline establishment
- **Mid (34-66%):** Progress tracking, theme emergence, mid-course corrections  
- **Late (67-100%):** Completion coverage, consolidation, assessment readiness

## Output Format

**Headline:** One sentence — the key takeaway specific to this program's goals.
**Insights (3-4 bullets):** Bulleted insights, each 1–2 sentences.
**Recommendations (1-2 bullets):** Actionable recommendations starting with a verb.
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

  // Memoize API Key to ensure hooks stable
  const apiKey = useMemo(() => getApiKey(), []);

  useEffect(() => {
    const fetchProgramConfig = async () => {
      if (!accountName) return;
      
      try {
        let { data: configData, error: configError } = await supabase
          .from('program_config')
          .select('*')
          .eq('account_name', accountName)
          .single();
        
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
    if (!apiKey) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const generateSignals = async () => {
      const hasData = data || (sessions && sessions.length > 0) || (employees && employees.length > 0);
      
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
        const ai = new GoogleGenAI({ apiKey });
        
        const safeStringify = (obj: any) => {
          const cache = new Set();
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (cache.has(value)) return;
              cache.add(value);
            }
            return value;
          });
        };

        let programContextSection = '';
        if (programConfig) {
          programContextSection = `
PROGRAM CONTEXT (GROUND TRUTH):
Account: ${programConfig.account_name} | Type: ${programConfig.program_type || 'N/A'}
Notes: ${programConfig.context_notes || 'None'}
---
`;
        }

        const payload = {
          context,
          selectedCohort,
          summary: data ? data : {
            sessionCount: sessions?.length || 0,
            employeeCount: employees?.length || 0
          }
        };

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            insights: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["headline", "insights", "recommendations"]
        };

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `${programContextSection}Analyze: ${safeStringify(payload)}`,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });

        if (mounted && response.text) {
          try {
            const result = JSON.parse(response.text.trim());
            setSignals(result);
          } catch (parseErr) {
            setSignals(null);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || "Analysis unavailable");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    generateSignals();
    return () => { mounted = false; };
  }, [sessions, employees, selectedCohort, context, data, programConfig, apiKey]);

  // Return early ONLY after hooks are declared to avoid Rules of Hooks violations
  if (!apiKey) return null;

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
        <div className="h-24 bg-gray-50 animate-pulse rounded-lg"></div>
      ) : signals ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-boon-blue/5 p-4 rounded-lg border border-boon-blue/10">
             <h4 className="text-lg font-bold text-boon-dark leading-snug">{signals.headline}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-3">
               <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-gray-100">
                 <TrendingUp className="w-4 h-4 text-boon-blue" /> Key Insights
               </h5>
               <ul className="space-y-2">
                 {signals.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-boon-blue rounded-full shrink-0"></span>
                       {insight}
                    </li>
                 ))}
               </ul>
            </div>

            <div className="space-y-3">
               <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-gray-100">
                 <Lightbulb className="w-4 h-4 text-boon-yellow" /> Recommendations
               </h5>
               <ul className="space-y-2">
                 {signals.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-boon-yellow rounded-full shrink-0"></span>
                       {rec}
                    </li>
                 ))}
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