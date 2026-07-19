export function BullseyeSignature({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={`bullseyeSignature ${compact ? "isCompact" : ""}`} viewBox="0 0 520 520" aria-hidden="true">
      <g className="bullseyeSignatureRings">
        <circle cx="260" cy="260" r="204" />
        <circle cx="260" cy="260" r="146" />
        <circle cx="260" cy="260" r="88" />
        <circle cx="260" cy="260" r="26" />
      </g>
      <g className="bullseyeSignatureAxes">
        <path d="M260 12V508M12 260H508" />
        <path d="M84 84L436 436M436 84L84 436" />
      </g>
      <path className="bullseyeSignatureVector" d="M54 354L146 310L222 332L302 226L386 246L478 154" />
      <g className="bullseyeSignatureNodes">
        <circle cx="146" cy="310" r="4" />
        <circle cx="302" cy="226" r="4" />
        <circle cx="386" cy="246" r="4" />
        <circle cx="478" cy="154" r="4" />
      </g>
    </svg>
  );
}
