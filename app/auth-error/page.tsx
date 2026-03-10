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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        {error === "AccessDenied" ? (
          <p className="text-slate-500 text-sm mb-6">
            Access is restricted to <span className="font-semibold text-slate-700">@{domain}</span> accounts.
            Please sign in with your company email.
          </p>
        ) : (
          <p className="text-slate-500 text-sm mb-6">
            An error occurred during authentication. Please try again.
          </p>
        )}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
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
