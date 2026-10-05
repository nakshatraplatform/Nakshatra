import { redirect } from "next/navigation";

/** Old private-pilot links remain safe bookmarks after open signup. */
export default function InvitationPage() {
  redirect("/signup");
}
