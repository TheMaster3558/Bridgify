import "server-only";
import { z } from "zod";
import { ApiError, checked } from "../api";
import type { db } from "./server";
import { peopleSchema } from "../schemas/onboarding";
import {
  connectionKey,
  readPhotonHistory,
  type ChatConnection,
} from "../photon/message-history";
import type { ProjectChatHistory } from "../photon/history-contract";
export async function getProjectChatHistory(
  client: Awaited<ReturnType<typeof db>>,
  projectId: string,
  cursor?: string,
): Promise<ProjectChatHistory> {
  if (!z.uuid().safeParse(projectId).success)
    throw new ApiError(404, "NOT_FOUND", "Project is unavailable.");
  // User-session RLS authorizes the project before any provider request is made.
  const project = checked(
    await client
      .from("projects")
      .select("id,name,timezone,people")
      .eq("id", projectId)
      .maybeSingle(),
  );
  if (!project)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Project is unavailable to your account.",
    );
  const people = peopleSchema.safeParse(project.people);
  const base = {
    projectName: project.name,
    timezone: project.timezone,
    connected: false,
    connectionKey: null,
    clientName: null,
    agentAddress: null,
    messages: [],
    nextCursor: null,
    fetchedAt: new Date().toISOString(),
  };
  if (!people.success || people.data.channel !== "photon_shared") return base;
  const connection: ChatConnection = {
    projectId,
    instanceId: people.data.instance_id,
    userId: people.data.photon_user_id,
    address: people.data.client_sender_id,
    agentAddress: people.data.agent_number,
    chatGuid: people.data.chat_guid,
  };
  const history = await readPhotonHistory(connection, cursor);
  return {
    ...base,
    ...history,
    connected: true,
    connectionKey: connectionKey(connection),
    clientName: people.data.client_name,
    agentAddress: people.data.agent_number,
    fetchedAt: new Date().toISOString(),
  };
}
