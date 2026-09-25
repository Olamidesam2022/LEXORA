import { useState, useRef, useEffect, useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Matter,
  AdvisoryRequest,
  LegalDocument,
  User as LegacyUser,
} from "@/types/legal";
import { useAuth } from "@/contexts/AuthContext";
import { useViewAs } from "@/contexts/ViewAsContext";
import { useMatters } from "@/hooks/useMatters";
import { useProfiles } from "@/hooks/useProfiles";
import { useAdvisoryRequests } from "@/hooks/useAdvisoryRequests";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useDocuments } from "@/hooks/useDocuments";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header, HeaderSearchResult } from "@/components/layout/Header";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { LitigationRegistry } from "@/components/litigation/LitigationRegistry";
import { AdvisoryWorkflow } from "@/components/advisory/AdvisoryWorkflow";
import { DocumentVault } from "@/components/documents/DocumentVault";
import { AuditTrail } from "@/components/audit/AuditTrail";
import { UserManagement } from "@/components/users/UserManagement";
import { Settings } from "@/components/settings/Settings";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ArchiveView } from "@/components/archive/ArchiveView";
import { RecordsView } from "@/components/records/RecordsView";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import ProgressPage from "@/pages/ProgressPage";
import { AddMatterDialog } from "@/components/dialogs/AddMatterDialog";
import { AddAdvisoryDialog } from "@/components/dialogs/AddAdvisoryDialog";
import { UploadDocumentDialog } from "@/components/dialogs/UploadDocumentDialog";
import { AddUserDialog } from "@/components/dialogs/AddUserDialog";
import { ViewMatterDialog } from "@/components/dialogs/ViewMatterDialog";
import { ViewAdvisoryDialog } from "@/components/dialogs/ViewAdvisoryDialog";
import { ViewDocumentDialog } from "@/components/dialogs/ViewDocumentDialog";
import { EditUserDialog } from "@/components/dialogs/EditUserDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";
import { Loader2, Shield, X } from "lucide-react";
import { useMatterProgressModal } from "@/hooks/useMatterProgressModal";
import { Client360Page } from "@/components/clients/Client360Page";
import { BillingPage } from "@/components/billing/BillingPage";

const viewTitles: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  billing: "Billing",
  litigation: "Matters",
  advisory: "Advisory Workflow",
  documents: "Document Vault",
  calendar: "Court Calendar",
  progress: "Progress",
  records: "Records",
  archive: "Archive",
  audit: "Audit Trail",
  users: "User Management",
  unauthorized: "Unauthorized",
  settings: "Settings",
};

type ConfirmDialogState = {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => Promise<void> | void;
};

const Index = () => {
  const { user, profile, role, isLoading, signOut } = useAuth();
  const { viewingAsUser, isViewingAs, startViewingAs, stopViewingAs } = useViewAs();
  const location = useLocation();
  const navigate = useNavigate();
  const { openModal } = useMatterProgressModal();
  const getViewFromPath = (pathname: string) => {
    if (pathname.startsWith("/app/advisory")) return "advisory";
    if (pathname.startsWith("/app/clients")) return "clients";
    if (pathname.startsWith("/app/billing")) return "billing";
    if (pathname.startsWith("/app/documents")) return "documents";
    if (pathname.startsWith("/app/calendar")) return "calendar";
    if (pathname.startsWith("/app/progress")) return "progress";
    if (pathname.startsWith("/app/records")) return "records";
    if (pathname.startsWith("/app/archive")) return "archive";
    if (pathname.startsWith("/app/matters")) return "litigation";
    if (pathname.startsWith("/app/audit")) return "audit";
    if (pathname.startsWith("/app/users")) {
      return role === "managing_partner" ? "users" : "unauthorized";
    }
    if (pathname.startsWith("/app/settings")) return "settings";
    return "dashboard";
  };
  const [activeView, setActiveView] = useState(getViewFromPath(location.pathname));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<Array<{ id: string; display_name: string; email?: string | null }>>([]);
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; display_name: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const { matters, metrics, createMatter, updateMatter, deleteMatter, closeMatter } = useMatters();
  const {
    advisoryRequests,
    createAdvisoryRequest,
    updateAdvisoryRequest,
    deleteAdvisoryRequest,
  } = useAdvisoryRequests();
  const { documents, createDocument, downloadDocument, deleteDocument } = useDocuments();
  const { auditLogs } = useAuditLogs();
  const { users: dbUsers, fetchUsers, updateUser, deleteUser } = useProfiles();

  useEffect(() => {
    let active = true;
    if (!user) return;
    supabase.auth.getSession().then(({ data }) => fetch(`/api/clients?search=`, {
      headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
    })).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      if (active) setClientOptions(payload.clients || []);
    }).catch(console.error);
    return () => { active = false; };
  }, [user?.id]);

  // Dialog states
  const [addMatterOpen, setAddMatterOpen] = useState(false);
  const [addAdvisoryOpen, setAddAdvisoryOpen] = useState(false);
  const [uploadDocumentOpen, setUploadDocumentOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [viewCaseOpen, setViewCaseOpen] = useState(false);
  const [viewAdvisoryOpen, setViewAdvisoryOpen] = useState(false);
  const [viewDocumentOpen, setViewDocumentOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Selected items for view dialogs
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [selectedAdvisory, setSelectedAdvisory] =
    useState<AdvisoryRequest | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<LegalDocument | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] =
    useState<LegacyUser | null>(null);

  useEffect(() => {
    if (user && (role === "managing_partner" || role === "operations_manager")) {
      fetchUsers();
    }
  }, [fetchUsers, user, role]);

  useEffect(() => {
    setActiveView(getViewFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    setIsPageLoading(true);
    const timeout = window.setTimeout(() => setIsPageLoading(false), 650);
    return () => window.clearTimeout(timeout);
  }, [activeView]);

  useEffect(() => {
    const match = location.pathname.match(/^\/app\/matters\/([^/]+)$/);
    if (match?.[1]) {
      openModal(match[1]);
    }
  }, [location.pathname, openModal]);

  useEffect(() => {
    const match = location.pathname.match(/^\/app\/matters\/([^/]+)\/edit$/);
    if (!match?.[1]) return;

    const matterItem = matters.find((item) => item.id === match[1]);
    if (matterItem) {
      if (isViewingAs || !matterItem.canEdit) {
        toast.error(
          isViewingAs
            ? "View-as mode is read-only."
            : "You can only edit matters assigned to you.",
        );
        navigate("/app/matters", { replace: true });
        return;
      }
      setSelectedMatter(matterItem);
      setAddMatterOpen(true);
    }
  }, [matters, isViewingAs, location.pathname, navigate]);

  // Swipe gestures for mobile sidebar
  useSwipeGesture(mainContentRef, {
    onSwipeRight: () => setSidebarOpen(true),
    onSwipeLeft: () => setSidebarOpen(false),
    threshold: 50,
    edgeThreshold: 40,
  });

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    toast.info("You have been logged out");
  };

  // View handlers
  const handleViewMatter = (matterItem: Matter) => {
    openModal(matterItem.id);
  };

  const handleViewChange = (viewId: string) => {
    if (isViewingAs && ["audit", "users"].includes(viewId)) {
      toast.info("Exit view-as mode to use administrator workspaces.");
      navigate("/app", { replace: true });
      return;
    }

    if (viewId === "users" && role !== "managing_partner") {
      toast.error("Only Managing Partner accounts can access user management.");
      navigate("/app", { replace: true });
      return;
    }

    setActiveView(viewId);
    const routeByView: Record<string, string> = {
      dashboard: "/app",
      clients: "/app/clients",
      billing: "/app/billing",
      litigation: "/app/matters",
      advisory: "/app/advisory",
      documents: "/app/documents",
      calendar: "/app/calendar",
      progress: "/app/progress",
      records: "/app/records",
      archive: "/app/archive",
      audit: "/app/audit",
      users: "/app/users",
      settings: "/app/settings",
    };
    navigate(routeByView[viewId] || "/app");
  };

  const handleEditMatter = (matterItem: Matter) => {
    if (isViewingAs) {
      toast.info("View-as mode is read-only.");
      return;
    }

    if (!matterItem.canEdit) {
      toast.error("You can only edit matters assigned to you.");
      return;
    }

    setSelectedMatter(matterItem);
    setAddMatterOpen(true);
  };

  const handleArchiveMatter = async (matterItem: Matter) => {
    if (isViewingAs) {
      toast.info("View-as mode is read-only.");
      return;
    }

    setConfirmDialog({
      title: "Archive matter?",
      description: `This will hide "${matterItem.matterTitle}" from normal matter lists. A Managing Partner can review deleted records.`,
      actionLabel: "Archive matter",
      onConfirm: async () => {
        try {
          await deleteMatter(matterItem);
          toast.success("Matter archived");
        } catch (error) {
          toast.error("Failed to archive matter", {
            description: error.message || "Please try again.",
          });
        }
      },
    });
  };

  const handleCloseMatter = (matterItem: Matter) => {
    setConfirmDialog({
      title: "Close matter?",
      description: `Closing "${matterItem.matterTitle}" starts its five-year minimum retention period and makes its documents read-only.`,
      actionLabel: "Close matter",
      onConfirm: async () => {
        try {
          await closeMatter(matterItem);
          toast.success("Matter closed");
        } catch (error) {
          toast.error("Failed to close matter", { description: error.message || "Please try again." });
        }
      },
    });
  };

  const handleViewAdvisory = (request: AdvisoryRequest) => {
    setSelectedAdvisory(request);
    setViewAdvisoryOpen(true);
  };

  const handleAddAdvisory = () => {
    if (isViewingAs) {
      toast.info("View-as mode is read-only.");
      return;
    }

    setSelectedAdvisory(null);
    setAddAdvisoryOpen(true);
  };

  const handleEditAdvisory = (request: AdvisoryRequest) => {
    if (isViewingAs) {
      toast.info("View-as mode is read-only.");
      return;
    }

    setSelectedAdvisory(request);
    setViewAdvisoryOpen(false);
    setAddAdvisoryOpen(true);
  };

  const handleDeleteAdvisory = async (request: AdvisoryRequest) => {
    if (isViewingAs) {
      toast.info("View-as mode is read-only.");
      return;
    }

    setConfirmDialog({
      title: "Delete advisory request?",
      description: `This will permanently delete "${request.title}". This action cannot be undone.`,
      actionLabel: "Delete request",
      onConfirm: async () => {
        try {
          await deleteAdvisoryRequest(request);
          setViewAdvisoryOpen(false);
          setSelectedAdvisory(null);
          toast.success("Advisory request deleted");
        } catch (error) {
          toast.error("Failed to delete advisory request", {
            description: error.message || "Please try again.",
          });
        }
      },
    });
  };

  const handleViewDocument = (doc: LegalDocument) => {
    setSelectedDocument(doc);
    setViewDocumentOpen(true);
  };

  const handleDownloadDocument = async (doc: LegalDocument) => {
    try {
      await downloadDocument(doc);
      toast.success(`Opening document: ${doc.name}`);
    } catch (error) {
      toast.error("Failed to download document", {
        description: error.message || "Please try again.",
      });
    }
  };

  const handleDeleteDocument = async (doc: LegalDocument) => {
    if (isViewingAs) {
      toast.info("View-as mode is read-only.");
      return;
    }

    setConfirmDialog({
      title: "Delete document?",
      description: `This will soft-delete "${doc.name}" from the document vault. Only a Managing Partner can perform this action.`,
      actionLabel: "Delete document",
      onConfirm: async () => {
        try {
          if (doc.matterId && user) {
            const removedAt = new Date();
            const userName = profile?.full_name || user.email || "Unknown user";
            const noteContent = `Document '${doc.name}' was removed by ${userName} on ${removedAt.toLocaleString("en-NG")}.`;
            const { error: noteError } = await supabase.from("matter_notes").insert({
              matter_id: doc.matterId,
              content: noteContent,
              created_by: user.id,
              user_id: user.id,
              is_private: false,
              note_type: "system",
            });

            if (noteError) {
              console.error("Failed to insert document removal system note:", noteError);
            }
          }

          await deleteDocument(doc);
          toast.success("Document deleted");
        } catch (error) {
          toast.error("Failed to delete document", {
            description: error.message || "Please try again.",
          });
        }
      },
    });
  };

  const handleEditUser = async (legacyUser: LegacyUser) => {
    if (isViewingAs) {
      toast.info("Exit view-as mode before managing users.");
      return;
    }

    if (role !== "managing_partner") {
      toast.error("Only Managing Partners can edit users.");
      return;
    }

    setSelectedUserForEdit(legacyUser);
    setEditUserOpen(true);
  };

  const handleSaveUserAccess = async (
    legacyUser: LegacyUser,
    nextRole: LegacyUser["role"],
    nextStatus: "pending" | "approved" | "rejected",
  ) => {
    try {
      await updateUser(legacyUser.id, { role: nextRole, status: nextStatus });
      toast.success("User updated.");
    } catch (error) {
      toast.error("Failed to update user", {
        description: error.message || "Please try again.",
      });
    }
  };

  const handleDeleteUser = async (legacyUser: LegacyUser) => {
    if (isViewingAs) {
      toast.info("Exit view-as mode before managing users.");
      return;
    }

    if (legacyUser.id === user?.id) {
      toast.error("You cannot delete your own account.");
      return;
    }

    setConfirmDialog({
      title: "Delete user?",
      description: `This will permanently remove ${legacyUser.name}'s account and profile from the workspace.`,
      actionLabel: "Delete user",
      onConfirm: async () => {
        try {
          await deleteUser(legacyUser.id);
          toast.success("User deleted.");
        } catch (error) {
          toast.error("Failed to delete user", {
            description: error.message || "Please try again.",
          });
        }
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;

    setIsConfirming(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewAsUser = async (legacyUser: LegacyUser) => {
    if (role !== "managing_partner") {
      toast.error("Only Managing Partners can view as another user.");
      return;
    }

    try {
      await startViewingAs(legacyUser);
      setAddMatterOpen(false);
      setAddAdvisoryOpen(false);
      setUploadDocumentOpen(false);
      setEditUserOpen(false);
      setSelectedMatter(null);
      setSelectedAdvisory(null);
      setSelectedDocument(null);
      handleViewChange("dashboard");
      toast.success(`Viewing as ${legacyUser.name}`);
    } catch (error) {
      toast.error("Could not start view-as mode", {
        description: error.message || "Please try again.",
      });
    }
  };

  const handleExitViewAs = async () => {
    const previousName = viewingAsUser?.name || "user";
    await stopViewingAs();
    toast.success(`Stopped viewing as ${previousName}`);
  };

  const canManageMatters =
    !isViewingAs && (role === "legal_officer" || role === "operations_manager" || role === "managing_partner");
  const canAssignMatters = !isViewingAs && role === "operations_manager";
  const displayMatters = matters;
  const activeMatters = useMemo(
    () =>
      displayMatters.filter(
        (matterItem) => !["Closed", "Archived"].includes(matterItem.status),
      ),
    [displayMatters],
  );
  const closedMatters = useMemo(
    () => displayMatters.filter((matterItem) => matterItem.status === "Closed"),
    [displayMatters],
  );
  const globalSearchResults = useMemo<HeaderSearchResult[]>(() => {
    const query = globalSearchQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const matterResults = displayMatters
      .filter((matterItem) =>
        [
          matterItem.suitNumber,
          matterItem.matterTitle,
          matterItem.adversaryParty,
          matterItem.assignedCounsel,
          matterItem.court,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 4)
      .map((matterItem) => ({
        id: matterItem.id,
        type: "matter" as const,
        title: matterItem.suitNumber,
        subtitle: matterItem.matterTitle,
      }));

    const documentResults = documents
      .filter((doc) => {
        const relatedMatter = doc.matterId
          ? displayMatters.find((matterItem) => matterItem.id === doc.matterId)
          : undefined;
        return [doc.name, doc.type, doc.uploadedBy, relatedMatter?.matterTitle]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      })
      .slice(0, 4)
      .map((doc) => ({
        id: doc.id,
        type: "document" as const,
        title: doc.name,
        subtitle: `${doc.type} - uploaded by ${doc.uploadedBy}`,
      }));

    const clientResults = clientSearchResults.map((client) => ({
      id: client.id,
      type: "client" as const,
      title: client.display_name,
      subtitle: client.email || "Open Client 360",
    }));
    return [...clientResults.slice(0, 3), ...matterResults, ...documentResults].slice(0, 8);
  }, [clientSearchResults, displayMatters, documents, globalSearchQuery]);

  useEffect(() => {
    let active = true;
    const query = globalSearchQuery.trim();
    if (query.length < 2) { setClientSearchResults([]); return; }
    const timer = window.setTimeout(async () => {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/clients?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${session.session?.access_token || ""}` },
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (active) setClientSearchResults(payload.clients || []);
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [globalSearchQuery]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Shield className="h-9 w-9 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Create a compatible user object for components that expect the legacy User type
  const currentUser: LegacyUser = {
    id: user.id,
    name: profile?.full_name || user.email || "User",
    email: profile?.email || user.email || "",
    role: role || "legal_officer",
    department: "Legal",
  };
  const workspaceUser = viewingAsUser || currentUser;

  const handleSearchResultSelect = (result: HeaderSearchResult) => {
    if (result.type === "client") {
      setSelectedClientId(result.id);
      handleViewChange("clients");
      return;
    }
    if (result.type === "matter") {
      const matterItem = displayMatters.find((item) => item.id === result.id);
      if (matterItem) {
        openModal(matterItem.id);
        return;
      }
      toast.error("Matter is no longer available.");
      return;
    }

    const document = documents.find((doc) => doc.id === result.id);
    if (document) {
      setSelectedDocument(document);
      setViewDocumentOpen(true);
      return;
    }
    toast.error("Document is no longer available.");
  };

  // Render the current view
  const renderView = () => {
    switch (activeView) {
      case "clients":
        return <Client360Page initialClientId={selectedClientId} />;
      case "billing":
        return role === "operations_manager" || role === "managing_partner"
          ? <BillingPage />
          : <div className="p-8 text-sm text-muted-foreground">Billing is available to Operations Managers and Managing Partners.</div>;
      case "dashboard":
        return (
          <Dashboard
            metrics={metrics}
            matters={activeMatters}
            auditLogs={auditLogs}
            onNavigate={handleViewChange}
          />
        );
      case "litigation":
        return (
          <LitigationRegistry
            matters={activeMatters}
            onAddMatter={
              canManageMatters
                ? () => {
                    setSelectedMatter(null);
                    setAddMatterOpen(true);
                  }
                : undefined
            }
            onViewMatter={handleViewMatter}
            onEditMatter={isViewingAs ? undefined : handleEditMatter}
            onDeleteMatter={isViewingAs ? undefined : handleArchiveMatter}
            onCloseMatter={!isViewingAs && (role === "operations_manager" || role === "managing_partner") ? handleCloseMatter : undefined}
          />
        );
      case "advisory":
        return (
          <AdvisoryWorkflow
            requests={advisoryRequests}
            onAddRequest={isViewingAs ? undefined : handleAddAdvisory}
            onViewRequest={handleViewAdvisory}
            onEditRequest={isViewingAs ? undefined : handleEditAdvisory}
            onDeleteRequest={isViewingAs ? undefined : handleDeleteAdvisory}
          />
        );
      case "documents":
        return (
          <DocumentVault
            documents={documents}
            matters={displayMatters}
            onUpload={isViewingAs ? undefined : () => setUploadDocumentOpen(true)}
            onViewDocument={handleViewDocument}
            onDownloadDocument={handleDownloadDocument}
            onDeleteDocument={isViewingAs ? undefined : handleDeleteDocument}
          />
        );
      case "progress":
        return <ProgressPage />;
      case "records":
        return (
          <RecordsView
            matters={closedMatters}
            documents={documents}
            auditLogs={auditLogs}
            onViewMatter={handleViewMatter}
          />
        );
      case "archive":
        return (
          <ArchiveView
            matters={closedMatters}
            documents={documents}
            onViewDocument={handleViewDocument}
            onDownloadDocument={handleDownloadDocument}
          />
        );
      case "audit":
        if (isViewingAs) {
          return (
            <div className="flex min-h-[22rem] flex-col items-center justify-center p-6 text-center">
              <h2 className="modern-page-title">Read-only workspace</h2>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Exit view-as mode to use the audit trail.
              </p>
            </div>
          );
        }
        return <AuditTrail logs={auditLogs} />;
      case "users":
        if (isViewingAs || role !== "managing_partner") {
          return (
            <div className="flex min-h-[22rem] flex-col items-center justify-center p-6 text-center">
              <h2 className="modern-page-title">Unauthorized</h2>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {isViewingAs
                  ? "Exit view-as mode to manage users."
                  : "Only Managing Partner accounts can access user management."}
              </p>
            </div>
          );
        }
        return (
          <UserManagement
            users={dbUsers}
            currentUser={currentUser}
            onAddUser={role === "managing_partner" ? () => setAddUserOpen(true) : undefined}
            onEditUser={role === "managing_partner" ? handleEditUser : undefined}
            onDeleteUser={role === "managing_partner" ? handleDeleteUser : undefined}
            onViewAsUser={role === "managing_partner" ? handleViewAsUser : undefined}
            viewingAsUserId={viewingAsUser?.id}
          />
        );
      case "settings":
        return <Settings currentUser={workspaceUser} />;
      case "calendar":
        return <CalendarView matters={activeMatters} onViewMatter={handleViewMatter} />;
      default:
        return (
          <Dashboard
            metrics={metrics}
            matters={activeMatters}
            auditLogs={auditLogs}
            onNavigate={handleViewChange}
          />
        );
    }
  };

  return (
    <div
      ref={mainContentRef}
      className="flex h-dvh w-full min-w-0 overflow-hidden bg-background touch-pan-y"
    >
      {/* Sidebar */}
      <Sidebar
        currentUser={workspaceUser}
        activeView={activeView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content */}
      <div
        className={cn(
          "flex h-full min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300",
        )}
      >
        <Header
          currentUser={workspaceUser}
          title={viewTitles[activeView] || "Dashboard"}
          onMenuToggle={() => setSidebarOpen(true)}
          onAccountClick={() => handleViewChange("settings")}
          onHelpClick={() => setGuideOpen(true)}
          onSearch={setGlobalSearchQuery}
          searchResults={globalSearchResults}
          onSearchResultSelect={handleSearchResultSelect}
          onPendingApprovalsClick={() => handleViewChange("users")}
        />
        {isViewingAs && viewingAsUser && (
          <div className="border-b border-border bg-foreground px-3 py-2 text-background sm:px-4 md:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-extrabold">
                  Viewing as {viewingAsUser.name}
                </p>
                <p className="text-xs font-medium text-background/75">
                  Read-only workspace preview. Actions are still audited under your Managing Partner account.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExitViewAs}
                className="inline-flex min-h-9 w-fit items-center justify-center gap-2 rounded-lg border border-background/25 px-3 py-1.5 text-sm font-bold transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Exit view
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          {isPageLoading ? (
            <div className="flex min-h-[calc(100vh-8rem)] animate-fade-in items-center justify-center p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Loading {viewTitles[activeView] || "page"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Preparing your workspace...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="app-view-frame">{renderView()}</div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <AddMatterDialog
        open={addMatterOpen}
        onOpenChange={(open) => {
          setAddMatterOpen(open);
          if (!open) setSelectedMatter(null);
        }}
        matterItem={selectedMatter}
        users={dbUsers}
        clients={clientOptions}
        canAssignMatter={canAssignMatters}
        onCreateMatter={(input) =>
          selectedMatter ? updateMatter(selectedMatter.id, input) : createMatter(input)
        }
      />
      <AddAdvisoryDialog
        open={addAdvisoryOpen}
        onOpenChange={(open) => {
          setAddAdvisoryOpen(open);
          if (!open) setSelectedAdvisory(null);
        }}
        request={selectedAdvisory}
        onCreateRequest={createAdvisoryRequest}
        onUpdateRequest={updateAdvisoryRequest}
      />
      <UploadDocumentDialog
        open={uploadDocumentOpen}
        onOpenChange={setUploadDocumentOpen}
        matters={displayMatters}
        onUploadDocument={createDocument}
      />
      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onUserCreated={fetchUsers}
      />
      <EditUserDialog
        open={editUserOpen}
        onOpenChange={(open) => {
          setEditUserOpen(open);
          if (!open) setSelectedUserForEdit(null);
        }}
        user={selectedUserForEdit}
        onSave={handleSaveUserAccess}
      />
      <ViewMatterDialog
        open={viewCaseOpen}
        onOpenChange={setViewCaseOpen}
        matterItem={selectedMatter}
      />
      <ViewAdvisoryDialog
        open={viewAdvisoryOpen}
        onOpenChange={setViewAdvisoryOpen}
        request={selectedAdvisory}
        onEdit={handleEditAdvisory}
        onDelete={handleDeleteAdvisory}
      />
      <ViewDocumentDialog
        open={viewDocumentOpen}
        onOpenChange={setViewDocumentOpen}
        document={selectedDocument}
        onDownloadDocument={handleDownloadDocument}
      />
      <OnboardingGuide
        userId={user.id}
        userName={currentUser.name}
        role={currentUser.role}
        open={guideOpen}
        onOpenChange={setGuideOpen}
        onNavigate={handleViewChange}
      />
      <AlertDialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open && !isConfirming) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmAction();
              }}
              disabled={isConfirming}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isConfirming ? "Working..." : confirmDialog?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
