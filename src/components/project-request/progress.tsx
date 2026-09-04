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
  const percent = total === 0 ? 0 : Math.round((step / total) * 100);
  const current = config.steps[step - 1];
  const columnsClass =
    total <= 4
      ? "sm:grid-cols-4"
      : total === 5
        ? "sm:grid-cols-5"
        : total === 6
          ? "sm:grid-cols-6"
          : "sm:grid-cols-6";

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            Step {step} of {total}
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
        aria-valuenow={step}
        aria-label={`Step ${step} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className={cn("mt-4 hidden gap-2 sm:grid", columnsClass)}>
        {config.steps.map((item, index) => {
          const id = index + 1;
          return (
            <li
              key={item.id}
              className={cn(
                "text-xs tracking-wide",
                id === step
                  ? "text-foreground"
                  : id < step
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
