import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getWelcomeSurveyScaleData, CompanyFilter, buildCompanyFilter } from '../lib/dataFetcher';
import { CountUp, AnimatedProgressBar, HoverCard } from './Animations';
import { 
  Users, 
  Briefcase, 
  Smile, 
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Calendar,
  Award,
  Heart,
  Minus
} from 'lucide-react';

interface ScaleWelcomeSurvey {
  id: number;
  account: string;
  email: string;
  first_name: string;
  last_name: string;
  age_range: string;
  gender: string;
  role: string;
  tenure: string;
  previous_coaching: number;
  satisfaction: number;
  productivity: number;
  work_life_balance: number;
  focus_work_relationships: boolean;
  focus_work_life_balance: boolean;
  focus_leadership_development: boolean;
  focus_realizing_potential: boolean;
  focus_work_performance: boolean;
  focus_work_stress: boolean;
  focus_new_environment: boolean;
  focus_adapting_to_change: boolean;
  focus_dealing_with_uncertainty: boolean;
  focus_bouncing_back: boolean;
  focus_relationship_with_self: boolean;
  focus_inner_confidence: boolean;
  focus_positive_habits: boolean;
  focus_personal_accountability: boolean;
  focus_professional_development: boolean;
  focus_persevering_through_change: boolean;
  focus_relationships_self_others: boolean;
  focus_coping_stress_anxiety: boolean;
}

const FOCUS_AREA_LABELS: Record<string, string> = {
  focus_leadership_development: 'Leadership Development',
  focus_professional_development: 'Professional Development',
  focus_work_performance: 'Work Performance',
  focus_work_stress: 'Managing Work Stress',
  focus_coping_stress_anxiety: 'Coping with Stress & Anxiety',
  focus_work_life_balance: 'Work-Life Balance',
  focus_work_life_balance: 'Work-Life Balance',
  focus_work_relationships: 'Work Relationships',
  focus_relationships_self_others: 'Relationships (Self & Others)',
  focus_realizing_potential: 'Realizing Potential',
  focus_inner_confidence: 'Inner Confidence',
  focus_positive_habits: 'Building Positive Habits',
  focus_personal_accountability: 'Personal Accountability',
  focus_adapting_to_change: 'Adapting to Change',
  focus_persevering_through_change: 'Persevering Through Change',
  focus_dealing_with_uncertainty: 'Dealing with Uncertainty',
  focus_bouncing_back: 'Bouncing Back / Resilience',
  focus_new_environment: 'New Environment',
  focus_relationship_with_self: 'Relationship with Self',
};

const ScaleBaselineDashboard: React.FC = () => {
  const [surveyData, setSurveyData] = useState<ScaleWelcomeSurvey[]>([]);
  const [benchmarks, setBenchmarks] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
        
        setCompanyName(accName || company);

        // Build company filter using helper
        const companyFilter = buildCompanyFilter(companyId, accName, company);

        console.log('ScaleBaselineDashboard using company filter:', companyFilter);

        // Fetch survey data - already filtered by company at query level
        const data = await getWelcomeSurveyScaleData(companyFilter);
        setSurveyData(data as unknown as ScaleWelcomeSurvey[]);

        // Fetch benchmarks
        const { data: benchmarkData, error: benchmarkError } = await supabase
          .from('boon_benchmarks')
          .select('*')
          .eq('program_type', 'Scale');

        if (!benchmarkError && benchmarkData) {
          const bm: Record<string, any> = {};
          benchmarkData.forEach((b: any) => {
            bm[b.metric_name] = {
              avg: b.avg_value,
              p25: b.percentile_25,
              p75: b.percentile_75,
              sampleSize: b.sample_size
            };
          });
          setBenchmarks(bm);
        }
      } catch (err) {
        console.error("Scale Baseline Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    if (loading || surveyData.length === 0) return null;

    const total = surveyData.length;

    // Role distribution
    const roleCounts: Record<string, number> = {};
    surveyData.forEach(s => {
      const role = s.role || 'Unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    const mostCommonRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Wellbeing averages
    const avgSatisfaction = surveyData.reduce((sum, s) => sum + (s.satisfaction || 0), 0) / total;
    const avgProductivity = surveyData.reduce((sum, s) => sum + (s.productivity || 0), 0) / total;
    const avgWorkLifeBalance = surveyData.reduce((sum, s) => sum + (s.work_life_balance || 0), 0) / total;

    // Focus areas - count how many selected each
    const focusAreaCounts: Record<string, number> = {};
    Object.keys(FOCUS_AREA_LABELS).forEach(key => {
      focusAreaCounts[key] = surveyData.filter(s => (s as any)[key] === true).length;
    });

    // Sort focus areas by count
    const sortedFocusAreas = Object.entries(focusAreaCounts)
      .map(([key, count]) => ({
        key,
        label: FOCUS_AREA_LABELS[key],
        count,
        pct: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // Age distribution
    const ageCounts: Record<string, number> = {};
    surveyData.forEach(s => {
      const age = s.age_range || 'Unknown';
      ageCounts[age] = (ageCounts[age] || 0) + 1;
    });

    // Tenure distribution
    const tenureCounts: Record<string, number> = {};
    surveyData.forEach(s => {
      const tenure = s.tenure || 'Unknown';
      tenureCounts[tenure] = (tenureCounts[tenure] || 0) + 1;
    });

    // Previous coaching - handle numeric (0, 1) or boolean values
    const previousCoachingCounts: Record<string, number> = { 'Yes': 0, 'No': 0 };
    surveyData.forEach(s => {
      // Fix: cast to any to allow loose comparison of legacy data types
      const val: any = s.previous_coaching;
      // Check for truthy value (1, 1.0, true, "1", "yes", etc.)
      if (val === 1 || val === 1.0 || val === true || val === '1' || val === 'yes' || val === 'Yes') {
        previousCoachingCounts['Yes']++;
      } else {
        previousCoachingCounts['No']++;
      }
    });

    // Gender distribution
    const genderCounts: Record<string, number> = {};
    surveyData.forEach(s => {
      const gender = s.gender || 'Unknown';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    });

    // New to coaching percentage
    const newToCoachingPct = (previousCoachingCounts['No'] / total) * 100;

    // Top 5 focus areas
    const top5FocusAreas = sortedFocusAreas.slice(0, 5);

    return {
      total,
      mostCommonRole,
      avgSatisfaction,
      avgProductivity,
      avgWorkLifeBalance,
      sortedFocusAreas,
      top5FocusAreas,
      ageCounts,
      tenureCounts,
      previousCoachingCounts,
      roleCounts,
      genderCounts,
      newToCoachingPct
    };
  }, [surveyData, loading]);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64"></div>
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics || metrics.total === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No baseline survey data found for this account.</p>
      </div>
    );
  }

  const m = metrics;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-boon-dark flex items-center gap-3">
          COHORT BASELINE <Target className="w-6 h-6 text-boon-purple" />
        </h1>
        <p className="text-gray-500 text-sm mt-1">Initial welcome survey data analysis.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard
          icon={<Users className="w-5 h-5 text-boon-blue" />}
          label="PARTICIPANTS"
          value={m.total}
        />
        <SummaryCard
          icon={<Briefcase className="w-5 h-5 text-boon-purple" />}
          label="MOST COMMON ROLE"
          value={m.mostCommonRole}
          isText
        />
        <SummaryCardWithBenchmark
          icon={<Smile className="w-5 h-5 text-boon-green" />}
          label="AVG SATISFACTION"
          value={m.avgSatisfaction}
          benchmark={benchmarks.baseline_satisfaction?.avg}
          suffix="/ 10"
        />
        <SummaryCardWithBenchmark
          icon={<TrendingUp className="w-5 h-5 text-boon-coral" />}
          label="AVG PRODUCTIVITY"
          value={m.avgProductivity}
          benchmark={benchmarks.baseline_productivity?.avg}
          suffix="/ 10"
        />
        <SummaryCardWithBenchmark
          icon={<Heart className="w-5 h-5 text-boon-blue" />}
          label="WORK-LIFE BALANCE"
          value={m.avgWorkLifeBalance}
          benchmark={benchmarks.baseline_work_life_balance?.avg}
          suffix="/ 10"
        />
      </div>

      {/* Top 5 Focus Areas Callout */}
      <div className="bg-gradient-to-r from-boon-purple/10 to-boon-blue/10 p-6 rounded-2xl border border-boon-purple/20">
        <h3 className="text-sm font-bold text-boon-dark mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-boon-purple" /> Top 5 Coaching Priorities
        </h3>
        <div className="flex flex-wrap gap-3">
          {m.top5FocusAreas.map((focus, idx) => (
            <div 
              key={focus.key}
              className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2"
            >
              <span className="w-6 h-6 rounded-full bg-boon-purple text-white text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="text-sm font-medium text-gray-700">{focus.label}</span>
              <span className="text-xs text-gray-400">({focus.pct.toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Focus Areas - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Target className="w-4 h-4 text-boon-purple" /> Coaching Focus Areas
            </h3>
            <p className="text-sm text-gray-500 mb-6">What participants want to work on with their coach</p>
            
            <div className="space-y-4">
              {m.sortedFocusAreas.filter(f => f.count > 0).map((focus, idx) => (
                <div key={focus.key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{focus.label}</span>
                    <span className="text-sm font-bold text-gray-900">{focus.count} (<CountUp end={focus.pct} duration={1200} decimals={0} />%)</span>
                  </div>
                  <AnimatedProgressBar 
                    value={focus.pct} 
                    max={100} 
                    color={idx < 3 ? 'bg-boon-purple' : idx < 6 ? 'bg-boon-pink' : 'bg-boon-green'} 
                    height="h-2.5" 
                  />
                </div>
              ))}
              {m.sortedFocusAreas.filter(f => f.count > 0).length === 0 && (
                <p className="text-gray-400 text-sm italic">No focus areas selected</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Demographics */}
        <div className="space-y-6">
          <DemographicCard
            icon={<Calendar className="w-4 h-4 text-boon-blue" />}
            title="AGE DISTRIBUTION"
            data={m.ageCounts}
            total={m.total}
          />
          <DemographicCard
            icon={<Users className="w-4 h-4 text-boon-pink" />}
            title="GENDER"
            data={m.genderCounts}
            total={m.total}
          />
          <DemographicCard
            icon={<Clock className="w-4 h-4 text-boon-purple" />}
            title="TENURE"
            data={m.tenureCounts}
            total={m.total}
          />
          <DemographicCard
            icon={<Briefcase className="w-4 h-4 text-boon-green" />}
            title="ROLE"
            data={m.roleCounts}
            total={m.total}
          />
          <DemographicCard
            icon={<Award className="w-4 h-4 text-boon-coral" />}
            title="PREVIOUS COACHING"
            data={m.previousCoachingCounts}
            total={m.total}
          />
        </div>
      </div>
    </div>
  );
};

// Sub-components

const SummaryCard = ({ icon, label, value, suffix, isText }: any) => (
  <HoverCard className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-3">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`${isText ? 'text-lg' : 'text-3xl'} font-black text-boon-dark`}>
      {isText ? value : <CountUp end={value} duration={1500} decimals={0} />}
      {suffix && <span className="text-sm font-medium text-gray-400 ml-1">{suffix}</span>}
    </div>
  </HoverCard>
);

const SummaryCardWithBenchmark = ({ icon, label, value, benchmark, suffix }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  benchmark?: number;
  suffix?: string;
}) => {
  const pctDiff = benchmark ? ((value - benchmark) / benchmark) * 100 : null;
  const isAbove = pctDiff !== null && pctDiff > 0;
  const isBelow = pctDiff !== null && pctDiff < 0;

  return (
    <HoverCard className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-black text-boon-dark">
        <CountUp end={value} duration={1500} decimals={1} />
        {suffix && <span className="text-sm font-medium text-gray-400 ml-1">{suffix}</span>}
      </div>
      {pctDiff !== null && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${isAbove ? 'text-green-600' : isBelow ? 'text-amber-600' : 'text-gray-400'}`}>
          {isAbove ? <TrendingUp size={12} /> : isBelow ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{isAbove ? '+' : ''}{pctDiff.toFixed(0)}% vs Boon avg</span>
        </div>
      )}
    </HoverCard>
  );
};

const WellbeingGauge = ({ label, value }: { label: string; value: number }) => {
  const percentage = (value / 10) * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#E5E7EB"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#3B82F6"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-boon-dark">{value.toFixed(1)}</span>
        </div>
      </div>
      <span className="text-xs font-bold text-gray-600 mt-2 text-center uppercase tracking-wide">{label}</span>
    </div>
  );
};

const WellbeingGaugeWithBenchmark = ({ label, value, benchmark }: { label: string; value: number; benchmark?: number }) => {
  const percentage = (value / 10) * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const diff = benchmark ? value - benchmark : null;
  const isAbove = diff !== null && diff > 0;
  const isBelow = diff !== null && diff < 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#E5E7EB"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke={isAbove ? '#10B981' : isBelow ? '#F59E0B' : '#3B82F6'}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-boon-dark">{value.toFixed(1)}</span>
        </div>
      </div>
      <span className="text-xs font-bold text-gray-600 mt-2 text-center uppercase tracking-wide">{label}</span>
      {benchmark && (
        <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${isAbove ? 'text-green-600' : isBelow ? 'text-amber-600' : 'text-gray-400'}`}>
          {isAbove ? <TrendingUp size={10} /> : isBelow ? <TrendingDown size={10} /> : <Minus size={10} />}
          <span>{isAbove ? '+' : ''}{diff?.toFixed(1)} vs Boon avg</span>
        </div>
      )}
    </div>
  );
};
const DemographicCard = ({ icon, title, data, total }: {
  icon: React.ReactNode;
  title: string;
  data: Record<string, number>;
  total: number;
}) => {
  const sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
  
  return (
    <HoverCard className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        {icon} {title}
      </h4>
      <div className="space-y-3">
        {sortedData.map(([label, count]) => (
          <div key={label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-600">{label}</span>
              <span className="text-xs font-bold text-gray-800">{((count / total) * 100).toFixed(0)}%</span>
            </div>
            <AnimatedProgressBar 
              value={(count / total) * 100} 
              max={100} 
              color="bg-boon-blue" 
              height="h-1.5" 
            />
          </div>
        ))}
      </div>
    </HoverCard>
  );
};

export default ScaleBaselineDashboard;