type Props = { verified: boolean; conditions: string[]; nextAction: string; dataStatus: string };
const words = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();

export function NoTradeScenarioCard({ verified, conditions, nextAction, dataStatus }: Props) {
  const reasons = conditions.length ? conditions.slice(0, 4) : ["Price remains between confirmation levels", "Risk/reward is not clearly defined", "A major catalyst is too close"];
  return <article className="eliteScenario isNeutral isResolved noTradeScenario">
    <header><div className="eliteScenarioIdentity"><i aria-hidden="true">N</i><div><span>NO-TRADE CASE</span><h2>Stand-aside scenario</h2><small>Capital-preservation conditions · not inactivity by default</small></div></div><div className="eliteScenarioProbability"><span>DATA STATE</span><strong>{dataStatus}</strong></div></header>
    <div className="eliteScenarioMeter" aria-hidden="true"><i style={{ width: verified ? "50%" : "100%" }} /></div>
    <div className="noTradeScenarioBody"><strong>{verified ? "Remain selective when:" : "Stand aside until verification completes"}</strong><ul>{reasons.map((reason) => <li key={reason}>{words(reason)}</li>)}</ul><p><span>Reassessment trigger</span>{nextAction}</p></div>
    <footer><span>Risk control</span><strong>No setup is a valid outcome</strong></footer>
  </article>;
}
