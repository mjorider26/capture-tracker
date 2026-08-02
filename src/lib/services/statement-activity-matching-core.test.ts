import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStatementActivityCandidates, isEligibleStatementTransaction, statementMatchSchema } from "./statement-activity-matching-core";
const money=(value:string)=>({toFixed:()=>value}); const day=new Date("2026-08-01T12:00:00.000Z");
const activity={id:"activity-1",activityDate:day,description:"Office supplies",reference:"REF-1",amount:money("25.00"),direction:"OUTFLOW",status:"UNMATCHED",version:1};
const transaction=(overrides:Record<string,unknown>={})=>({id:"tx-1",postedAt:day,description:"Office supplies",merchantName:null,sourceReference:null,amount:money("25.00"),direction:"OUTFLOW",status:"APPROVED",version:1,correctionOfId:null,hasCorrections:false,reversed:false,alreadyMatched:false,rejected:false,...overrides});
describe("statement activity candidate generation",()=>{
  it("returns the exact amount, direction, scoped eligible candidate",()=>expect(buildStatementActivityCandidates(activity,[transaction()]).map(x=>x.transaction.id)).toEqual(["tx-1"]));
  it("excludes incompatible amount, direction, already matched, reversed, superseded, and rejected records",()=>{
    expect(buildStatementActivityCandidates(activity,[transaction({amount:money("26.00")}),transaction({direction:"INFLOW"}),transaction({alreadyMatched:true}),transaction({reversed:true}),transaction({hasCorrections:true}),transaction({rejected:true})])).toEqual([]);
  });
  it("keeps matching explicit and rejects malformed optimistic versions",()=>{
    expect(isEligibleStatementTransaction({...activity,status:"MATCHED"},transaction())).toBe(false);
    expect(statementMatchSchema.safeParse({statementActivityId:"activity-1",transactionId:"tx-1",expectedActivityVersion:"1",expectedTransactionVersion:"1",expectedReconciliationVersion:"1"}).success).toBe(true);
    expect(statementMatchSchema.safeParse({statementActivityId:"activity-1",transactionId:"tx-1",expectedActivityVersion:"0",expectedTransactionVersion:"1",expectedReconciliationVersion:"1"}).success).toBe(false);
  });
  it("orders closer and more similar candidates deterministically",()=>{
    const later=transaction({id:"tx-2",postedAt:new Date("2026-08-04T12:00:00.000Z"),description:"Other"});
    expect(buildStatementActivityCandidates(activity,[later,transaction()]).map(x=>x.transaction.id)).toEqual(["tx-1","tx-2"]);
  });
  it("uses a distinct, PostgreSQL-safe migration index name",()=>{
    const migration=readFileSync(resolve(process.cwd(),"prisma/migrations/20260802100000_statement_activity_matching/migration.sql"),"utf8");
    expect(migration).toContain('CREATE INDEX "StatementActivityCandidateDecision_lookup_idx"');
    expect("StatementActivityCandidateDecision_lookup_idx".length).toBeLessThanOrEqual(63);
  });
});
