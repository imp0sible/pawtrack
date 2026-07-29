import { clsx } from "clsx";

interface Props {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

// Plain <img> (not next/image) so we don't need remote-image domain config.
export function Avatar({ name, src, size = 40, className }: Props) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] font-semibold text-[var(--brand-strong)]",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
