"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { AnanyaPhone, AnanyaPhoneFrame, ananyaScreens } from "./AnanyaPhone";
import styles from "./ProductStory.module.css";
import landing from "./LandingExperience.module.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function ProductStory() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(min-width: 1000px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)", () => {
      const shots = element.querySelectorAll<HTMLElement>("[data-story-shot]");
      const chapters = element.querySelectorAll<HTMLElement>("[data-story-chapter]");
      element.dataset.storyMotion = "true";
      gsap.set(shots, { autoAlpha: 0 });
      gsap.set(shots[0], { autoAlpha: 1 });
      // A single scrubbed sequence changes the real capture as its explanation
      // passes the phone. CSS sticky owns positioning; native scrolling stays free.
      const timeline = gsap.timeline({ scrollTrigger: {
        trigger: element, start: "top 15%", end: "bottom 85%", scrub: 0.3,
        onUpdate: self => { element.dataset.storyStep = String(Math.min(2, Math.round(self.progress * 2))); },
        onRefresh: self => { element.dataset.storyStep = String(Math.min(2, Math.round(self.progress * 2))); },
      } });
      for (let index = 1; index < shots.length; index++) {
        timeline.to(shots[index - 1], { autoAlpha: 0, y: -20, duration: 0.35 }, index - 0.5)
          .fromTo(shots[index], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35 }, index - 0.5);
      }
      // End holds leave each capture visible for reading rather than requiring
      // the visitor to race through a repeating promotional film.
      timeline.to({}, { duration: 0.5 });
      chapters.forEach(chapter => { chapter.style.scrollMarginTop = "7rem"; });
      return () => {
        delete element.dataset.storyMotion;
        delete element.dataset.storyStep;
        chapters.forEach(chapter => { chapter.style.removeProperty("scroll-margin-top"); });
      };
    });
    return () => media.revert();
  }, { scope: root });

  return <section id="product-story" className={styles.story} ref={root} aria-label="Explore Ananya’s sample introduction">
    <span id="samples" className={styles.anchor} />
    <article className={styles.chapter} data-story-chapter>
      <div className={styles.copy}>
        <h2>Meet Ananya.<br />There’s more to her story.</h2>
        <p>Her work, family, everyday joys and hopes for the future, brought together in one introduction. A prospective partner can get a first sense of the person before a conversation begins.</p>
        <Link href="/demo" className={landing.primaryButton}>Explore Ananya’s introduction <ArrowRight aria-hidden="true" /></Link>
        <p className={styles.disclosure}>Ananya and every detail in the sample are fictional. AI-generated portrait. Private details are not shown.</p>
        <details className={styles.recording}><summary>Watch the sample walkthrough</summary><video controls preload="none" poster={ananyaScreens[0].image.src} aria-label="Recorded walkthrough of Ananya’s fictional public introduction"><source src="/demo/ananya-walkthrough.webm" type="video/webm" /><track kind="captions" src="/demo/ananya-walkthrough.vtt" srcLang="en" label="English" default />Your browser can’t play this recording. <Link href="/demo">Explore the sample introduction instead.</Link></video><p>Silent recording: public view, personal story, then the private-access explanation. No request is submitted.</p></details>
      </div>
      <div className={styles.firstChapterPhone}><AnanyaPhone screen={0} /></div>
    </article>
    <article id="why" className={styles.chapter} data-story-chapter>
      <div className={styles.copy}>
        <h2>Your details travel further than you expect.</h2>
        <p>A PDF can reach families you have never spoken to. Older versions keep circulating after your work, photos or plans change.</p>
        <p>Share your Vivara link once. Save changes privately, then publish them at that same link. The next person who opens it sees your latest published introduction.</p>
        <p className={styles.linkExample}>vivintro.com/p/… <span>One link you can update</span></p>
      </div>
      <AnanyaPhone screen={1} />
    </article>
    <article id="privacy" className={styles.chapter} data-story-chapter>
      <div className={styles.copy}>
        <h2>You decide who sees what.</h2>
        <p>Anyone with your link can read the public introduction. To ask for private details, a viewer signs in and confirms their email. You decide whether to share more.</p>
        <dl className={styles.boundaries}>
          <div><dt>Public introduction</dt><dd>Your published name, age, marital status and the story and photos you choose for the public view.</dd></div>
          <div><dt>Private details</dt><dd>Shared only when you approve, for up to 15 days. Share again or stop sharing early.</dd></div>
          <div><dt>Private notes</dt><dd>Your notes and street address aren’t included in either shared view.</dd></div>
        </dl>
        <p className={styles.disclosure}>Anything someone can see, they can screenshot. Keep phone numbers and other private details out of your public story. Copies already saved can’t be recalled.</p>
      </div>
      <AnanyaPhone screen={2} />
    </article>
    <aside className={styles.stickyPhone} aria-hidden="true">
      <AnanyaPhoneFrame>
        {ananyaScreens.map(capture => <div key={capture.name} className={styles.shot} data-story-shot><Image src={capture.image} alt="" width={1024} height={2048} sizes="340px" /></div>)}
      </AnanyaPhoneFrame>
      <p>Ananya’s fictional introduction · AI-generated portrait</p>
    </aside>
  </section>;
}
