import { useMemo } from "preact/hooks";
import { qrcodegen } from "@/lib/qr/qrcodegen";

export function QrCodeSvg(props: {
  text: string;
  className?: string;
  title?: string;
}) {
  const qr = useMemo(
    () =>
      qrcodegen.QrCode.encodeText(props.text, qrcodegen.QrCode.Ecc.MEDIUM),
    [props.text],
  );

  const border = 4;
  const size = qr.size + border * 2;
  const modules: JSX.Element[] = [];

  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.getModule(x, y)) continue;
      modules.push(
        <rect x={x + border} y={y + border} width="1" height="1" />,
      );
    }
  }

  return (
    <svg
      className={props.className}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={props.title ?? "QR code"}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <g fill="#000000">{modules}</g>
    </svg>
  );
}
