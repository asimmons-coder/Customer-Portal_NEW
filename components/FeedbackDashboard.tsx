
import React, { useEffect, useState, useMemo } from 'react';
import { getSurveyResponses, getEmployeeRoster, getCompetencyScores, CompanyFilter, buildCompanyFilter } from '../lib/dataFetcher';
import { SurveyResponse, CompetencyScore } from '../types';
import { supabase } from '../lib/supabaseClient';
import { 
  Award,
  AlertCircle,
  TrendingUp,
  Star,
  Users,
  Quote
} from 'lucide-react';

const FeedbackDashboard: React.FC = () => {
  const [surveyData, setSurveyData] = useState<SurveyResponse[]>([]);
  const [competencyData, setCompetencyData] = useState<CompetencyScore[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get company from auth
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

        console.log('FeedbackDashboard using company filter:', companyFilter);

        const [surveys, roster, comps] = await Promise.all([
          getSurveyResponses(companyFilter),
          getEmployeeRoster(companyFilter),
          getCompetencyScores(companyFilter)
        ]);
        setSurveyData(surveys);
        setTotalEmployees(roster.length);
        setCompetencyData(comps);
      } catch (err: any) {
        setError(err.message || 'Failed to load outcomes data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Metrics & Data Processing ---
  const stats = useMemo(() => {
    // 1. NPS Score
    const npsScores = surveyData.filter(r => r.nps !== null && r.nps !== undefined).map(r => r.nps);
    const promoters = npsScores.filter(s => s >= 9).length;
    const detractors = npsScores.filter(s => s <= 6).length;
    const nps = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : 0;

    // 2. Coach Satisfaction
    const satScores = surveyData.filter(r => r.coach_satisfaction !== null && r.coach_satisfaction !== undefined).map(r => r.coach_satisfaction);
    const avgSatisfaction = satScores.length > 0 ? (satScores.reduce((a, b) => a + b, 0) / satScores.length).toFixed(1) : '0.0';

    // 3. Response Rate
    const uniqueEmails = new Set(surveyData.map(r => r.email).filter(Boolean)).size;

    // 4. Competency Growth (Top 3)
    const competencyAverages: Record<string, { before: number[]; after: number[] }> = {};
    competencyData.forEach(row => {
      // Use existing types 'pre' and 'post' as they map to score_before/score_after in logic
      if (!competencyAverages[row.competency]) {
        competencyAverages[row.competency] = { before: [], after: [] };
      }
      if (row.pre !== null && row.pre !== undefined) competencyAverages[row.competency].before.push(row.pre);
      if (row.post !== null && row.post !== undefined) competencyAverages[row.competency].after.push(row.post);
    });

    const competencyGrowth = Object.entries(competencyAverages).map(([name, scores]) => {
      const avgBefore = scores.before.length > 0 ? scores.before.reduce((a,b) => a+b, 0) / scores.before.length : 0;
      const avgAfter = scores.after.length > 0 ? scores.after.reduce((a,b) => a+b, 0) / scores.after.length : 0;
      const pctChange = avgBefore > 0 ? Math.round(((avgAfter - avgBefore) / avgBefore) * 100) : 0;
      return { name, avgBefore, avgAfter, pctChange };
    })
    .filter(c => c.avgBefore > 0 && c.avgAfter > 0)
    .sort((a, b) => b.pctChange - a.pctChange);

    const top3Competencies = competencyGrowth.slice(0, 3);

    // 5. Qualitative Quotes
    // Deduplicate by email to get unique participant feedback
    const uniqueFeedbackMap = new Map<string, { learned?: string, insight?: string }>();
    
    competencyData.forEach(row => {
      if (row.email && !uniqueFeedbackMap.has(row.email)) {
        if (row.feedback_learned || row.feedback_insight) {
          uniqueFeedbackMap.set(row.email, {
            learned: row.feedback_learned,
            insight: row.feedback_insight
          });
        }
      }
    });

    const quotesList = Array.from(uniqueFeedbackMap.values())
      .flatMap(f => [f.learned, f.insight])
      .filter((text): text is string => {
        if (!text) return false;
        const lower = text.toLowerCase().trim();
        if (lower.length < 40) return false;
        if (lower.includes("i don't know") || lower.includes("nothing") || lower.includes("not sure")) return false;
        // Exclude coach-focused praise to focus on behavior change
        if (lower.includes("great coach") || lower.includes("love my coach") || lower.includes("enjoyed working with")) return false;
        return true;
      })
      .slice(0, 5); // Take top 5

    return {
      nps,
      avgSatisfaction,
      uniqueEmails,
      respondentCount: npsScores.length,
      top3Competencies,
      quotes: quotesList
    };
  }, [surveyData, competencyData]);

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-32 bg-gray-200 rounded-lg mb-8"></div>
        <div className="h-64 bg-gray-200 rounded-xl mb-8"></div>
        <div className="grid grid-cols-1 gap-6">
           <div className="h-32 bg-gray-200 rounded-xl"></div>
           <div className="h-32 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm border border-red-100 mt-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Unable to load outcomes data</h2>
        <p className="text-gray-500 mt-2">{error}</p>
      </div>
    );
  }

  // Construct Executive Summary
  const topSkill1 = stats.top3Competencies[0];
  const topSkill2 = stats.top3Competencies[1];
  
  let summaryText = `Across ${stats.respondentCount} survey responses from ${stats.uniqueEmails} employees, the program shows an NPS of ${stats.nps > 0 ? '+' : ''}${stats.nps} and ${stats.avgSatisfaction}/10 coach satisfaction.`;
  
  if (topSkill1) {
    summaryText += ` Participants developed strongest in ${topSkill1.name} (+${topSkill1.pctChange}%)`;
    if (topSkill2) {
      summaryText += ` and ${topSkill2.name} (+${topSkill2.pctChange}%)`;
    }
    summaryText += `.`;
  } else {
    summaryText += ` Skill growth data will populate as participants complete their assessments.`;
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12 font-sans max-w-5xl mx-auto">
      
      {/* 1. EXECUTIVE SUMMARY */}
      <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Executive Summary</h2>
        </div>
        <p className="text-lg text-boon-dark font-medium leading-relaxed font-serif">
          {summaryText}
        </p>
      </div>

      {/* 2. PROGRAM OUTCOMES (HERO) */}
      {stats.top3Competencies.length > 0 && (
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-boon-dark tracking-tight mb-6 flex items-center gap-3">
            Measured Skill Growth <TrendingUp className="w-6 h-6 text-boon-green" />
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.top3Competencies.map(skill => (
              <div key={skill.name} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col items-center text-center">
                  <div className="text-5xl font-bold text-boon-green mb-3 tracking-tighter">
                    +{skill.pctChange}%
                  </div>
                  <div className="text-lg font-bold text-gray-800 leading-tight mb-4 min-h-[3rem] flex items-center justify-center">
                    {skill.name}
                  </div>
                  <div className="text-sm font-semibold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                    {skill.avgBefore.toFixed(1)} <span className="mx-1 text-gray-300">→</span> <span className="text-boon-dark">{skill.avgAfter.toFixed(1)}</span>
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BEHAVIOR CHANGE: QUALITATIVE */}
      <div>
         <h2 className="text-2xl md:text-3xl font-extrabold text-boon-dark tracking-tight mb-6">
            Behavior Change: In Their Own Words
         </h2>
         
         <div className="space-y-4">
            {stats.quotes.length > 0 ? (
              stats.quotes.map((quote, i) => (
                <div key={i} className="bg-white p-6 rounded-r-xl border-l-4 border-boon-blue shadow-sm border-y border-r border-gray-100">
                   <p className="text-gray-700 text-lg leading-relaxed italic">
                     "{quote}"
                   </p>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-3">
                     — Program Participant
                   </p>
                </div>
              ))
            ) : (
               <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 italic">
                  Participant feedback will appear here as post-program surveys are completed.
               </div>
            )}
         </div>
      </div>

      {/* 4. SATISFACTION METRICS (SECONDARY) */}
      <div className="pt-8 border-t border-gray-100">
         <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Program Satisfaction</h3>
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
            {/* NPS */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
               <div className="text-3xl font-bold text-gray-700 mb-1">
                 {stats.nps > 0 ? '+' : ''}{stats.nps}
               </div>
               <div className="text-xs font-bold text-gray-400 uppercase">NPS Score</div>
               <div className="text-xs text-gray-400 mt-1">n={stats.respondentCount} responses</div>
            </div>

            {/* Coach Rating */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
               <div className="text-3xl font-bold text-gray-700 mb-1">
                 {stats.avgSatisfaction}<span className="text-lg text-gray-400">/10</span>
               </div>
               <div className="text-xs font-bold text-gray-400 uppercase">Coach Rating</div>
            </div>

            {/* Response Rate */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
               <div className="text-3xl font-bold text-gray-700 mb-1">
                 {totalEmployees > 0 ? Math.round((stats.uniqueEmails / totalEmployees) * 100) : 0}%
               </div>
               <div className="text-xs font-bold text-gray-400 uppercase">Response Rate</div>
               <div className="text-xs text-gray-400 mt-1">{stats.uniqueEmails} of {totalEmployees} employees</div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default FeedbackDashboard;
