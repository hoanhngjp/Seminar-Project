import type { TimeContext } from '../types/domain';

// Detects time-of-day context for Recommendation Engine
// Mirrors context values accepted by GET /api/v1/recommendations?context=
export function getTimeContext(): TimeContext {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// Vietnamese greeting based on time context
export function getGreeting(name?: string): string {
  const ctx = getTimeContext();
  const greetings: Record<TimeContext, string> = {
    morning:   'Chào buổi sáng',
    afternoon: 'Chào buổi chiều',
    evening:   'Chào buổi tối',
    night:     'Chào buổi khuya',
  };
  const base = greetings[ctx];
  return name ? `${base}, ${name} 👋` : `${base} 👋`;
}
