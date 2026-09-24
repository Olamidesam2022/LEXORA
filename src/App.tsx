import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ViewAsProvider } from "@/contexts/ViewAsContext";
import { MatterProgressModalProvider } from "@/hooks/useMatterProgressModal";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AwaitingApproval from "./pages/AwaitingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isApproved, status, signOut } = useAuth();

  useEffect(() => {
    if (user && !isLoading && status && status !== "approved") {
      signOut();
    }
  }, [isLoading, signOut, status, user]);

  if (isLoading) {
    return null; // Index handles its own loading state
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (status === "pending") {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (!isApproved) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Keep public pages directly accessible, including when the browser has a
// restored session. Successful sign-in navigates to the workspace explicitly.
function PublicRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route
      path="/login"
      element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      }
    />
    <Route
      path="/signup"
      element={
        <PublicRoute>
          <SignUp />
        </PublicRoute>
      }
    />
    <Route
      path="/awaiting-approval"
      element={
        <PublicRoute>
          <AwaitingApproval />
        </PublicRoute>
      }
    />
    <Route
      path="/app/*"
      element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      }
    />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <ViewAsProvider>
              <MatterProgressModalProvider>
                <AppRoutes />
              </MatterProgressModalProvider>
            </ViewAsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
