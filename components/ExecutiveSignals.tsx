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

const SYSTEM_PROMPT = `
# Boon Insights AI
You AUDIT coaching program reality against stated intent — comparing what IS happening vs what SHOULD be happening.
Output Headline (one sentence), Insights (3-4 bullets), and Recommendations (1-2 bullets).
Be specific with numbers. Keep total output under 250 words.
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

  // Safe API Key access - ensure hooks are called unconditionally above this
  const apiKey = useMemo(() => {
    try {
      return (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
    } catch (e) {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!accountName) return;
    let mounted = true;
    const fetchProgramConfig = async () => {
      try {
        const { data: configData } = await supabase
          .from('program_config')
          .select('*')
          .ilike('account_name', `%${accountName}%`)
          .limit(1)
          .single();
        if (mounted && configData) setProgramConfig(configData);
      } catch (err) {}
    };
    fetchProgramConfig();
    return () => { mounted = false; };
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
        if (mounted) setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const ai = new GoogleGenAI({ apiKey });
        
        const payload = {
          context,
          selectedCohort,
          accountName,
          summary: data || {
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
          contents: `Analyze this data: ${JSON.stringify(payload)}`,
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
          } catch (e) {
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
  }, [sessions, competencies, surveys, baselineData, employees, selectedCohort, context, data, programConfig, apiKey]);

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
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6 flex items-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-boon-blue" /> : <Sparkles className="w-4 h-4 text-boon-blue" />}
        Boon Insights AI
      </h3>
      
      {loading ? (
        <div className="h-24 bg-gray-50 animate-pulse rounded-lg"></div>
      ) : signals ? (
        <div className="space-y-6">
          <div className="bg-boon-blue/5 p-4 rounded-lg border border-boon-blue/10">
             <h4 className="text-lg font-bold text-boon-dark leading-snug">{signals.headline}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
               <h5 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 pb-2 border-b">
                 <TrendingUp className="w-4 h-4 text-boon-blue" /> Insights
               </h5>
               <ul className="space-y-2">
                 {signals.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-boon-blue rounded-full shrink-0"></span>
                       {insight}
                    </li>
                 ))}
               </ul>
            </div>

            <div className="space-y-3">
               <h5 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 pb-2 border-b">
                 <Lightbulb className="w-4 h-4 text-boon-yellow" /> Recommendations
               </h5>
               <ul className="space-y-2">
                 {signals.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                       <span className="mt-1.5 w-1.5 h-1.5 bg-boon-yellow rounded-full shrink-0"></span>
                       {rec}
                    </li>
                 ))}
               </ul>
            </div>
          </div>
        </div>
      ) : <p className="text-gray-400 italic text-sm">Analysis unavailable.</p>}
    </div>
  );
};

export default ExecutiveSignals;