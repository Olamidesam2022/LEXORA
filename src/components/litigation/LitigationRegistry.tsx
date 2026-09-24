import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  ChevronDown, 
  Calendar,
  User,
  MapPin,
  Eye,
  Edit,
  Trash2,
  CircleCheck,
} from 'lucide-react';
import { formatPracticeArea, Matter, ProceduralStage } from '@/types/legal';
import { cn } from '@/lib/utils';

interface LitigationRegistryProps {
  matters: Matter[];
  onAddMatter?: () => void;
  onViewMatter?: (matterItem: Matter) => void;
  onEditMatter?: (matterItem: Matter) => void;
  onDeleteMatter?: (matterItem: Matter) => void;
  onCloseMatter?: (matterItem: Matter) => void;
}

const stageColors: Record<ProceduralStage, string> = {
  Mention: 'status-mention',
  Interlocutory: 'status-interlocutory',
  Trial: 'status-trial',
  Judgment: 'status-judgment',
};

export function LitigationRegistry({ matters, onAddMatter, onViewMatter, onEditMatter, onDeleteMatter, onCloseMatter }: LitigationRegistryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<ProceduralStage | 'all'>('all');
  const [practiceAreaFilter, setPracticeAreaFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredMatters = matters.filter(matterItem => {
    const matchesSearch = 
      matterItem.matterTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatPracticeArea(matterItem.practiceArea).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (matterItem.practiceArea === 'litigation' && (matterItem.suitNumber.toLowerCase().includes(searchQuery.toLowerCase()) || matterItem.adversaryParty.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      matterItem.assignedCounsel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || (matterItem.practiceArea === 'litigation' && matterItem.proceduralStage === stageFilter);
    const matchesPracticeArea = practiceAreaFilter === 'all' || matterItem.practiceArea === practiceAreaFilter;
    return matchesSearch && matchesStage && matchesPracticeArea;
  });

  const stages: ProceduralStage[] = ['Mention', 'Interlocutory', 'Trial', 'Judgment'];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {filteredMatters.length} matter{filteredMatters.length !== 1 ? 's' : ''} found
          </p>
        </div>
        {onAddMatter && (
          <button
            onClick={onAddMatter}
            className="gold-button flex items-center gap-2 rounded-lg px-4 py-2.5"
          >
            <Plus className="h-4 w-4" />
            <span>New Matter</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search matter, client work, or practice area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input w-full pl-10"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors",
            showFilters ? "bg-muted text-foreground" : "bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
        </button>
      </div>

      <select aria-label="Filter by practice area" value={practiceAreaFilter} onChange={(event) => setPracticeAreaFilter(event.target.value)} className="search-input max-w-xs">
        <option value="all">All practice areas</option>
        <option value="corporate_commercial">Corporate &amp; commercial</option>
        <option value="ma">M&amp;A</option>
        <option value="tech_ip">Tech &amp; IP</option>
        <option value="contracts">Contracts</option>
        <option value="regulatory_compliance">Regulatory &amp; compliance</option>
        <option value="corporate_secretarial">Corporate secretarial</option>
        <option value="adr">ADR</option>
        <option value="litigation">Litigation</option>
        <option value="needs_review">Needs review</option>
      </select>

      {/* Filter Options */}
      {showFilters && (
        <div className="surface-card animate-fade-in p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Procedural Stage</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStageFilter('all')}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                stageFilter === 'all' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              All Stages
            </button>
            {stages.map(stage => (
              <button
                key={stage}
                onClick={() => setStageFilter(stage)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  stageFilter === stage 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {filteredMatters.map((matterItem, index) => {
          const isLitigation = matterItem.practiceArea === 'litigation';
          return (
          <div
            key={matterItem.id}
            className="case-modern-row animate-fade-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <button
              onClick={() => onViewMatter?.(matterItem)}
              className="grid min-w-0 flex-1 gap-3 text-left md:grid-cols-[10rem_1fr_auto] md:items-center"
            >
              <div>
                <p className={cn("text-sm font-semibold text-muted-foreground", isLitigation && "text-xs uppercase tracking-wide")}>
                  {isLitigation ? matterItem.suitNumber : formatPracticeArea(matterItem.practiceArea)}
                </p>
                {isLitigation && <span className={`status-pill ${stageColors[matterItem.proceduralStage]} mt-2`}>
                  {matterItem.proceduralStage}
                </span>}
              </div>

              <div className="min-w-0">
                  <h4 className="truncate text-base font-extrabold text-foreground">
                  {matterItem.matterTitle}
                </h4>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {isLitigation ? `vs. ${matterItem.adversaryParty}` : matterItem.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <User className="h-3.5 w-3.5" />
                    {matterItem.assignedCounsel}
                  </span>
                  {isLitigation && <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{matterItem.court}</span>
                  </span>}
                </div>
              </div>

              {isLitigation && <div className="flex items-center gap-2 rounded-2xl bg-background/70 p-3 md:justify-end">
                <Calendar className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">Next date</p>
                  <p className="text-sm font-extrabold text-foreground">
                    {matterItem.nextHearing.toLocaleDateString('en-NG', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>}
            </button>

            <div className="flex shrink-0 items-center gap-1 self-start md:self-center">
              <button onClick={() => onViewMatter?.(matterItem)} className="icon-button" title="View">
                <Eye className="h-4 w-4" />
              </button>
              {matterItem.canEdit && onEditMatter && (
                <button onClick={() => onEditMatter?.(matterItem)} className="icon-button" title="Edit">
                  <Edit className="h-4 w-4" />
                </button>
              )}
              {matterItem.matterStatus === 'open' && onCloseMatter && (
                <button onClick={() => onCloseMatter(matterItem)} className="icon-button" title="Close matter">
                  <CircleCheck className="h-4 w-4" />
                </button>
              )}
              {matterItem.canDelete && onDeleteMatter && (
                <button onClick={() => onDeleteMatter?.(matterItem)} className="icon-button hover:bg-destructive/10 hover:text-destructive" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );})}
      </div>

      {/* Empty State */}
      {filteredMatters.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center border-dashed py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">No matters found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
