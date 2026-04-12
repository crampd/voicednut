function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((row) => {
    lines.push(row.map((cell) => csvEscape(String(cell ?? ''))).join(','));
  });

  const csv = `${lines.join('\n')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
