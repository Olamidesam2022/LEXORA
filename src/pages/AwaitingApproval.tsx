import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Clock3, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";

type AwaitingApprovalState = {
  email?: string;
  fullName?: string;
  role?: "legal_officer" | "operations_manager";
};

export default function AwaitingApproval() {
  const location = useLocation();
  const state = (location.state || {}) as AwaitingApprovalState;
  const accountType =
    state.role === "operations_manager"
      ? "Admin"
      : state.role === "legal_officer"
        ? "Legal User"
        : null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[32rem] items-center">
        <section className="surface-card w-full p-5 sm:p-8">
          <div className="mb-6 flex justify-center"><BrandLogo /></div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock3 className="h-7 w-7" />
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-2xl font-extrabold text-foreground">
              Await Managing Partner Validation
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your account request has been submitted. A Managing Partner must validate
              and approve it before you can access the workspace.
            </p>
          </div>

          <div className="mt-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            {state.fullName && (
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">
                  {state.fullName}
                </span>
              </div>
            )}
            {state.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span className="min-w-0 truncate text-muted-foreground">
                  {state.email}
                </span>
              </div>
            )}
            {accountType && (
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Requested role: {accountType}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="gold-button inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold"
            >
              Go to Login
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              Return Home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
