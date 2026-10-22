// Fictional, deliberately bounded Broker Standard-like fixtures. No protected data.
export const customers = [
  {
    ref: "bcr_6GvT8p",
    name: "Aditi Rao",
    age: 29,
    height: "165 cm",
    profession: "Product designer",
    location: "Pune, Maharashtra",
    region: "Maharashtra",
    education: "B.Des · Communication design",
    gotra: "Kashyap",
    manglik: "Manglik",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Deshastha",
    marital: "Never married",
    visa: "Lives in India",
    readiness: "ready",
    assigned: ["Maya", "Neha"],
    version: 4,
    initial: "AR",
    tone: "sage",
    about:
      "I enjoy thoughtful conversations, weekend hikes and time with family. I value kindness, curiosity and a balanced life.",
    family:
      "A close-knit family based in Pune. Both parents are retired; one sibling works in education.",
    preferences:
      "Age 28–34 · Vegetarian · Open to Maharashtra and relocating within India.",
    mandate: "30 Nov 2026",
    consentVersion: "V3",
    familyViewers: [
      {
        name: "Meena Rao",
        relationship: "Mother",
        status: "active",
        primary: true,
      },
      {
        name: "Suresh Rao",
        relationship: "Father",
        status: "awaiting-google",
        primary: false,
      },
    ],
  },
  {
    ref: "bcr_K9wR2x",
    name: "Rohan Iyer",
    age: 31,
    height: "181 cm",
    profession: "Architect",
    location: "Mumbai, Maharashtra",
    region: "Maharashtra",
    education: "B.Arch · Architecture",
    gotra: "Vashishtha",
    manglik: "Manglik",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Konkanastha",
    marital: "Never married",
    visa: "Open to relocating",
    readiness: "ready",
    assigned: ["Maya", "Vikram"],
    version: 2,
    initial: "RI",
    tone: "sand",
    about:
      "Architecture, music and long walks are a big part of my life. Looking for a partnership built on respect and everyday companionship.",
    family:
      "Family based in Mumbai, with roots in coastal Maharashtra. One younger sibling.",
    preferences: "Age 27–32 · Vegetarian · Open to Pune or Mumbai.",
    mandate: "25 Nov 2026",
    consentVersion: "V3",
    familyViewers: [
      {
        name: "Lakshmi Iyer",
        relationship: "Mother",
        status: "active",
        primary: true,
      },
      {
        name: "Prakash Iyer",
        relationship: "Father",
        status: "active",
        primary: false,
      },
    ],
  },
  {
    ref: "bcr_h2P7mQ",
    name: "Dev Kulkarni",
    age: 30,
    height: "177 cm",
    profession: "Software engineer",
    location: "Pune, Maharashtra",
    region: "Maharashtra",
    education: "B.E · Computer engineering",
    gotra: "Bharadwaj",
    manglik: "Not provided",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Deshastha",
    marital: "Never married",
    visa: "Lives in India",
    readiness: "ready",
    assigned: ["Maya"],
    version: 3,
    initial: "DK",
    tone: "structure",
    about: "I enjoy books, cooking and exploring new places with friends.",
    family: "Family presentation is available in the published portfolio.",
    preferences: "Age 26–31 · Open to Maharashtra.",
    mandate: "18 Nov 2026",
    consentVersion: "V3",
    familyViewers: [],
  },
  {
    ref: "bcr_Q4bL8s",
    name: "Arjun Rao",
    age: 32,
    height: "179 cm",
    profession: "Operations manager",
    location: "Bengaluru, Karnataka",
    region: "Karnataka",
    education: "MBA · Operations",
    gotra: "Kashyap",
    manglik: "Not Manglik",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Deshastha",
    marital: "Never married",
    visa: "Lives in India",
    readiness: "ready",
    assigned: ["Maya"],
    version: 2,
    initial: "AR",
    tone: "rose",
    about: "I enjoy travel and a quiet weekend with family.",
    family: "Family lives in Bengaluru.",
    preferences: "Age 27–32 · Open to relocating.",
    mandate: "29 Nov 2026",
    consentVersion: "V3",
    familyViewers: [
      {
        name: "Nandini Rao",
        relationship: "Mother",
        status: "proposed",
        primary: false,
      },
    ],
  },
  {
    ref: "bcr_M3jD9k",
    name: "Meera Shah",
    age: 28,
    height: "162 cm",
    profession: "Chartered accountant",
    location: "Ahmedabad, Gujarat",
    region: "Gujarat",
    education: "Chartered accountancy",
    gotra: "Not provided",
    manglik: "Not Manglik",
    diet: "Vegetarian",
    community: "Jain",
    subCaste: "Not provided",
    marital: "Never married",
    visa: "Lives in India",
    readiness: "paused",
    assigned: ["Neha"],
    version: 2,
    initial: "MS",
    tone: "rose",
    about: "Portfolio access is paused.",
    family: "Unavailable while representation is paused.",
    preferences: "Unavailable while representation is paused.",
    mandate: "Paused by customer",
    consentVersion: "V2",
    familyViewers: [],
  },
  {
    ref: "bcr_F5tN1a",
    name: "Nikhil Joshi",
    age: 33,
    height: "176 cm",
    profession: "Research scientist",
    location: "Pune, Maharashtra",
    region: "Maharashtra",
    education: "M.Sc · Biotechnology",
    gotra: "Atri",
    manglik: "Manglik",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Deshastha",
    marital: "Never married",
    visa: "Lives in India",
    readiness: "ready",
    assigned: ["Maya", "Vikram"],
    version: 1,
    initial: "NJ",
    tone: "sage",
    about: "I enjoy science, hiking and spending time with family.",
    family: "Family based in Pune.",
    preferences: "Age 27–32 · Vegetarian.",
    mandate: "20 Dec 2026",
    consentVersion: "V3",
    familyViewers: [
      {
        name: "Anjali Joshi",
        relationship: "Mother",
        status: "active",
        primary: true,
      },
    ],
  },
  {
    ref: "bcr_a8U2vC",
    name: "Karan Patel",
    age: 30,
    height: "183 cm",
    profession: "Urban planner",
    location: "Austin, Texas, USA",
    region: "Texas",
    education: "M.Plan · Urban planning",
    gotra: "Gautam",
    manglik: "Manglik",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Not provided",
    marital: "Never married",
    visa: "US work visa",
    readiness: "ready",
    assigned: ["Vikram"],
    version: 3,
    initial: "KP",
    tone: "sand",
    about: "I enjoy city walks, cooking and live music.",
    family: "Parents live in India; a sibling lives in the USA.",
    preferences: "Age 26–31 · Open to the USA.",
    mandate: "14 Dec 2026",
    consentVersion: "V3",
    familyViewers: [],
  },
  {
    ref: "bcr_J7cW3r",
    name: "Tara Desai",
    age: 27,
    height: "168 cm",
    profession: "Teacher",
    location: "Vadodara, Gujarat",
    region: "Gujarat",
    education: "M.Ed · Education",
    gotra: "Bharadwaj",
    manglik: "Manglik",
    diet: "Vegetarian",
    community: "Brahmin",
    subCaste: "Not provided",
    marital: "Never married",
    visa: "Open to relocating",
    readiness: "invited",
    assigned: ["Neha"],
    version: 1,
    initial: "TD",
    tone: "structure",
    about: "Customer invitation is awaiting acceptance.",
    family: "Available after consent and publication.",
    preferences: "Available after consent and publication.",
    mandate: "Invitation expires 20 Oct",
    consentVersion: "Pending",
    familyViewers: [],
  },
];

export const sampleIntroductions = [
  {
    ref: "bir_N8pH4x",
    a: customers[0].ref,
    b: customers[5].ref,
    state: "shared",
    shareStates: {
      a: { state: "confirmed", at: "3 Oct, 10:20 AM" },
      b: { state: "initiated", at: "3 Oct, 10:24 AM" },
    },
    familyUpdates: {
      a: null,
      b: {
        status: "family-interested",
        source: "Mother",
        channel: "WhatsApp",
        at: "4 Oct, 6:10 PM",
      },
    },
    responses: { a: "waiting", b: "interested" },
    versions: { a: 3, b: 1 },
    reviewed: false,
    deadline: "18 Oct 2026",
    completeUntil: null,
    created: "3 Oct",
    creator: "Maya",
  },
  {
    ref: "bir_R5dV9q",
    a: customers[1].ref,
    b: customers[6].ref,
    state: "mutual",
    shareStates: {
      a: { state: "confirmed", at: "5 Oct, 11:12 AM" },
      b: { state: "confirmed", at: "5 Oct, 11:18 AM" },
    },
    familyUpdates: { a: null, b: null },
    frozenFamilyViewers: { a: 2, b: 0 },
    responses: { a: "interested", b: "interested" },
    versions: { a: 2, b: 3 },
    reviewed: true,
    deadline: "20 Oct 2026",
    completeUntil: "9 Nov 2026",
    created: "5 Oct",
    creator: "Vikram",
  },
  {
    ref: "bir_F1sK7z",
    a: customers[2].ref,
    b: customers[3].ref,
    state: "declined",
    shareStates: {
      a: { state: "confirmed", at: "27 Sep, 2:15 PM" },
      b: { state: "confirmed", at: "27 Sep, 2:21 PM" },
    },
    familyUpdates: {
      a: {
        status: "family-declined",
        source: "Father",
        channel: "Phone call",
        at: "29 Sep, 8:05 PM",
      },
      b: null,
    },
    responses: { a: "declined", b: "waiting" },
    versions: { a: 3, b: 2 },
    reviewed: true,
    responseOpen: false,
    deadline: "12 Oct 2026",
    completeUntil: null,
    created: "27 Sep",
    creator: "Maya",
  },
];

export function customerByRef(ref) {
  return customers.find((customer) => customer.ref === ref) || customers[0];
}
export function isAssigned(customer, role) {
  return role === "Admin" || customer.assigned.includes("Maya");
}
export function canCreate(role) {
  return role === "Admin" || role === "Advisor";
}

// Draft policy fixtures for design review only. Production must return authoritative checks.
export function pairAssessment(a, b, introductions) {
  if (a.readiness !== "ready" || b.readiness !== "ready")
    return {
      state: "blocked",
      reason:
        "An active mandate and published portfolio are needed for both customers.",
    };
  if (
    introductions.some(
      (intro) =>
        (["created", "shared", "mutual"].includes(intro.state) ||
          (intro.state === "declined" && intro.responseOpen !== false)) &&
        [intro.a, intro.b].includes(a.ref) &&
        [intro.a, intro.b].includes(b.ref),
    )
  )
    return {
      state: "blocked",
      reason: "This pair already has an active Introduction in your agency.",
    };
  if (a.gotra !== "Not provided" && a.gotra === b.gotra)
    return {
      state: "ready",
      reason:
        "Astrology note: both profiles list the same gotra. This is advisory only; review it with the families before deciding.",
    };
  if ([a.manglik, b.manglik, a.gotra, b.gotra].includes("Not provided"))
    return {
      state: "ready",
      reason:
        "Astrology note: one or more details are not provided. This does not block the broker from using professional judgment.",
    };
  if (a.manglik !== b.manglik)
    return {
      state: "ready",
      reason:
        "Astrology note: the listed Manglik statuses differ. This is advisory only and is not an approved system rule.",
    };
  return {
    state: "ready",
    reason:
      "Both customers are ready. Review their preferences before making the Introduction.",
  };
}

export const team = [
  { name: "Maya Kapoor", short: "Maya", role: "Advisor", initial: "MK" },
  { name: "Neha Shah", short: "Neha", role: "Coordinator", initial: "NS" },
  { name: "Vikram Mehta", short: "Vikram", role: "Advisor", initial: "VM" },
  { name: "Ananya Rao", short: "Ananya", role: "Owner", initial: "AR" },
];
