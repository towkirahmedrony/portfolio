import { cn } from "@/lib/utils";
import type { OrderFormConfig, ProjectRequestStep } from "@/types/project-request";

export function FormProgress({
  step,
  config,
}: {
  step: ProjectRequestStep;
  config: OrderFormConfig;
}) {
  const total = config.steps.length;
  if (total === 0) {
    return null;
  }

  const currentStep = Math.min(Math.max(step, 1), total);
  const percent = Math.round((currentStep / total) * 100);
  const current = config.steps[currentStep - 1];

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            Step {currentStep} of {total}
          </p>
          <p className="mt-1 text-sm text-muted">
            {current?.description ?? current?.title ?? ""}
          </p>
        </div>
        <p className="text-xs text-muted">{percent}%</p>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-card-border"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentStep}
        aria-label={`Step ${currentStep} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol
        className="mt-4 hidden gap-2 sm:grid"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {config.steps.map((item, index) => {
          const id = index + 1;
          return (
            <li
              key={item.id}
              className={cn(
                "text-xs tracking-wide",
                id === currentStep
                  ? "text-foreground"
                  : id < currentStep
                    ? "text-accent"
                    : "text-muted",
              )}
            >
              {item.title}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
