"use client";

/** Choix de visibilité d'un contenu : visible par les autres membres ou réservé à soi. */
export default function VisibilityToggle({ isPublic, onChange, publicHint, privateHint }: {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
  publicHint: string;
  privateHint: string;
}) {
  const opt = (value: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={isPublic === value}
      onClick={() => onChange(value)}
      className={`flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-[background-color,color,transform] duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${
        isPublic === value ? "bg-violet text-cream shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label="Visibilité" className="flex gap-1 rounded-xl border border-line bg-paper p-1">
        {opt(true, "Public")}
        {opt(false, "Privé")}
      </div>
      <p className="text-[11.5px] leading-snug text-muted">{isPublic ? publicHint : privateHint}</p>
    </div>
  );
}
