import type { FormStatus } from "@garmincoach/training-engine";

const FORM_LABELS: Record<FormStatus, { label: string; className: string }> = {
  fresh: { label: "Frisch", className: "text-success" },
  neutral: { label: "Ausgeglichen", className: "text-foreground" },
  fatigued: { label: "Ermüdet", className: "text-warning" },
  very_fatigued: { label: "Stark ermüdet", className: "text-danger" },
};

export function FormStatusBadge({ status }: { status: FormStatus }) {
  const { label, className } = FORM_LABELS[status];
  return <p className={`text-2xl font-semibold tracking-tight ${className}`}>{label}</p>;
}
