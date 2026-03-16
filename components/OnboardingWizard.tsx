"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Users,
  Columns3,
  Sparkles,
  ArrowRight,
  Check,
  X,
} from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to Hive",
    description:
      "Your team's project management hub. Let's get you set up in under a minute.",
    color: "#6366f1",
  },
  {
    icon: FolderKanban,
    title: "Create Your First Board",
    description:
      "Boards organize your work into projects. Each board has its own Kanban view with cards you can drag between columns.",
    action: "boards",
    color: "#3b82f6",
  },
  {
    icon: Columns3,
    title: "Customize Your Workflow",
    description:
      "We've set up default columns: To Do, In Progress, In Review, and Done. You can customize these anytime in Settings.",
    action: "settings",
    color: "#10b981",
  },
  {
    icon: Users,
    title: "Add Your Team",
    description:
      "Invite team members to collaborate. Assign cards, leave comments, and track progress together.",
    action: "team",
    color: "#f59e0b",
  },
];

export function OnboardingWizard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    const done = localStorage.getItem("hive-onboarding-done");
    if (!done) {
      // Small delay so the page loads first
      setTimeout(() => setShow(true), 500);
    }
  }, [status]);

  const dismiss = () => {
    localStorage.setItem("hive-onboarding-done", "true");
    setShow(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const goToAction = () => {
    const action = STEPS[step].action;
    dismiss();
    if (action === "boards") router.push("/projects");
    if (action === "settings") router.push("/settings/board");
    if (action === "team") router.push("/members");
  };

  if (!show) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[300]" onClick={dismiss} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[301] w-full max-w-md px-4">
        <div className="bg-bg-surface rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress */}
          <div className="flex gap-1 px-6 pt-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= step ? "bg-brand" : "bg-bg-base"
                }`}
              />
            ))}
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 text-text-disabled hover:text-text-secondary transition-colors"
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div className="px-6 pt-6 pb-8 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: current.color + "18" }}
            >
              <Icon size={28} style={{ color: current.color }} />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              {current.title}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
              {current.description}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            {step === 0 ? (
              <button
                onClick={next}
                className="flex-1 bg-brand text-white py-2.5 rounded-xl font-medium text-sm hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
              >
                Get Started <ArrowRight size={16} />
              </button>
            ) : (
              <>
                {current.action && (
                  <button
                    onClick={goToAction}
                    className="flex-1 bg-bg-card text-text-primary py-2.5 rounded-xl font-medium text-sm hover:bg-bg-base transition-colors"
                  >
                    {current.action === "boards" && "Create Board"}
                    {current.action === "settings" && "Go to Settings"}
                    {current.action === "team" && "Add Members"}
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex-1 bg-brand text-white py-2.5 rounded-xl font-medium text-sm hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                >
                  {isLast ? (
                    <>
                      Done <Check size={16} />
                    </>
                  ) : (
                    <>
                      Next <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Skip */}
          {!isLast && step > 0 && (
            <div className="px-6 pb-4 text-center">
              <button
                onClick={dismiss}
                className="text-xs text-text-disabled hover:text-text-secondary transition-colors"
              >
                Skip setup
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
