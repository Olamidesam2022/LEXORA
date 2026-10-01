import { Link } from "react-router-dom";
import type { MouseEvent } from "react";
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
  LayoutDashboard,
  Bell,
  Moon,
  CircleUserRound,
  Clock3,
  FolderOpen,
  Settings2,
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

function handleSmoothScroll(event: MouseEvent<HTMLAnchorElement>) {
  const targetId = event.currentTarget.getAttribute("href");
  if (!targetId?.startsWith("#")) return;

  const target = document.querySelector(targetId);
  if (!target) return;

  event.preventDefault();
  const targetTop = target.getBoundingClientRect().top + window.scrollY - 76;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetTop);
    window.history.replaceState(null, "", targetId);
    return;
  }

  const startTop = window.scrollY;
  const distance = targetTop - startTop;
  const duration = Math.min(1800, Math.max(1000, Math.abs(distance) * 0.75));
  const startTime = performance.now();
  const easeInOut = (progress: number) => progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const animate = (currentTime: number) => {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    window.scrollTo(0, startTop + distance * easeInOut(progress));

    if (progress < 1) {
      window.requestAnimationFrame(animate);
    } else {
      window.history.replaceState(null, "", targetId);
    }
  };

  window.requestAnimationFrame(animate);
}

export default function Landing() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground">
      <header className="landing-header">
        <div className="landing-container flex h-[76px] items-center justify-between">
          <BrandLogo to="/" />
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
            <a className="landing-nav-link" href="#platform" onClick={handleSmoothScroll}>Platform</a>
            <a className="landing-nav-link" href="#workflow" onClick={handleSmoothScroll}>Workflow</a>
            <a className="landing-nav-link" href="#capabilities" onClick={handleSmoothScroll}>Capabilities</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
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
              <a href="#capabilities" className="landing-text-link" onClick={handleSmoothScroll}>Explore the platform <ArrowDown className="h-4 w-4" /></a>
            </div>
            <div className="landing-proofline"><ShieldCheck className="h-4 w-4" /> Private by design <span /> Role-based access <span /> Recorded approvals</div>
          </div>

          <div className="landing-preview-wrap" aria-label="Static sample dashboard preview">
            <div className="landing-app-preview landing-demo-dashboard">
              <aside className="landing-demo-sidebar">
                <BrandLogo compact />
                <nav aria-label="Sample workspace navigation">
                  <span className="landing-demo-nav-active"><LayoutDashboard /> Dashboard</span>
                  <span><UsersRound /> Clients</span>
                  <span><CircleDollarSign /> Billing</span>
                  <span><BriefcaseBusiness /> Matters</span>
                  <span><FileCheck2 /> Advisory</span>
                  <span><Files /> Document Vault</span>
                  <span><CalendarDays /> Calendar</span>
                  <span><FolderOpen /> Records</span>
                </nav>
                <span className="landing-demo-sidebar-footer"><Settings2 /> Settings</span>
              </aside>
              <div className="landing-demo-main">
                <header className="landing-demo-topbar">
                  <div className="landing-demo-page-title"><strong>Dashboard</strong><small>Monday, 28 September 2026</small></div>
                  <div className="landing-demo-top-actions">
                    <div className="landing-demo-search"><Search /><span>Search clients, matters, documents</span></div>
                    <Bell /><Moon /><CircleUserRound />
                  </div>
                </header>
                <div className="landing-demo-content">
                  <div className="landing-demo-greeting">
                    <h2>Good afternoon, Adeola</h2>
                    <div className="landing-demo-tabs"><span className="is-active">Firm</span><span>Matters</span><span>Documents</span><span>Calendar</span><span>Users</span></div>
                  </div>
                  <div className="landing-demo-stats">
                    <article><span className="landing-demo-stat-icon"><BriefcaseBusiness /></span><small>LEXORA</small><p>Active matters</p><strong>18</strong><em>Across 4 practice areas</em></article>
                    <article><span className="landing-demo-stat-icon"><CircleDollarSign /></span><small>LEXORA</small><p>Outstanding fees</p><strong>₦4.8m</strong><em>12 fee notes</em></article>
                    <article><span className="landing-demo-stat-icon"><Files /></span><small>LEXORA</small><p>Documents on file</p><strong>36</strong><em>5 awaiting review</em></article>
                    <article><span className="landing-demo-stat-icon"><CalendarDays /></span><small>LEXORA</small><p>Upcoming deadlines</p><strong>4</strong><em>Next 7 days</em></article>
                  </div>
                  <div className="landing-demo-panels">
                    <section className="landing-demo-shortcuts">
                      <div><span><BriefcaseBusiness /></span><strong>Matters</strong></div>
                      <div><span><Files /></span><strong>Documents</strong></div>
                      <div><span><CalendarDays /></span><strong>Calendar</strong></div>
                      <div><span><UsersRound /></span><strong>Users</strong></div>
                    </section>
                    <section className="landing-demo-deadlines">
                      <header><div><strong>Upcoming Deadlines</strong><small>Deadlines over the next seven days</small></div><span>View Calendar</span></header>
                      <div className="landing-demo-deadline-row"><span className="landing-demo-date">29<br /><small>SEP</small></span><div><strong>Board resolution filing</strong><small>Northstar Energy · Corporate</small></div><em><Clock3 /> 10:00 am</em></div>
                      <div className="landing-demo-deadline-row"><span className="landing-demo-date">30<br /><small>SEP</small></span><div><strong>Submit witness statement</strong><small>Adeyemi v. Meridian Group · Litigation</small></div><em><Clock3 /> 12:30 pm</em></div>
                      <div className="landing-demo-deadline-row"><span className="landing-demo-date">02<br /><small>OCT</small></span><div><strong>Contract review due</strong><small>Harbour Foods · Commercial</small></div><em><Clock3 /> 4:00 pm</em></div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
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
