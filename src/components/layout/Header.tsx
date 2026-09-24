import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CircleHelp,
  Search,
  Menu,
  UserCircle2,
  AlertTriangle,
  FileText,
  Scale,
  Users,
} from "lucide-react";
import { User } from "@/types/legal";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useNotifications } from "@/hooks/useNotifications";

export interface HeaderSearchResult {
  id: string;
  type: "matter" | "client" | "document";
  title: string;
  subtitle: string;
}

interface HeaderProps {
  currentUser: User;
  title: string;
  onMenuToggle?: () => void;
  onAccountClick?: () => void;
  onHelpClick?: () => void;
  onSearch?: (query: string) => void;
  searchResults?: HeaderSearchResult[];
  onSearchResultSelect?: (result: HeaderSearchResult) => void;
  onPendingApprovalsClick?: () => void;
}

export function Header({
  currentUser,
  title,
  onMenuToggle,
  onAccountClick,
  onHelpClick,
  onSearch,
  searchResults = [],
  onSearchResultSelect,
  onPendingApprovalsClick,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const storedUnreadCount = notifications.filter(
    (n) => !n.read && n.kind !== "pending_approval",
  ).length;
  const canShowSearchResults = searchQuery.trim().length >= 2 && showSearchResults;
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSearchResults(true);
    onSearch?.(e.target.value);
  };

  const handleSearchResultSelect = (result: HeaderSearchResult) => {
    onSearchResultSelect?.(result);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node) &&
        (!mobileSearchRef.current ||
          !mobileSearchRef.current.contains(event.target as Node))
      ) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getNotificationIcon = (type: "urgent" | "info" | "warning") => {
    switch (type) {
      case "urgent":
        return AlertTriangle;
      case "warning":
        return FileText;
      default:
        return Scale;
    }
  };

  const getNotificationColor = (type: "urgent" | "info" | "warning") => {
    switch (type) {
      case "urgent":
        return "text-destructive bg-destructive/10";
      case "warning":
        return "text-warning bg-warning/10";
      default:
        return "text-info bg-info/10";
    }
  };

  const renderSearchBox = (
    ref: React.RefObject<HTMLDivElement>,
    containerClassName: string,
    inputClassName: string,
    dropdownClassName: string,
  ) => (
    <div className={containerClassName} ref={ref}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder="Search clients, matters, documents..."
        value={searchQuery}
        onChange={handleSearchChange}
        onFocus={() => setShowSearchResults(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && searchResults[0]) {
            handleSearchResultSelect(searchResults[0]);
          }
          if (event.key === "Escape") {
            setShowSearchResults(false);
          }
        }}
        className={inputClassName}
      />
      {canShowSearchResults && (
        <div className={dropdownClassName}>
          {searchResults.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No matching clients, matters, or documents
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {searchResults.map((result) => {
                const Icon = result.type === "matter" ? Scale : result.type === "client" ? Users : FileText;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSearchResultSelect(result)}
                    className="flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {result.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 dark:bg-background/80">
      <div className="app-header-inner flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-foreground sm:text-xl">
              {title}
            </h2>
            <p className="hidden text-sm text-muted-foreground sm:block">
              {new Date().toLocaleDateString("en-NG", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {renderSearchBox(
            searchRef,
            "relative hidden md:block",
            "search-input w-56 lg:w-72 pl-10",
            "absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-card",
          )}

          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-card animate-fade-in z-50">
                <div className="flex items-center justify-between border-b border-border p-3">
                  <h3 className="font-semibold text-foreground">
                    Notifications
                  </h3>
                  {storedUnreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead().catch(console.error)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.type);
                      return (
                        <div
                          key={notification.id}
                          onClick={() => {
                            if (notification.kind === "pending_approval") {
                              setShowNotifications(false);
                              onPendingApprovalsClick?.();
                              return;
                            }

                            markAsRead(notification.id).catch(console.error);
                          }}
                          className={cn(
                            "flex gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/50 border-b border-border last:border-0",
                            !notification.read && "bg-primary/5",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                              getNotificationColor(notification.type),
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground capitalize truncate">
                                {notification.type}
                              </p>
                              {!notification.read && (
                                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.created_at).toLocaleString(
                                "en-NG",
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <ThemeToggle />

          <button
            type="button"
            onClick={onHelpClick}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            title="How to use LEXORA"
            aria-label="Open how to use guide"
          >
            <CircleHelp className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onAccountClick}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            title={`${currentUser.name} - ${currentUser.role}`}
            aria-label={`View ${currentUser.name} account settings`}
          >
            <UserCircle2 className="h-9 w-9" />
          </button>
        </div>
      </div>
      <div className="px-3 pb-3 md:hidden">
        {renderSearchBox(
          mobileSearchRef,
          "relative",
          "search-input w-full pl-10",
          "absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border bg-card shadow-card",
        )}
      </div>
    </header>
  );
}
