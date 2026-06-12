import type { SVGProps } from "react";

// Logo X (Twitter) oficial — usado como "estilo de post", não como rede de destino.
export function XStyleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.244 2H21l-6.49 7.41L22 22h-6.84l-4.79-6.26L4.8 22H2.04l6.94-7.93L2 2h6.99l4.34 5.74L18.244 2Zm-1.2 18h1.79L7.04 4h-1.9l11.904 16Z" />
    </svg>
  );
}
