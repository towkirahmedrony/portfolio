import { OrderFormSkeleton } from "@/components/public/content-states";
import { PageHero } from "@/components/ui/section";

export default function StartProjectLoading() {
  return (
    <>
      <PageHero
        eyebrow="Project request"
        title="Tell me about the website you need"
        description="A short brief, one step at a time. Your answers stay on this page until you submit — nothing is stored or emailed yet."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <OrderFormSkeleton />
        </div>
      </section>
    </>
  );
}
