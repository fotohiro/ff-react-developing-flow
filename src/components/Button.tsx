import { type CSSProperties, type ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "disabled";
}

export default function Button({
  children,
  variant = "primary",
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || variant === "disabled";

  return (
    <button
      disabled={isDisabled}
      style={{
        ...base,
        ...(isDisabled ? disabledStyle : activeStyle),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const base: CSSProperties = {
  width: "100%",
  maxWidth: 264,
  height: 63,
  borderRadius: "var(--radius-button)",
  fontSize: 30,
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto",
  /* Optical vertical centering — AcidGrotesk sits low on baseline */
  paddingBottom: 4,
  transition: "all var(--transition-fast)",
  WebkitTapHighlightColor: "transparent",
};

const activeStyle: CSSProperties = {
  backgroundColor: "var(--color-cta)",
  color: "var(--color-text)",
  border: "2px solid var(--color-cta-border)",
  cursor: "pointer",
};

const disabledStyle: CSSProperties = {
  backgroundColor: "var(--color-disabled)",
  color: "#ffffff",
  border: "none",
  cursor: "default",
  opacity: 1,
};
