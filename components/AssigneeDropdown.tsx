"use client";
import { useState, useEffect, useRef } from "react";
import { User, ChevronDown, Plus, X } from "lucide-react";

export interface AssigneeMember {
  _id: string;
  name: string;
  avatar?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MemberAvatar({
  name,
  avatar,
  size = "w-6 h-6",
  textSize = "text-xs",
  bg = "bg-brand-subtle",
  color = "text-brand",
}: {
  name: string;
  avatar?: string;
  size?: string;
  textSize?: string;
  bg?: string;
  color?: string;
}) {
  return avatar ? (
    <img
      src={avatar}
      alt={name}
      className={`${size} rounded-full flex-shrink-0`}
    />
  ) : (
    <span
      className={`${size} rounded-full ${bg} flex items-center justify-center ${color} ${textSize} font-bold flex-shrink-0`}
    >
      {initials(name)}
    </span>
  );
}

// ── Variant: "field" (inline row used in edit/create modals) ──────
// ── Variant: "button" (dropdown trigger used in filters) ──────────

interface BaseProps {
  members: AssigneeMember[];
  selected: string[];
  onChange: (updated: string[]) => void;
}

interface FieldVariantProps extends BaseProps {
  variant?: "field";
}

interface ButtonVariantProps extends BaseProps {
  variant: "button";
}

type Props = FieldVariantProps | ButtonVariantProps;

export function AssigneeDropdown({
  members,
  selected,
  onChange,
  variant = "field",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = (name: string) => {
    const updated = selected.includes(name)
      ? selected.filter((a) => a !== name)
      : [...selected, name];
    onChange(updated);
  };

  const getAvatar = (name: string) =>
    members.find((m) => m.name === name)?.avatar;

  if (variant === "button") {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
            selected.length > 0
              ? "filter-btn-active"
              : "bg-bg-base text-text-secondary hover:bg-bg-surface"
          }`}
        >
          <User size={13} />
          {selected.length > 0 ? `Assignee (${selected.length})` : "Assignee"}
          <ChevronDown
            size={12}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-fit min-w-54 max-h-64 overflow-y-auto py-1.5">
            {selected.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-bg-surface transition-colors cursor-pointer"
                >
                  Clear all
                </button>
                <div className="h-px bg-bg-base my-0.5" />
              </>
            )}
            {members.map((m) => {
              const isSelected = selected.includes(m.name);
              return (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => toggle(m.name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                    isSelected
                      ? "filter-item-active"
                      : "text-text-primary hover:!bg-bg-base"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center ${
                      isSelected ? "bg-brand" : "bg-bg-base"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 5L4 7L8 3"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <MemberAvatar
                    name={m.name}
                    avatar={m.avatar}
                    size="w-6 h-6"
                  />
                  {m.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── variant: "field" ──
  return (
    <div className="flex-1 relative" ref={ref}>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {selected.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 text-xs p-1 rounded-full bg-brand-subtle text-brand font-medium"
          >
            <MemberAvatar
              name={name}
              avatar={getAvatar(name)}
              size="w-5 h-5"
              textSize="text-xs"
              bg="bg-brand-subtle"
            />
            {name}
            <button
              type="button"
              onClick={() => toggle(name)}
              className="hover:text-danger transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="text-sm text-text-disabled hover:text-brand transition-colors flex items-center gap-1"
      >
        <Plus size={12} /> Add assignee
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-card rounded-xl shadow-lg z-[60] w-56 max-h-48 overflow-y-auto py-1">
          {members.map((m) => (
            <button
              key={m._id}
              type="button"
              onClick={() => toggle(m.name)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-surface transition-colors text-left"
            >
              <span
                className={`w-4 h-4 rounded flex items-center justify-center text-xs ${
                  selected.includes(m.name)
                    ? "bg-brand text-white"
                    : "bg-bg-base"
                }`}
              >
                {selected.includes(m.name) && "✓"}
              </span>
              <MemberAvatar name={m.name} avatar={m.avatar} />
              <span className="text-text-primary">{m.name}</span>
            </button>
          ))}
          {members.length === 0 && (
            <p className="px-3 py-2 text-xs text-text-disabled">
              No members found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
