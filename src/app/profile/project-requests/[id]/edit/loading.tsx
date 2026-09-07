import { OrderFormSkeleton } from "@/components/public/content-states";

export default function EditProjectRequestLoading() {
  return (
    <div className="mx-auto max-w-3xl pt-28 pb-12 sm:pt-32 px-5 sm:px-8">
      <div className="h-4 w-32 animate-pulse rounded bg-card-border" />
      <div className="mt-8 h-8 w-48 animate-pulse rounded bg-card-border" />
      <div className="mt-10">
        <OrderFormSkeleton />
      </div>
    </div>
  );
}
