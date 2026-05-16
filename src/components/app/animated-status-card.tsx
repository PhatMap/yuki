import type { ReactNode } from "react";

interface AnimatedStatusCardProps {
  eyebrow?: string;
  title: string;
  value: string;
  description?: string;
  children?: ReactNode;
}

export function AnimatedStatusCard({
  eyebrow,
  title,
  value,
  description,
  children,
}: AnimatedStatusCardProps) {
  return (
    <div className="animated-status-card">
      <div className="animated-status-card__glow" aria-hidden="true" />

      <div className="animated-status-card__content">
        {eyebrow ? (
          <p className="animated-status-card__eyebrow">{eyebrow}</p>
        ) : null}

        <div className="animated-status-card__main">
          <div>
            <p className="animated-status-card__title">{title}</p>
            {description ? (
              <p className="animated-status-card__description">
                {description}
              </p>
            ) : null}
          </div>

          <p className="animated-status-card__value">{value}</p>
        </div>

        {children ? (
          <div className="animated-status-card__body">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
