import { useState } from "react";
export function VenueImage({
  src,
  alt,
  loading,
}: {
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? "/images/venue-fallback.svg" : src}
      alt={failed ? "DUSK venue preview illustration" : alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
