import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryFile = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

describe("VivIntro authentication email branding", () => {
  it("uses the VivIntro name in authentication email subjects", () => {
    const config = repositoryFile("supabase/config.toml");
    const configuredTemplates = config.slice(config.indexOf("[auth.email.template.confirmation]"));

    expect(configuredTemplates.match(/subject = "Your VivIntro verification code"/g)).toHaveLength(2);
    expect(configuredTemplates).not.toMatch(/Nakshatra verification code/i);
  });

  it.each(["confirmation", "magic_link"])("uses the accessible VivIntro lockup in the %s template", (template) => {
    const html = repositoryFile(`supabase/templates/${template}.html`);

    expect(html).toContain('{{ .SiteURL }}/brand/vivintro/vivintro-lockup-stacked-email.png');
    expect(html).toContain('alt="VivIntro"');
    expect(html).toContain("{{ .Token }}");
    expect(html).not.toMatch(/NAKSHATRA/i);
  });
});
