import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { LoadingStatus } from "./LoadingStatus";
import styles from "./LoadingStatus.module.css";

/** Streams a useful shell while server data is pending, without hiding ready content. */
export function PageLoading({ title = "Opening VivIntro", detail = "Getting this page ready. Please wait." }: { title?: string; detail?: string }) {
  return <main id="main-content" className={styles.page}>
    <VivIntroBrand variant="stacked" displayWidth={168} priority />
    <LoadingStatus title={title} detail={detail} state="connecting" />
  </main>;
}
