"use client";

import { useEffect, useRef, type RefObject } from "react";
import { activateModalLifecycle } from "@/lib/ui/modal-lifecycle";

/** React ownership of the same modal lifecycle used by account and public dialogs. */
export function useModalFocus(open: boolean, dialogRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog) return activateModalLifecycle(dialog, () => dismissRef.current());
  }, [open, dialogRef]);
}
