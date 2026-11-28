// A control branch's record of a control's fill and the stylesheet rules that match it.
import type { Locator, Page } from "@playwright/test";

/** Logs the control's look at once, after two frames and after 1 s. */
export async function probeFill(page: Page, control: Locator, label: string): Promise<void> {
  for (const when of ["now", "two-frames", "one-second"]) {
    if (when === "two-frames") {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          })
      );
    }
    if (when === "one-second") await page.waitForTimeout(1000);
    const record = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      const rules: {
        order: number;
        sheet: string;
        context: string;
        selector: string;
        text: string;
      }[] = [];
      const pressedRules: string[] = [];
      let order = 0;
      const walk = (
        list: CSSRuleList,
        sheet: string,
        context: string,
        parent: string | undefined
      ) => {
        for (const rule of Array.from(list)) {
          if (rule instanceof CSSStyleRule) {
            const own = rule.selectorText;
            const selector =
              parent === undefined
                ? own
                : own.includes("&")
                  ? own.replaceAll("&", `:is(${parent})`)
                  : `:is(${parent}) ${own}`;
            if (own.includes("aria-pressed\\:bg-muted"))
              pressedRules.push(`${context} ${rule.cssText}`);
            let hit = false;
            try {
              hit = element.matches(selector);
            } catch {
              hit = false;
            }
            order += 1;
            if (hit && rule.style.length > 0) {
              rules.push({
                order,
                sheet,
                context,
                selector,
                text: rule.style.cssText.slice(0, 400),
              });
            }
            if (rule.cssRules.length > 0) walk(rule.cssRules, sheet, context, selector);
          } else if (rule instanceof CSSLayerBlockRule) {
            walk(rule.cssRules, sheet, `${context}@layer ${rule.name}`, parent);
          } else if (rule instanceof CSSMediaRule) {
            if (window.matchMedia(rule.conditionText).matches) {
              walk(rule.cssRules, sheet, `${context}@media ${rule.conditionText}`, parent);
            }
          } else if (rule instanceof CSSSupportsRule) {
            walk(rule.cssRules, sheet, `${context}@supports`, parent);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        let list: CSSRuleList | undefined;
        try {
          list = sheet.cssRules;
        } catch {
          list = undefined;
        }
        if (list !== undefined) walk(list, sheet.href ?? "inline", "", undefined);
      }
      return {
        className: element.className,
        ariaPressed: element.getAttribute("aria-pressed"),
        background: style.backgroundColor,
        color: style.color,
        hover: element.matches(":hover"),
        focusVisible: element.matches(":focus-visible"),
        colorMuted: style.getPropertyValue("--color-muted"),
        dark: document.documentElement.classList.contains("dark"),
        sheets: Array.from(document.styleSheets).map((sheet) => sheet.href ?? "inline"),
        pressedRules,
        rules,
      };
    });
    console.log(`T8B-FILL ${label} ${when} ${JSON.stringify(record)}`);
  }
}
