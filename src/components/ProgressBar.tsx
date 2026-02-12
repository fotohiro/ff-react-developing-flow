import { type CSSProperties } from "react";

interface Props {
  total: number;
  current: number; // 0-indexed
}

export default function ProgressBar({ total, current }: Props) {
  return (
    <div style={bar}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            ...segment,
            backgroundColor:
              i <= current
                ? "var(--color-progress-filled)"
                : "var(--color-progress-empty)",
          }}
        />
      ))}
    </div>
  );
}

const bar: CSSProperties = {
  display: "flex",
  gap: "var(--progress-gap)",
  padding: "0 var(--page-padding)",
  marginTop: 21 + 19 + 10, // logo top + logo height + gap
};

const segment: CSSProperties = {
  flex: 1,
  height: "var(--progress-height)",
  borderRadius: "var(--radius-badge)",
  transition: "background-color var(--transition-normal)",
};
