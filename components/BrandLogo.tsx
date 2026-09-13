import Image from "next/image";

type BrandLogoProps = {
  size?: "compact" | "large";
  decorative?: boolean;
};

export function BrandLogo({
  size = "compact",
  decorative = false,
}: BrandLogoProps) {
  return (
    <span className={`brand-logo brand-logo-${size}`}>
      <Image
        src="/brand/pb-logo.jpg"
        alt={decorative ? "" : "Pb Messenger logo"}
        width={784}
        height={1168}
        sizes={size === "large" ? "160px" : "64px"}
        className="brand-logo-image"
      />
    </span>
  );
}
