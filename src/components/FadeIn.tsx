import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Unique key to re-trigger the animation */
  stepKey: string;
}

export default function FadeIn({ children, stepKey }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [stepKey]);

  return (
    <div
      style={{
        ...wrapper,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {children}
    </div>
  );
}

const wrapper: CSSProperties = {
  transition: "opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  willChange: "opacity, transform",
};
