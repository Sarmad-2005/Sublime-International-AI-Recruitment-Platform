import "server-only";

import { prisma, type Prisma, type CandidateProfile } from "@/lib/prisma";
import {
  APPLICATION_STATUS_TO_BUCKET,
  APPLICATION_STATUS_LABELS,
  CANDIDATE_STATUS_BUCKETS,
  type CandidateStatusBucket,
} from "@/lib/constants";
import type {
  CandidateActivityItem,
  CandidateApplicationSummary,
  CandidateDashboardData,
  CandidateProfileDTO,
  FeaturedJob,
  NotificationFeed,
  ProfileCompletion,
  SectionCompletion,
} from "@/types";
import type { UpdateCandidateProfileInput } from "@/lib/validations";

/**
 * Candidate service — the only layer that talks to the database for the
 * candidate portal (Rule #5). Returns JSON-safe DTOs (dates as `yyyy-MM-dd` /
 * ISO strings, salaries in major units) so the same shapes flow from Server
 * Components, the `/api/candidate/*` routes and the client hooks unchanged.
 */

/** A new candidate has only a `users` row; the profile is created on first save. */
export class CandidateProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateProfileError";
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** `Date` → `yyyy-MM-dd` (or `null`). */
function toDateString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Halalas (minor units) → whole major currency units. */
function toMajorUnits(value: number | null): number | null {
  return value === null ? null : Math.round(value / 100);
}

function toProfileDTO(p: CandidateProfile): CandidateProfileDTO {
  return {
    id: p.id,
    userId: p.userId,
    fullName: p.fullName,
    fatherName: p.fatherName,
    cnic: p.cnic,
    dateOfBirth: toDateString(p.dateOfBirth) ?? "",
    gender: p.gender,
    nationality: p.nationality,
    maritalStatus: p.maritalStatus,
    religion: p.religion,
    passportNumber: p.passportNumber,
    passportIssueDate: toDateString(p.passportIssueDate),
    passportExpiryDate: toDateString(p.passportExpiryDate),
    passportIssuePlace: p.passportIssuePlace,
    permanentAddress: p.permanentAddress,
    currentAddress: p.currentAddress,
    city: p.city,
    province: p.province,
    country: p.country,
    postalCode: p.postalCode,
    educationLevel: p.educationLevel,
    primaryTrade: p.primaryTrade,
    secondaryTrade: p.secondaryTrade,
    yearsOfExperience: p.yearsOfExperience,
    profilePhotoUrl: p.profilePhotoUrl,
    cvUrl: p.cvUrl,
    cvUploadedAt: p.cvUploadedAt ? p.cvUploadedAt.toISOString() : null,
    passportCopyUrl: p.passportCopyUrl,
    emergencyContactName: p.emergencyContactName,
    emergencyContactRelation: p.emergencyContactRelation,
    emergencyContactPhone: p.emergencyContactPhone,
    emergencyContactAddress: p.emergencyContactAddress,
  };
}

/** `yyyy-MM-dd` → midnight-UTC `Date` (or `null` for empty/undefined). */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The candidate's full BEOE profile, or `null` if not created yet. */
export async function getCandidateProfile(
  userId: string,
): Promise<CandidateProfileDTO | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
  });
  return profile ? toProfileDTO(profile) : null;
}

// ---------------------------------------------------------------------------
// Writes (upsert — create on first save, then patch each section)
// ---------------------------------------------------------------------------

/** Fields that must be present to create the profile row for the first time. */
const CREATE_REQUIRED_FIELDS = [
  "fullName",
  "fatherName",
  "cnic",
  "dateOfBirth",
  "gender",
  "permanentAddress",
  "city",
] as const;

/**
 * Create-or-update the candidate's profile from a partial section payload.
 *
 * On first save the personal-identity fields are mandatory (the row can't exist
 * without them); education/experience seed to sensible defaults and are filled
 * in later by the Education tab. Subsequent saves patch only the keys provided,
 * so each tab can save independently.
 */
export async function updateCandidateProfile(
  userId: string,
  data: UpdateCandidateProfileInput,
): Promise<CandidateProfileDTO> {
  const existing = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!existing) {
    const missing = CREATE_REQUIRED_FIELDS.filter((key) => !data[key]);
    if (missing.length > 0) {
      throw new CandidateProfileError(
        "Please complete and save your Personal Info before updating other sections.",
      );
    }

    const created = await prisma.candidateProfile.create({
      data: {
        userId,
        fullName: data.fullName!,
        fatherName: data.fatherName!,
        cnic: data.cnic!,
        dateOfBirth: toDate(data.dateOfBirth)!,
        gender: data.gender!,
        nationality: data.nationality ?? "Pakistani",
        maritalStatus: data.maritalStatus ?? null,
        religion: data.religion ?? null,
        passportNumber: data.passportNumber ?? null,
        passportIssueDate: toDate(data.passportIssueDate),
        passportExpiryDate: toDate(data.passportExpiryDate),
        passportIssuePlace: data.passportIssuePlace ?? null,
        permanentAddress: data.permanentAddress!,
        currentAddress: data.currentAddress ?? null,
        city: data.city!,
        province: data.province ?? null,
        country: data.country ?? "Pakistan",
        postalCode: data.postalCode ?? null,
        educationLevel: data.educationLevel ?? "NONE",
        primaryTrade: data.primaryTrade ?? "",
        secondaryTrade: data.secondaryTrade ?? null,
        yearsOfExperience: data.yearsOfExperience ?? 0,
        profilePhotoUrl: emptyToNull(data.profilePhotoUrl),
        cvUrl: emptyToNull(data.cvUrl),
        cvUploadedAt: data.cvUrl ? new Date() : null,
        passportCopyUrl: emptyToNull(data.passportCopyUrl),
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactRelation: data.emergencyContactRelation ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        emergencyContactAddress: data.emergencyContactAddress ?? null,
      },
    });
    return toProfileDTO(created);
  }

  // Patch: only assign keys that were actually provided.
  const patch: Prisma.CandidateProfileUpdateInput = {};
  const set = <K extends keyof Prisma.CandidateProfileUpdateInput>(
    key: K,
    value: Prisma.CandidateProfileUpdateInput[K] | undefined,
  ) => {
    if (value !== undefined) patch[key] = value;
  };

  set("fullName", data.fullName);
  set("fatherName", data.fatherName);
  set("cnic", data.cnic);
  if (data.dateOfBirth !== undefined) patch.dateOfBirth = toDate(data.dateOfBirth)!;
  set("gender", data.gender);
  set("nationality", data.nationality);
  set("maritalStatus", data.maritalStatus);
  set("religion", data.religion);
  set("passportNumber", data.passportNumber);
  if (data.passportIssueDate !== undefined)
    patch.passportIssueDate = toDate(data.passportIssueDate);
  if (data.passportExpiryDate !== undefined)
    patch.passportExpiryDate = toDate(data.passportExpiryDate);
  set("passportIssuePlace", data.passportIssuePlace);
  set("permanentAddress", data.permanentAddress);
  set("currentAddress", data.currentAddress);
  set("city", data.city);
  set("province", data.province);
  set("country", data.country);
  set("postalCode", data.postalCode);
  set("educationLevel", data.educationLevel);
  set("primaryTrade", data.primaryTrade);
  set("secondaryTrade", data.secondaryTrade);
  set("yearsOfExperience", data.yearsOfExperience);
  set("emergencyContactName", data.emergencyContactName);
  set("emergencyContactRelation", data.emergencyContactRelation);
  set("emergencyContactPhone", data.emergencyContactPhone);
  set("emergencyContactAddress", data.emergencyContactAddress);

  if (data.profilePhotoUrl !== undefined)
    patch.profilePhotoUrl = emptyToNull(data.profilePhotoUrl);
  if (data.passportCopyUrl !== undefined)
    patch.passportCopyUrl = emptyToNull(data.passportCopyUrl);
  if (data.cvUrl !== undefined) {
    patch.cvUrl = emptyToNull(data.cvUrl);
    patch.cvUploadedAt = data.cvUrl ? new Date() : null;
  }

  const updated = await prisma.candidateProfile.update({
    where: { userId },
    data: patch,
  });
  return toProfileDTO(updated);
}

function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

// ---------------------------------------------------------------------------
// Profile completion
// ---------------------------------------------------------------------------

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

interface FieldCheck {
  label: string;
  filled: boolean;
}

function sectionCompletion(fields: FieldCheck[]): SectionCompletion {
  const filled = fields.filter((f) => f.filled).length;
  return {
    percentage: fields.length === 0 ? 100 : Math.round((filled / fields.length) * 100),
    missingFields: fields.filter((f) => !f.filled).map((f) => f.label),
  };
}

/**
 * Per-section + overall completion. A `null` profile (not created yet) reports
 * 0% with every field listed as missing.
 */
export function computeProfileCompletion(
  profile: CandidateProfileDTO | null,
): ProfileCompletion {
  const personalFields: FieldCheck[] = [
    { label: "Full name", filled: nonEmpty(profile?.fullName) },
    { label: "Father's name", filled: nonEmpty(profile?.fatherName) },
    { label: "CNIC", filled: nonEmpty(profile?.cnic) },
    { label: "Date of birth", filled: nonEmpty(profile?.dateOfBirth) },
    { label: "Gender", filled: nonEmpty(profile?.gender) },
    { label: "Permanent address", filled: nonEmpty(profile?.permanentAddress) },
    { label: "City", filled: nonEmpty(profile?.city) },
    { label: "Passport number", filled: nonEmpty(profile?.passportNumber) },
    { label: "Passport expiry", filled: nonEmpty(profile?.passportExpiryDate) },
    {
      label: "Emergency contact name",
      filled: nonEmpty(profile?.emergencyContactName),
    },
    {
      label: "Emergency contact phone",
      filled: nonEmpty(profile?.emergencyContactPhone),
    },
  ];

  const documentsFields: FieldCheck[] = [
    { label: "Profile photo", filled: nonEmpty(profile?.profilePhotoUrl) },
    { label: "CV / resume", filled: nonEmpty(profile?.cvUrl) },
    { label: "Passport copy", filled: nonEmpty(profile?.passportCopyUrl) },
  ];

  const educationFields: FieldCheck[] = [
    {
      label: "Education level",
      filled: nonEmpty(profile?.educationLevel) && profile?.educationLevel !== "NONE",
    },
    { label: "Primary trade", filled: nonEmpty(profile?.primaryTrade) },
  ];

  const personal = sectionCompletion(personalFields);
  const documents = sectionCompletion(documentsFields);
  const education = sectionCompletion(educationFields);

  const allFields = [...personalFields, ...documentsFields, ...educationFields];
  const overall = Math.round(
    (allFields.filter((f) => f.filled).length / allFields.length) * 100,
  );

  return {
    overall,
    sections: { personal, documents, education },
    missingFields: allFields.filter((f) => !f.filled).map((f) => f.label),
  };
}

/** Overall completion percentage (0–100) — convenience wrapper. */
export function getProfileCompletionPercentage(
  profile: CandidateProfileDTO | null,
): number {
  return computeProfileCompletion(profile).overall;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/** All of a candidate's applications, newest first, summarised for portal lists. */
export async function getApplications(
  candidateId: string,
): Promise<CandidateApplicationSummary[]> {
  const applications = await prisma.application.findMany({
    where: { candidateId },
    orderBy: { appliedAt: "desc" },
    select: {
      id: true,
      jobPostId: true,
      status: true,
      appliedAt: true,
      jobPost: {
        select: {
          title: true,
          city: true,
          saudiClient: { select: { companyName: true } },
        },
      },
    },
  });

  return applications.map((a) => ({
    id: a.id,
    jobPostId: a.jobPostId,
    jobTitle: a.jobPost.title,
    companyName: a.jobPost.saudiClient.companyName,
    city: a.jobPost.city,
    status: a.status,
    appliedAt: a.appliedAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function emptyStatusCounts(): Record<CandidateStatusBucket, number> {
  return CANDIDATE_STATUS_BUCKETS.reduce(
    (acc, bucket) => {
      acc[bucket] = 0;
      return acc;
    },
    {} as Record<CandidateStatusBucket, number>,
  );
}

/** Everything the candidate dashboard needs, in one round of queries. */
export async function getCandidateDashboardData(
  userId: string,
): Promise<CandidateDashboardData> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
  });

  const profileDTO = profile ? toProfileDTO(profile) : null;
  const completion = computeProfileCompletion(profileDTO);

  const [applications, unreadNotifications] = await Promise.all([
    profile
      ? prisma.application.findMany({
          where: { candidateId: profile.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            jobPostId: true,
            jobPost: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  // Status-bucket counts.
  const statusCounts = emptyStatusCounts();
  for (const app of applications) {
    const bucket = APPLICATION_STATUS_TO_BUCKET[app.status];
    if (bucket) statusCounts[bucket] += 1;
  }

  // Recent activity (last 5 status changes).
  const recentActivity: CandidateActivityItem[] = applications
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      jobTitle: a.jobPost.title,
      status: a.status,
      occurredAt: a.updatedAt.toISOString(),
    }));

  // Featured active jobs the candidate hasn't applied to yet (max 3).
  const appliedJobIds = applications.map((a) => a.jobPostId);
  const jobs = await prisma.jobPost.findMany({
    where: {
      status: "ACTIVE",
      ...(appliedJobIds.length > 0 ? { id: { notIn: appliedJobIds } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
    select: {
      id: true,
      title: true,
      sector: true,
      city: true,
      country: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      vacancies: true,
      deadline: true,
      saudiClient: { select: { companyName: true } },
    },
  });

  const featuredJobs: FeaturedJob[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: j.saudiClient.companyName,
    sector: j.sector,
    city: j.city,
    country: j.country,
    salaryMin: toMajorUnits(j.salaryMin),
    salaryMax: toMajorUnits(j.salaryMax),
    salaryCurrency: j.salaryCurrency,
    vacancies: j.vacancies,
    deadline: j.deadline ? j.deadline.toISOString() : null,
  }));

  return {
    fullName: profileDTO?.fullName ?? "",
    profilePhotoUrl: profileDTO?.profilePhotoUrl ?? null,
    completion,
    statusCounts,
    totalApplications: applications.length,
    recentActivity,
    featuredJobs,
    unreadNotifications,
  };
}

// ---------------------------------------------------------------------------
// Notifications (powers the nav bell — SRS M11)
// ---------------------------------------------------------------------------

/** Recent notifications + unread count for the nav bell. */
export async function getNotificationFeed(
  userId: string,
  limit = 8,
): Promise<NotificationFeed> {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

/** Mark every unread notification for a user as read. Returns the count cleared. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return count;
}

/** Labels for the activity timeline (re-exported for convenience). */
export { APPLICATION_STATUS_LABELS };
