import React, { useEffect, useState, useMemo } from 'react';
import { getCompetencyScores, getWelcomeSurveyData } from '../lib/dataFetcher';
import { CompetencyScore, WelcomeSurveyEntry } from '../types';
import ExecutiveSignals from './ExecutiveSignals';
import { BarChart, AlertCircle, Clock, Info } from 'lucide-react';

// --- Program Display Name Mapping ---
const programDisplayNames: Record<string, string> = {
  'CP-0028': 'GROW - Cohort 1',
  'CP-0117': 'GROW - Cohort 2',
};

const getDisplayName = (program: string): string => {
  return programDisplayNames[program] || program;
};

// --- Competency Mapping ---
const COMPETENCY_MAP: Record<string, string> = {
    comp_effective_communication: "Effective Communication",
    comp_persuasion_and_influence: "Persuasion & Influence",
    comp_adaptability_and_resilience: "Adaptability & Resilience",
    comp_strategic_thinking: "Strategic Thinking",
    comp_emotional_intelligence: "Emotional Intelligence",
    comp_building_relationships_at_work: "Building Relationships",
    comp_self_confidence_and_imposter_syndrome: "Confidence & Imposter Syndrome",
    comp_delegation_and_accountability: "Delegation & Accountability",
    comp_giving_and_receiving_feedback: "Giving & Receiving Feedback",
    comp_effective_planning_and_execution: "Planning & Execution",
    comp_change_management: "Change Management",
    comp_time_management_and_productivity: "Time Management"
};

// --- Interpretation Logic ---
const getInterpretation = (topCompetencies: string[]): string => {
  if (topCompetencies.length === 0) return "";

  // Check the top competency to determine the category
  const top = topCompetencies[0].toLowerCase();
  
  // 1. Core Management Skills
  if (top.includes('delegation') || top.includes('accountability') || top.includes('feedback') || (top.includes('management') && !top.includes('change') && !top.includes('time'))) {
    return "These results suggest the program is particularly effective at building core management skills.";
  }
  
  // 2. Interpersonal Effectiveness
  if (top.includes('communication') || top.includes('influence') || top.includes('persuasion') || top.includes('relationship')) {
    return "These results suggest the program is particularly effective at enhancing interpersonal effectiveness.";
  }

  // 3. Strategic Leadership
  if (top.includes('strategic') || top.includes('planning') || top.includes('change management') || top.includes('execution')) {
    return "These results suggest the program is particularly effective at developing strategic leadership capabilities.";
  }

  // 4. Personal Effectiveness
  if (top.includes('confidence') || top.includes('resilience') || top.includes('emotional') || top.includes('adaptability')) {
    return "These results suggest the program is particularly effective at strengthening personal effectiveness and resilience.";
  }

  // Default fallback if no specific category matches
  return "These results suggest the program is effective at driving growth in key performance areas.";
};

const ImpactDashboard: React.FC = () => {
  const [scores, setScores] = useState<CompetencyScore[]>([]);
  const [baselineData, setBaselineData] = useState<WelcomeSurveyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState('All Programs');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [compData, baseData] = await Promise.all([
          getCompetencyScores(),
          getWelcomeSurveyData()
        ]);
        setScores(compData);
        setBaselineData(baseData);
      } catch (err: any) {
        setError(err.message || 'Failed to load competency data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Data Processing & Aggregation ---
  const { 
    programs, 
    competencyStats, 
    overallStats,
    interpretation,
    baselineStats,
    hasImpactData
  } = useMemo(() => {
    const normalize = (str: string) => (str || '').toLowerCase().trim();
    const selNorm = normalize(selectedProgram);

    // 1. Determine Unique Programs from BOTH sources
    const uniquePrograms = ['All Programs', ...new Set([
        ...scores.map(s => s.program),
        ...baselineData.map(b => b.cohort)
    ].filter(Boolean))].sort();


    // 2. Filter Impact Data by Program
    const filteredScores = selectedProgram === 'All Programs' 
      ? scores 
      : scores.filter(s => normalize(s.program) === selNorm);

    // 3. Aggregate by Competency (Impact)
    const compMap = new Map<string, { name: string, sumPre: number, sumPost: number, count: number }>();
    
    filteredScores.forEach(s => {
      const preVal = Number(s.pre);
      const postVal = Number(s.post);

      if (!isNaN(preVal) && !isNaN(postVal) && preVal > 0 && postVal > 0) {
          if (!compMap.has(s.competency)) {
            compMap.set(s.competency, { name: s.competency, sumPre: 0, sumPost: 0, count: 0 });
          }
          const entry = compMap.get(s.competency)!;
          entry.sumPre += preVal;
          entry.sumPost += postVal;
          entry.count += 1;
      }
    });

    const competencyStats = Array.from(compMap.values()).map(c => {
      const avgPre = c.sumPre / c.count;
      const avgPost = c.sumPost / c.count;
      const change = avgPost - avgPre;
      const pctGrowth = avgPre > 0 ? (change / avgPre) * 100 : 0;
      return { ...c, avgPre, avgPost, change, pctGrowth };
    }).sort((a, b) => b.pctGrowth - a.pctGrowth);

    // 4. Overall Statistics (Impact)
    const uniqueParticipants = new Set(filteredScores.map(s => s.email)).size;
    let totalSumPre = 0;
    let totalSumPost = 0;
    let validItemCount = 0;

    filteredScores.forEach(s => {
        const preVal = Number(s.pre);
        const postVal = Number(s.post);
        if (!isNaN(preVal) && !isNaN(postVal) && preVal > 0 && postVal > 0) {
            totalSumPre += preVal;
            totalSumPost += postVal;
            validItemCount++;
        }
    });

    const avgOverallPre = validItemCount > 0 ? totalSumPre / validItemCount : 0;
    const avgOverallPost = validItemCount > 0 ? totalSumPost / validItemCount : 0;
    const avgOverallGain = avgOverallPost - avgOverallPre;
    const overallGrowthPct = avgOverallPre > 0 ? ((avgOverallPost - avgOverallPre) / avgOverallPre) * 100 : 0;
    const improvedCount = competencyStats.filter(c => c.change > 0).length;
    const topCompetencies = competencyStats.slice(0, 2).map(c => c.name);
    const interpretationText = getInterpretation(topCompetencies);

    const hasImpactData = competencyStats.length > 0;


    // 5. Baseline Statistics (Fallback View)
    let baselineStats: { label: string, avg: number }[] = [];
    if (!hasImpactData) {
        const filteredBaseline = selectedProgram === 'All Programs'
            ? baselineData
            : baselineData.filter(b => {
                 const bCoh = normalize(b.cohort);
                 const bComp = normalize(b.company);
                 // Relaxed matching for baseline data
                 return bCoh === selNorm || bComp === selNorm || selNorm.includes(bCoh);
            });
            
        baselineStats = Object.entries(COMPETENCY_MAP).map(([key, label]) => {
            const values = filteredBaseline
                .map(r => Number(r[key]))
                .filter(v => !isNaN(v) && v > 0);
            
            const avg = values.length > 0 
                ? values.reduce((a,b) => a+b, 0) / values.length 
                : 0;
            return { label, avg: Math.round(avg * 10) / 10 };
        })
        .filter(c => c.avg > 0)
        .sort((a, b) => b.avg - a.avg); // Sort highest baseline first (usually 'strengths') or swap to see gaps
    }


    return {
      programs: uniquePrograms,
      competencyStats,
      overallStats: {
        uniqueParticipants,
        overallGrowthPct,
        avgOverallGain,
        improvedCount,
        totalCompetencies: competencyStats.length
      },
      interpretation: interpretationText,
      baselineStats,
      hasImpactData
    };
  }, [scores, baselineData, selectedProgram]);

  if (loading) return <div className="p-12 text-center text-gray-400">Loading impact data...</div>;
  if (error) return <div className="p-12 text-center text-red-500">{error}</div>;

  const maxPctChange = Math.max(...competencyStats.map(c => Math.abs(c.pctGrowth)), 1);

  return (
    <div className="font-sans pb-20 max-w-7xl mx-auto">
      
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#111827] leading-tight">Program Impact</h1>
          <p className="text-[#374151] mt-1 text-sm md:text-base">Measuring competency growth from pre to post assessment</p>
        </div>
        
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="w-full md:w-auto px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#466FF6]/20 min-w-[200px]"
        >
          {programs.map(p => (
            <option key={p} value={p}>{p === 'All Programs' ? 'All Programs' : getDisplayName(p)}</option>
          ))}
        </select>
      </div>

      <ExecutiveSignals context="Impact" data={{ overallStats, competencyStats }} />

      {!hasImpactData ? (
          // --- ZERO STATE / BASELINE VIEW ---
          <div className="animate-in fade-in duration-500">
             
             {/* Banner */}
             <div className="bg-blue-50 border-l-4 border-boon-blue p-6 rounded-r-xl mb-10 flex items-start gap-4 shadow-sm">
                <Clock className="w-6 h-6 text-boon-blue shrink-0 mt-0.5" />
                <div>
                   <h3 className="text-boon-blue font-bold text-lg mb-1">Awaiting Post-Program Assessments</h3>
                   <p className="text-gray-600 leading-relaxed">
                      Impact data will appear here once participants complete their end-of-program competency surveys. 
                      In the meantime, review the baseline competency levels below to understand where your team started.
                   </p>
                </div>
             </div>

             {/* Baseline Chart */}
             <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <BarChart className="w-4 h-4 text-boon-dark" /> Where Your Team Started (Baseline)
                    </h3>
                    <div className="hidden md:flex gap-4 text-xs font-medium text-gray-400">
                        <span>1: Learning</span>
                        <span>2: Growing</span>
                        <span>3: Applying</span>
                        <span>4: Excelling</span>
                        <span>5: Mastery</span>
                    </div>
                </div>

                {baselineStats.length > 0 ? (
                    <div className="space-y-6">
                        {baselineStats.map((item) => (
                            <div key={item.label}>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-bold text-gray-700">{item.label}</span>
                                    <span className="text-sm font-black text-boon-dark">{item.avg.toFixed(1)} <span className="text-gray-300 font-normal">/ 5.0</span></span>
                                </div>
                                <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                     {/* Markers */}
                                     <div className="absolute top-0 bottom-0 left-[20%] w-px bg-white/50"></div>
                                     <div className="absolute top-0 bottom-0 left-[40%] w-px bg-white/50"></div>
                                     <div className="absolute top-0 bottom-0 left-[60%] w-px bg-white/50"></div>
                                     <div className="absolute top-0 bottom-0 left-[80%] w-px bg-white/50"></div>
                                     
                                     {/* Bar */}
                                     <div 
                                        className="h-full bg-boon-blue rounded-full" 
                                        style={{ width: `${(item.avg / 5) * 100}%` }}
                                     ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-400 italic">
                        No baseline data available for this cohort.
                    </div>
                )}
                
                <div className="mt-8 pt-6 border-t border-gray-100 flex items-start gap-3">
                    <Info className="w-5 h-5 text-gray-400 shrink-0" />
                    <p className="text-sm text-gray-500">
                        <span className="font-bold text-gray-700">What to expect:</span> Based on completed cohorts, participants typically show <span className="font-bold text-boon-green">10-25% improvement</span> across competencies by the end of the program.
                    </p>
                </div>
             </div>
          </div>
      ) : (
        // --- DATA VIEW (Existing) ---
        <div className="animate-in fade-in duration-500">
            {/* 2. Executive Insight Banner */}
            <div className="w-full bg-[#F8F9FA] p-4 md:p-6 mb-8 md:mb-12 rounded-sm border-l-4 border-[#466FF6]">
            <p className="text-base md:text-[18px] text-[#374151] leading-relaxed">
                Participants showed a <strong className="font-bold text-[#111827]">{overallStats.overallGrowthPct.toFixed(1)}% overall improvement</strong> in self-rated competencies, 
                with the largest gains in <strong className="font-bold text-[#111827]">{competencyStats[0]?.name} (+{competencyStats[0]?.pctGrowth.toFixed(0)}%)</strong> and <strong className="font-bold text-[#111827]">{competencyStats[1]?.name} (+{competencyStats[1]?.pctGrowth.toFixed(0)}%)</strong>.
                {' '}{interpretation}
            </p>
            </div>

            {/* 3. Metrics Row */}
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 mb-12 md:mb-16 items-start">
            
            {/* Left: Hero Metric */}
            <div className="flex-1 w-full">
                <div className="text-[48px] md:text-[72px] font-bold text-[#466FF6] leading-none tracking-tight">
                {overallStats.overallGrowthPct > 0 ? '+' : ''}{overallStats.overallGrowthPct.toFixed(1)}%
                </div>
                <div className="text-sm font-medium uppercase tracking-wider text-[#6B7280] mt-4 mb-1">
                Overall Competency Growth
                </div>
                <div className="text-xs text-[#9CA3AF]">
                {overallStats.uniqueParticipants} participants · {selectedProgram === 'All Programs' ? 'All Cohorts' : getDisplayName(selectedProgram)}
                </div>
            </div>

            {/* Right: Supporting Metrics */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-auto">
                {/* Card 1 */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 min-w-[240px] flex-1 lg:flex-none">
                <div className="text-sm font-medium uppercase tracking-wider text-[#6B7280] mb-1">
                    Avg Score Gain
                </div>
                <div className="text-2xl font-bold text-[#111827] mb-1">
                    {overallStats.avgOverallGain > 0 ? '+' : ''}{overallStats.avgOverallGain.toFixed(2)}
                </div>
                <div className="text-xs text-[#9CA3AF]">on 5-point scale</div>
                </div>

                {/* Card 2 */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 min-w-[240px] flex-1 lg:flex-none">
                <div className="text-sm font-medium uppercase tracking-wider text-[#6B7280] mb-1">
                    Competencies Improved
                </div>
                <div className="text-2xl font-bold text-[#111827] mb-1">
                    {overallStats.improvedCount} of {overallStats.totalCompetencies}
                </div>
                <div className="text-xs text-[#9CA3AF]">showed positive growth</div>
                </div>
            </div>
            </div>

            {/* 4. Competency Table */}
            <div className="mb-12">
            {/* Mobile View: Cards */}
            <div className="block md:hidden space-y-4">
                {competencyStats.map((item, index) => (
                <div key={item.name} className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-sm font-bold text-[#111827] w-2/3">{item.name}</h3>
                        <span className={`text-lg font-bold ${item.change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                            {item.pctGrowth > 0 ? '+' : ''}{Math.round(item.pctGrowth)}%
                        </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-[#6B7280] mb-3 bg-[#F9FAFB] p-2 rounded-lg">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1">Before</span>
                            <span className="font-semibold text-[#374151]">{item.avgPre.toFixed(2)}</span>
                        </div>
                        <div className="text-[#9CA3AF]">→</div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-[#9CA3AF] mb-1">After</span>
                            <span className="font-bold text-[#466FF6]">{item.avgPost.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="h-full rounded-full bg-[#466FF6]"
                            style={{ width: `${Math.max((Math.abs(item.pctGrowth) / maxPctChange) * 100, 5)}%` }}
                        />
                    </div>
                </div>
                ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr>
                    <th className="py-3 px-4 text-xs font-medium uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] w-[35%]">Competency</th>
                    <th className="py-3 px-4 text-xs font-medium uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] text-center w-[10%]">Before</th>
                    <th className="py-3 px-4 text-xs font-medium uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] text-center w-[10%]">After</th>
                    <th className="py-3 px-4 text-xs font-medium uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] text-right w-[15%]">Change</th>
                    <th className="py-3 px-4 text-xs font-medium uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] w-[30%]"></th>
                    </tr>
                </thead>
                <tbody>
                    {competencyStats.map((item, index) => (
                    <tr 
                        key={item.name} 
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-[#EFF6FF] transition-colors h-[48px]`}
                    >
                        <td className="px-4 text-sm font-medium text-[#111827]">
                        {item.name}
                        </td>
                        <td className="px-4 text-sm text-[#6B7280] text-center">
                        {item.avgPre.toFixed(2)}
                        </td>
                        <td className="px-4 text-sm font-bold text-[#466FF6] text-center">
                        {item.avgPost.toFixed(2)}
                        </td>
                        <td className={`px-4 text-sm font-bold text-right ${item.change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {item.pctGrowth > 0 ? '+' : ''}{Math.round(item.pctGrowth)}%
                        </td>
                        <td className="px-4 align-middle">
                        <div className="h-full flex items-center">
                            <div 
                                className="h-2 rounded-full bg-[#466FF6] opacity-90"
                                style={{ width: `${Math.max((Math.abs(item.pctGrowth) / maxPctChange) * 100, 1)}%` }}
                            />
                        </div>
                        </td>
                    </tr>
                    ))}
                    {competencyStats.length === 0 && (
                    <tr>
                        <td colSpan={5} className="py-12 text-center text-[#9CA3AF]">
                        No competency data found for the selected program.
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ImpactDashboard;