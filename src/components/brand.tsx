import Image from "next/image";

export function BrandLockup({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={`h-auto w-full object-contain ${className}`}
      src="/brand/capture-tracker-lockup.png"
      alt="Capture Tracker. SPEND TRACKED. BUSINESS GROWN."
      width={1224}
      height={400}
      priority={priority}
    />
  );
}

export function BrandIcon({
  decorative = false,
  className = "",
}: {
  decorative?: boolean;
  className?: string;
}) {
  return (
    <Image
      className={`h-auto w-auto object-contain ${className}`}
      src="/brand/capture-tracker-icon.png"
      alt={
        decorative
          ? ""
          : "Capture Tracker octagonal circuit-frame mark with a circular teal financial-bars window"
      }
      aria-hidden={decorative || undefined}
      width={340}
      height={400}
    />
  );
}
