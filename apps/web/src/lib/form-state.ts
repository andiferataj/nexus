export interface FormState {
  shareUrl?: string;
  error: string | null;
  invitationUrl?: string;
  message?: string;
}

export function safeReturnPath(input: unknown): string {
  if (typeof input !== "string") return "/workspaces";
  return /^\/workspaces(?:\/[a-zA-Z0-9_-]+)?$/.test(input) ||
    /^\/invite\?token=[a-f0-9]{64}$/.test(input)
    ? input
    : "/workspaces";
}
