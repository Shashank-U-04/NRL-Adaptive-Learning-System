import { CheckCircle2 } from "lucide-react";

export default function SummaryCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="rounded-lg p-4" style={{ border: "1px solid var(--border-glass)", background: "rgba(34,197,94,0.06)" }}>
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="space-y-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
