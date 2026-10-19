import { useState } from "react";

interface SiteIconProps {
  icon: string | null;
  domain: string;
  error?: string | null;
}

export function SiteIcon({
  icon,
  domain,
  error,
}: SiteIconProps) {
  const [failed, setFailed] = useState(false);
  const tooltip = error
    ? `Couldn't fetch site details: ${error}`
    : undefined;

  if (icon && !failed) {
    return (
      <img
        className="site-icon"
        src={`/static/icons/${encodeURIComponent(icon)}`}
        alt=""
        title={tooltip}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`site-icon site-icon-placeholder ${
        error ? "site-icon-error" : ""
      }`}
      title={tooltip}
      aria-hidden="true"
    >
      {domain.replace(/^www\./, "").charAt(0).toUpperCase()}
    </span>
  );
}
