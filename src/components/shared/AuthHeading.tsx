interface AuthHeadingProps {
  title: string;
  subtitle?: string;
}

/** Standard left-aligned heading used at the top of every auth form. */
export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <header className="space-y-2">
      <h2 className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </header>
  );
}
