import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderPlus,
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AppRole } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type GuideStep = {
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  bullets: string[];
  actionLabel: string;
  view: string;
};

const baseSteps: GuideStep[] = [
  {
    title: "Start from the dashboard",
    description:
      "Use the dashboard to see active matters, upcoming court dates, recent activity, and risk signals before moving into detailed work.",
    icon: LayoutDashboard,
    bullets: [
      "Check active matters and deadlines first.",
      "Use quick actions to jump into common work.",
      "Open alerts early so urgent matters are not missed.",
    ],
    actionLabel: "Open dashboard",
    view: "dashboard",
  },
  {
    title: "Register legal work",
    description:
      "Create litigation matters and advisory requests with the information your legal team needs to track ownership, status, and next action.",
    icon: FolderPlus,
    bullets: [
      "Add suit numbers, parties, court details, and counsel.",
      "Create advisory requests with departments and due dates.",
      "Update status as work moves from pending to completed.",
    ],
    actionLabel: "Open matters",
    view: "litigation",
  },
  {
    title: "Keep documents connected",
    description:
      "Upload and search documents from the vault so files stay linked to matters instead of being scattered across personal devices.",
    icon: FileText,
    bullets: [
      "Attach documents to related matters when possible.",
      "Use search to find matters, clients, and uploaded records.",
      "Download only what you need for the current task.",
    ],
    actionLabel: "Open documents",
    view: "documents",
  },
  {
    title: "Track dates and progress",
    description:
      "Use the calendar and progress views to keep hearings, milestones, notes, and follow-up actions visible.",
    icon: CalendarDays,
    bullets: [
      "Review upcoming court dates regularly.",
      "Add notes when a matter moves forward.",
      "Use progress history to understand what changed and when.",
    ],
    actionLabel: "Open calendar",
    view: "calendar",
  },
  {
    title: "Close with accountability",
    description:
      "Move completed matters into records and archive views while the audit trail preserves the system history.",
    icon: Archive,
    bullets: [
      "Use records for closed matters and supporting documents.",
      "Keep archived files searchable for future reference.",
      "Review audit history when accountability matters.",
    ],
    actionLabel: "Open records",
    view: "records",
  },
];

const managingPartnerStep: GuideStep = {
  title: "Approve and manage access",
  description:
    "Managing Partners control who enters the workspace, which role they receive, and whether an account remains active.",
  icon: Users,
  bullets: [
    "Review pending approvals from the dashboard.",
    "Approve only verified firm users.",
    "Change roles or deactivate accounts from user management.",
  ],
  actionLabel: "Open users",
  view: "users",
};

interface OnboardingGuideProps {
  userId: string;
  userName: string;
  role: AppRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: string) => void;
}

export function OnboardingGuide({
  userId,
  userName,
  role,
  open,
  onOpenChange,
  onNavigate,
}: OnboardingGuideProps) {
  const [activeStep, setActiveStep] = useState(0);
  const storageKey = `legal-case-manager:onboarding-seen:${userId}`;

  const steps = useMemo(
    () => (role === "managing_partner" ? [...baseSteps, managingPartnerStep] : baseSteps),
    [role],
  );
  const step = steps[activeStep];
  const Icon = step.icon;
  const isLastStep = activeStep === steps.length - 1;

  useEffect(() => {
    if (!userId) return;

    const hasSeenGuide = window.localStorage.getItem(storageKey) === "true";
    if (!hasSeenGuide) {
      setActiveStep(0);
      onOpenChange(true);
    }
  }, [onOpenChange, storageKey, userId]);

  const markSeen = () => {
    window.localStorage.setItem(storageKey, "true");
  };

  const closeGuide = (nextOpen: boolean) => {
    if (!nextOpen) {
      markSeen();
    }
    onOpenChange(nextOpen);
  };

  const handleFinish = () => {
    markSeen();
    onOpenChange(false);
  };

  const handleAction = () => {
    markSeen();
    onOpenChange(false);
    onNavigate(step.view);
  };

  return (
    <Dialog open={open} onOpenChange={closeGuide}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-border bg-background p-0 shadow-2xl sm:rounded-lg">
        <div className="grid gap-0 md:grid-cols-[17rem_1fr]">
          <aside className="border-b border-border bg-muted/45 p-5 md:border-b-0 md:border-r">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-foreground">
                  Welcome, {userName}
                </p>
                <p className="text-xs font-medium capitalize text-muted-foreground">
                  Approved {role} account
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {steps.map((item, index) => {
                const StepIcon = item.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "border-foreground bg-background text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <StepIcon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="p-5 sm:p-7">
            <DialogHeader>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                <Icon className="h-7 w-7" />
              </div>
              <DialogTitle className="text-2xl font-black leading-tight text-foreground">
                {step.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-7">
                {step.description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-3">
              {step.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
                  <p className="text-sm font-medium leading-6 text-card-foreground">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-border bg-muted/35 p-4">
              <div className="flex items-start gap-3">
                <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Tip: every module is connected. A matter can lead to documents,
                  progress notes, calendar dates, records, archive history, and
                  audit entries.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-7 gap-2 sm:justify-between sm:space-x-0">
              <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                {steps.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={cn(
                      "h-2.5 rounded-full transition-all",
                      activeStep === index
                        ? "w-7 bg-foreground"
                        : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/60",
                    )}
                    aria-label={`Go to step ${index + 1}`}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    activeStep === 0
                      ? closeGuide(false)
                      : setActiveStep((current) => current - 1)
                  }
                >
                  {activeStep === 0 ? "Skip" : "Back"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleAction}>
                  {step.actionLabel}
                  <Scale className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    isLastStep
                      ? handleFinish()
                      : setActiveStep((current) => current + 1)
                  }
                >
                  {isLastStep ? "Finish" : "Next"}
                  {!isLastStep && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </DialogFooter>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
