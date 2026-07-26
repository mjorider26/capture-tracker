import { readFileSync } from "node:fs";
import pg from "pg";

const { Client } = pg;

function readDatabaseUrl() {
  const explicitUrl = process.env.DATABASE_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const envText = readFileSync(".env", "utf8");

  const line = envText
    .split(/\r?\n/)
    .find((value) => value.trim().startsWith("DATABASE_URL="));

  if (!line) {
    throw new Error("DATABASE_URL was not found in .env");
  }

  let value = line.substring(line.indexOf("=") + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

const expectedTriggers = [
  "transaction_split_sum_matches_total",
  "parent_transaction_split_state_is_valid",
  "reimbursement_expense_sum_matches_claim_total",
  "reimbursement_claim_total_matches_expenses",
  "journal_lines_balance_parent_entry",
  "parent_journal_entry_balance_valid",
  "journal_entry_period_is_valid",
  "reconciliation_item_account_matches",
  "accounting_period_dates_cover_entries",
  "reconciliation_account_matches_existing_items",
  "transaction_account_matches_reconciliations",
];

const expectedConstraints = [
  "transaction_amount_positive",
  "transaction_split_amount_positive",
  "weekly_review_date_order",
  "payroll_period_date_order",
  "payroll_amounts_nonnegative",
  "payroll_run_net_pay_consistent",
  "quarterly_tax_estimate_quarter_range",
  "quarterly_tax_estimate_revision_positive",
  "quarterly_tax_amounts_nonnegative",
  "tax_payment_quarter_range",
  "tax_payment_amount_positive",
  "reimbursement_claim_total_nonnegative",
  "reimbursement_expense_amount_positive",
  "reimbursement_mileage_fields_consistent",
  "approval_decision_exactly_one_target",
  "audit_actor_type_consistent",
  "ledger_account_code_not_blank",
  "ledger_account_name_not_blank",
  "accounting_period_date_order",
  "journal_line_one_sided_amount",
  "journal_line_number_positive",
  "posting_rule_accounts_differ",
  "reconciliation_statement_date_order",
  "TransactionDocument_unlink_integrity",
  "DocumentExtractionCandidate_confidence_range",
  "DocumentExtractionCandidate_review_integrity",
];

const expectedFunctions = [
  "assert_transaction_splits_sum_to_total",
  "assert_parent_transaction_split_state",
  "assert_reimbursement_expenses_sum_to_claim_total",
  "assert_reimbursement_claim_total_matches_expenses",
  "assert_journal_entry_balanced",
  "assert_parent_journal_entry_balanced",
  "assert_journal_entry_period_valid",
  "assert_reconciliation_item_account_matches",
  "validate_transaction_split_state",
  "validate_reimbursement_claim_expense_total",
  "validate_journal_entry_balance",
  "assert_accounting_period_dates_cover_entries",
  "assert_reconciliation_account_matches_existing_items",
  "assert_transaction_account_matches_reconciliations",
];

function report(label, expected, rows) {
  const found = new Set(rows.map((row) => row.name));
  const missing = expected.filter((name) => !found.has(name));

  console.log(
    `${label}: ${expected.length - missing.length}/${expected.length}`,
  );

  if (missing.length > 0) {
    console.error(`Missing ${label.toLowerCase()}:`);
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
  }

  return missing;
}

async function main() {
  const databaseUrl = new URL(readDatabaseUrl());

  const client = new Client({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.replace(/^\//, ""),
    ssl: false,
  });

  await client.connect();

  try {
    const triggers = await client.query(
      `
        SELECT trigger.tgname AS name
        FROM pg_trigger AS trigger
        JOIN pg_class AS table_info
          ON table_info.oid = trigger.tgrelid
        JOIN pg_namespace AS namespace
          ON namespace.oid = table_info.relnamespace
        WHERE namespace.nspname = 'public'
          AND trigger.tgisinternal = false
          AND trigger.tgname = ANY($1::text[])
        ORDER BY trigger.tgname
      `,
      [expectedTriggers],
    );

    const constraints = await client.query(
      `
        SELECT constraint_info.conname AS name
        FROM pg_constraint AS constraint_info
        JOIN pg_namespace AS namespace
          ON namespace.oid = constraint_info.connamespace
        WHERE namespace.nspname = 'public'
          AND constraint_info.conname = ANY($1::text[])
        ORDER BY constraint_info.conname
      `,
      [expectedConstraints],
    );

    const functions = await client.query(
      `
        SELECT procedure_info.proname AS name
        FROM pg_proc AS procedure_info
        JOIN pg_namespace AS namespace
          ON namespace.oid = procedure_info.pronamespace
        WHERE namespace.nspname = 'public'
          AND procedure_info.proname = ANY($1::text[])
        ORDER BY procedure_info.proname
      `,
      [expectedFunctions],
    );

    const missing = [
      ...report("Triggers", expectedTriggers, triggers.rows),
      ...report("Constraints", expectedConstraints, constraints.rows),
      ...report("Functions", expectedFunctions, functions.rows),
    ];

    if (missing.length > 0) {
      console.error("\nDATABASE INTEGRITY VERIFICATION FAILED");
      process.exitCode = 1;
      return;
    }

    console.log("\nDATABASE INTEGRITY VERIFIED");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\nVerification error:");
  console.error(error);
  process.exitCode = 1;
});
