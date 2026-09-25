import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Scale
} from 'lucide-react';
import { Matter } from '@/types/legal';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  matters: Matter[];
  onViewMatter: (matterItem: Matter) => void;
}

export function CalendarView({ matters, onViewMatter }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: startingDay }, (_, i) => i);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getMattersForDay = (day: number) => {
    return matters.filter(c => {
      const hearingDate = c.nextHearing;
      return (
        hearingDate.getDate() === day &&
        hearingDate.getMonth() === currentDate.getMonth() &&
        hearingDate.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const upcomingHearings = matters
    .filter(c => c.nextHearing >= new Date())
    .sort((a, b) => a.nextHearing.getTime() - b.nextHearing.getTime())
    .slice(0, 5);

  const startOfWeek = (date: Date) => {
    const next = new Date(date);
    next.setDate(date.getDate() - date.getDay());
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const visibleWeek = Array.from({ length: 7 }, (_, index) => {
    const date = startOfWeek(currentDate);
    date.setDate(date.getDate() + index);
    return date;
  });

  const getMattersForDate = (date: Date) =>
    matters.filter(c => {
      const hearingDate = c.nextHearing;
      return (
        hearingDate.getDate() === date.getDate() &&
        hearingDate.getMonth() === date.getMonth() &&
        hearingDate.getFullYear() === date.getFullYear()
      );
    });

  const navigateDate = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      navigateMonth(direction);
      return;
    }

    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + (direction === 'prev' ? -1 : 1) * (view === 'week' ? 7 : 1));
      return next;
    });
  };

  const headingLabel =
    view === 'month'
      ? currentDate.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${visibleWeek[0].toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} - ${visibleWeek[6].toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : currentDate.toLocaleDateString('en-NG', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          <div className="flex rounded-lg border border-border bg-card overflow-hidden">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium capitalize transition-colors",
                  view === v 
                    ? "bg-accent text-accent-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 overflow-hidden">
          <div className="surface-panel overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between border-b border-border p-3 sm:p-4">
              <button
                onClick={() => navigateDate('prev')}
                className="rounded-lg p-1.5 sm:p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <h3 className="text-sm font-extrabold text-foreground sm:text-lg">
                {headingLabel}
              </h3>
              <button
                onClick={() => navigateDate('next')}
                className="rounded-lg p-1.5 sm:p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {view === 'month' && (
              <>
                <div className="grid grid-cols-7 border-b border-border">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {emptyDays.map(i => (
                    <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[80px] border-b border-r border-border p-1 sm:p-2" />
                  ))}
                  {days.map(day => {
                    const dayMatters = getMattersForDay(day);
                    const hasHearing = dayMatters.length > 0;

                    return (
                      <div
                        key={day}
                        className={cn(
                          "min-h-[60px] sm:min-h-[80px] border-b border-r border-border p-1 sm:p-2 transition-colors hover:bg-muted/50",
                          isToday(day) && "bg-primary/5"
                        )}
                      >
                        <span className={cn(
                          "inline-flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm",
                          isToday(day) && "bg-primary text-primary-foreground font-bold",
                          hasHearing && !isToday(day) && "bg-destructive/10 text-destructive font-medium"
                        )}>
                          {day}
                        </span>
                        {dayMatters.slice(0, 1).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => onViewMatter(c)}
                            className="mt-0.5 sm:mt-1 block w-full truncate rounded border-l-2 border-primary bg-primary/5 px-1 py-0.5 text-left text-[9px] font-semibold text-primary hover:bg-primary/10 sm:text-xs"
                          >
                            {c.suitNumber}
                          </button>
                        ))}
                        {dayMatters.length > 1 && (
                          <span className="mt-0.5 block text-[9px] sm:text-xs text-muted-foreground">
                            +{dayMatters.length - 1} more
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {view === 'week' && (
              <div className="grid gap-0 sm:grid-cols-7">
                {visibleWeek.map((date) => {
                  const dayMatters = getMattersForDate(date);
                  const today = new Date();
                  const dateIsToday =
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();

                  return (
                    <div key={date.toISOString()} className={cn("min-h-[160px] border-b border-r border-border p-3", dateIsToday && "bg-primary/5")}>
                      <div className="mb-3">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          {date.toLocaleDateString('en-NG', { weekday: 'short' })}
                        </p>
                        <p className="text-lg font-extrabold text-foreground">{date.getDate()}</p>
                      </div>
                      <div className="space-y-2">
                        {dayMatters.map((matterItem) => (
                          <button
                            key={matterItem.id}
                            onClick={() => onViewMatter(matterItem)}
                            className="w-full border-l-2 border-primary bg-primary/5 p-2 text-left text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            <span className="block truncate">{matterItem.suitNumber}</span>
                            <span className="block truncate text-muted-foreground">{matterItem.matterTitle}</span>
                          </button>
                        ))}
                        {dayMatters.length === 0 && (
                          <p className="text-xs text-muted-foreground">No hearings</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'day' && (
              <div className="divide-y divide-border">
                {getMattersForDate(currentDate).map((matterItem) => (
                  <button
                    key={matterItem.id}
                    onClick={() => onViewMatter(matterItem)}
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
                      {matterItem.nextHearing.toLocaleTimeString('en-NG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-foreground">{matterItem.suitNumber}</p>
                      <p className="truncate text-sm text-muted-foreground">{matterItem.matterTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{matterItem.court}</p>
                    </div>
                  </button>
                ))}
                {getMattersForDate(currentDate).length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No hearings scheduled for this day
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Hearings Sidebar */}
        <div className="space-y-3 sm:space-y-4">
          <div className="surface-panel">
            <div className="border-b border-border px-3 py-3 sm:px-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Upcoming Hearings</h3>
              </div>
            </div>
            <div className="clean-list max-h-[40vh] overflow-y-auto border-y-0 scrollbar-thin sm:max-h-[50vh]">
              {upcomingHearings.map((matterItem, index) => (
                <button
                  key={matterItem.id}
                  onClick={() => onViewMatter(matterItem)}
                  className="clean-list-row flex-row items-center"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background">
                    <span className="text-[0.6rem] font-bold uppercase text-muted-foreground">
                      {matterItem.nextHearing.toLocaleDateString('en-NG', { month: 'short' })}
                    </span>
                    <span className="text-sm font-extrabold text-foreground">
                      {matterItem.nextHearing.getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {matterItem.suitNumber}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {matterItem.matterTitle}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {matterItem.nextHearing.toLocaleTimeString('en-NG', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{matterItem.court.split(' ').slice(0, 2).join(' ')}</span>
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {upcomingHearings.length === 0 && (
                <div className="p-4 sm:p-6 text-center text-muted-foreground">
                  <CalendarIcon className="mx-auto h-6 w-6 sm:h-8 sm:w-8 opacity-50" />
                  <p className="mt-2 text-xs sm:text-sm">No upcoming hearings</p>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="surface-panel p-3 sm:p-4">
            <h4 className="mb-2 sm:mb-3 text-xs sm:text-sm font-medium text-foreground">Legend</h4>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary flex-shrink-0" />
                <span className="text-muted-foreground">Today</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-destructive/50 flex-shrink-0" />
                <span className="text-muted-foreground">Litigation hearing</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded bg-primary/20 flex-shrink-0" />
                <span className="text-muted-foreground">Matter deadline</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
