import { publicInvoice } from "@/lib/services/invoicing";
import { prisma } from "@/lib/prisma";
import { createPdfIndex } from "@/lib/services/cpa-export-core";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const invoice = await publicInvoice(prisma, token);
  if (!invoice) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const date = (value: Date | null) => value ? value.toISOString().slice(0, 10) : "Not issued";
  const lines = [
    `Invoice ${invoice.invoiceNumber}`,
    invoice.business.displayName,
    invoice.business.legalName,
    `Bill to: ${invoice.customer.businessName}`,
    invoice.customer.contactName ? `Contact: ${invoice.customer.contactName}` : "",
    `Issued: ${date(invoice.issueDate)}   Due: ${date(invoice.dueDate)}`,
    "",
    ...invoice.lines.flatMap((line) => [`${line.description}`, `  ${line.quantity.toFixed(2)} x $${line.rate.toFixed(2)} = $${line.amount.toFixed(2)}`]),
    "",
    `Total due: $${invoice.total.toFixed(2)}`,
    invoice.paymentInstructions ? `Payment instructions: ${invoice.paymentInstructions}` : "",
    invoice.terms ? `Terms: ${invoice.terms}` : "",
    invoice.memo ? `Memo: ${invoice.memo}` : "",
  ].filter(Boolean);
  return new Response(createPdfIndex(`Invoice ${invoice.invoiceNumber}`, lines), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });
}
