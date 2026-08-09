import "server-only";

export type TransactionalEmail = { subject: string; text: string; html: string };

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const shell = (content: string) => `<!doctype html><html lang="en"><body style="margin:0;background:#f4f7f8;color:#102338;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;background:#fff;padding:32px;border-radius:16px"><p style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#087e7a">CAPTURE TRACKER</p>${content}<p style="margin-top:28px;font-size:12px;font-weight:700;letter-spacing:1px;color:#087e7a">SPENDING TRACKED. BUSINESS GROWN.</p></main></body></html>`;

export function invitationEmail(input: { ownerDisplayName: string; businessDisplayName: string; expiresAt: Date; invitationUrl: string }): TransactionalEmail {
  const owner = escapeHtml(input.ownerDisplayName.split(/\s+/)[0] || "there");
  const business = escapeHtml(input.businessDisplayName);
  const expiry = input.expiresAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const url = escapeHtml(input.invitationUrl);
  return { subject: "You’re invited to Capture Tracker", text: `Hi ${input.ownerDisplayName},\n\nYou’re invited to set up ${input.businessDisplayName} on Capture Tracker, built for single-owner S-Corporations. This secure one-time setup link expires ${expiry}.\n\nSet up Capture Tracker: ${input.invitationUrl}\n\nSPENDING TRACKED. BUSINESS GROWN.`, html: shell(`<h1 style="margin:0;font-size:28px">Welcome, ${owner}.</h1><p style="line-height:1.6">You’re invited to set up <strong>${business}</strong> on Capture Tracker, built for single-owner S-Corporations.</p><p style="line-height:1.6">Your secure one-time setup link expires ${escapeHtml(expiry)}.</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#087e7a;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700">Set up Capture Tracker</a></p><p style="font-size:13px;color:#536273">If you were not expecting this invitation, you can ignore this email.</p>`) };
}

export function setupCompleteEmail(input: { ownerDisplayName: string; businessDisplayName: string; todayUrl: string; installUrl: string; foundingCustomer: boolean }): TransactionalEmail {
  const founding = input.foundingCustomer ? " You’re officially Capture Tracker Customer #001. Thank you for being the first business to put it to work." : "";
  const today = escapeHtml(input.todayUrl); const install = escapeHtml(input.installUrl);
  return { subject: "You’re live on Capture Tracker", text: `Hi ${input.ownerDisplayName},\n\n${input.businessDisplayName} is ready to run in Capture Tracker.${founding}\n\nToday: ${input.todayUrl}\nInstall Capture Tracker: ${input.installUrl}\n\nDuring the week: capture receipts when needed.\nOnce a week: complete Weekly Review.\nAt month-end: reconcile and close your books.`, html: shell(`<h1 style="margin:0;font-size:28px">You’re live on Capture Tracker.</h1><p style="line-height:1.6">${escapeHtml(input.businessDisplayName)} is ready to run in Capture Tracker.${escapeHtml(founding)}</p><p><a href="${today}" style="display:inline-block;background:#087e7a;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700">Go to Today</a></p><p><a href="${install}" style="color:#087e7a;font-weight:700">Install Capture Tracker</a></p><p style="line-height:1.7"><strong>During the week:</strong> Capture receipts when needed.<br><strong>Once a week:</strong> Complete Weekly Review.<br><strong>At month-end:</strong> Reconcile and close your books.</p>`) };
}
