import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Files,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const capabilities = [
  { icon: BriefcaseBusiness, number: "01", title: "Matter management", description: "Keep corporate, transactional, regulatory, and litigation work together from opening through retention." },
  { icon: UsersRound, number: "02", title: "Client 360", description: "Find a client once and see their matters, documents, fees, payments, and recent activity." },
  { icon: FileCheck2, number: "03", title: "Document approvals", description: "Route drafts through Legal Officer, Operations Manager, and Managing Partner review." },
  { icon: CircleDollarSign, number: "04", title: "Billing records", description: "Link fee notes and payments directly to the clients and matters they belong to." },
  { icon: Files, number: "05", title: "Durable records", description: "Keep document revisions under unique file names, with an integrity hash and activity history." },
  { icon: CalendarDays, number: "06", title: "Deadlines & retention", description: "See upcoming work and review closed matters as they approach the five-year threshold." },
];

const approvalSteps = [
  { step: "01", role: "Legal Officer", action: "Prepare and submit" },
  { step: "02", role: "Operations Manager", action: "Review and route" },
  { step: "03", role: "Managing Partner", action: "Give final approval" },
];

export default function Landing() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <header className="landing-header">
        <div className="landing-container flex h-[76px] items-center justify-between">
          <BrandLogo to="/" />
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
            <a className="landing-nav-link" href="#platform">Platform</a>
            <a className="landing-nav-link" href="#workflow">Workflow</a>
            <a className="landing-nav-link" href="#capabilities">Capabilities</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {/* <Link to="/signup" className="landing-request-access" aria-label="Request access">
              <span className="hidden sm:inline">Request access</span>
              <span className="sm:hidden">Access</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link> */}
            <Link to="/login" className="landing-login-link">Sign in <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span className="landing-eyebrow-dot" /> LEGAL WORK, IN GOOD ORDER</div>
            <h1>Clarity for every<br /><span>matter that moves</span></h1>
            <p className="landing-lede">LEXORA brings client relationships, legal work, documents, approvals, and billing into one considered workspace for legal professionals.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login" className="landing-cta">Enter your workspace <ArrowRight className="h-4 w-4" /></Link>
              <a href="#capabilities" className="landing-text-link">Explore the platform <ArrowDown className="h-4 w-4" /></a>
            </div>
            <div className="landing-proofline"><ShieldCheck className="h-4 w-4" /> Private by design <span /> Role-based access <span /> Recorded approvals</div>
          </div>

          <div className="landing-preview-wrap" aria-label="Illustration of the LEXORA workspace">
            <div className="landing-preview-orb landing-preview-orb-one" />
            <div className="landing-preview-orb landing-preview-orb-two" />
            <div className="landing-app-preview">
              <div className="landing-app-topbar">
                <BrandLogo compact />
                <span className="landing-preview-label">WORKSPACE PREVIEW</span>
                <div className="landing-preview-search"><Search className="h-3.5 w-3.5" /><span>Search clients and matters</span><kbd>⌘ K</kbd></div>
                <span className="landing-avatar">Z</span>
              </div>
              <div className="landing-app-body">
                <aside className="landing-preview-sidebar">
                  <span className="landing-side-active"><BriefcaseBusiness /> Matters</span>
                  <span><UsersRound /> Clients</span>
                  <span><Files /> Documents</span>
                  <span><CircleDollarSign /> Billing</span>
                  <div className="landing-side-label">WORKSPACE</div>
                  <span><CalendarDays /> Calendar</span>
                  <span><ShieldCheck /> Approvals</span>
                </aside>
                <div className="landing-preview-content">
                  <div className="landing-preview-heading"><div><p>YOUR WORKSPACE</p><h2>Good morning, team</h2></div><span className="landing-preview-chip"><Sparkles /> Today at a glance</span></div>
                  <div className="landing-preview-stats">
                    <div><span>Active matters</span><strong>24</strong><small><i /> 4 practice areas</small></div>
                    <div><span>Awaiting review</span><strong>06</strong><small>Across the approval chain</small></div>
                    <div><span>Upcoming deadlines</span><strong>08</strong><small>Next 7 days</small></div>
                  </div>
                  <div className="landing-preview-list">
                    <div className="landing-preview-list-head"><strong>Recent matter activity</strong><span>View all <ChevronRight /></span></div>
                    <div className="landing-preview-entry"><span className="landing-entry-icon entry-green"><FileCheck2 /></span><div><strong>Share Purchase Agreement</strong><small>Acme Holdings · M&amp;A</small></div><span className="landing-status status-review">In ops review</span></div>
                    <div className="landing-preview-entry"><span className="landing-entry-icon entry-sand"><BriefcaseBusiness /></span><div><strong>Regulatory Compliance Review</strong><small>Northstar Energy · Regulatory</small></div><span className="landing-status status-open">In progress</span></div>
                    <div className="landing-preview-entry"><span className="landing-entry-icon entry-blue"><BadgeCheck /></span><div><strong>Board Advisory Memorandum</strong><small>Meridian Group · Corporate</small></div><span className="landing-status status-approved">Approved</span></div>
                  </div>
                </div>
              </div>
              <div className="landing-preview-foot"><LockKeyhole /> Client information stays within approved access.</div>
            </div>
            <div className="landing-floating-note"><span><Check /></span><div><strong>Approval recorded</strong><small>Every step leaves a trail</small></div></div>
          </div>
        </section>

        <section className="landing-container landing-trust-strip" aria-label="Platform principles">
          <p>MADE FOR THE WAY LEGAL TEAMS WORK</p>
          <div><span><Check /> One connected client record</span><span><Check /> Clear review ownership</span><span><Check /> Durable document history</span></div>
        </section>

        <section id="capabilities" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-heading">
              <div><p className="landing-section-kicker">THE PLATFORM</p><h2>Everything connected.<br /><span>Nothing out of place.</span></h2></div>
              <p>From the first client conversation to the final retained record, each part of the work has a clear home and a clear next step.</p>
            </div>
            <div className="landing-capability-grid">
              {capabilities.map(({ icon: Icon, number, title, description }) => (
                <article key={number} className="landing-capability-card">
                  <div className="landing-capability-top"><span>{number}</span><Icon /></div>
                  <h3>{title}</h3><p>{description}</p>
                  <ArrowUpRight className="landing-capability-arrow" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-workflow-section">
          <div className="landing-container landing-workflow-grid">
            <div><p className="landing-section-kicker">A CLEAR ROUTE TO APPROVAL</p><h2>Good work moves<br />with <span>the right people.</span></h2><p className="landing-workflow-copy">Documents move through a defined review path. Each decision is recorded, and the next person knows exactly what needs attention.</p><Link to="/login" className="landing-workflow-link">Sign in to your workspace <ArrowRight /></Link></div>
            <div className="landing-approval-list">
              {approvalSteps.map((item, index) => <div key={item.step} className="landing-approval-step"><span className="landing-approval-number">{item.step}</span><div><strong>{item.role}</strong><small>{item.action}</small></div><span className="landing-approval-check"><Check /></span>{index < approvalSteps.length - 1 && <span className="landing-approval-connector" />}</div>)}
              <div className="landing-system-note"><LockKeyhole /><p><strong>Managing Partners oversee workspace access.</strong><br />They approve users, manage roles, and make final document decisions.</p></div>
            </div>
          </div>
        </section>

        <section className="landing-container landing-bottom-cta">
          <div><p className="landing-section-kicker"></p><h2>Your work, in one place.</h2><p>A calmer way to keep matters moving and records in order.</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/login" className="landing-cta landing-cta-light">Sign in <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/signup" className="landing-bottom-request-access">Request access <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer"><div className="landing-container"><BrandLogo /><span>© {new Date().getFullYear()} adeadebola LEXORA Legal Workspace</span></div></footer>
    </div>
  );
}
