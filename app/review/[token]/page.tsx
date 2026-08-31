import { ReviewSubmissionForm } from "@/components/review/review-submission-form";
import { ThemeCorner } from "@/components/theme/theme-corner";

export default async function ReviewRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <ThemeCorner />
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-16 text-zinc-950 dark:text-zinc-50">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Leave a review
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Share your experience with the product you purchased.
        </p>
      </div>

      <ReviewSubmissionForm token={token} />
    </main>
    </>
  );
}
