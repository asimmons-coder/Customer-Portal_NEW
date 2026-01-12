import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardSessions, getProgramConfig, CompanyFilter, buildCompanyFilter } from '../lib/dataFetcher';
import { SessionWithEmployee, ProgramConfig } from '../types';
import { supabase } from '../lib/supabaseClient';
import { CountUp, AnimatedProgressBar, HoverCard } from './Animations';
import { 
  Lightbulb, 
  Filter, 
  Calendar,
  AlertCircle,
  TrendingUp,
  BrainCircuit,
  Users,
  MessageCircle,
  Info,
  ChevronDown
} from 'lucide-react';
import ExecutiveSignals from './ExecutiveSignals';

type TimeRange = '3M' | '6M' | '12M' | 'ALL';

const COLORS = {
  mental: '#466FF6', // Boon Blue
  leadership: '#C47ACC', // Boon Purple
  communication: '#FF8D80' // Boon Coral
};

const ThemesDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<SessionWithEmployee[]>([]);
  const [programConfig, setProgramConfig] = useState<ProgramConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [selectedProgram, setSelectedProgram] = useState<string>('All Cohorts');

  useEffect(() => {
    const fetchSessions = async () => {
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

        console.log('ThemesDashboard using company filter:', companyFilter);
        
        const [data, configData] = await Promise.all([
          getDashboardSessions(companyFilter),
          getProgramConfig(companyFilter)
        ]);
        
        // Sort program config by start date (most recent first)
        const sortedConfig = configData.sort((a, b) => {
          const dateA = a.program_start_date ? new Date(a.program_start_date).getTime() : 0;
          const dateB = b.program_start_date ? new Date(b.program_start_date).getTime() : 0;
          return dateB - dateA;
        });
        
        setSessions(data);
        setProgramConfig(sortedConfig);
      } catch (err: any) {
        setError(err.message || 'Failed to load session data');
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  // Get unique programs sorted by start date
  const programs = useMemo(() => {
    const uniquePrograms = [...new Set(programConfig.map(p => p.program_title).filter(Boolean))];
    return ['All Cohorts', ...uniquePrograms];
  }, [programConfig]);

  // --- Data Processing ---
  const processedData = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    
    // Set cutoff based on filter
    if (timeRange === '3M') cutoffDate.setMonth(now.getMonth() - 3);
    else if (timeRange === '6M') cutoffDate.setMonth(now.getMonth() - 6);
    else if (timeRange === '12M') cutoffDate.setMonth(now.getMonth() - 12);
    else cutoffDate.setFullYear(1900); // ALL

    // 1. Filter sessions by time range AND program
    const validSessions = sessions.filter(s => {
      const d = new Date(s.session_date);
      const status = (s.status || '').toLowerCase();
      // Only Completed sessions within time range
      const isCompleted = !status.includes('no show') && 
                          !status.includes('late cancel') && 
                          (status.includes('completed') || (status === '' && d < now));
      
      // Filter by program if selected
      if (selectedProgram !== 'All Cohorts') {
        const sessionProgram = (s as any).program_title || '';
        if (sessionProgram !== selectedProgram) return false;
      }
      
      return isCompleted && d >= cutoffDate && d <= now;
    });

    // 2. Aggregate for Trend Chart (Monthly)
    const monthlyStats = new Map<string, { date: Date, mental: number, leadership: number, comms: number, total: number }>();

    // 3. Aggregate for Bar Charts (Sub-themes)
    const subThemes = {
      mental: new Map<string, number>(),
      leadership: new Map<string, number>(),
      comms: new Map<string, number>()
    };

    validSessions.forEach(s => {
      const d = new Date(s.session_date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, { 
          date: new Date(d.getFullYear(), d.getMonth(), 1), 
          mental: 0, 
          leadership: 0, 
          comms: 0, 
          total: 0 
        });
      }
      
      const stat = monthlyStats.get(monthKey)!;
      stat.total++;

      // Helpers to process semi-colon separated strings
      const processField = (field: string | undefined, category: 'mental' | 'leadership' | 'comms') => {
        if (!field) return false;
        const themes = field.split(';').map(t => t.trim()).filter(t => t.length > 0);
        
        if (themes.length > 0) {
          // Increment monthly category counter (count session once per category if it has any tag)
          stat[category]++;
          
          // Increment sub-theme counters
          themes.forEach(theme => {
            const map = subThemes[category];
            map.set(theme, (map.get(theme) || 0) + 1);
          });
          return true;
        }
        return false;
      };

      processField(s.mental_well_being, 'mental');
      processField(s.leadership_management_skills, 'leadership');
      processField(s.communication_skills, 'comms');
    });

    // Sort monthly stats by date
    const trends = Array.from(monthlyStats.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(t => ({
        label: t.date.toLocaleString('default', { month: 'short', year: '2-digit' }),
        // Calculate % of sessions that touched this theme
        mentalPct: t.total ? Math.round((t.mental / t.total) * 100) : 0,
        leadershipPct: t.total ? Math.round((t.leadership / t.total) * 100) : 0,
        commsPct: t.total ? Math.round((t.comms / t.total) * 100) : 0,
        total: t.total
      }));

    // Convert sub-themes to sorted arrays
    const getTopThemes = (map: Map<string, number>) => {
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5
        .map(([name, count]) => ({ name, count }));
    };

    return {
      trends,
      topMental: getTopThemes(subThemes.mental),
      topLeadership: getTopThemes(subThemes.leadership),
      topComms: getTopThemes(subThemes.comms),
      totalSessions: validSessions.length
    };
  }, [sessions, timeRange, selectedProgram]);

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="h-64 bg-gray-200 rounded-2xl mb-8"></div>
        <div className="grid grid-cols-3 gap-6">
           <div className="h-64 bg-gray-200 rounded-2xl"></div>
           <div className="h-64 bg-gray-200 rounded-2xl"></div>
           <div className="h-64 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm border border-red-100">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Unable to load theme data</h2>
        <p className="text-gray-500 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-boon-dark tracking-tight uppercase flex items-center gap-3">
            Coaching Themes <Lightbulb className="w-6 h-6 md:w-8 md:h-8 text-boon-yellow fill-boon-yellow/20" />
          </h1>
          <p className="text-gray-500 font-medium mt-2 text-sm md:text-base">
            Analyze the distribution of coaching topics across {processedData.totalSessions} completed sessions.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {/* Program Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-10 text-sm font-semibold text-boon-dark shadow-sm cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-boon-blue/20 min-w-[200px]"
            >
              {programs.map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Time Range Filter */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex items-center overflow-x-auto">
            {(['3M', '6M', '12M', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 md:px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  timeRange === range 
                    ? 'bg-boon-dark text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {range === 'ALL' ? 'All Time' : `Last ${range}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ExecutiveSignals hidden for now
      <ExecutiveSignals context="Coaching Themes" data={processedData} />
      */}

      {/* Main Trend Chart */}
      <div className="bg-white rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <h3 className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Category Trends (% of Sessions)
          </h3>
          <div className="flex flex-wrap gap-4 text-[10px] md:text-xs font-bold uppercase tracking-wide">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.mental }}></span>
              Mental Well-being
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.leadership }}></span>
              Leadership
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.communication }}></span>
              Communication
            </div>
          </div>
        </div>
        
        <div className="h-48 md:h-64 w-full">
          <ThemeTrendChart data={processedData.trends} />
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mental Well-being Card */}
        <ThemeCard 
          title="Mental Well-being" 
          icon={<BrainCircuit className="w-5 h-5" />}
          color={COLORS.mental}
          data={processedData.topMental}
          totalCount={processedData.topMental.reduce((a, b) => a + b.count, 0)}
        />

        {/* Leadership Card */}
        <ThemeCard 
          title="Leadership Skills" 
          icon={<Users className="w-5 h-5" />}
          color={COLORS.leadership}
          data={processedData.topLeadership}
          totalCount={processedData.topLeadership.reduce((a, b) => a + b.count, 0)}
        />

        {/* Communication Card */}
        <ThemeCard 
          title="Communication" 
          icon={<MessageCircle className="w-5 h-5" />}
          color={COLORS.communication}
          data={processedData.topComms}
          totalCount={processedData.topComms.reduce((a, b) => a + b.count, 0)}
        />
      </div>
    </div>
  );
};

// --- Sub-Components ---

const ThemeCard = ({ 
  title, 
  icon, 
  color, 
  data,
  totalCount
}: { 
  title: string, 
  icon: React.ReactNode, 
  color: string, 
  data: { name: string, count: number }[],
  totalCount: number
}) => {
  const maxVal = Math.max(...data.map(d => d.count), 1);

  return (
    <HoverCard className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
        <div className="p-3 rounded-xl text-white shadow-md" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-lg text-boon-dark leading-tight">{title}</h3>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Top Sub-themes</p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {data.length > 0 ? (
          data.map((item, i) => (
            <ThemeBarRow 
              key={i} 
              name={item.name} 
              count={item.count} 
              maxVal={maxVal} 
              color={color} 
              delay={i * 100}
            />
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
            <Info className="w-8 h-8 mb-2" />
            <p className="text-sm">No data recorded</p>
          </div>
        )}
      </div>
    </HoverCard>
  );
};

// Animated bar row for theme cards
const ThemeBarRow = ({ name, count, maxVal, color, delay }: {
  name: string;
  count: number;
  maxVal: number;
  color: string;
  delay: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const percentage = (count / maxVal) * 100;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="group">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold text-gray-700 group-hover:text-boon-dark transition-colors">
          {name}
        </span>
        <span className="font-bold text-gray-400">
          <CountUp end={count} duration={1200} decimals={0} />
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ 
            width: isVisible ? `${percentage}%` : '0%',
            backgroundColor: color,
            opacity: 0.8,
            transitionDelay: `${delay}ms`
          }}
        />
      </div>
    </div>
  );
};

const ThemeTrendChart = ({ data }: { data: any[] }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium bg-gray-50 rounded-xl border border-dashed border-gray-200">
        No trend data available for this period
      </div>
    );
  }

  const width = 1000;
  const height = 300;
  const paddingX = 60;
  const paddingY = 40;
  const graphHeight = height - paddingY * 2;
  const graphWidth = width - paddingX * 2;

  // Grid lines
  const yTicks = [0, 25, 50, 75, 100];
  
  // Calculate points
  const getPoints = (key: string) => {
    return data.map((d, i) => {
      const x = paddingX + (i / (data.length - 1 || 1)) * graphWidth;
      const y = height - paddingY - (d[key] / 100) * graphHeight;
      return `${x},${y}`;
    }).join(' ');
  };

  const getCoordinates = (i: number) => {
    return paddingX + (i / (data.length - 1 || 1)) * graphWidth;
  };

  const mentalPoints = getPoints('mentalPct');
  const leadershipPoints = getPoints('leadershipPct');
  const commsPoints = getPoints('commsPct');

  return (
    <div className="w-full h-full relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-sans">
        {/* Y-Axis Grid */}
        {yTicks.map(tick => {
          const y = height - paddingY - (tick / 100) * graphHeight;
          return (
            <g key={tick}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-xs fill-gray-400 font-medium">
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Lines */}
        <polyline points={mentalPoints} fill="none" stroke={COLORS.mental} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={leadershipPoints} fill="none" stroke={COLORS.leadership} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={commsPoints} fill="none" stroke={COLORS.communication} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover Effects & Tooltip Interaction Area */}
        {data.map((d, i) => {
          const x = getCoordinates(i);
          const isHovered = hoverIndex === i;

          return (
            <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
              {/* Invisible touch target column */}
              <rect x={x - (graphWidth / data.length / 2)} y={paddingY} width={graphWidth / data.length} height={graphHeight} fill="transparent" />
              
              {/* Vertical line indicator */}
              <line 
                x1={x} y1={paddingY} x2={x} y2={height - paddingY} 
                stroke="#E5E7EB" 
                strokeWidth="1" 
                strokeDasharray="4 4"
                className={`transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* Data Points */}
              {['mentalPct', 'leadershipPct', 'commsPct'].map((key, idx) => {
                 const color = idx === 0 ? COLORS.mental : idx === 1 ? COLORS.leadership : COLORS.communication;
                 const val = d[key];
                 const y = height - paddingY - (val / 100) * graphHeight;
                 return (
                   <circle 
                    key={key} 
                    cx={x} cy={y} 
                    r={isHovered ? 6 : 4} 
                    fill="white" stroke={color} strokeWidth="3" 
                    className="transition-all duration-200"
                   />
                 );
              })}

              {/* X-Axis Label */}
              <text 
                x={x} y={height - 10} textAnchor="middle" 
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${isHovered ? 'fill-boon-dark' : 'fill-gray-400'}`}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip HTML Overlay */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div 
          className="absolute z-10 top-0 left-0 bg-white p-4 rounded-xl shadow-xl border border-gray-100 pointer-events-none transform -translate-x-1/2 -translate-y-4 w-48"
          style={{ 
            left: `${(paddingX + (hoverIndex / (data.length - 1 || 1)) * graphWidth) / width * 100}%`,
            top: '20%'
          }}
        >
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{data[hoverIndex].label}</div>
          <div className="space-y-2">
             <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background: COLORS.mental}}/> Mental</span>
                <span>{data[hoverIndex].mentalPct}%</span>
             </div>
             <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background: COLORS.leadership}}/> Leadership</span>
                <span>{data[hoverIndex].leadershipPct}%</span>
             </div>
             <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background: COLORS.communication}}/> Comms</span>
                <span>{data[hoverIndex].commsPct}%</span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemesDashboard;