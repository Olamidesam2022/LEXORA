import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Missing credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.toLowerCase().includes("pending managing partner approval")) {
          navigate("/awaiting-approval", { state: { email } });
          return;
        }

        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/app");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[26.25rem] items-center">
        <div className="surface-card w-full p-5 sm:p-8">
          <div className="mb-7 text-center">
            <BrandLogo className="justify-center" />
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to continue to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
                onClick={() =>
                  toast({
                    title: "Password Reset",
                    description:
                      "Contact your administrator to reset your password.",
                  })
                }
              >
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {/* Help Text */}
          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/signup")}
                className="font-semibold text-primary hover:underline"
              >
                Sign up
              </button>{" "}
              - it will await Managing Partner approval.
            </p>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Secure law firm workspace
            <br />
            Protected legal operations
          </p>
        </div>
      </div>
    </div>
  );
}
