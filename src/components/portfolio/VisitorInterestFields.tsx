"use client";

import { useState } from "react";
import { PhoneNumberField } from "./PhoneNumberField";
import { InterestLocationFields } from "./InterestLocationFields";
import { InterestField } from "./InterestField";
import type { NewViewerInterestInput } from "@/features/interest/server/interest.contract";

export function VisitorInterestFields({ draft, sessionEmail, errors }: { draft: Partial<NewViewerInterestInput> | null; sessionEmail: string | null; errors: Record<string, string> }) {
  const [profileFor, setProfileFor] = useState(draft?.profileFor || "");
  const [phone, setPhone] = useState(draft?.phone || "");
  const [candidatePhone, setCandidatePhone] = useState(draft?.candidate?.phone || "");
  return <>
    <div className="interest-form-intro"><strong>Personal details</strong><span>* Required</span></div>
    <div className="interest-field-grid">
      <InterestField label="Your full name *" error={errors.name}>{attributes => <input {...attributes} aria-label="Your full name" name="name" autoComplete="name" defaultValue={draft?.name || ""} required minLength={2} maxLength={180} />}</InterestField>
      <InterestField label="Contacting for *" error={errors.profileFor}>{attributes => <select {...attributes} name="profileFor" aria-label="Contacting for" required value={profileFor} onChange={event => setProfileFor(event.target.value as typeof profileFor)}><option value="">Choose one</option><option value="self">Myself</option><option value="son">My son</option><option value="daughter">My daughter</option><option value="sibling">My sibling</option><option value="relative">A relative</option></select>}</InterestField>
      <PhoneNumberField name="phone" value={phone} onChange={setPhone} required error={errors.phone} />
      <InterestField label="Your email address *" error={errors.email}>{attributes => <><input {...attributes} aria-label="Email address" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required defaultValue={sessionEmail || draft?.email || ""} readOnly={Boolean(sessionEmail)} maxLength={180} />{sessionEmail && <small>Verified email</small>}</>}</InterestField>
    </div>
    <InterestLocationFields prefix="viewer" label="Your location" initial={draft?.location} errors={errors} />
    {profileFor && profileFor !== "self" && <section className="interest-candidate-section">
      <h3>Candidate details</h3><p>These details describe the person you are introducing. Share only what you have permission to share. Email verification applies to you, not the candidate.</p>
      <div className="interest-field-grid">
        <InterestField label="Candidate’s full name *" error={errors["candidate.name"] || errors.candidate}>{attributes => <input {...attributes} aria-label="Candidate’s full name" name="candidateName" required minLength={2} maxLength={180} defaultValue={draft?.candidate?.name || ""} />}</InterestField>
        <InterestField label="Candidate’s email *" error={errors["candidate.email"]}>{attributes => <input {...attributes} aria-label="Candidate’s email" name="candidateEmail" type="email" spellCheck={false} required maxLength={180} defaultValue={draft?.candidate?.email || ""} />}</InterestField>
        <PhoneNumberField name="candidatePhone" label="Candidate’s phone" value={candidatePhone} onChange={setCandidatePhone} required error={errors["candidate.phone"]} />
        <InterestField label="Your relationship to candidate *" error={errors["candidate.relationship"]}>{attributes => <select {...attributes} aria-label="Your relationship to candidate" name="candidateRelationship" required defaultValue={draft?.candidate?.relationship || ""}><option value="">Choose relationship</option><option>Parent</option><option>Sibling</option><option>Relative</option><option>Guardian</option></select>}</InterestField>
      </div>
      <InterestLocationFields prefix="candidate" label="Candidate’s location" initial={draft?.candidate?.location} errors={errors} />
    </section>}
    <div className="interest-form-intro"><strong>Context &amp; message</strong></div>
    <InterestField label="Family context *" error={errors.familyContext}>{attributes => <><textarea {...attributes} aria-label="Family context" name="familyContext" required minLength={40} maxLength={600} rows={3} defaultValue={draft?.familyContext || ""} placeholder="Tell the family about your background and what matters to you…" /><small>40–600 characters</small></>}</InterestField>
    <InterestField label="Message *" error={errors.message}>{attributes => <><textarea {...attributes} aria-label="Message" name="message" required minLength={80} maxLength={600} rows={4} defaultValue={draft?.message || ""} placeholder="Explain your interest and what you would like the family to know…" /><small>80–600 characters</small></>}</InterestField>
  </>;
}
