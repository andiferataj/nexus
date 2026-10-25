"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationFeed({
  organizationId,
  initialUnread,
  initialSignature,
}: {
  organizationId: string;
  initialUnread: number;
  initialSignature: string;
}) {
  const router = useRouter(),
    [unread, setUnread] = useState(initialUnread),
    signature = useRef(initialSignature);
  useEffect(() => {
    setUnread(initialUnread);
    signature.current = initialSignature;
  }, [initialUnread, initialSignature, organizationId]);
  useEffect(() => {
    const connection = new EventSource(
      `/api/workspaces/${organizationId}/events`,
    );
    connection.addEventListener("notifications", (event) => {
      try {
        const data: unknown = JSON.parse((event as MessageEvent<string>).data);
        if (!data || typeof data !== "object") return;
        const value = data as Record<string, unknown>;
        if (
          typeof value.unread !== "number" ||
          typeof value.signature !== "string"
        )
          return;
        setUnread(value.unread);
        if (signature.current !== value.signature) {
          signature.current = value.signature;
          router.refresh();
        }
      } catch {}
    });
    return () => connection.close();
  }, [organizationId, router]);
  return (
    <span className="live-notification-count" aria-live="polite">
      {unread ? `${unread} unread` : "All caught up"}
    </span>
  );
}
