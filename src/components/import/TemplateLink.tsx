"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";
import { TEMPLATE_FILES, type TemplateFile } from "@/lib/import/format";

const LINK_TEXT: Record<TemplateFile, string> = {
  template: "Download our template (CSV)",
  example: "Download the filled-in example (CSV)",
};

/**
 * A plain link to the template or the example, so it works without JavaScript,
 * that sends template_downloaded with where it was clicked.
 */
export default function TemplateLink({
  file,
  where,
  className = "font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300",
  children,
}: {
  file: TemplateFile;
  where: string;
  className?: string;
  children?: ReactNode;
}) {
  const { path, name } = TEMPLATE_FILES[file];
  return (
    <a href={path} download={name} className={className} onClick={() => void track("template_downloaded", { where, file })}>
      {children ?? LINK_TEXT[file]}
    </a>
  );
}
