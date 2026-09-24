import { useMemo, useState } from 'react';
import { 
  Search, 
  Upload, 
  FolderOpen, 
  FileText, 
  FileSpreadsheet,
  File,
  Download,
  Eye,
  Trash2,
  Clock,
  User,
  Tag,
  Grid,
  List
} from 'lucide-react';
import { LegalDocument, DocumentType, Matter } from '@/types/legal';
import { cn } from '@/lib/utils';
import { AppTablePagination, AppTableShell } from '@/components/ui/app-table';

interface DocumentVaultProps {
  documents: LegalDocument[];
  matters?: Matter[];
  onUpload?: () => void;
  onViewDocument?: (doc: LegalDocument) => void;
  onDownloadDocument?: (doc: LegalDocument) => void;
  onDeleteDocument?: (doc: LegalDocument) => void;
}

const typeIcons: Record<DocumentType, React.ElementType> = {
  'MoU': FileText,
  'Court Process': FileSpreadsheet,
  'Legal Opinion': FileText,
  'Contract': File,
  'Correspondence': FileText,
};

const typeColors: Record<DocumentType, string> = {
  'MoU': 'bg-info/10 text-info',
  'Court Process': 'bg-warning/10 text-warning',
  'Legal Opinion': 'bg-success/10 text-success',
  'Contract': 'bg-accent/20 text-accent-foreground',
  'Correspondence': 'bg-muted text-muted-foreground',
};

const statusStyles = {
  draft: 'bg-warning/10 text-warning',
  submitted: 'bg-info/10 text-info',
  in_ops_review: 'bg-warning/10 text-warning',
  awaiting_partner_approval: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
};

export function DocumentVault({ documents, matters = [], onUpload, onViewDocument, onDownloadDocument, onDeleteDocument }: DocumentVaultProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredDocuments = documents.filter(doc => {
    const relatedMatter = doc.matterId
      ? matters.find((matterItem) => matterItem.id === doc.matterId)
      : undefined;
    const matterTitle = relatedMatter?.matterTitle || "";
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matterTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const documentTypes: DocumentType[] = ['MoU', 'Court Process', 'Legal Opinion', 'Contract', 'Correspondence'];
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedDocuments = useMemo(
    () => filteredDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredDocuments],
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {onUpload && (
          <button
            onClick={onUpload}
            className="gold-button flex items-center gap-2 rounded-lg px-4 py-2.5"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search filename, matter, or uploader..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input w-full pl-10"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "rounded-md p-2 transition-colors",
                viewMode === 'grid' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Landscape view"
              aria-label="Landscape view"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "rounded-md p-2 transition-colors",
                viewMode === 'list' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="List view"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Document type filters */}
      <section className="space-y-2" aria-label="Filter documents by type">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document type</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {(['all', ...documentTypes] as const).map(type => {
            const isAll = type === 'all';
            const Icon = type === 'all' ? FolderOpen : typeIcons[type];
            const count = type === 'all' ? documents.length : documents.filter(document => document.type === type).length;
            const isActive = typeFilter === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
                aria-pressed={isActive}
                className={cn(
                  'flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/60',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="min-w-0 flex-1 truncate">{isAll ? 'All documents' : type}</span>
                <span className={cn(
                  'shrink-0 rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                  isActive ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Documents Grid View */}
      {viewMode === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pagedDocuments.map((doc, index) => {
            const Icon = typeIcons[doc.type];
            
            return (
              <div
                key={doc.id}
                className="document-card group animate-fade-in p-0"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="border-b border-border/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-sm", typeColors[doc.type])}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={cn("status-pill", statusStyles[doc.status])}>
                      {doc.status}
                    </span>
                  </div>
                  <div className="mt-4">
                    <h4 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-foreground">
                      {doc.name}
                    </h4>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("rounded-md px-2 py-1 font-semibold", typeColors[doc.type])}>
                        {doc.type}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-1 font-semibold">v{doc.version}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/60 p-2">
                      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Modified</span>
                      </div>
                      <p className="font-semibold text-foreground">
                        {doc.lastModified.toLocaleDateString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-2">
                      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                        <Tag className="h-3.5 w-3.5" />
                        <span>Size</span>
                      </div>
                      <p className="font-semibold text-foreground">{doc.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{doc.uploadedBy}</span>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border/70 bg-muted/20 p-3">
                  <button 
                    onClick={() => onViewDocument?.(doc)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-background py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    <Eye className="h-4 w-4" />
                    <span>View</span>
                  </button>
                  <button 
                    onClick={() => onDownloadDocument?.(doc)}
                    className="icon-button bg-background shadow-sm"
                    aria-label={`Download ${doc.name}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {doc.canDelete && onDeleteDocument && (
                    <button
                      onClick={() => onDeleteDocument?.(doc)}
                      className="icon-button bg-background shadow-sm hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${doc.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents List View */}
      {viewMode === 'list' && (
        <AppTableShell>
          <div className="table-header hidden grid-cols-[minmax(0,1.8fr)_9rem_7rem_8rem_7rem_9rem] gap-3 px-4 py-3 lg:grid">
            <span>Document</span>
            <span>Type</span>
            <span>Status</span>
            <span>Modified</span>
            <span>Size</span>
            <span className="text-right">Actions</span>
          </div>
          {pagedDocuments.map((doc, index) => {
            const Icon = typeIcons[doc.type];

            return (
              <div
                key={doc.id}
                className="clean-list-row animate-fade-in lg:grid-cols-[minmax(0,1.8fr)_9rem_7rem_8rem_7rem_9rem] lg:items-center"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", typeColors[doc.type])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-foreground">{doc.name}</p>
                    <p className="truncate text-xs text-muted-foreground">Uploaded by {doc.uploadedBy} · v{doc.version}</p>
                  </div>
                </div>

                <span className={cn("w-fit rounded-md px-2 py-1 text-xs font-semibold", typeColors[doc.type])}>
                  {doc.type}
                </span>

                <span className={cn("status-pill w-fit", statusStyles[doc.status])}>
                  {doc.status}
                </span>

                <span className="text-xs font-medium text-muted-foreground">
                  {doc.lastModified.toLocaleDateString('en-NG', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>

                <span className="text-xs font-medium text-muted-foreground">{doc.size}</span>

                <div className="flex items-center gap-1 lg:justify-end">
                  <button onClick={() => onViewDocument?.(doc)} className="icon-button" aria-label={`View ${doc.name}`}>
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDownloadDocument?.(doc)} className="icon-button" aria-label={`Download ${doc.name}`}>
                    <Download className="h-4 w-4" />
                  </button>
                  {doc.canDelete && onDeleteDocument && (
                    <button
                      onClick={() => onDeleteDocument?.(doc)}
                      className="icon-button hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${doc.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <AppTablePagination
            page={currentPage}
            pageCount={pageCount}
            total={filteredDocuments.length}
            onPageChange={setPage}
          />
        </AppTableShell>
      )}

      {/* Empty State */}
      {filteredDocuments.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center border-dashed py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">No documents found</h3>
          <p className="mb-4 text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
          {onUpload && (
            <button
              onClick={onUpload}
              className="gold-button flex items-center gap-2 rounded-lg px-4 py-2"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
