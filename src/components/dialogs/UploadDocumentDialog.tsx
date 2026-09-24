import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Upload, File, X } from 'lucide-react';
import { DocumentType, Matter } from '@/types/legal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matters?: Matter[];
  onUploadDocument?: (input: {
    name: string;
    type: DocumentType;
    relatedMatter?: string;
    file?: File | null;
  }) => Promise<void>;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  matters = [],
  onUploadDocument,
}: UploadDocumentDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '' as DocumentType | '',
    relatedMatter: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!formData.name) {
      setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !formData.name || !formData.type) {
      toast.error('Please select a file and fill in required fields');
      return;
    }

    setUploadStatus('uploading');
    setUploadError(null);
    try {
      await onUploadDocument?.({
        name: formData.name,
        type: formData.type,
        relatedMatter: formData.relatedMatter,
        file: selectedFile,
      });
      toast.success('Document uploaded successfully', {
        description: `"${formData.name}" has been added to the vault.`,
      });
      
      setFormData({ name: '', type: '', relatedMatter: '' });
      setSelectedFile(null);
      setUploadStatus('idle');
      onOpenChange(false);
    } catch (error) {
      const message = error.message || 'Please try again.';
      setUploadStatus('failed');
      setUploadError(message);
      toast.error('Failed to upload document', {
        description: message,
      });
      window.setTimeout(() => setUploadStatus('idle'), 2500);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: '', relatedMatter: '' });
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a new document to the secure vault.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Drop Zone */}
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground",
              selectedFile && "border-success bg-success/5"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            />
            
            {selectedFile ? (
              <div className="flex items-center gap-3">
                <File className="h-8 w-8 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                <p className="mb-1 text-sm font-medium text-foreground">
                  Drag and drop your file here
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  or click to browse
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select File
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="docName">Document Name *</Label>
            <Input
              id="docName"
              placeholder="Enter document name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="docType">Document Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as DocumentType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MoU">Memorandum of Understanding</SelectItem>
                <SelectItem value="Court Process">Court Process</SelectItem>
                <SelectItem value="Legal Opinion">Legal Opinion</SelectItem>
                <SelectItem value="Contract">Contract</SelectItem>
                <SelectItem value="Correspondence">Correspondence</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatedMatter">Related matter (optional)</Label>
            <Select
              value={formData.relatedMatter}
              onValueChange={(value) =>
                setFormData(prev => ({
                  ...prev,
                  relatedMatter: value === 'none' ? '' : value,
                }))
              }
            >
              <SelectTrigger id="relatedMatter">
                <SelectValue placeholder="Select a case" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No related case</SelectItem>
                {matters.map((matterItem) => (
                  <SelectItem key={matterItem.id} value={matterItem.id}>
                    {matterItem.suitNumber} - {matterItem.matterTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uploadStatus === 'failed' && uploadError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedFile || uploadStatus === 'uploading'}>
              {uploadStatus === 'uploading'
                ? 'Uploading...'
                : uploadStatus === 'failed'
                  ? 'Upload Failed'
                  : 'Upload Document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
