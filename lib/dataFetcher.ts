import React, { useEffect, useState, useMemo } from 'react';
import { getWelcomeSurveyData } from '../lib/dataFetcher';
import { WelcomeSurveyEntry } from '../types';
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
  ChevronUp
} from 'lucide-react';

const BaselineDashboard: React.FC = () => {
  const [data, setData] = useState<WelcomeSurveyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCohort, setSelectedCohort] = useState('All Cohorts');
  
  // Mobile accordion state
  const [demographicsOpen, setDemographicsOpen] = useState(false);

  // Competency Key Map
  const COMPETENCY_MAP = {
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

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const result = await getWelcomeSurveyData();
        console.log("Raw Baseline Data:", result); // Debug log
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load survey data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { filteredData, cohorts, stats } = useMemo(() => {
    // Extract unique cohorts
    const uniqueCohorts = ['All Cohorts', ...Array.from(new Set(data.map(d => d.cohort).filter(Boolean))).sort()];

    // Filter
    const filtered = selectedCohort === 'All Cohorts' 
      ? data 
      : data.filter(d => d.cohort === selectedCohort);

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

    // 2. Wellbeing (Average)
    const wellbeingKeys = ['satisfaction', 'productivity', 'work_life_balance', 'motivation', 'inclusion'];
    const wellbeingAvgs = wellbeingKeys.map(key => {
      const validValues = filtered.map(d => Number(d[key])).filter(v => !isNaN(v));
      const avg = validValues.length ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
      return { key, label: key.replace(/_/g, ' '), value: avg };
    });

    // 3. Competencies (Average)
    const compAvgs = Object.entries(COMPETENCY_MAP).map(([key, label]) => {
      // Robustly cast to Number to handle potential string data
      const validValues = filtered
        .map(d => Number(d[key]))
        .filter(v => !isNaN(v) && v > 0);
      
      const avg = validValues.length ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
      return { key, label, value: avg };
    }).sort((a, b) => b.value - a.value); // Sort by highest score

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
        }
      }
    };
  }, [data, selectedCohort]);

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
      
      {/* Executive Signals AI Panel */}
      <ExecutiveSignals 
        context="Baseline" 
        data={stats} 
        baselineData={filteredData}
        selectedCohort={selectedCohort}
      />

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
                 <KPICard 
                    title="Avg Satisfaction" 
                    value={stats.wellbeing.find(w => w.key === 'satisfaction')?.value.toFixed(1) || '-'} 
                    icon={<Smile className="w-5 h-5 text-boon-green" />} 
                    color="bg-boon-green/10"
                    textColor="text-boon-green"
                    subtext="/ 10"
                />
                <KPICard 
                    title="Avg Productivity" 
                    value={stats.wellbeing.find(w => w.key === 'productivity')?.value.toFixed(1) || '-'} 
                    icon={<Activity className="w-5 h-5 text-boon-coral" />} 
                    color="bg-boon-coral/10"
                    textColor="text-boon-coral"
                    subtext="/ 10"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left Column: Wellbeing & Competencies */}
                <div className="xl:col-span-2 space-y-8">
                    
                    {/* Competency Chart (Now First) */}
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

                    {/* Wellbeing Chart (Now Second) */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Smile className="w-4 h-4 text-boon-green" /> Wellbeing Baseline (1-10)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {stats.wellbeing.map((item, index) => (
                                <div 
                                    key={item.key} 
                                    className={`flex flex-col items-center p-4 bg-gray-50 rounded-2xl ${
                                        index === stats.wellbeing.length - 1 ? 'col-span-2 md:col-span-1 justify-self-center w-1/2 md:w-auto mx-auto md:mx-0' : ''
                                    }`}
                                >
                                    <div className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center mb-3">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="50%" cy="50%" r="40%" stroke="#E5E7EB" strokeWidth="8" fill="none" />
                                            <circle 
                                                cx="50%" cy="50%" r="40%" 
                                                stroke={getWellbeingColor(item.value)} 
                                                strokeWidth="8" 
                                                fill="none" 
                                                strokeDasharray={251} 
                                                strokeDashoffset={251 - (251 * item.value) / 10} 
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <span className="absolute text-xl md:text-2xl font-black text-gray-700">{item.value.toFixed(1)}</span>
                                    </div>
                                    <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase text-center">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

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

const KPICard = ({ title, value, icon, color, textColor, subtext, isText }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
            {icon}
        </div>
        <div className="overflow-hidden">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">{title}</p>
            <div className={`font-black ${textColor} ${isText ? 'text-lg truncate' : 'text-3xl'}`}>
                {value} 
                {subtext && <span className="text-sm text-gray-300 font-medium ml-1">{subtext}</span>}
            </div>
        </div>
    </div>
);

const DemographicCard = ({ title, data }: { title: string, data: { label: string, count: number, pct: number }[] }) => (
    <div className="bg-white xl:p-6 rounded-2xl xl:shadow-sm xl:border border-gray-100">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <PieChart className="w-3 h-3" /> {title}
        </h4>
        <div className="space-y-3">
            {data.slice(0, 5).map((item) => (
                <div key={item.label}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-gray-600 truncate max-w-[70%]">{item.label}</span>
                        <span className="text-gray-400">{item.count} ({item.pct.toFixed(0)}%)</span>
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

const getWellbeingColor = (val: number) => {
    if (val >= 8) return '#6CD893'; // green
    if (val >= 6) return '#466FF6'; // blue
    if (val >= 4) return '#FFC969'; // yellow
    return '#FF6D6A'; // red
};

export default BaselineDashboard;