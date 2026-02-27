interface CapsuleTagProps {
  label: string;
  className?: string;
}

export function CapsuleTag({ label, className = '' }: CapsuleTagProps) {
  return (
    <span
      className={`inline-block px-3 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 ${className}`}
    >
      {label}
    </span>
  );
}
