// Accessible SVG icons for booking status
import React from "react";
import CheckSvg from "@cusown/shared/icons/check.svg";
import CloseSvg from "@cusown/shared/icons/close.svg";
import UndoSvg from "@cusown/shared/icons/undo.svg";

export function IconCheck({
  className = "",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return <CheckSvg className={className} aria-label="Accepted" {...props} />;
}

export function IconCross({
  className = "",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return <CloseSvg className={className} aria-label="Rejected" {...props} />;
}

export function IconUndo({
  className = "",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return <UndoSvg className={className} aria-label="Undo" {...props} />;
}
