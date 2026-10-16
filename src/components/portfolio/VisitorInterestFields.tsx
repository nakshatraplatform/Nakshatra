"use client";

import { useState } from "react";
import { PhoneNumberField } from "./PhoneNumberField";
import { InterestField } from "./InterestField";
import type { NewViewerInterestInput } from "@/features/interest/server/interest.contract";
import type { LocationValue } from "./LocationFields";
import { StructuredInterestLocation, interestLocationError, locationValue } from "./StructuredInterestLocation";

export function VisitorInterestFields({ draft, sessionEmail, errors, portfolioToken }: { draft: Partial<NewViewerInterestInput> | null; sessionEmail: string | null; errors: Record<string, string>; portfolioToken: string }) {
  const [profileFor, setProfileFor] = useState(draft?.profileFor || "");
  const [phone, setPhone] = useState(draft?.phone || "");
  const [candidatePhone, setCandidatePhone] = useState(draft?.candidate?.phone || "");
  const [location, setLocation] = useState<LocationValue>(() => locationValue(draft?.location));
  const initialCandidateLocation = draft?.candidate?.location;
  const [candidateLocation, setCandidateLocation] = useState<LocationValue>(() => locationValue(initialCandidateLocation && "country" in initialCandidateLocation ? initialCandidateLocation : undefined));
  const [includeCandidateLocation, setIncludeCandidateLocation] = useState(Boolean(initialCandidateLocation));
  return <>
    <fieldset className="interest-form-section">
      <legend>About you</legend>
      <p>Tell the family who is getting in touch. We confirm your email before sending.</p>
      <div className="interest-field-grid">
        <InterestField label="Full name *" error={errors.name}>{attributes => <input {...attributes} aria-label="Full name" name="name" autoComplete="name" placeholder="Full name" defaultValue={draft?.name || ""} required minLength={2} maxLength={180} />}</InterestField>
        <InterestField label="Who are you contacting for? *" error={errors.profileFor}>{attributes => <select {...attributes} name="profileFor" aria-label="Who are you contacting for?" required value={profileFor} onChange={event => setProfileFor(event.target.value as typeof profileFor)}><option value="">Choose one</option><option value="self">Myself</option><option value="son">My son</option><option value="daughter">My daughter</option><option value="sibling">My sibling</option><option value="relative">A relative</option></select>}</InterestField>
        <PhoneNumberField name="phone" value={phone} onChange={setPhone} required error={errors.phone} showPartLabels={false} />
        <InterestField label="Email address *" error={errors.email}>{attributes => <><input {...attributes} aria-label="Email address" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" spellCheck={false} required defaultValue={sessionEmail || draft?.email || ""} readOnly={Boolean(sessionEmail)} maxLength={180} />{sessionEmail && <small>Verified email</small>}</>}</InterestField>
      </div>
      <h3>Your current location <span className="interest-required-label">Required</span></h3>
      <StructuredInterestLocation label="Your location" value={location} onChange={changes => setLocation(current => ({ ...current, ...changes }))} portfolioToken={portfolioToken} error={interestLocationError(errors)} />
    </fieldset>
    <fieldset hidden={!profileFor || profileFor === "self"} className="interest-form-section interest-candidate-section">
      <legend>Candidate details</legend>
      <p>The person you are introducing. Only their name is required. Share other details only with their permission.</p>
      <div className="interest-field-grid">
        <InterestField label="Candidate’s full name *" error={errors["candidate.name"] || errors.candidate}>{attributes => <input {...attributes} aria-label="Candidate’s full name" name="candidateName" autoComplete="off" placeholder="Candidate’s full name…" required minLength={2} maxLength={180} defaultValue={draft?.candidate?.name || ""} />}</InterestField>
        <InterestField label="Candidate’s email (optional)" error={errors["candidate.email"]}>{attributes => <input {...attributes} aria-label="Candidate’s email" name="candidateEmail" type="email" inputMode="email" autoComplete="off" placeholder="candidate@example.com" spellCheck={false} maxLength={180} defaultValue={draft?.candidate?.email || ""} />}</InterestField>
        <PhoneNumberField name="candidatePhone" label="Candidate’s phone (optional)" value={candidatePhone} onChange={setCandidatePhone} error={errors["candidate.phone"]} showPartLabels={false} />
      </div>
      {includeCandidateLocation ? <div className="interest-optional-location">
        <div className="interest-form-intro"><h3>Candidate’s location <span className="interest-required-label">Optional</span></h3><button type="button" className="interest-secondary-action" onClick={() => { setIncludeCandidateLocation(false); setCandidateLocation({}); }}>Remove location</button></div>
        <StructuredInterestLocation prefix="candidate" label="Candidate’s location" value={candidateLocation} onChange={changes => setCandidateLocation(current => ({ ...current, ...changes }))} portfolioToken={portfolioToken} error={Object.entries(errors).find(([key]) => key.startsWith("candidate.location"))?.[1]} />
      </div> : <button type="button" className="interest-secondary-action" onClick={() => setIncludeCandidateLocation(true)}>Add candidate location (optional)</button>}
    </fieldset>
    <InterestContextFields draft={draft} errors={errors} />
  </>;
}

export function InterestContextFields({ draft, errors }: { draft?: { familyContext?: string; message?: string } | null; errors: Record<string, string> }) {
  const [messageOpen, setMessageOpen] = useState(Boolean(draft?.message));
  return <fieldset className="interest-form-section">
    <legend>Introduce yourself</legend>
    <InterestField label="Family context *" error={errors.familyContext}>{attributes => <><textarea {...attributes} aria-label="Family context" name="familyContext" required minLength={40} maxLength={600} rows={3} defaultValue={draft?.familyContext || ""} placeholder="Tell the family about your background and what matters to you…" /><small>40–600 characters</small></>}</InterestField>
    <details className="interest-sharing-info" open={messageOpen || Boolean(errors.message)} onToggle={event => setMessageOpen(event.currentTarget.open)}><summary>Add a message (optional)</summary>
      <InterestField label="Message (optional)" error={errors.message}>{attributes => <><textarea {...attributes} aria-label="Message" name="message" maxLength={600} rows={3} defaultValue={draft?.message || ""} placeholder="Anything else you would like to share…" /><small>Leave blank, or write 80–600 characters.</small></>}</InterestField>
    </details>
  </fieldset>;
}
