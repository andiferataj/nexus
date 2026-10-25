import type {
  Organization,
  OrganizationMembership,
  OrganizationRole,
} from "@nexus/shared";

export interface AccountUser {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  sessionVersion: number;
  emailVerified: Date | null;
}

export interface Invitation {
  id: string;
  organizationId: string;
  invitedById: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export interface OrganizationAccess {
  organization: Organization;
  membership: OrganizationMembership;
}

export interface WorkspaceMember {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: OrganizationRole;
  createdAt: Date;
}

export interface RepositoryTransaction {
  findUserById(id: string): Promise<AccountUser | null>;
  findUserByEmail(email: string): Promise<AccountUser | null>;
  insertUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<AccountUser>;
  findOrganizationById(id: string): Promise<Organization | null>;
  findOrganizationBySlug(slug: string): Promise<Organization | null>;
  insertOrganization(data: {
    name: string;
    slug: string;
  }): Promise<Organization>;
  findMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null>;
  listOrganizations(userId: string): Promise<OrganizationAccess[]>;
  listMembers(organizationId: string): Promise<WorkspaceMember[]>;
  insertMembership(data: {
    userId: string;
    organizationId: string;
    role: OrganizationRole;
  }): Promise<OrganizationMembership>;
  replaceInvitation(
    data: Omit<Invitation, "id" | "acceptedAt">,
  ): Promise<Invitation>;
  findInvitationByHash(tokenHash: string): Promise<Invitation | null>;
  consumeInvitation(id: string, userId: string, now: Date): Promise<boolean>;
  consumeAuthAttempt(
    key: string,
    now: Date,
    windowMs: number,
    limit: number,
  ): Promise<boolean>;
  clearAuthAttempts(key: string): Promise<void>;
  replaceResetToken(
    identifier: string,
    token: string,
    expires: Date,
  ): Promise<void>;
  findResetToken(
    token: string,
  ): Promise<{ identifier: string; token: string; expires: Date } | null>;
  consumeResetToken(token: string, now: Date): Promise<boolean>;
  changePassword(userId: string, passwordHash: string): Promise<void>;
  verifyEmail(userId: string, now: Date): Promise<void>;
}

export interface Repository {
  transaction<T>(
    operation: (transaction: RepositoryTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface Actor {
  userId: string | null;
}
