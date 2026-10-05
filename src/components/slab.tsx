type SlabMode = "hang" | "drop" | "safe";

export function Slab({
  danger,
  mode,
  left,
  streak,
}: {
  danger: number;
  mode: SlabMode;
  left: number;
  streak: number;
}) {
  const drop = Math.min(1, Math.max(0, danger));
  const late = drop > 0.72 && mode === "hang";
  return (
    <div className={`well ${mode === "drop" ? "is-drop" : ""} ${mode === "safe" ? "is-safe" : ""} ${late ? "is-late" : ""}`}>
      <div className="rope" style={{ height: mode === "drop" ? "78%" : `${10 + drop * 62}%` }} />
      <div
        className="stone"
        style={mode === "hang" ? { top: `${6 + drop * 58}%` } : undefined}
      >
        <span />
        <span />
      </div>
      <div className="fruit" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="hand" aria-hidden="true">
        <b />
        <b />
      </div>
      {mode === "safe" ? <em className="sparks" key={left} /> : null}
      <p className="well-read tabular-nums">
        {mode === "drop" ? "Плита" : mode === "safe" ? "Успел" : left.toFixed(1)}
        {streak >= 3 && mode === "hang" ? <small>серия держит трос</small> : null}
      </p>
    </div>
  );
}
