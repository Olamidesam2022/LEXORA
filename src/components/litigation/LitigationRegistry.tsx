import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  ChevronDown, 
  Eye,
  Edit,
  Trash2,
  CircleCheck,
  BriefcaseBusiness,
  MoreHorizontal,
} from 'lucide-react';
import { formatPracticeArea, Matter, ProceduralStage } from '@/types/legal';
import { cn } from '@/lib/utils';
import { AlignedList, AlignedListRow } from '@/components/ui/aligned-list';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <AlignedList>
          {filteredMatters.map((matterItem) => {
            const isLitigation = matterItem.practiceArea === 'litigation';
            const matterStatus = matterItem.matterStatus || 'open';
            const nextHearing = matterItem.nextHearing;
            return <AlignedListRow
              key={matterItem.id}
              avatar={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><BriefcaseBusiness className="h-4 w-4" /></span>}
              primary={matterItem.matterTitle}
              secondary={isLitigation ? `vs. ${matterItem.adversaryParty} · ${matterItem.suitNumber}` : `${formatPracticeArea(matterItem.practiceArea)} · ${matterItem.description}`}
              tag={<span className={`status-pill ${isLitigation ? stageColors[matterItem.proceduralStage] : 'bg-muted text-muted-foreground'}`}>{isLitigation ? matterItem.proceduralStage : matterStatus}</span>}
              metric={<span className="truncate text-xs text-muted-foreground">{matterItem.assignedCounsel}</span>}
              date={nextHearing instanceof Date && !Number.isNaN(nextHearing.getTime()) ? nextHearing.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
              action={<DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label={`Actions for ${matterItem.matterTitle}`}><MoreHorizontal className="h-[18px] w-[18px]" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onViewMatter && <DropdownMenuItem onSelect={() => onViewMatter(matterItem)}><Eye className="mr-2 h-4 w-4" />View matter</DropdownMenuItem>}
                  {matterItem.canEdit && onEditMatter && <DropdownMenuItem onSelect={() => onEditMatter(matterItem)}><Edit className="mr-2 h-4 w-4" />Edit matter</DropdownMenuItem>}
                  {matterStatus === 'open' && onCloseMatter && <DropdownMenuItem onSelect={() => onCloseMatter(matterItem)}><CircleCheck className="mr-2 h-4 w-4" />Close matter</DropdownMenuItem>}
                  {matterItem.canDelete && onDeleteMatter && <DropdownMenuItem onSelect={() => onDeleteMatter(matterItem)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete matter</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>}
              onClick={onViewMatter ? () => onViewMatter(matterItem) : undefined}
              ariaLabel={`Open matter ${matterItem.matterTitle}`}
            />;
          })}
        </AlignedList>
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
