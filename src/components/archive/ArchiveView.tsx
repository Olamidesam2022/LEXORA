import {
  Archive,
  CalendarDays,
  Download,
  Eye,
  FileText,
  MapPin,
  Search,
  Scale,
  User,
  ChevronRight,
} from "lucide-react";
import { formatPracticeArea, LegalDocument, Matter } from "@/types/legal";
import { AlignedList, AlignedListRow } from "@/components/ui/aligned-list";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ArchiveViewProps {
  matters: Matter[];
  documents: LegalDocument[];
  onViewDocument?: (document: LegalDocument) => void;
  onDownloadDocument?: (document: LegalDocument) => void;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ArchiveView({
  matters,
  documents,
  onViewDocument,
  onDownloadDocument,
}: ArchiveViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const archivedMatters = matters.filter((matterItem) => matterItem.status === "Closed");
  const filteredMatters = archivedMatters.filter((matterItem) =>
    [
      matterItem.matterTitle,
      matterItem.assignedCounsel,
      ...(matterItem.practiceArea === "litigation" ? [matterItem.suitNumber, matterItem.adversaryParty, matterItem.court] : []),
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const getCaseDocuments = (matterId: string) =>
    documents.filter((document) => document.matterId === matterId);
  const selectedMatterDocuments = selectedMatter ? getCaseDocuments(selectedMatter.id) : [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {archivedMatters.length} closed matter{archivedMatters.length === 1 ? "" : "s"}
        </p>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search archive..."
            className="search-input w-full pl-10"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <AlignedList>
        {filteredMatters.map((matterItem) => {
          const matterDocuments = getCaseDocuments(matterItem.id);
          const hasMultipleDocuments = matterDocuments.length >= 2;
          const isLitigation = matterItem.practiceArea === "litigation";

          return <AlignedListRow
              key={matterItem.id}
              avatar={<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Archive className="h-4 w-4" /></span>}
              primary={matterItem.matterTitle}
              secondary={isLitigation ? `vs. ${matterItem.adversaryParty} · ${matterItem.suitNumber}` : `${formatPracticeArea(matterItem.practiceArea)} · ${matterItem.assignedCounsel}`}
              tag={<span className="status-pill bg-muted text-muted-foreground">{hasMultipleDocuments ? "Multiple docs" : matterItem.status}</span>}
              metric={<span className="inline-flex items-center justify-end gap-1 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />{matterDocuments.length}</span>}
              date={matterItem.filedDate.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: '2-digit' })}
              action={<ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />}
              onClick={() => setSelectedMatter(matterItem)}
              ariaLabel={`Open archived matter ${matterItem.matterTitle}`}
            />;
        })}
        </AlignedList>
      </div>

      {filteredMatters.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center border-dashed py-12 text-center">
          <Archive className="h-9 w-9 text-muted-foreground" />
          <h3 className="mt-3 text-base font-extrabold text-foreground">
            No archived matters found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Matters marked Closed will appear here automatically.
          </p>
        </div>
      )}

      <Dialog open={Boolean(selectedMatter)} onOpenChange={(open) => !open && setSelectedMatter(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedMatter && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-8">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Archive className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base">
                      {selectedMatter.matterTitle}
                    </DialogTitle>
                    <DialogDescription className="mt-1 line-clamp-2">
                      {formatPracticeArea(selectedMatter.practiceArea)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedMatter.practiceArea === "litigation" && <div className="rounded-lg border border-border bg-card p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <Scale className="h-3.5 w-3.5" />
                      Parties
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      vs. {selectedMatter.adversaryParty}
                    </p>
                  </div>}
                  {selectedMatter.practiceArea === "litigation" && <div className="rounded-lg border border-border bg-card p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Court
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedMatter.court}
                    </p>
                  </div>}
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      Counsel
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedMatter.assignedCounsel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Opened
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatDate(selectedMatter.filedDate)}
                    </p>
                  </div>
                </div>

                <section className="rounded-lg border border-border bg-background">
                  <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                    <div>
                      <h3 className="font-semibold text-foreground">Archived Documents</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedMatterDocuments.length} document
                        {selectedMatterDocuments.length === 1 ? "" : "s"} attached
                      </p>
                    </div>
                    <span className="status-pill bg-muted text-muted-foreground">
                      Closed
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {selectedMatterDocuments.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">
                        No documents are attached to this closed case.
                      </p>
                    ) : (
                      selectedMatterDocuments.map((document) => (
                        <div
                          key={document.id}
                          className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {document.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {document.type} - v{document.version} - uploaded by{" "}
                              {document.uploadedBy}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <span className="status-pill bg-background text-muted-foreground">
                              {document.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => onViewDocument?.(document)}
                              className="icon-button"
                              aria-label={`View ${document.name}`}
                              title="View document"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDownloadDocument?.(document)}
                              className="icon-button"
                              aria-label={`Download ${document.name}`}
                              title="Download document"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
