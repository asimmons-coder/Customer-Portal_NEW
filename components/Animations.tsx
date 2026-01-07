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
