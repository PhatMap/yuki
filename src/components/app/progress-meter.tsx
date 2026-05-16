interface ProgressMeterProps {
  value: number;
  label?: string;
  description?: string;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function ProgressMeter({
  value,
  label,
  description,
}: ProgressMeterProps) {
  const percent = clampPercent(value);

  return (
    <div className="progress-meter">
      <div className="progress-meter__header">
        {label ? <span>{label}</span> : <span>Progress</span>}
        <span>{percent}%</span>
      </div>

      <div
        className="progress-meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="progress-meter__bar"
          style={{ width: `${percent}%` }}
        />
      </div>

      {description ? (
        <p className="progress-meter__description">{description}</p>
      ) : null}
    </div>
  );
}
