import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";

import {
  SettingsFoot,
  SettingsRow,
  SettingsSection,
} from "#registry/legion/blocks/settings-section";
import { Heading } from "#registry/legion/ui/heading";
import { Input } from "#registry/legion/ui/input";
import { Switch } from "#registry/legion/ui/switch";

describe("SettingsSection", () => {
  it("is a region named by its h2, at the anchor its id gives, in the order of its parts", () => {
    render(
      <SettingsSection description="Who can sign in." id="signins" title="Sign-ins">
        <p>Body</p>
      </SettingsSection>
    );
    const region = screen.getByRole("region", { name: "Sign-ins" });
    expect(region.id).toBe("signins");
    expect(screen.getByRole("heading", { level: 2 }).className).toContain("text-base");
    expect(region.textContent).toBe("Sign-insWho can sign in.Body");
  });

  it("draws its controls after the title column, and nothing for empty slots", () => {
    const { container, rerender } = render(
      <SettingsSection end={<button type="button">Refresh</button>} id="tokens" title="Tokens">
        <p>Body</p>
      </SettingsSection>
    );
    const header = container.querySelector("section")?.firstElementChild;
    expect(header?.firstElementChild?.contains(screen.getByRole("heading"))).toBe(true);
    expect(header?.lastElementChild?.contains(screen.getByRole("button"))).toBe(true);
    expect(header?.children).toHaveLength(2);
    rerender(
      <SettingsSection description={false} end={false} id="tokens" title="Tokens">
        <p>Body</p>
      </SettingsSection>
    );
    expect(header?.children).toHaveLength(1);
    expect(header?.firstElementChild?.children).toHaveLength(1);
  });

  it("holds a folded explanation in its description", () => {
    render(
      <SettingsSection
        description={
          <details>
            <summary>How logins work</summary>
            <p>A login lasts until it expires.</p>
          </details>
        }
        id="logins"
        title="Logins"
      >
        <p>Body</p>
      </SettingsSection>
    );
    expect(screen.getByRole("group").parentElement?.tagName).toBe("DIV");
  });

  it("ranks the body's headings under its own", () => {
    render(
      <SettingsSection id="legion" title="Legion">
        <Heading size="group">Daemons</Heading>
      </SettingsSection>
    );
    expect(screen.getByRole("heading", { name: "Daemons" }).tagName).toBe("H3");
  });

  it("gives its ref the section", () => {
    const ref = createRef<HTMLElement>();
    render(
      <SettingsSection id="logins" ref={ref} title="Logins">
        <p>Body</p>
      </SettingsSection>
    );
    expect(ref.current).toBe(screen.getByRole("region"));
  });

  it("draws a 1 px line 16 px from each side above a section after a section, none after other content", async () => {
    render(
      <main>
        <form aria-label="Approve" />
        <SettingsSection id="one" title="One">
          <p>Body</p>
        </SettingsSection>
        <SettingsSection id="two" title="Two">
          <p>Body</p>
        </SettingsSection>
      </main>
    );
    const two = screen.getByRole("region", { name: "Two" });
    // happy-dom resolves no theme variable, so the utilities alone show which section has the line.
    const tailwind = await compile('@import "tailwindcss/utilities";', {
      base: join(import.meta.dirname, "../styles"),
      from: join(import.meta.dirname, "../styles/globals.css"),
      onDependency: () => {},
    });
    const style = document.createElement("style");
    style.textContent = tailwind.build(two.className.split(" "));
    document.head.append(style);
    try {
      const line = (name: string) =>
        getComputedStyle(screen.getByRole("region", { name })).borderTopWidth;
      expect(line("One")).not.toBe("1px");
      expect(line("Two")).toBe("1px");
      expect(two.className).toContain("[[data-slot=settings-section]+&]:mt-4");
      expect(two.className).toContain("[[data-slot=settings-section]+&]:pt-4");
    } finally {
      style.remove();
    }
  });
});

describe("SettingsFoot", () => {
  it("is the last row of a form in a section: the form's submit button, then its muted note", () => {
    render(
      <SettingsSection id="delivery" title="Delivery">
        <form aria-label="Delivery settings">
          <SettingsFoot note="A save reads each source again.">
            <button type="submit">Save</button>
          </SettingsFoot>
        </form>
      </SettingsSection>
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save.closest("form")).toBe(screen.getByRole<HTMLFormElement>("form"));
    const foot = save.parentElement;
    expect(foot?.textContent).toBe("SaveA save reads each source again.");
    expect(foot?.lastElementChild?.className).toContain("text-muted-foreground");
  });

  it("draws the action alone without a note", () => {
    render(
      <SettingsFoot>
        <button type="submit">Save</button>
      </SettingsFoot>
    );
    expect(screen.getByRole("button").parentElement?.children).toHaveLength(1);
  });
});

describe("SettingsRow", () => {
  it("names its control by the label and describes it by the description and the error", () => {
    render(
      <SettingsRow
        description="As owner/name."
        error="The repository does not exist."
        id="repo"
        label="Deploy repository"
      >
        {(control) => <Input {...control} />}
      </SettingsRow>
    );
    const input = screen.getByRole("textbox", {
      name: "Deploy repository",
      description: "As owner/name. The repository does not exist.",
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("puts a new error in the alert region that was there before it", () => {
    const row = (error?: string) => (
      <SettingsRow error={error} id="name" label="Name">
        {(control) => <Input {...control} />}
      </SettingsRow>
    );
    const { rerender } = render(row());
    const region = screen.getByRole("alert");
    expect(region.textContent).toBe("");
    rerender(row("Dispatch refused the name."));
    expect(screen.getByRole("alert")).toBe(region);
    expect(region.textContent).toBe("Dispatch refused the name.");
  });

  it("describes a switch by the description alone when there is no error", () => {
    render(
      <SettingsRow description="Kept in this browser." id="preview" label="New page">
        {(control) => <Switch {...control} />}
      </SettingsRow>
    );
    const toggle = screen.getByRole("switch", {
      name: "New page",
      description: "Kept in this browser.",
    });
    expect(toggle.hasAttribute("aria-invalid")).toBe(false);
  });

  it("gives a bare control no description", () => {
    render(
      <SettingsRow id="workflow" label="Deploy workflow">
        {(control) => <Input {...control} />}
      </SettingsRow>
    );
    expect(
      screen.getByRole("textbox", { name: "Deploy workflow" }).hasAttribute("aria-describedby")
    ).toBe(false);
  });

  it("puts the control at the right from the small breakpoint, under the label before it", () => {
    const { container } = render(
      <SettingsRow id="repo" label="Deploy repository">
        {(control) => <Input {...control} />}
      </SettingsRow>
    );
    const row = container.querySelector("[data-slot=settings-row]");
    expect(row?.className).toContain("flex-col");
    expect(row?.className).toContain("sm:flex-row");
    expect(screen.getByRole("textbox").parentElement?.className).toContain("sm:justify-end");
  });
});
