const encoder = new TextEncoder();

export type ExportFile = { name: string; content: string | Uint8Array; contentType?: string };

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}
function u16(value: number) { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
function concat(parts: Uint8Array[]) { const length = parts.reduce((total, part) => total + part.length, 0); const output = new Uint8Array(length); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }

/** Store-only ZIP for modest accounting packages; every supplied row is retained. */
export function createZip(files: ExportFile[]) {
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name); const bytes = typeof file.content === "string" ? encoder.encode(file.content) : file.content; const checksum = crc32(bytes);
    const header = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(checksum), ...u32(bytes.length), ...u32(bytes.length), ...u16(name.length), ...u16(0), ...name]);
    local.push(header, bytes);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(checksum), ...u32(bytes.length), ...u32(bytes.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += header.length + bytes.length;
  }
  const centralBytes = concat(central);
  return concat([...local, centralBytes, new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralBytes.length), ...u32(offset), ...u16(0)])]);
}

function escapePdf(value: string) { return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/[\u0000-\u001f]/g, " "); }
/** A deliberately simple, portable PDF index. Detailed schedules are CSV files in the same protected package. */
export function createPdfIndex(title: string, lines: string[]) {
  const textLines = [title, ...lines].map((line, index) => `BT /F1 ${index === 0 ? 18 : 10} Tf 50 ${760 - index * 16} Td (${escapePdf(line).slice(0, 180)}) Tj ET`).join("\n");
  const stream = encoder.encode(textLines); const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${stream.length} >>\nstream\n${textLines}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let body = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(encoder.encode(body).length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = encoder.encode(body).length; body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return encoder.encode(body);
}
