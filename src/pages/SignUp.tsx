import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, UserPlus } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function SignUp() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const requestedRole = "legal_officer" as const;
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signUp({
        email,
        password,
        fullName,
        role: requestedRole,
      });
      if (error) throw error;

      toast.success("Signup submitted. Your account is awaiting Managing Partner approval.");
      navigate("/awaiting-approval", {
        replace: true,
        state: { email, fullName, role: requestedRole },
      });
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Signup failed");
    } finally {
      setLoading(false);
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
          <div className="mb-6 text-center">
            <BrandLogo className="justify-center" />
            <h1 className="text-2xl font-extrabold text-foreground">Request Access</h1>
            <p className="mt-2 text-sm text-muted-foreground">Request access to LEXORA</p>
          </div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            Account details
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">
              Full name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="search-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              className="search-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              className="search-input"
            />
          </div>
          <p className="text-xs text-muted-foreground">New accounts are provisioned as Legal Officers and require Managing Partner approval.</p>
          <button
            type="submit"
            disabled={loading}
            className="gold-button flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2.5"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
