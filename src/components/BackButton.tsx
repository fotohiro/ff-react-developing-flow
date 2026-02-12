import { type CSSProperties } from "react";

interface Props {
  onClick: () => void;
}

export default function BackButton({ onClick }: Props) {
  return (
    <button style={style} onClick={onClick} type="button">
      ← Back
    </button>
  );
}

const style: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 20,
  color: "var(--color-text-secondary)",
  background: "none",
  border: "none",
  padding: "0",
  cursor: "pointer",
  alignSelf: "flex-start",
  textAlign: "left",
  WebkitTapHighlightColor: "transparent",
};
