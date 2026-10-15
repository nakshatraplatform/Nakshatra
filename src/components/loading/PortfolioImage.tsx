"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { LoadingStatus } from "./LoadingStatus";
import styles from "./LoadingStatus.module.css";

/** Key by URL at the caller so a new photo owns a fresh load/error lifecycle. */
export function PortfolioImage({ showLoading = true, onLoad, onError, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { showLoading?: boolean }) {
  const image = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    // A cached image may finish before hydration attaches its load handler.
    if (image.current?.complete) setState(image.current.naturalWidth > 0 ? "ready" : "failed");
  }, []);
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element -- signed/private media must use the original authenticated URL */}
    <img {...props} data-editorial-photo="" alt={alt ?? ""} ref={image} onLoad={(event) => { setState("ready"); onLoad?.(event); }}
      onError={(event) => { setState("failed"); onError?.(event); }} />
    {showLoading && state !== "ready" && <div className={styles.photoStatus} style={{ colorScheme: "light" }}>
      {state === "loading" ? <LoadingStatus compact title="Loading photo" appearance="light" />
        : <p role="status">Photo could not load. Try reopening this page.</p>}
    </div>}
  </>;
}
