import { useEffect, useState } from "react";
import {
  Bell,
  Shield,
  Database,
  Mail,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  UserCircle2,
  BriefcaseBusiness,
  Fingerprint,
} from "lucide-react";
import { User } from "@/types/legal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SettingsProps {
  currentUser: User;
}

export function Settings({ currentUser }: SettingsProps) {
  const storageKey = `lexora-settings-${currentUser.id}`;
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [hearingReminders, setHearingReminders] = useState(true);
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed">("idle");

  const roleLabel =
    currentUser.role === "operations_manager"
      ? "Operations Manager"
      : currentUser.role === "managing_partner"
        ? "Managing Partner"
        : "Legal Officer";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        emailNotifications?: boolean;
        pushNotifications?: boolean;
        hearingReminders?: boolean;
        deadlineAlerts?: boolean;
      };
      setEmailNotifications(parsed.emailNotifications ?? true);
      setPushNotifications(parsed.pushNotifications ?? true);
      setHearingReminders(parsed.hearingReminders ?? true);
      setDeadlineAlerts(parsed.deadlineAlerts ?? true);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const handleSave = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          emailNotifications,
          pushNotifications,
          hearingReminders,
          deadlineAlerts,
        }),
      );
      setSaveStatus("saved");
      toast.success("Settings saved successfully");
      window.setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (error) {
      setSaveStatus("failed");
      toast.error("Could not save settings", {
        description: error.message || "Please try again.",
      });
    }
  };

  const handleReset = () => {
    setEmailNotifications(true);
    setPushNotifications(true);
    setHearingReminders(true);
    setDeadlineAlerts(true);
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        emailNotifications: true,
        pushNotifications: true,
        hearingReminders: true,
        deadlineAlerts: true,
      }),
    );
    setSaveStatus("saved");
    toast.info("Settings reset to defaults");
    window.setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const handleChangePassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      toast.error("Could not send password reset email", {
        description: error.message,
      });
      return;
    }

    toast.success("Password reset email sent");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {saveStatus !== "idle" && (
            <div
              className={cn(
                "hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold sm:flex",
                saveStatus === "saved"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {saveStatus === "saved" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {saveStatus === "saved" ? "Saved" : "Save failed"}
            </div>
          )}
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 dark:border dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account Details */}
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <UserCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Account Details</h3>
                <p className="text-sm text-muted-foreground">
                  Your signed-in profile information
                </p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-foreground">
                {currentUser.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-foreground">
                  {currentUser.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Role
                </div>
                <p className="text-sm font-semibold text-foreground">{roleLabel}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  Department
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {currentUser.department || "Legal"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 sm:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Account ID
                </div>
                <p className="break-all text-sm font-semibold text-foreground">
                  {currentUser.id}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance moved to dashboard */}

        {/* Notifications */}
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <Bell className="h-5 w-5 text-info" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Configure alert preferences
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  Email Notifications
                </p>
                <p className="text-sm text-muted-foreground">
                  Receive updates via email
                </p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  emailNotifications
                    ? "bg-foreground dark:bg-muted-foreground"
                    : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    emailNotifications && "translate-x-5",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  Push Notifications
                </p>
                <p className="text-sm text-muted-foreground">
                  Browser notifications
                </p>
              </div>
              <button
                onClick={() => setPushNotifications(!pushNotifications)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  pushNotifications
                    ? "bg-foreground dark:bg-muted-foreground"
                    : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    pushNotifications && "translate-x-5",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Hearing Reminders</p>
                <p className="text-sm text-muted-foreground">
                  72-hour hearing alerts
                </p>
              </div>
              <button
                onClick={() => setHearingReminders(!hearingReminders)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  hearingReminders
                    ? "bg-foreground dark:bg-muted-foreground"
                    : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    hearingReminders && "translate-x-5",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Deadline Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Advisory deadline warnings
                </p>
              </div>
              <button
                onClick={() => setDeadlineAlerts(!deadlineAlerts)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  deadlineAlerts
                    ? "bg-foreground dark:bg-muted-foreground"
                    : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    deadlineAlerts && "translate-x-5",
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Security</h3>
                <p className="text-sm text-muted-foreground">
                  Account security settings
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">Current Role</p>
                <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
                  {roleLabel}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Last Login</p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-NG", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              onClick={handleChangePassword}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Lock className="h-4 w-4" />
              Change Password
            </button>
          </div>
        </div>

        {/* System Information */}
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2">
                <Database className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  System Information
                </h3>
                <p className="text-sm text-muted-foreground">
                  Application details
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Version</p>
              <p className="font-medium text-foreground">1.0.0</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Environment</p>
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                Production
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Database Status</p>
              <span className="flex items-center gap-1.5 text-sm text-success">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">NDPR Compliance</p>
              <span className="flex items-center gap-1.5 text-sm text-success">
                <Shield className="h-4 w-4" />
                Enabled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Support */}
      <div className="surface-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-accent/20 p-3">
              <Mail className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                Contact your firm's system administrator for assistance
              </p>
            </div>
          </div>
          <button
            onClick={() => toast.info("Support contact: system administrator")}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
