"use client";

import { useEffect, useState } from "react";
import { relationshipQueueSchema, type RelationshipQueue } from "../relationship-queue.contract";

/** Key each response to its filters and cancel stale pages, including late responses after closing. */
export function useRelationshipQueue(stage: string | null, page: number, search: string, filter: string, revision: number) {
  const [result, setResult] = useState<{ key: string; data?: RelationshipQueue; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const url = `/api/relationships?${new URLSearchParams({ stage: stage || "", offset: String((page - 1) * 8), search, filter })}`;
  const key = `${url}:${revision}:${retry}`;
  useEffect(() => {
    if (!stage) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
        const parsed = relationshipQueueSchema.safeParse(await response.json());
        if (!response.ok || !parsed.success) throw new Error("Queue unavailable");
        if (!controller.signal.aborted) setResult({ key, data: parsed.data });
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ key, error: "We could not load this queue. Please retry." });
      });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [stage, url, key, search]);
  return {
    loading: Boolean(stage) && result?.key !== key,
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    retry: () => setRetry(value => value + 1),
  };
}
