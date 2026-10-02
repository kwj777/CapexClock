"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";
import { templateFile, type TemplateFile, type TemplateFormat } from "@/lib/import/format";

const LINK_TEXT: Record<TemplateFile, Record<TemplateFormat, string>> = {
  template: { xlsx: "Download our template (Excel)", csv: "Download our template (CSV)" },
  example: { xlsx: "Download the filled-in example (Excel)", csv: "Download the filled-in example (CSV)" },
};

/**
 * A plain link to the template or the example, as an Excel file or a CSV, so it
 * works without JavaScript, that sends template_downloaded with where it was clicked.
 */
export default function TemplateLink({
  file,
  format,
  where,
  className = "font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300",
  children,
}: {
  file: TemplateFile;
  format: TemplateFormat;
  where: string;
  className?: string;
  children?: ReactNode;
}) {
  const { path, name } = templateFile(file, format);
  return (
    <a href={path} download={name} className={className} onClick={() => void track("template_downloaded", { where, file, format })}>
      {children ?? LINK_TEXT[file][format]}
    </a>
  );
}
