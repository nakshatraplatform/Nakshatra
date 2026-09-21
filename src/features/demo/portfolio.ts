import type { PortfolioData } from "@/types/portfolio";

export const demoPortfolio: PortfolioData = {
  privacy_mode: "balanced",
  personal: { name: "Ananya Mehta", first_name: "Ananya", last_name: "Mehta", dob: "1995-04-18", place_of_birth: "Pune", current_location: "Bengaluru, Karnataka", gender: "female", marital_status: "Never married", citizenship: "India", religion: "Hindu", community: "Gujarati", short_bio: "Thoughtful, optimistic, and happiest around family, books, and the outdoors.", profile_summary: "I value warm relationships, curiosity, and building a grounded life with room for both families and individual ambitions.", shared_life_plans: "I hope to build a warm home, travel thoughtfully, and support each other’s goals.", relocation_preference: "Open to discussing together" },
  vitals: { height: "5 ft 5 in", gotra: "Kashyap" },
  education: { qualification_level: "Master's degree", degree: "MS in Data Science", institution: "Example University" },
  career: { title: "Product designer", company: "Example Company", location: "Bengaluru" },
  lifestyle: { hobbies: "Hiking, reading, cooking", languages: "English, Hindi, Gujarati", diet: "Vegetarian", drinking: "Socially", smoking: "Never", values_statement: "Kindness, growth, family" },
  family: { public_summary: "A close-knit family that values education, warmth, and mutual respect.", father: { name: "Fictional Father", occupation: "Engineer" }, mother: { name: "Fictional Mother", occupation: "Teacher" }, paternal_origin: "Ahmedabad", maternal_origin: "Vadodara", sibling_count: 1, sibling_position: "Older" },
  astrology: { rashi: "mesha", nakshatra: "Ashwini", time_of_birth: "10:30", maternal_gotra: "Bharadwaj" },
  preferences: { narrative: "A kind, emotionally mature partner who communicates openly and respects both families.", age_range: "29–35", marriage_timeline: "Within 1–2 years", children_preference: "Open to children", living_arrangement: "Discuss and decide together", family_responsibilities: "Shared as a couple" },
  contact: { contacts: [{ relationship: "Mother", name: "Fictional Mother", phone: "+91 90000 00000", email: "family@example.test" }] },
  style: { appearance: "light", template_name: "VivIntro Portfolio" },
};
