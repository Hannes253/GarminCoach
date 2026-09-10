import type { FormStatus } from "@garmincoach/training-engine";

const FORM_LABELS: Record<FormStatus, { label: string; className: string }> = {
  fresh: { label: "Frisch", className: "text-green-600" },
  neutral: { label: "Ausgeglichen", className: "text-foreground" },
  fatigued: { label: "Ermüdet", className: "text-orange-600" },
  very_fatigued: { label: "Stark ermüdet", className: "text-red-600" },
};

export function FormStatusBadge({ status }: { status: FormStatus }) {
  const { label, className } = FORM_LABELS[status];
  return <p className={`text-xl font-semibold ${className}`}>{label}</p>;
}
