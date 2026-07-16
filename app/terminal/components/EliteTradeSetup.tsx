type EliteTradeSetupProps = {
  title: string;
  direction: "Long" | "Short";
  conviction: number;
  entryZone: string;
  stopLoss: string;
  target1: string;
  target2: string;
  riskReward: string;
  timeframe: string;
  status: "Waiting" | "Active" | "Closed";
  explanation: string;
};

type StatusPillProps = {
  status: EliteTradeSetupProps["status"];
};

type InfoTileProps = {
  label: string;
  value: string;
};

function StatusPill({ status }: StatusPillProps) {
  return <span className={`eliteTradeSetupStatus eliteTradeSetupStatus-${status.toLowerCase()}`}>{status}</span>;
}

function InfoTile({ label, value }: InfoTileProps) {
  return (
    <article className="eliteTradeSetupTile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function EliteTradeSetup({
  title,
  direction,
  conviction,
  entryZone,
  stopLoss,
  target1,
  target2,
  riskReward,
  timeframe,
  status,
  explanation,
}: EliteTradeSetupProps) {
  return (
    <section className="eliteTradeSetup">
      <div className="eliteTradeSetupHeader">
        <div>
          <span className="terminalPanelEyebrow">ELITE TRADE SETUP</span>
          <h2>{title}</h2>
          <p>Premium signal orchestration designed for a desk-grade execution workflow.</p>
        </div>
        <div className="eliteTradeSetupMeta">
          <StatusPill status={status} />
          <span className={`eliteTradeSetupDirection ${direction.toLowerCase()}`}>{direction}</span>
        </div>
      </div>

      <div className="eliteTradeSetupScoreCard">
        <div className="eliteTradeSetupConviction">
          <span>Conviction</span>
          <strong>{conviction}%</strong>
          <small>Desk confidence index</small>
        </div>
        <div className="eliteTradeSetupRiskReward">
          <span>Risk : Reward</span>
          <strong>{riskReward}</strong>
        </div>
      </div>

      <div className="eliteTradeSetupGrid">
        <InfoTile label="Entry zone" value={entryZone} />
        <InfoTile label="Stop loss" value={stopLoss} />
        <InfoTile label="Target 1" value={target1} />
        <InfoTile label="Target 2" value={target2} />
        <InfoTile label="Timeframe" value={timeframe} />
        <InfoTile label="Trade status" value={status} />
      </div>

      <div className="eliteTradeSetupExplanation">
        <h3>Why this trade exists</h3>
        <p>{explanation}</p>
      </div>
    </section>
  );
}
