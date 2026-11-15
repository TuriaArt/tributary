import type { ReactNode } from "react";

/**
 * A card in a commit's details, for what the site says about it: a pull request, its checks.
 * Each is built the same way: an icon in a disc of its state's colour, a title, a line under
 * it, and its button at the end. What follows (a bar, a list) goes under them.
 */
export function DetailsCard({ className, icon, title, sub, action, children }: { className: string; icon: ReactNode; title: ReactNode; sub: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`details-card ${className}`}>
      <div className="details-card-main">
        <span className="details-card-icon">{icon}</span>
        <span className="details-card-text">
          <span className="details-card-title">{title}</span>
          <span className="details-card-sub">{sub}</span>
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A card's button, like Show or Open. */
export function DetailsCardButton({ onClick, icon, label, title }: { onClick: () => void; icon: ReactNode; label: string; title: string }) {
  return (
    <button className="details-card-button" onClick={onClick} title={title}>
      {icon}
      <span className="button-label">{label}</span>
    </button>
  );
}
