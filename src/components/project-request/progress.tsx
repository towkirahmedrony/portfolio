import { stepMeta, TOTAL_STEPS } from "@/data/project-request";
import { cn } from "@/lib/utils";
import type { ProjectRequestStep } from "@/types/project-request";

export function FormProgress({ step }: { step: ProjectRequestStep }) {
  const percent = Math.round((step / TOTAL_STEPS) * 100);
  const current = stepMeta[step - 1];

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            Step {step} of {TOTAL_STEPS}
          </p>
          <p className="mt-1 text-sm text-muted">{current.description}</p>
        </div>
        <p className="text-xs text-muted">{percent}%</p>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-card-border"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-4 hidden gap-2 sm:grid sm:grid-cols-6">
        {stepMeta.map((item) => (
          <li
            key={item.id}
            className={cn(
              "text-xs tracking-wide",
              item.id === step
                ? "text-foreground"
                : item.id < step
                  ? "text-accent"
                  : "text-muted",
            )}
          >
            {item.title}
          </li>
        ))}
      </ol>
    </div>
  );
}
