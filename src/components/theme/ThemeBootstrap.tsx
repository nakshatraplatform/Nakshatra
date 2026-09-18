"use client";

import { useServerInsertedHTML } from "next/navigation";
import { APP_THEME_INIT_SCRIPT } from "@/lib/app-theme";

export function ThemeBootstrap() {
  useServerInsertedHTML(() => (
    <script
      id="nakshatra-app-theme"
      dangerouslySetInnerHTML={{ __html: APP_THEME_INIT_SCRIPT }}
    />
  ));

  return null;
}
