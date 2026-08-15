import "server-only";

export type TransactionalEmail = {
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const shell = (content: string, logoUrl?: string) => {
  const brand = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="210" alt="Capture Tracker" style="display:block;width:210px;max-width:70%;height:auto;border:0">`
    : '<p style="margin:0;font-size:13px;letter-spacing:1.6px;font-weight:800;color:#11BEA0">CAPTURE TRACKER</p>';
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:620px){.ct-card{margin:0!important;border-radius:0!important;padding:28px 20px!important}.ct-cta{display:block!important;text-align:center!important}}</style></head><body style="margin:0;background:#FBFAF6;color:#0A2740;font-family:Arial,Helvetica,sans-serif"><main class="ct-card" style="box-sizing:border-box;max-width:600px;margin:24px auto;background:#ffffff;padding:36px;border:1px solid #dce4e6;border-radius:16px">${brand}${content}<hr style="margin:30px 0 22px;border:0;border-top:1px solid #dce4e6"><p style="margin:0;font-size:14px;font-weight:800;color:#0A2740">Capture Tracker</p><p style="margin:8px 0 0;font-size:12px;font-weight:800;letter-spacing:1px;color:#11BEA0">SPENDING TRACKED. BUSINESS GROWN.</p></main></body></html>`;
};

export function invitationEmail(input: {
  ownerDisplayName: string;
  businessDisplayName: string;
  recipientEmail: string;
  expiresAt: Date;
  invitationUrl: string;
  logoUrl?: string;
}): TransactionalEmail {
  const owner = escapeHtml(input.ownerDisplayName.split(/\s+/)[0] || "there");
  const business = escapeHtml(input.businessDisplayName);
  const recipient = escapeHtml(input.recipientEmail);
  const expiry = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/Los_Angeles",
  }).format(input.expiresAt);
  const url = escapeHtml(input.invitationUrl);
  return {
    subject: "You’re invited to Capture Tracker",
    text: `Welcome to Capture Tracker, ${input.ownerDisplayName.split(/\s+/)[0] || "there"}\n\nYour ${input.businessDisplayName} workspace is ready.\n\nCapture Tracker will guide you through setting up your business, bringing in your bank activity, confirming your starting books, and learning the simple routine you’ll use to keep everything current.\n\nSet Up My Account: ${input.invitationUrl}\n\nYou can connect your business bank securely or import transactions manually.\n\nThis invitation is intended for: ${input.recipientEmail}\nInvitation expires: ${expiry}\n\nCapture Tracker\nSPENDING TRACKED. BUSINESS GROWN.`,
    html: shell(
      `<h1 style="margin:28px 0 0;font-size:30px;line-height:1.2;color:#0A2740">Welcome to Capture Tracker, ${owner}</h1><p style="margin:18px 0 0;font-size:17px;line-height:1.65;color:#48555C">Your <strong style="color:#0A2740">${business}</strong> workspace is ready.</p><p style="margin:16px 0 0;font-size:16px;line-height:1.65;color:#48555C">Capture Tracker will guide you through setting up your business, bringing in your bank activity, confirming your starting books, and learning the simple routine you’ll use to keep everything current.</p><p style="margin:28px 0"><a class="ct-cta" href="${url}" style="display:inline-block;background:#11BEA0;color:#0A2740;padding:15px 22px;border-radius:9px;text-decoration:none;font-size:16px;font-weight:800">Set Up My Account</a></p><p style="margin:0;font-size:15px;line-height:1.6;color:#48555C">You can connect your business bank securely or import transactions manually.</p><div style="margin-top:24px;padding:16px;background:#FBFAF6;border-radius:10px"><p style="margin:0;font-size:13px;line-height:1.55;color:#48555C">This invitation is intended for:<br><strong style="color:#0A2740">${recipient}</strong></p><p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:#48555C">Invitation expires:<br><strong style="color:#0A2740">${escapeHtml(expiry)}</strong></p></div><p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#48555C">If you were not expecting this invitation, you can ignore this email.</p>`,
      input.logoUrl,
    ),
  };
}

export function setupCompleteEmail(input: {
  ownerDisplayName: string;
  businessDisplayName: string;
  todayUrl: string;
  installUrl: string;
  foundingCustomer: boolean;
}): TransactionalEmail {
  const founding = input.foundingCustomer
    ? " You’re officially Capture Tracker Customer #001. Thank you for being the first business to put it to work."
    : "";
  const today = escapeHtml(input.todayUrl);
  const install = escapeHtml(input.installUrl);
  return {
    subject: "You’re live on Capture Tracker",
    text: `Hi ${input.ownerDisplayName},\n\n${input.businessDisplayName} is ready to run in Capture Tracker.${founding}\n\nToday: ${input.todayUrl}\nInstall Capture Tracker: ${input.installUrl}\n\nDuring the week: capture receipts when needed.\nOnce a week: complete Weekly Review.\nAt month-end: reconcile and close your books.`,
    html: shell(
      `<h1 style="margin:0;font-size:28px">You’re live on Capture Tracker.</h1><p style="line-height:1.6">${escapeHtml(input.businessDisplayName)} is ready to run in Capture Tracker.${escapeHtml(founding)}</p><p><a href="${today}" style="display:inline-block;background:#087e7a;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700">Go to Today</a></p><p><a href="${install}" style="color:#087e7a;font-weight:700">Install Capture Tracker</a></p><p style="line-height:1.7"><strong>During the week:</strong> Capture receipts when needed.<br><strong>Once a week:</strong> Complete Weekly Review.<br><strong>At month-end:</strong> Reconcile and close your books.</p>`,
    ),
  };
}
