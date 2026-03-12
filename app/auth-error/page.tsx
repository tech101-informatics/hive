"use client";
import { useSearchParams } from "next/navigation";
import { FolderKanban, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const domain = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN || "your company";

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-border rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-danger-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} className="text-danger" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Access Denied</h1>
        {error === "AccessDenied" ? (
          <p className="text-text-secondary text-sm mb-6">
            Access is restricted to <span className="font-semibold text-text-primary">@{domain}</span> accounts.
            Please sign in with your company email.
          </p>
        ) : (
          <p className="text-text-secondary text-sm mb-6">
            An error occurred during authentication. Please try again.
          </p>
        )}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-lg hover:bg-brand-hover font-medium transition-colors"
        >
          <FolderKanban size={16} /> Back to Login
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
