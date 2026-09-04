export function RatingStars({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "md" | "lg";
}) {
  const textClass = size === "lg" ? "text-2xl" : "text-lg";
  const starClass = (index: number) =>
    index <= rating ? "text-amber-400" : "text-foreground/15";

  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={`Rated ${rating} out of 5`}
    >
      <span className={`flex ${textClass} leading-none`} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((index) => (
          <span key={index} className={starClass(index)}>
            ★
          </span>
        ))}
      </span>
      <span className="text-sm font-medium text-foreground">
        {rating} / 5
      </span>
    </div>
  );
}
