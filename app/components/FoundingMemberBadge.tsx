type FoundingMemberBadgeProps = {
  position?: number | null;
  programme: "pro" | "elite";
};

export function FoundingMemberBadge({ position = null, programme }: FoundingMemberBadgeProps) {
  const confirmed = Number.isInteger(position) && Number(position) > 0;
  return <div className="foundingMemberWelcomeBadge" data-confirmed={confirmed}>
    <span aria-hidden="true">◇</span>
    <div>
      <small>FOUNDING MEMBER · {programme.toUpperCase()}</small>
      <strong>Member #{confirmed ? position : "—"}</strong>
      <p>{confirmed ? "Founding membership confirmed." : "Number assigned after eligibility confirmation."}</p>
    </div>
  </div>;
}
