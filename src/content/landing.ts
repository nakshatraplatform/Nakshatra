/** Public copy only. VivIntro is the product; Vivara is its shareable link. */
export const landingTitle = "Marriage biodata as a link | VivIntro";
export const landingDescription = "Create your marriage biodata with VivIntro. Share it through your Vivara link, publish updates without resending files, and choose who sees your private details.";
export const landingConcepts = {
  clarity: { headline: "Your marriage biodata, shared through one link.", lead: "Create your introduction with VivIntro. Vivara is the link you share. Save changes privately, then publish them at the same link. You decide who sees private details." },
  control: { headline: "Share your biodata. Choose when to share more.", lead: "Create your introduction with VivIntro. Share your Vivara link, then review requests for private details in your dashboard." },
  story: { headline: "Introduce yourself the way you want to be known.", lead: "Bring your story, family and photos together with VivIntro. Share your Vivara link and decide when to share more." },
} as const;
export type LandingVariant = keyof typeof landingConcepts;

export const allFaqs = [
  { question: "What is a Vivara?", answer: "Vivara is the link you share to your marriage introduction on VivIntro. Anyone with an active link can read the public introduction. You decide who sees private details." },
  { question: "Does someone need an account to open my Vivara link?", answer: "No. Anyone with the active link can read the public introduction without signing in. When someone selects Show interest, they sign in and confirm their email before their request reaches you. They do not need an introduction of their own. Email confirmation alone does not grant access or prove identity." },
  { question: "Do saved edits change the introduction I have shared?", answer: "Not until you publish the update. Saving keeps edits in your private draft. Publishing updates the introduction at your existing Vivara link, so you do not need to resend a file." },
  { question: "Can my link be forwarded?", answer: "Yes. Anyone with the active link can read the public view, and anything visible can be saved or screenshotted. Forwarding the link does not transfer access to private details. Replacing your link stops the old one from opening; it cannot erase saved copies." },
  { question: "What happens after I share details?", answer: "They can view your private details for up to 15 days. You can stop sharing early or renew it. Unpublishing pauses viewing; a sharing period that has not ended or been stopped can resume when you publish again. Stopping sharing or replacing the link ends that sharing. Copies already saved cannot be recalled." },
  { question: "What does “Liveness checked” mean?", answer: "Standard publication requires a live camera check through Didit. The badge means a live person passed that check. It does not verify legal identity, compare photos, or confirm the details in an introduction. VivIntro records consent and normalized results, not the live camera capture. Provider processing and cleanup are explained in the Privacy Policy. Test publications without this check have no badge." },
  { question: "Is this a matchmaking site?", answer: "No. VivIntro has no profile directory or match suggestions. You choose who gets your Vivara link." },
  { question: "Can a parent or sibling create my introduction?", answer: "For now, create and publish your own introduction. Parents and siblings can help prepare the details and share your Vivara link. Creating and managing an introduction on someone else’s behalf is not currently offered." },
  { question: "How is a Vivara link different from a PDF?", answer: "You publish updates at the same link instead of sending new files. Private details stay separate until you choose to share them. You can end access in VivIntro, but copies someone has already saved cannot be erased." },
  { question: "Is it free?", answer: "Yes. Creating and sharing is free. If we add paid options, we will tell you before asking you to pay." },
] as const;
export const landingFaqs = allFaqs.slice(0, 6);
