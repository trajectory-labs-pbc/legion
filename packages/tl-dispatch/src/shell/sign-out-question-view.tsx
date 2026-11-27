import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@legion/ui/components/alert-dialog";

/** The question a sign-out asks before it discards unsent changes. */
export function SignOutQuestionView({
  onConfirm,
  onDismiss,
  open,
  question,
}: {
  onConfirm: () => void;
  onDismiss: () => void;
  open: boolean;
  question: string | undefined;
}) {
  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {question}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
