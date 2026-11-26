import type { UserEvent } from "@testing-library/user-event";

/** Answers the open revoke question with its Revoke. */
export async function confirmRevoke(user: UserEvent): Promise<void> {
  const question = document.querySelector('[role="alertdialog"]');
  const revoke = [...(question?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === "Revoke"
  );
  if (revoke === undefined) throw new Error("no revoke question is open");
  await user.click(revoke);
}
