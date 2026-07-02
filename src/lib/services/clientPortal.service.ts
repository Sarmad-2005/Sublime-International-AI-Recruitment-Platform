import "server-only";

import { subDays } from "date-fns";

import { prisma, Prisma } from "@/lib/prisma";
import type {
  ApplicationStatus,
  CandidateTier as PrismaCandidateTier,
  ClientReviewStatus,
} from "@/generated/prisma/enums";
import {
  signedUrl,
  CLIENT_RECORDING_TTL_SECONDS,
} from "@/lib/storage/interview-recordings";
import { USER_ROLES, type CandidateTier } from "@/lib/constants";
import type {
  ClientCandidateView,
  ClientDashboard,
  ClientJobPosition,
  ClientMessageDTO,
  ClientMessageThread,
  ClientPoolCandidate,
  ClientPoolSummary,
  ClientProfileDTO,
  ClientReviewStatusValue,
  ClientUpcomingInterview,
  PaginatedClientPool,
} from "@/types";
import type {
  ClientCandidateStatusInput,
  SendClientMessageInput,
} from "@/lib/validations";

/**
 * Saudi Client Portal service (SRS §3.8 M7) — the only layer that reads/writes
 * the DB for the client-facing portal (Rule #5).
 *
 * SECURITY MODEL: every method takes the *authenticated* user id (never a raw
 * client id from the request), resolves the caller's own `SaudiClientProfile`,
 * and scopes all candidate reads to pool entries owned by that profile. A client
 * can therefore never address another client's pool, candidate or recording.
 */

/** Application statuses that count a pooled candidate as "Selected". */
const SELECTED_STATUSES: ApplicationStatus[] = [
  "SELECTED",
  "POST_SELECTION",
  "DEPLOYED",
];

export const CLIENT_POOL_PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Profile resolution (auth boundary)
// ---------------------------------------------------------------------------

const clientProfileSelect = {
  id: true,
  userId: true,
  companyName: true,
  companyRegNumber: true,
  country: true,
  city: true,
  address: true,
  contactName: true,
  designation: true,
  contactPhone: true,
  website: true,
  logoUrl: true,
  user: { select: { email: true } },
} satisfies Prisma.SaudiClientProfileSelect;

type ClientProfileRow = Prisma.SaudiClientProfileGetPayload<{
  select: typeof clientProfileSelect;
}>;

function toClientProfileDTO(row: ClientProfileRow): ClientProfileDTO {
  return {
    id: row.id,
    userId: row.userId,
    companyName: row.companyName,
    companyRegNumber: row.companyRegNumber,
    country: row.country,
    city: row.city,
    address: row.address,
    contactName: row.contactName,
    designation: row.designation,
    contactPhone: row.contactPhone,
    website: row.website,
    logoUrl: row.logoUrl,
    email: row.user.email,
  };
}

/** The signed-in client's own company/contact profile, or `null`. */
export async function getClientProfile(
  userId: string,
): Promise<ClientProfileDTO | null> {
  const row = await prisma.saudiClientProfile.findUnique({
    where: { userId },
    select: clientProfileSelect,
  });
  return row ? toClientProfileDTO(row) : null;
}

/** Resolve the caller's client profile or throw — the internal auth gate. */
async function requireClientProfile(userId: string): Promise<ClientProfileRow> {
  const row = await prisma.saudiClientProfile.findUnique({
    where: { userId },
    select: clientProfileSelect,
  });
  if (!row) {
    throw new Error("No Saudi client profile is linked to this account.");
  }
  return row;
}

/** Unread inbound message count for the portal chrome badge. */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: { threadId: userId, receiverId: userId, isRead: false },
  });
}

/** The default support admin a client's messages are routed to. */
async function getSupportAdminId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return admin?.id ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Everything the client dashboard renders (summary, new arrivals, interviews). */
export async function getClientDashboard(
  userId: string,
): Promise<ClientDashboard> {
  const profile = await requireClientProfile(userId);
  const clientId = profile.id;
  const now = new Date();

  // "Since last login": the sign-in stamps `lastLoginAt` to ~now, so when the
  // stamp is within the last hour (this very session) fall back to a 7-day
  // window to keep the badge meaningful.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastLoginAt: true },
  });
  const lastLogin = user?.lastLoginAt ?? null;
  const sinceReference =
    lastLogin && now.getTime() - lastLogin.getTime() > 60 * 60 * 1000
      ? lastLogin
      : subDays(now, 7);

  const poolWhere: Prisma.SaudiClientCandidatePoolWhereInput = {
    saudiClientId: clientId,
  };

  const [
    total,
    interested,
    shortlisted,
    selected,
    newSinceLastLogin,
    upcomingRows,
    latestMessageRow,
    unreadMessages,
  ] = await Promise.all([
    prisma.saudiClientCandidatePool.count({ where: poolWhere }),
    prisma.saudiClientCandidatePool.count({
      where: { ...poolWhere, clientStatus: "INTERESTED" },
    }),
    prisma.saudiClientCandidatePool.count({
      where: { ...poolWhere, clientStatus: "SHORTLISTED_FOR_INTERVIEW" },
    }),
    prisma.saudiClientCandidatePool.count({
      where: {
        ...poolWhere,
        application: { status: { in: SELECTED_STATUSES } },
      },
    }),
    prisma.saudiClientCandidatePool.count({
      where: { ...poolWhere, addedAt: { gte: sinceReference } },
    }),
    prisma.liveInterviewSession.findMany({
      where: {
        saudiClientId: clientId,
        status: "SCHEDULED",
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: {
        id: true,
        applicationId: true,
        scheduledAt: true,
        durationMinutes: true,
        application: {
          select: {
            candidate: { select: { fullName: true } },
            jobPost: { select: { title: true } },
          },
        },
      },
    }),
    prisma.message.findFirst({
      where: { threadId: userId },
      orderBy: { sentAt: "desc" },
      select: { id: true, content: true, sentAt: true, senderId: true },
    }),
    prisma.message.count({
      where: { threadId: userId, receiverId: userId, isRead: false },
    }),
  ]);

  const summary: ClientPoolSummary = { total, interested, shortlisted, selected };

  const upcomingInterviews: ClientUpcomingInterview[] = upcomingRows.map((row) => ({
    id: row.id,
    applicationId: row.applicationId,
    candidateName: row.application.candidate.fullName,
    jobTitle: row.application.jobPost.title,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMinutes: row.durationMinutes,
  }));

  return {
    companyName: profile.companyName,
    contactName: profile.contactName,
    logoUrl: profile.logoUrl,
    summary,
    newSinceLastLogin,
    upcomingInterviews,
    latestMessage: latestMessageRow
      ? {
          id: latestMessageRow.id,
          content: latestMessageRow.content,
          sentAt: latestMessageRow.sentAt.toISOString(),
          fromAdmin: latestMessageRow.senderId !== userId,
        }
      : null,
    unreadMessages,
  };
}

// ---------------------------------------------------------------------------
// Talent pool (filtered, paginated)
// ---------------------------------------------------------------------------

export interface ClientPoolFilterInput {
  jobPostId: string | null;
  tier: CandidateTier | null;
  status: ClientReviewStatusValue | null;
  q: string | null;
  page: number;
}

/** The client's candidate pool, filtered + paginated, with filter facets. */
export async function getAssignedCandidatePool(
  userId: string,
  filters: ClientPoolFilterInput,
): Promise<PaginatedClientPool> {
  const profile = await requireClientProfile(userId);
  const clientId = profile.id;
  const page = Math.max(1, filters.page);
  const pageSize = CLIENT_POOL_PAGE_SIZE;
  const skip = (page - 1) * pageSize;

  const where: Prisma.SaudiClientCandidatePoolWhereInput = {
    saudiClientId: clientId,
  };

  if (filters.status) {
    where.clientStatus = filters.status as ClientReviewStatus;
  }

  const appFilter: Prisma.ApplicationWhereInput = {};
  if (filters.jobPostId) appFilter.jobPostId = filters.jobPostId;
  if (filters.tier) {
    appFilter.tierRecord = { tier: filters.tier as PrismaCandidateTier };
  }
  if (filters.q) {
    appFilter.candidate = {
      fullName: { contains: filters.q.trim(), mode: "insensitive" },
    };
  }
  if (Object.keys(appFilter).length > 0) {
    where.application = appFilter;
  }

  const [rows, total, positionRows] = await Promise.all([
    prisma.saudiClientCandidatePool.findMany({
      where,
      orderBy: [{ addedAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        applicationId: true,
        clientStatus: true,
        addedAt: true,
        application: {
          select: {
            candidate: {
              select: {
                fullName: true,
                profilePhotoUrl: true,
                primaryTrade: true,
                yearsOfExperience: true,
              },
            },
            jobPost: { select: { title: true } },
            tierRecord: { select: { tier: true, finalScore: true } },
            assessmentAttempt: { select: { score: true } },
            aiInterviewAttempt: { select: { overallInterviewScore: true } },
          },
        },
      },
    }),
    prisma.saudiClientCandidatePool.count({ where }),
    prisma.jobPost.findMany({
      where: {
        saudiClientId: clientId,
        applications: { some: { clientPoolEntry: { isNot: null } } },
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const items: ClientPoolCandidate[] = rows.map((row) => {
    const app = row.application;
    return {
      applicationId: row.applicationId,
      fullName: app.candidate.fullName,
      profilePhotoUrl: app.candidate.profilePhotoUrl,
      tier: (app.tierRecord?.tier ?? "PENDING") as CandidateTier,
      finalScore: app.tierRecord?.finalScore ?? null,
      primaryTrade: app.candidate.primaryTrade,
      yearsOfExperience: app.candidate.yearsOfExperience,
      assessmentScore: app.assessmentAttempt?.score ?? null,
      interviewScore: app.aiInterviewAttempt?.overallInterviewScore ?? null,
      clientStatus: row.clientStatus as ClientReviewStatusValue,
      jobTitle: app.jobPost.title,
      addedAt: row.addedAt.toISOString(),
    };
  });

  const positions: ClientJobPosition[] = positionRows.map((j) => ({
    id: j.id,
    title: j.title,
  }));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    positions,
  };
}

// ---------------------------------------------------------------------------
// Candidate profile (client-reduced view)
// ---------------------------------------------------------------------------

/**
 * A single pooled candidate's reduced profile. Returns `null` when the
 * application isn't in THIS client's pool (prevents cross-client access).
 */
export async function getCandidateProfileForClient(
  userId: string,
  applicationId: string,
): Promise<ClientCandidateView | null> {
  const profile = await requireClientProfile(userId);

  const entry = await prisma.saudiClientCandidatePool.findFirst({
    where: { saudiClientId: profile.id, applicationId },
    select: {
      clientStatus: true,
      application: {
        select: {
          id: true,
          candidate: {
            select: {
              fullName: true,
              profilePhotoUrl: true,
              educationLevel: true,
              primaryTrade: true,
              secondaryTrade: true,
              yearsOfExperience: true,
              nationality: true,
            },
          },
          jobPost: {
            select: {
              title: true,
              saudiClient: { select: { companyName: true } },
            },
          },
          tierRecord: { select: { tier: true, finalScore: true } },
          assessmentAttempt: { select: { score: true, passed: true } },
          aiInterviewAttempt: {
            select: {
              technicalScore: true,
              communicationScore: true,
              behavioralScore: true,
              confidenceScore: true,
              overallInterviewScore: true,
              aiSummary: true,
              recordingUrl: true,
            },
          },
        },
      },
    },
  });

  if (!entry) return null;

  const app = entry.application;
  const interview = app.aiInterviewAttempt;

  // Recording column stores the storage PATH; sign it for a short-lived preview.
  const recordingUrl = interview?.recordingUrl
    ? await signedUrl(interview.recordingUrl, CLIENT_RECORDING_TTL_SECONDS)
    : null;

  return {
    applicationId: app.id,
    fullName: app.candidate.fullName,
    profilePhotoUrl: app.candidate.profilePhotoUrl,
    tier: (app.tierRecord?.tier ?? "PENDING") as CandidateTier,
    finalScore: app.tierRecord?.finalScore ?? null,
    clientStatus: entry.clientStatus as ClientReviewStatusValue,
    jobTitle: app.jobPost.title,
    companyName: app.jobPost.saudiClient.companyName,
    educationLevel: app.candidate.educationLevel,
    primaryTrade: app.candidate.primaryTrade,
    secondaryTrade: app.candidate.secondaryTrade,
    yearsOfExperience: app.candidate.yearsOfExperience,
    nationality: app.candidate.nationality,
    recordingUrl,
    aiSummary: interview?.aiSummary ?? null,
    scores: {
      technical: interview?.technicalScore ?? null,
      communication: interview?.communicationScore ?? null,
      behavioral: interview?.behavioralScore ?? null,
      confidence: interview?.confidenceScore ?? null,
      overall: interview?.overallInterviewScore ?? null,
    },
    assessmentScore: app.assessmentAttempt?.score ?? null,
    assessmentPassed: app.assessmentAttempt?.passed ?? null,
  };
}

// ---------------------------------------------------------------------------
// Client interest signal
// ---------------------------------------------------------------------------

/** Map the client's interest choice to the pool's `clientStatus` enum value. */
const STATUS_MAP: Record<
  ClientCandidateStatusInput["status"],
  ClientReviewStatus
> = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  SHORTLISTED_FOR_INTERVIEW: "SHORTLISTED_FOR_INTERVIEW",
};

/**
 * Record the client's interest on a pooled candidate. Verifies ownership,
 * updates the pool entry, and — for a shortlist — advances the application and
 * notifies the team. SRS §3.8 FR-CLIENT-005.
 */
export async function updateClientCandidateStatus(
  userId: string,
  input: ClientCandidateStatusInput,
): Promise<{ status: ClientReviewStatusValue }> {
  const profile = await requireClientProfile(userId);
  const { applicationId, status } = input;

  const entry = await prisma.saudiClientCandidatePool.findFirst({
    where: { saudiClientId: profile.id, applicationId },
    select: { id: true },
  });
  if (!entry) {
    throw new Error("This candidate is not in your talent pool.");
  }

  const mapped = STATUS_MAP[status];

  await prisma.saudiClientCandidatePool.update({
    where: { id: entry.id },
    data: { clientStatus: mapped, reviewedAt: new Date() },
  });

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.auditLog.create({
      data: {
        userId,
        action: "CLIENT_REVIEW",
        entityType: "APPLICATION",
        entityId: applicationId,
        newValue: { clientStatus: mapped, company: profile.companyName },
      },
    }),
  ];

  // Shortlisting for a live interview advances the application stage.
  if (mapped === "SHORTLISTED_FOR_INTERVIEW") {
    writes.push(
      prisma.application.update({
        where: { id: applicationId },
        data: { status: "CLIENT_SHORTLISTED" },
      }),
    );
    const adminId = await getSupportAdminId();
    if (adminId) {
      writes.push(
        prisma.notification.create({
          data: {
            userId: adminId,
            type: "CLIENT_SHORTLIST",
            title: "Candidate shortlisted",
            message: `${profile.companyName} shortlisted a candidate for a live interview.`,
            link: `/admin/candidates?applicationId=${applicationId}`,
          },
        }),
      );
    }
  }

  await prisma.$transaction(writes);

  return { status: mapped as ClientReviewStatusValue };
}

// ---------------------------------------------------------------------------
// Recording signed URL (on-demand, ownership-checked)
// ---------------------------------------------------------------------------

/**
 * Mint a fresh 6-hour signed URL for a recording, verifying the recording's
 * attempt belongs to an application in THIS client's pool. Never accept a
 * bucket path from the client without this check. SRS §3.8 FR-CLIENT-004.
 */
export async function getSignedRecordingUrl(
  userId: string,
  recordingPath: string,
): Promise<string | null> {
  const profile = await requireClientProfile(userId);

  // Path shape: `<attemptId>/recording.webm`.
  const attemptId = recordingPath.split("/")[0];
  if (!attemptId) return null;

  const attempt = await prisma.aIInterviewAttempt.findUnique({
    where: { id: attemptId },
    select: { recordingUrl: true, applicationId: true },
  });
  if (!attempt || attempt.recordingUrl !== recordingPath) return null;

  const owns = await prisma.saudiClientCandidatePool.findFirst({
    where: { saudiClientId: profile.id, applicationId: attempt.applicationId },
    select: { id: true },
  });
  if (!owns) return null;

  return signedUrl(recordingPath, CLIENT_RECORDING_TTL_SECONDS);
}

// ---------------------------------------------------------------------------
// Messaging (client ↔ admin, one thread per client)
// ---------------------------------------------------------------------------

function toMessageDTO(
  row: {
    id: string;
    content: string;
    attachmentUrl: string | null;
    attachmentName: string | null;
    senderId: string;
    isRead: boolean;
    sentAt: Date;
  },
  clientUserId: string,
): ClientMessageDTO {
  return {
    id: row.id,
    content: row.content,
    attachmentUrl: row.attachmentUrl,
    attachmentName: row.attachmentName,
    senderId: row.senderId,
    fromClient: row.senderId === clientUserId,
    isRead: row.isRead,
    sentAt: row.sentAt.toISOString(),
  };
}

/**
 * The client's whole conversation with the team (thread id == the client's user
 * id). Marks inbound messages read as a side effect.
 */
export async function getMessages(userId: string): Promise<ClientMessageThread> {
  const profile = await requireClientProfile(userId);

  const [rows, adminId] = await Promise.all([
    prisma.message.findMany({
      where: { threadId: userId },
      orderBy: { sentAt: "asc" },
      select: {
        id: true,
        content: true,
        attachmentUrl: true,
        attachmentName: true,
        senderId: true,
        isRead: true,
        sentAt: true,
      },
    }),
    getSupportAdminId(),
  ]);

  // Mark inbound (admin → client) messages as read.
  await prisma.message.updateMany({
    where: { threadId: userId, receiverId: userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return {
    adminId,
    clientUserId: profile.userId,
    messages: rows.map((row) => toMessageDTO(row, userId)),
  };
}

/**
 * Send a message (optionally with a document attachment) to the support team.
 * Thread id is the client's user id so all their messages stay in one thread.
 */
export async function sendMessage(
  userId: string,
  input: SendClientMessageInput,
): Promise<ClientMessageDTO> {
  const profile = await requireClientProfile(userId);
  const adminId = await getSupportAdminId();
  if (!adminId) {
    throw new Error("No support contact is available right now.");
  }

  const created = await prisma.message.create({
    data: {
      threadId: userId,
      senderId: userId,
      receiverId: adminId,
      content: input.content.trim(),
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentName: input.attachmentName ?? null,
    },
    select: {
      id: true,
      content: true,
      attachmentUrl: true,
      attachmentName: true,
      senderId: true,
      isRead: true,
      sentAt: true,
    },
  });

  await prisma.notification.create({
    data: {
      userId: adminId,
      type: "NEW_MESSAGE",
      title: "New client message",
      message: `${profile.companyName} sent a message.`,
      link: `/admin/messages?client=${userId}`,
    },
  });

  return toMessageDTO(created, userId);
}
