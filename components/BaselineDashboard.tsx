import React, { useEffect, useState, useMemo } from 'react';
import { getWelcomeSurveyData, getProgramConfig, getFocusAreaSelections, getBaselineCompetencyScores } from '../lib/dataFetcher';
import { WelcomeSurveyEntry, ProgramConfig, FocusAreaSelection, CompetencyScoreRecord } from '../types';
import { supabase } from '../lib/supabaseClient';
import ExecutiveSignals from './ExecutiveSignals';
import { 
  Users, 
  Filter, 
  PieChart, 
  Activity, 
  Smile, 
  Briefcase,
  AlertCircle,
  BarChart,
  Layout,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';

const BaselineDashboard: React.FC = () => {
  const [data, setData] = useState<WelcomeSurveyEntry[]>([]);
  const [focusAreas, setFocusAreas] = useState<FocusAreaSelection[]>([]);
  const [baselineCompetencies, setBaselineCompetencies] = useState<CompetencyScoreRecord[]>([]);
  const [programConfig, setProgramConfig] = useState<ProgramConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCohort, setSelectedCohort] = useState('All Cohorts');
  const [boonAverages, setBoonAverages] = useState<{satisfaction: number, productivity: number, work_life_balance: number}>({
    satisfaction: 0, productivity: 0, work_life_balance: 0
  });
  
  // Mobile accordion state
  const [demographicsOpen, setDemographicsOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        
        // Get company from auth
        const { data: { session } } = await supabase.auth.getSession();
        const company = session?.user?.app_metadata?.company || '';
        const companyBase = company.split(' - ')[0].toLowerCase();
        
        const [result, focusData, competencyData, configData, benchmarkData] = await Promise.all([
          getWelcomeSurveyData(),
          getFocusAreaSelections(),
          getBaselineCompetencyScores(),
          getProgramConfig(),
          supabase.from('boon_benchmarks').select('*').eq('program_type', 'GROW')
        ]);
        
        // Get Boon benchmarks from table (use GROW benchmarks for baseline comparison)
        const benchmarks = benchmarkData.data || [];
        const getBenchmark = (metric: string) => {
          const row = benchmarks.find((b: any) => b.metric_name === metric);
          return row ? Number(row.avg_value) : 0;
        };
        
        setBoonAverages({
          satisfaction: getBenchmark('baseline_satisfaction'),
          productivity: getBenchmark('baseline_productivity'),
          work_life_balance: getBenchmark('baseline_work_life_balance')
        });
        
        // Filter by company
        const filteredResult = result.filter(b => {
          const account = ((b as any).account_name || (b as any).account || '').toLowerCase();
          const programTitle = ((b as any).program_title || '').toLowerCase();
          
          // For Wonderful Company, only include TWC programs (exclude FSNA, etc.)
          if (companyBase.includes('wonderful')) {
            return programTitle.startsWith('twc');
          }
          
          return account.includes(companyBase) || companyBase.includes(account.split(' - ')[0]);
        });
        
        // Filter focus areas by company
        const filteredFocusAreas = focusData.filter(f => {
          const account = (f.account_name || '').toLowerCase();
          const programTitle = (f.program_title || '').toLowerCase();
          
          if (companyBase.includes('wonderful')) {
            return programTitle.startsWith('twc');
          }
          
          return account.includes(companyBase) || companyBase.includes(account.split(' - ')[0]);
        });
        
        // Filter baseline competencies by company
        const filteredCompetencies = competencyData.filter(c => {
          const account = (c.account_name || '').toLowerCase();
          const programTitle = (c.program_title || '').toLowerCase();
          
          if (companyBase.includes('wonderful')) {
            return programTitle.startsWith('twc');
          }
          
          return account.includes(companyBase) || companyBase.includes(account.split(' - ')[0]);
        });
        
        // Filter program config by company (also exclude non-TWC for Wonderful)
        const filteredConfig = configData.filter(p => {
          const accountName = (p.account_name || '').toLowerCase();
          const programTitle = (p.program_title || '').toLowerCase();
          
          if (companyBase.includes('wonderful')) {
            return programTitle.startsWith('twc');
          }
          
          return accountName.includes(companyBase) || companyBase.includes(accountName.split(' - ')[0]);
        });
        
        console.log("Raw Baseline Data:", filteredResult); // Debug log
        setData(filteredResult);
        setFocusAreas(filteredFocusAreas);
        setBaselineCompetencies(filteredCompetencies);
        setProgramConfig(filteredConfig);
      } catch (err: any) {
        setError(err.message || 'Failed to load survey data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { filteredData, cohorts, stats } = useMemo(() => {
    // Build start date map for sorting
    const startDateMap = new Map<string, Date>();
    programConfig.forEach(p => {
      if (p.program_title && p.program_start_date) {
        startDateMap.set(p.program_title, new Date(p.program_start_date));
      }
    });
    
    // Extract unique cohorts from program_title (preferred) or cohort field - trim whitespace
    const programTitles = data
      .map(d => ((d as any).program_title || d.cohort || '').trim())
      .filter(Boolean) as string[];
    const uniquePrograms = Array.from(new Set(programTitles));
    
    // Sort by start date (most recent first)
    uniquePrograms.sort((a, b) => {
      const dateA = startDateMap.get(a);
      const dateB = startDateMap.get(b);
      if (dateA && dateB) return dateB.getTime() - dateA.getTime();
      if (dateA) return -1;
      if (dateB) return 1;
      return a.localeCompare(b);
    });
    
    const uniqueCohorts = ['All Cohorts', ...uniquePrograms];

    // Filter by program_title or cohort
    const filtered = selectedCohort === 'All Cohorts' 
      ? data 
      : data.filter(d => {
          const pt = (d as any).program_title || d.cohort || '';
          return pt === selectedCohort;
        });

    if (filtered.length === 0) {
      return { 
        filteredData: [], 
        cohorts: uniqueCohorts, 
        stats: null 
      };
    }

    // --- Aggregations ---

    // 1. Roles
    const roleCounts: Record<string, number> = {};
    filtered.forEach(d => {
      if (d.role) roleCounts[d.role] = (roleCounts[d.role] || 0) + 1;
    });
    const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
    const topRole = sortedRoles.length > 0 ? sortedRoles[0][0] : 'N/A';

    // 2. Wellbeing (Average) - scale to 1-10 if data is on 1-5 scale
    const wellbeingKeys = ['satisfaction', 'productivity', 'work_life_balance', 'motivation', 'inclusion'];
    const wellbeingAvgs = wellbeingKeys.map(key => {
      const validValues = filtered.map(d => Number(d[key])).filter(v => !isNaN(v) && v > 0);
      if (validValues.length === 0) return { key, label: key.replace(/_/g, ' '), value: 0, hasData: false };
      
      const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      
      // Check if data is on 1-5 scale (max value <= 5) and scale to 1-10
      const maxVal = Math.max(...validValues);
      const scaledAvg = maxVal <= 5 ? avg * 2 : avg;
      
      return { key, label: key.replace(/_/g, ' '), value: scaledAvg, hasData: true };
    });

    // 3. Competencies (Average) from competency_scores table - keep on 1-5 scale
    // Filter competencies by the same cohort filter
    const cohortCompetencies = baselineCompetencies.filter(c => {
      if (selectedCohort === 'All Cohorts') return true;
      const pt = (c.program_title || '').toLowerCase();
      return pt === selectedCohort.toLowerCase();
    });
    
    // Aggregate by competency name
    const compMap = new Map<string, { sum: number; count: number }>();
    cohortCompetencies.forEach(c => {
      const name = c.competency_name;
      const score = Number(c.score);
      if (!isNaN(score) && score > 0) {
        if (!compMap.has(name)) {
          compMap.set(name, { sum: 0, count: 0 });
        }
        const entry = compMap.get(name)!;
        entry.sum += score;
        entry.count++;
      }
    });
    
    const compAvgs = Array.from(compMap.entries()).map(([label, data]) => ({
      key: label,
      label,
      value: data.sum / data.count,
      hasData: data.count > 0
    })).filter(c => c.hasData).sort((a, b) => b.value - a.value);

    // 4. Demographics Helpers
    const getDistribution = (field: string) => {
      const counts: Record<string, number> = {};
      filtered.forEach(d => {
        const val = d[field] || 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => {
            // Try to sort numerically if possible (ranges)
            const numA = parseInt(a[0]);
            const numB = parseInt(b[0]);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return b[1] - a[1]; // default frequency sort
        })
        .map(([label, count]) => ({ 
          label, 
          count, 
          pct: (count / filtered.length) * 100 
        }));
    };

    // Analyze coaching goals for themes (including Leader Essentials topics)
    const analyzeCoachingGoals = (entries: WelcomeSurveyEntry[]) => {
      const themeCounts: Record<string, number> = {};
      let totalResponses = 0;
      
      // Process free-text coaching goals
      const goals = entries
        .map(e => (e as any).coaching_goals)
        .filter(g => g && typeof g === 'string' && g.length > 20);
      
      const themePatterns: Record<string, string[]> = {
        'Leadership Skills': ['leadership', 'lead', 'leader', 'managing people', 'manage team'],
        'Executive Presence': ['executive presence', 'presence', 'confident', 'confidence', 'gravitas'],
        'Communication': ['communication', 'communicate', 'speaking', 'presentation', 'articulate'],
        'Time Management': ['time management', 'productivity', 'priorit', 'balance', 'workload'],
        'Strategic Thinking': ['strategic', 'strategy', 'vision', 'big picture'],
        'Delegation': ['delegation', 'delegate', 'empower', 'trust team'],
        'Career Growth': ['career', 'promotion', 'growth', 'advancement', 'next level', 'new role'],
        'Difficult Conversations': ['conflict', 'difficult conversation', 'feedback', 'tough talk'],
        'Team Building': ['team', 'collaboration', 'relationship', 'peers'],
        'Managing Up': ['managing up', 'stakeholder', 'executive', 'senior leader'],
      };
      
      for (const goal of goals) {
        const lower = goal.toLowerCase();
        for (const [theme, patterns] of Object.entries(themePatterns)) {
          if (patterns.some(p => lower.includes(p))) {
            themeCounts[theme] = (themeCounts[theme] || 0) + 1;
          }
        }
      }
      totalResponses += goals.length;
      
      // Process Leader Essentials structured topics
      const leTopics = entries
        .map(e => (e as any).leader_essentials_topics)
        .filter(t => t && typeof t === 'string');
      
      for (const topicStr of leTopics) {
        const topics = topicStr.split(',').map((t: string) => t.trim());
        for (const topic of topics) {
          if (topic === 'Influencing Others') {
            themeCounts['Influencing Others'] = (themeCounts['Influencing Others'] || 0) + 1;
          } else if (topic === 'Developing Team') {
            themeCounts['Developing Team'] = (themeCounts['Developing Team'] || 0) + 1;
          } else if (topic === 'Leading Change') {
            themeCounts['Leading Change'] = (themeCounts['Leading Change'] || 0) + 1;
          }
        }
      }
      if (leTopics.length > 0) totalResponses += leTopics.length;
      
      if (totalResponses === 0) return [];
      
      return Object.entries(themeCounts)
        .map(([theme, count]) => ({ theme, count, pct: (count / totalResponses) * 100 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    };

    return {
      filteredData: filtered,
      cohorts: uniqueCohorts,
      stats: {
        count: filtered.length,
        topRole,
        wellbeing: wellbeingAvgs,
        competencies: compAvgs,
        demographics: {
          age: getDistribution('age_range'),
          tenure: getDistribution('tenure'),
          experience: getDistribution('years_experience'),
          coaching: getDistribution('previous_coaching')
        },
        coachingGoals: analyzeCoachingGoals(filtered)
      }
    };
  }, [data, selectedCohort, programConfig, baselineCompetencies]);

  if (loading) {
     return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-4 gap-4">
           {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
        </div>
        <div className="h-96 bg-gray-200 rounded-2xl mt-8"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm border border-red-100 mt-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Unable to load baseline data</h2>
        <p className="text-gray-500 mt-2">{error}</p>
        <p className="text-xs text-gray-400 mt-4">Ensure table 'welcome_survey_baseline' exists.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-boon-dark tracking-tight uppercase flex items-center gap-3">
            Cohort Baseline <Layout className="w-6 h-6 md:w-8 md:h-8 text-boon-purple" />
          </h1>
          <p className="text-gray-500 font-medium mt-2 text-sm md:text-base">
            Initial welcome survey data analysis.
          </p>
        </div>

        {/* Cohort Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative group w-full md:w-auto">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Filter className="h-4 w-4 text-gray-400" />
                 </div>
                 <select
                    value={selectedCohort}
                    onChange={(e) => setSelectedCohort(e.target.value)}
                    className="w-full md:w-auto pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 ring-boon-purple/30 shadow-sm appearance-none cursor-pointer hover:border-boon-purple/50 transition"
                 >
                    {cohorts.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                 </select>
             </div>
        </div>
      </div>
      
      {/* Executive Signals AI Panel - hidden for now
      <ExecutiveSignals 
        context="Baseline" 
        data={stats} 
        baselineData={filteredData}
        selectedCohort={selectedCohort}
      />
      */}

      {!stats ? (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-200 text-gray-500">
            No data found for this cohort.
        </div>
      ) : (
        <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KPICard 
                    title="Participants" 
                    value={stats.count} 
                    icon={<Users className="w-5 h-5 text-boon-blue" />}
                    color="bg-boon-blue/10"
                    textColor="text-boon-blue"
                />
                <KPICard 
                    title="Most Common Role" 
                    value={stats.topRole} 
                    icon={<Briefcase className="w-5 h-5 text-boon-purple" />} 
                    color="bg-boon-purple/10"
                    textColor="text-boon-purple"
                    isText
                />
                {stats.wellbeing.find(w => w.key === 'satisfaction')?.hasData && (
                 <KPICard 
                    title="Avg Satisfaction" 
                    value={stats.wellbeing.find(w => w.key === 'satisfaction')?.value.toFixed(1) || '-'} 
                    icon={<Smile className="w-5 h-5 text-boon-green" />} 
                    color="bg-boon-green/10"
                    textColor="text-boon-green"
                    subtext="/ 10"
                    benchmark={boonAverages.satisfaction}
                    currentValue={stats.wellbeing.find(w => w.key === 'satisfaction')?.value || 0}
                />
                )}
                {stats.wellbeing.find(w => w.key === 'productivity')?.hasData && (
                <KPICard 
                    title="Avg Productivity" 
                    value={stats.wellbeing.find(w => w.key === 'productivity')?.value.toFixed(1) || '-'} 
                    icon={<Activity className="w-5 h-5 text-boon-coral" />} 
                    color="bg-boon-coral/10"
                    textColor="text-boon-coral"
                    subtext="/ 10"
                    benchmark={boonAverages.productivity}
                    currentValue={stats.wellbeing.find(w => w.key === 'productivity')?.value || 0}
                />
                )}
                {stats.wellbeing.find(w => w.key === 'work_life_balance')?.hasData && (
                <KPICard 
                    title="Work-Life Balance" 
                    value={stats.wellbeing.find(w => w.key === 'work_life_balance')?.value.toFixed(1) || '-'} 
                    icon={<Smile className="w-5 h-5 text-boon-yellow" />} 
                    color="bg-boon-yellow/10"
                    textColor="text-boon-dark"
                    subtext="/ 10"
                    benchmark={boonAverages.work_life_balance}
                    currentValue={stats.wellbeing.find(w => w.key === 'work_life_balance')?.value || 0}
                />
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left Column: Wellbeing & Competencies */}
                <div className="xl:col-span-2 space-y-8">
                    
                    {/* Competency Chart (Now First) */}
                    {stats.competencies.length > 0 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                         <h3 className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <BarChart className="w-4 h-4 text-boon-blue" /> Competency Self-Ratings (1-5)
                        </h3>
                        <div className="space-y-4">
                            {stats.competencies.map((comp) => (
                                <div key={comp.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <div className="w-full sm:w-48 text-xs font-bold text-gray-600 sm:text-right truncate" title={comp.label}>
                                        {comp.label}
                                    </div>
                                    <div className="flex-1 bg-gray-100 h-3 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-boon-blue rounded-full" 
                                            style={{ width: `${(comp.value / 5) * 100}%` }}
                                        />
                                    </div>
                                    <div className="hidden sm:block w-12 text-sm font-black text-boon-dark text-right">
                                        {comp.value.toFixed(1)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-between sm:px-48 text-[10px] text-gray-400 font-bold uppercase">
                             <span>1</span>
                             <span>2</span>
                             <span>3</span>
                             <span>4</span>
                             <span>5</span>
                        </div>
                    </div>
                    )}

                    {/* Coaching Goals Themes */}
                    {stats.coachingGoals && stats.coachingGoals.length > 0 && (
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-boon-yellow" /> Top Coaching Goals
                        </h3>
                        <div className="space-y-4">
                            {stats.coachingGoals.map((item, index) => (
                                <div key={item.theme}>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span className="text-gray-700 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-boon-blue/10 text-boon-blue text-xs flex items-center justify-center font-black">
                                                {index + 1}
                                            </span>
                                            {item.theme}
                                        </span>
                                        <span className="text-gray-400">{item.pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-boon-blue to-boon-purple rounded-full transition-all duration-500" 
                                            style={{ width: `${item.pct}%` }} 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-4 italic">
                            Based on {filteredData.filter(d => (d as any).coaching_goals).length} participant responses
                        </p>
                    </div>
                    )}

                </div>

                {/* Right Column: Demographics */}
                <div className="xl:col-span-1 space-y-6">
                    {/* Desktop View */}
                    <div className="hidden xl:block space-y-6">
                        <DemographicCard title="Age Distribution" data={stats.demographics.age} />
                        <DemographicCard title="Tenure" data={stats.demographics.tenure} />
                        <DemographicCard title="Years Experience" data={stats.demographics.experience} />
                        <DemographicCard title="Previous Coaching" data={stats.demographics.coaching} />
                    </div>

                    {/* Mobile/Tablet Accordion View */}
                    <div className="xl:hidden bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <button 
                            onClick={() => setDemographicsOpen(!demographicsOpen)}
                            className="w-full p-6 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition"
                        >
                            <span className="font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-boon-purple" />
                                Demographics Breakdown
                            </span>
                            {demographicsOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                        </button>
                        
                        {demographicsOpen && (
                            <div className="p-6 space-y-6">
                                <DemographicCard title="Age Distribution" data={stats.demographics.age} />
                                <DemographicCard title="Tenure" data={stats.demographics.tenure} />
                                <DemographicCard title="Years Experience" data={stats.demographics.experience} />
                                <DemographicCard title="Previous Coaching" data={stats.demographics.coaching} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

// Sub-components

const KPICard = ({ title, value, icon, color, textColor, subtext, isText, benchmark, currentValue }: any) => {
    const diff = benchmark && currentValue ? currentValue - benchmark : null;
    const showBenchmark = benchmark && benchmark > 0 && diff !== null;
    
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}>
                {icon}
            </div>
            <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">{title}</p>
                <div className={`font-black ${textColor} ${isText ? 'text-lg truncate' : 'text-3xl'}`}>
                    {value} 
                    {subtext && <span className="text-sm text-gray-300 font-medium ml-1">{subtext}</span>}
                </div>
                {showBenchmark && (
                    <p className={`text-xs font-semibold mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {diff >= 0 ? '↑' : '↓'} {Math.abs((diff / benchmark) * 100).toFixed(0)}% vs Boon avg
                    </p>
                )}
            </div>
        </div>
    );
};

const DemographicCard = ({ title, data }: { title: string, data: { label: string, count: number, pct: number }[] }) => {
    // Hide card if only "Unknown" at 100%
    const hasRealData = data.some(item => item.label !== 'Unknown') || 
                        (data.length === 1 && data[0].label === 'Unknown' && data[0].pct < 100);
    
    if (!hasRealData && data.length > 0) return null;
    
    // Format labels for Previous Coaching
    const formatLabel = (label: string, cardTitle: string) => {
        if (cardTitle === 'Previous Coaching') {
            if (label === '0') return 'No prior coaching';
            if (label === '1') return 'Has prior coaching';
        }
        return label;
    };
    
    return (
        <div className="bg-white xl:p-6 rounded-2xl xl:shadow-sm xl:border border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <PieChart className="w-3 h-3" /> {title}
            </h4>
            <div className="space-y-3">
                {data.slice(0, 5).map((item) => (
                    <div key={item.label}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-gray-600 truncate max-w-[70%]">{formatLabel(item.label, title)}</span>
                            <span className="text-gray-400">
                                {title === 'Previous Coaching' ? `${item.pct.toFixed(0)}%` : `${item.count} (${item.pct.toFixed(0)}%)`}
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-boon-purple/70 rounded-full" 
                                style={{ width: `${item.pct}%` }} 
                            />
                        </div>
                    </div>
                ))}
                {data.length === 0 && <div className="text-xs text-gray-300 italic">No data available</div>}
            </div>
        </div>
    );
};

const getWellbeingColor = (val: number) => {
    if (val >= 8) return '#6CD893'; // green
    if (val >= 6) return '#466FF6'; // blue
    if (val >= 4) return '#FFC969'; // yellow
    return '#FF6D6A'; // red
};

export default BaselineDashboard;