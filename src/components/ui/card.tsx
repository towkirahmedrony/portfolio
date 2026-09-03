import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type CardProps = ComponentProps<"article">;

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-card-border bg-card p-6 shadow-[0_1px_0_rgba(20,20,20,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(20,20,20,0.06)] dark:shadow-none dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
