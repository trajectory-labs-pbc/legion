// Check `document-ask-enter`: a decision ask in a document keeps upstream's card in the pane.
import { expectOpen, questionBody } from "./page";
import { expect, test } from "./seed";

test("INB-149 Skip to the answer brings a document's decision ask to the top of the pane", async ({
  inbox,
  page,
}) => {
  const decision = await inbox.decisionInDocument("Which service moves first?", 40);
  await page.goto(await inbox.address({ item: decision.id }));
  await expectOpen(page, decision.text);
  const question = questionBody(page).getByText(decision.text).first();
  await expect(question).toBeAttached();
  await expect(question).not.toBeInViewport();
  await page
    .getByRole("region", { name: "Selected question" })
    .getByRole("button", { name: "Skip to the answer" })
    .click();
  await expect(question).toBeInViewport();
});
