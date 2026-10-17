import type {
  Decision,
  Project,
  ProposalSummary,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/fixtures/types";

export const projects: Project[] = [
  {
    id: "harbor-pine",
    name: "Harbor & Pine Bakery website",
    clientName: "Harbor & Pine Bakery",
    imessage: "connected",
  },
  {
    id: "ferro",
    name: "Ferro Cycles landing refresh",
    clientName: "Ferro Cycles",
    imessage: "disconnected",
  },
];

export const tasks: Task[] = [
  {
    id: "T-107",
    projectId: "harbor-pine",
    title: "Change homepage heading to green",
    status: "in_progress",
    priority: "high",
    internalTargetDate: "Nov 18, 2026",
    clientAgreedDate: "Nov 20, 2026",
    sourceMessage: "Hi! Can you make the homepage heading green?",
    messageHistory: [
      {
        id: "M-107-1",
        author: "Maya Chen",
        at: "Oct 13, 9:02 AM",
        body: "Hi! Can you make the homepage heading green?",
      },
      {
        id: "M-107-2",
        author: "Bridgify",
        at: "Oct 13, 9:02 AM",
        body: "I've added “change the homepage heading to green” to the work list.",
      },
    ],
  },
  {
    id: "T-108",
    projectId: "harbor-pine",
    title: "Replace homepage subtext",
    status: "ready",
    priority: "normal",
    internalTargetDate: "Nov 19, 2026",
    clientAgreedDate: null,
    sourceMessage: "Also can the line under it say “Baked before sunrise, every day”?",
    messageHistory: [
      {
        id: "M-108-1",
        author: "Maya Chen",
        at: "Oct 13, 9:40 AM",
        body: "Also can the line under it say “Baked before sunrise, every day”?",
      },
      {
        id: "M-108-2",
        author: "Bridgify",
        at: "Oct 13, 9:40 AM",
        body: "I've added the homepage subtext change to the work list. No new launch date was agreed.",
      },
    ],
  },
  {
    id: "T-105",
    projectId: "harbor-pine",
    title: "Contact form delivers to the bakery inbox",
    status: "blocked",
    priority: "high",
    internalTargetDate: "Nov 12, 2026",
    clientAgreedDate: "Nov 20, 2026",
    sourceMessage: "Please send the contact form to hello@harborandpine.example once that inbox is live.",
    messageHistory: [
      {
        id: "M-105-1",
        author: "Maya Chen",
        at: "Oct 12, 4:18 PM",
        body: "Please send the contact form to hello@harborandpine.example once that inbox is live.",
      },
      {
        id: "M-105-2",
        author: "Bridgify",
        at: "Oct 12, 4:18 PM",
        body: "The contact form is on the work list. It stays blocked until the inbox address is confirmed.",
      },
    ],
  },
  {
    id: "T-101",
    projectId: "harbor-pine",
    title: "Build the Home page",
    status: "done",
    priority: "high",
    internalTargetDate: "Oct 11, 2026",
    clientAgreedDate: "Nov 20, 2026",
    sourceMessage: "The Home page is part of the signed five-page site.",
    messageHistory: [
      {
        id: "M-101-1",
        author: "Agreement",
        at: "Oct 8, 10:00 AM",
        body: "The Home page is part of the signed five-page site.",
      },
    ],
  },
  {
    id: "T-201",
    projectId: "ferro",
    title: "Set the hero headline to black",
    status: "ready",
    priority: "normal",
    internalTargetDate: "Dec 2, 2026",
    clientAgreedDate: null,
    sourceMessage: "Can the big headline on the landing page be black instead of gray?",
    messageHistory: [
      {
        id: "M-201-1",
        author: "Lena Ferro",
        at: "Oct 16, 2:11 PM",
        body: "Can the big headline on the landing page be black instead of gray?",
      },
      {
        id: "M-201-2",
        author: "Bridgify",
        at: "Oct 16, 2:11 PM",
        body: "I've added the headline color change to the work list.",
      },
    ],
  },
];

export const decisions: Decision[] = [
  {
    id: "D-7",
    projectId: "harbor-pine",
    reason: "exhausted_allowance",
    reasonLabel: "Out of revisions",
    clientMessage: "Fix the “Pasteries” typo on the Menu page.",
    recommendedAction: "Grant an extra revision. The menu page is in scope, and the allowance is already used.",
    evidence: "Revision allowance: 2 total, 1 reserved, 1 consumed, 0 available.",
  },
  {
    id: "D-8",
    projectId: "harbor-pine",
    reason: "scope_addition",
    reasonLabel: "New scope requested",
    clientMessage: "Can customers create accounts?",
    recommendedAction: "Draft a proposal. Customer accounts are excluded from the signed agreement.",
    evidence: "Agreement excludes customer accounts and login.",
  },
  {
    id: "D-21",
    projectId: "ferro",
    reason: "ambiguous_request",
    reasonLabel: "Needs clarification",
    clientMessage: "Can you update the hours?",
    recommendedAction: "Request clarification. The message does not say which page or what the new hours are.",
    evidence: "Missing the target page and the replacement text.",
  },
];

export const proposalSummaries: ProposalSummary[] = [
  {
    id: "P-001",
    projectId: "harbor-pine",
    status: "awaiting_client",
  },
];

export const taskStatusLabel: Record<TaskStatus, string> = {
  ready: "Ready",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const taskPriorityLabel: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export function isActionableTask(task: Task) {
  return task.status === "ready" || task.status === "in_progress" || task.status === "blocked";
}

export function projectById(id: string) {
  return projects.find((project) => project.id === id) ?? projects[0];
}
