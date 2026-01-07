// ============================================
// ANIMATION UTILITIES & COMPONENTS
// Add these to your dashboard for premium feel
// ============================================

import React, { useState, useEffect, useRef } from 'react';

// ============================================
// 1. NUMBER COUNT-UP ANIMATION
// ============================================

interface CountUpProps {
  end: number;
  duration?: number; // ms
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 1500,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = ''
}) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Use Intersection Observer to start animation when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (end - startValue) * easeOut;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  );
};

// Specialized versions for common use cases
export const CountUpSessions: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <CountUp end={value} duration={1200} className={className} />
);

export const CountUpPercentage: React.FC<{ value: number; showPlus?: boolean; className?: string }> = ({ 
  value, 
  showPlus = true, 
  className 
}) => (
  <CountUp 
    end={value} 
    duration={1500} 
    prefix={showPlus && value > 0 ? '+' : ''} 
    suffix="%" 
    decimals={0}
    className={className} 
  />
);

export const CountUpNPS: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <CountUp 
    end={value} 
    duration={1500} 
    prefix={value > 0 ? '+' : ''} 
    decimals={0}
    className={className} 
  />
);

export const CountUpRating: React.FC<{ value: number; max?: number; className?: string }> = ({ 
  value, 
  max = 10, 
  className 
}) => (
  <span className={className}>
    <CountUp end={value} duration={1200} decimals={1} />/{max}
  </span>
);


// ============================================
// 2. SKELETON LOADERS
// ============================================

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', animate = true }) => (
  <div 
    className={`bg-gray-200 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
  />
);

// Pre-built skeleton layouts matching your dashboard
export const SkeletonStatCard: React.FC = () => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-4">
      <Skeleton className="w-5 h-5 rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="h-10 w-20 mb-2" />
    <Skeleton className="h-3 w-32" />
  </div>
);

export const SkeletonHeroCard: React.FC = () => (
  <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col items-center">
    <div className="w-full h-2 bg-gray-200 rounded absolute top-0 left-0" />
    <Skeleton className="h-6 w-48 mb-4" />
    <Skeleton className="h-24 w-32 mb-4" />
    <Skeleton className="h-6 w-64 mb-6" />
    <Skeleton className="h-4 w-80" />
  </div>
);

export const SkeletonCompetencyBar: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 flex-1 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    ))}
  </div>
);

export const SkeletonFeedbackCard: React.FC = () => (
  <div className="bg-white rounded-xl p-4 border border-gray-100">
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-3/4 mb-3" />
    <Skeleton className="h-3 w-32" />
  </div>
);

export const SkeletonActivityItem: React.FC = () => (
  <div className="flex items-start gap-3 py-3">
    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
    <div className="flex-1">
      <Skeleton className="h-4 w-48 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

// Full dashboard skeleton
export const SkeletonDashboard: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    {/* Hero */}
    <SkeletonHeroCard />
    
    {/* Stats Row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
      <SkeletonStatCard />
    </div>
    
    {/* Main Content */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Competencies */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Skeleton className="h-5 w-48 mb-6" />
          <SkeletonCompetencyBar />
        </div>
        
        {/* Feedback */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-4">
            <SkeletonFeedbackCard />
            <SkeletonFeedbackCard />
          </div>
        </div>
      </div>
      
      {/* Sidebar */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-1">
            <SkeletonActivityItem />
            <SkeletonActivityItem />
            <SkeletonActivityItem />
            <SkeletonActivityItem />
          </div>
        </div>
      </div>
    </div>
  </div>
);


// ============================================
// 3. ANIMATED PROGRESS BAR
// ============================================

interface AnimatedProgressBarProps {
  value: number; // 0-100
  max?: number;
  color?: string;
  bgColor?: string;
  height?: string;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'outside';
  className?: string;
  delay?: number; // ms delay before animation starts
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  value,
  max = 100,
  color = 'bg-boon-blue',
  bgColor = 'bg-gray-100',
  height = 'h-2',
  showLabel = false,
  labelPosition = 'outside',
  className = '',
  delay = 0
}) => {
  const [width, setWidth] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      setWidth(percentage);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, percentage, delay]);

  return (
    <div ref={ref} className={`w-full ${className}`}>
      <div className={`w-full ${bgColor} rounded-full ${height} overflow-hidden`}>
        <div
          className={`${color} ${height} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        >
          {showLabel && labelPosition === 'inside' && width > 10 && (
            <span className="text-xs text-white font-medium px-2">
              {value.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      {showLabel && labelPosition === 'outside' && (
        <span className="text-sm text-gray-600 mt-1">
          {value.toFixed(0)}%
        </span>
      )}
    </div>
  );
};

// Competency growth bar with before/after
interface CompetencyGrowthBarProps {
  name: string;
  preScore: number;
  postScore: number;
  maxScore?: number;
  delay?: number;
}

export const CompetencyGrowthBar: React.FC<CompetencyGrowthBarProps> = ({
  name,
  preScore,
  postScore,
  maxScore = 5,
  delay = 0
}) => {
  const [animate, setAnimate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const growth = postScore - preScore;
  const growthPct = preScore > 0 ? ((growth / preScore) * 100) : 0;
  const preWidth = (preScore / maxScore) * 100;
  const postWidth = (postScore / maxScore) * 100;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animate) {
          setTimeout(() => setAnimate(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [animate, delay]);

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{name}</span>
        <span className={`text-sm font-bold ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-500' : 'text-gray-500'}`}>
          {growth > 0 ? '+' : ''}{growthPct.toFixed(0)}%
        </span>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        {/* Pre score (faded) */}
        <div 
          className="absolute top-0 left-0 h-full bg-gray-300 rounded-full transition-all duration-1000 ease-out"
          style={{ width: animate ? `${preWidth}%` : '0%' }}
        />
        {/* Post score (solid) */}
        <div 
          className="absolute top-0 left-0 h-full bg-boon-green rounded-full transition-all duration-1000 ease-out delay-300"
          style={{ width: animate ? `${postWidth}%` : '0%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{preScore.toFixed(1)} → {postScore.toFixed(1)}</span>
      </div>
    </div>
  );
};


// ============================================
// 4. HOVER CARD WRAPPER
// ============================================

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
  hoverScale?: number;
  hoverShadow?: 'sm' | 'md' | 'lg' | 'xl';
  hoverBorder?: boolean;
}

export const HoverCard: React.FC<HoverCardProps> = ({
  children,
  className = '',
  hoverScale = 1.01,
  hoverShadow = 'lg',
  hoverBorder = true
}) => {
  const shadowClasses = {
    sm: 'hover:shadow-sm',
    md: 'hover:shadow-md',
    lg: 'hover:shadow-lg',
    xl: 'hover:shadow-xl'
  };

  return (
    <div 
      className={`
        transition-all duration-200 ease-out
        ${shadowClasses[hoverShadow]}
        ${hoverBorder ? 'hover:border-gray-200' : ''}
        ${className}
      `}
      style={{
        transform: 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `translateY(-2px) scale(${hoverScale})`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
      }}
    >
      {children}
    </div>
  );
};

// Stat card with built-in hover effect
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subtext?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

export const AnimatedStatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtext,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: 'text-boon-blue',
    green: 'text-boon-green',
    purple: 'text-purple-600',
    orange: 'text-orange-500'
  };

  const bgClasses = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    purple: 'bg-purple-50',
    orange: 'bg-orange-50'
  };

  return (
    <HoverCard className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${bgClasses[color]}`}>
          <span className={colorClasses[color]}>{icon}</span>
        </div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className={`text-3xl font-bold ${colorClasses[color]} mb-1`}>
        {value}
      </div>
      {subtext && (
        <p className="text-sm text-gray-500">{subtext}</p>
      )}
    </HoverCard>
  );
};


// ============================================
// 5. FADE IN ON SCROLL
// ============================================

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  direction = 'up',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)';
    switch (direction) {
      case 'up': return 'translate(0, 20px)';
      case 'down': return 'translate(0, -20px)';
      case 'left': return 'translate(20px, 0)';
      case 'right': return 'translate(-20px, 0)';
      default: return 'translate(0, 0)';
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
      }}
    >
      {children}
    </div>
  );
};

// Staggered children animation
interface StaggeredProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export const Staggered: React.FC<StaggeredProps> = ({
  children,
  staggerDelay = 100,
  className = ''
}) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <FadeIn delay={index * staggerDelay} direction="up">
          {child}
        </FadeIn>
      ))}
    </div>
  );
};


// ============================================
// 5. ANIMATED BAR CHART
// ============================================

interface BarData {
  label: string;
  value: number;
  preValue?: number;
  color?: string;
}

interface AnimatedBarChartProps {
  data: BarData[];
  maxValue?: number;
  showValues?: boolean;
  showPercentChange?: boolean;
  barHeight?: number;
  colors?: {
    pre?: string;
    post?: string;
    single?: string;
  };
  className?: string;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  maxValue,
  showValues = true,
  showPercentChange = true,
  barHeight = 12,
  colors = {
    pre: 'bg-gray-300',
    post: 'bg-boon-green',
    single: 'bg-boon-blue'
  },
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const calculatedMax = maxValue || Math.max(...data.map(d => Math.max(d.value, d.preValue || 0)));

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
    <div ref={ref} className={`w-full ${className}`}>
      <div className="space-y-4">
        {data.map((item, index) => {
          const hasPrePost = item.preValue !== undefined;
          const postWidth = (item.value / calculatedMax) * 100;
          const preWidth = hasPrePost ? ((item.preValue || 0) / calculatedMax) * 100 : 0;
          const percentChange = hasPrePost && item.preValue 
            ? ((item.value - item.preValue) / item.preValue) * 100 
            : 0;
          
          return (
            <div key={item.label} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <div className="flex items-center gap-3">
                  {showValues && hasPrePost && (
                    <span className="text-xs text-gray-500">
                      {item.preValue?.toFixed(1)} → {item.value.toFixed(1)}
                    </span>
                  )}
                  {showValues && !hasPrePost && (
                    <span className="text-sm font-bold text-gray-700">
                      {item.value.toFixed(1)}
                    </span>
                  )}
                  {showPercentChange && hasPrePost && percentChange !== 0 && (
                    <span className={`text-sm font-bold ${percentChange > 0 ? 'text-boon-green' : 'text-red-500'}`}>
                      {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              
              <div className="relative" style={{ height: hasPrePost ? barHeight * 2 + 4 : barHeight }}>
                {hasPrePost ? (
                  <>
                    <div 
                      className="absolute top-0 left-0 w-full bg-gray-100 rounded-full overflow-hidden"
                      style={{ height: barHeight }}
                    >
                      <div
                        className={`h-full rounded-full ${colors.pre} transition-all duration-1000 ease-out`}
                        style={{ 
                          width: isVisible ? `${preWidth}%` : '0%',
                          transitionDelay: `${index * 100}ms`
                        }}
                      />
                    </div>
                    <div 
                      className="absolute left-0 w-full bg-gray-100 rounded-full overflow-hidden"
                      style={{ height: barHeight, top: barHeight + 4 }}
                    >
                      <div
                        className={`h-full rounded-full ${item.color || colors.post} transition-all duration-1000 ease-out`}
                        style={{ 
                          width: isVisible ? `${postWidth}%` : '0%',
                          transitionDelay: `${index * 100 + 200}ms`
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div 
                    className="absolute top-0 left-0 w-full bg-gray-100 rounded-full overflow-hidden"
                    style={{ height: barHeight }}
                  >
                    <div
                      className={`h-full rounded-full ${item.color || colors.single} transition-all duration-1000 ease-out`}
                      style={{ 
                        width: isVisible ? `${postWidth}%` : '0%',
                        transitionDelay: `${index * 100}ms`
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {data.some(d => d.preValue !== undefined) && (
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${colors.pre}`} />
            <span>Before</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${colors.post}`} />
            <span>After</span>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================
// 6. ANIMATED DONUT CHART
// ============================================

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface AnimatedDonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  showCenter?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}

export const AnimatedDonutChart: React.FC<AnimatedDonutChartProps> = ({
  data,
  size = 200,
  strokeWidth = 24,
  showLegend = true,
  showCenter = true,
  centerLabel,
  centerValue,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

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

  let cumulativePercent = 0;
  const segments = data.map((item, index) => {
    const percent = total > 0 ? item.value / total : 0;
    const offset = cumulativePercent * circumference;
    const length = percent * circumference;
    cumulativePercent += percent;
    
    return {
      ...item,
      percent,
      offset,
      length,
      delay: index * 200
    };
  });

  return (
    <div ref={ref} className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                strokeDasharray: isVisible 
                  ? `${segment.length} ${circumference - segment.length}`
                  : `0 ${circumference}`,
                strokeDashoffset: isVisible ? -segment.offset : 0,
                transitionDelay: `${segment.delay}ms`
              }}
            />
          ))}
        </svg>
        
        {showCenter && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-2xl font-bold text-gray-900">
                {typeof centerValue === 'number' ? (
                  <CountUp end={centerValue} duration={1500} />
                ) : (
                  centerValue
                )}
              </span>
            )}
            {centerLabel && (
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {segments.map(segment => (
            <div key={segment.label} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-600">
                {segment.label} ({(segment.percent * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// ============================================
// 7. NPS DONUT CHART (Pre-configured)
// ============================================

interface NPSDonutChartProps {
  promoters: number;
  passives: number;
  detractors: number;
  npsScore: number;
  size?: number;
  className?: string;
}

export const NPSDonutChart: React.FC<NPSDonutChartProps> = ({
  promoters,
  passives,
  detractors,
  npsScore,
  size = 180,
  className = ''
}) => {
  const data: DonutSegment[] = [
    { label: 'Promoters', value: promoters, color: '#22c55e' },
    { label: 'Passives', value: passives, color: '#facc15' },
    { label: 'Detractors', value: detractors, color: '#ef4444' }
  ];

  return (
    <AnimatedDonutChart
      data={data}
      size={size}
      strokeWidth={20}
      showCenter={true}
      centerValue={npsScore > 0 ? `+${npsScore}` : npsScore.toString()}
      centerLabel="NPS"
      className={className}
    />
  );
};


// ============================================
// USAGE EXAMPLES
// ============================================

/*
// 1. Count-up numbers:
<CountUpSessions value={897} className="text-3xl font-bold" />
<CountUpPercentage value={4} className="text-6xl font-black text-boon-green" />
<CountUpNPS value={69} className="text-3xl font-bold" />
<CountUpRating value={9.1} className="text-3xl font-bold" />

// 2. Skeleton loaders (while data loads):
{loading ? <SkeletonDashboard /> : <ActualDashboard />}

// Or individual pieces:
{loading ? <SkeletonStatCard /> : <StatCard ... />}

// 3. Animated progress bars:
<AnimatedProgressBar value={71} color="bg-boon-blue" />

<CompetencyGrowthBar 
  name="Strategic Thinking" 
  preScore={3.2} 
  postScore={3.4} 
  delay={100}
/>

// 4. Hover cards:
<HoverCard className="bg-white rounded-2xl p-6">
  <h3>Card content</h3>
</HoverCard>

// Or use the pre-built stat card:
<AnimatedStatCard
  icon={<CheckCircle className="w-4 h-4" />}
  label="Sessions Completed"
  value={<CountUpSessions value={897} />}
  color="blue"
/>

// 5. Fade in on scroll:
<FadeIn direction="up" delay={200}>
  <MyComponent />
</FadeIn>

// Staggered list:
<Staggered staggerDelay={100}>
  <Card1 />
  <Card2 />
  <Card3 />
</Staggered>
*/