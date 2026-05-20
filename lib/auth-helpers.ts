import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { Project } from "@/models/Project";

export function isAdminSession(session: Session | null): boolean {
  return session?.user?.role === "admin";
}

/** Mongo filter snippet to merge into project-scoped queries.
 *  Empty for admins; for members, excludes admin-only boards. */
export function projectVisibilityFilter(session: Session | null): Record<string, unknown> {
  return isAdminSession(session) ? {} : { isAdminOnly: { $ne: true } };
}

/** Resolve a project by id, returning it only if the caller may see it.
 *  Returns null when the project is missing OR hidden to this user (treated as 404). */
export async function getVisibleProject(
  session: Session | null,
  projectId: string,
): Promise<any | null> {
  if (!projectId) return null;
  const project = await Project.findById(projectId);
  if (!project) return null;
  if (project.isAdminOnly && !isAdminSession(session)) return null;
  return project;
}

/** Returns the set of project IDs the caller may see, as strings. Admins get all. */
export async function visibleProjectIds(session: Session | null): Promise<string[]> {
  const filter = projectVisibilityFilter(session);
  const projects = await Project.find(filter).select("_id").lean<Array<{ _id: unknown }>>();
  return projects.map((p) => String(p._id));
}

export async function getSessionOrUnauthorized() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return { session: null, error };
  if (session!.user.role !== "admin") {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Forbidden — admin only" },
        { status: 403 },
      ),
    };
  }
  return { session: session!, error: null };
}
