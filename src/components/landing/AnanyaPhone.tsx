import Image from "next/image";
import type { ReactNode } from "react";
import overview from "../../../public/demo/ananya-overview.png";
import story from "../../../public/demo/ananya-story.png";
import privacy from "../../../public/demo/ananya-privacy.png";
import styles from "./ProductStory.module.css";

export const ananyaScreens = [
  { name: "overview", image: overview, alt: "Ananya’s fictional Vivara with her AI-generated portrait and public story" },
  { name: "story", image: story, alt: "Personal story section from Ananya’s actual sample Vivara" },
  { name: "privacy", image: privacy, alt: "Ananya’s sample Vivara keeps contact and other private details behind an access request" },
] as const;

/** Hardware is outside the capture viewport, so its border cannot crop the UI. */
export function AnanyaPhoneFrame({ children }: { children: ReactNode }) {
  return <div className={styles.phone}><div className={styles.screen}>{children}</div></div>;
}

/** A capture of the real public renderer, not an invented application screen. */
export function AnanyaPhone({ screen = 0, priority = false }: { screen?: number; priority?: boolean }) {
  const capture = ananyaScreens[screen];
  return <figure className={styles.phoneFigure}>
    <AnanyaPhoneFrame>
      <Image src={capture.image} alt={capture.alt} width={1024} height={2048} sizes="(max-width: 600px) 80vw, 340px" priority={priority} />
    </AnanyaPhoneFrame>
    <figcaption>Ananya’s fictional Vivara · AI-generated portrait</figcaption>
  </figure>;
}
