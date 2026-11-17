import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import * as policy from "@convex/services/policy";

const id = (s: string) => s as Id<"users">;
const alice = { _id: id("alice"), role: "user" as const };
const bob = { _id: id("bob"), role: "user" as const };
const admin = { _id: id("admin"), role: "admin" as const };

const aliceTool = { ownerId: alice._id, removedAt: undefined };
const removedTool = { ownerId: alice._id, removedAt: 1 };
const request = { ownerId: alice._id, borrowerId: bob._id };

describe("policy", () => {
  it("only owners edit listings; admins do not edit others' listings", () => {
    expect(policy.canEditTool(alice, aliceTool)).toBe(true);
    expect(policy.canEditTool(bob, aliceTool)).toBe(false);
    expect(policy.canEditTool(admin, aliceTool)).toBe(false);
  });

  it("only admins remove any listing", () => {
    expect(policy.canRemoveAnyTool(admin)).toBe(true);
    expect(policy.canRemoveAnyTool(alice)).toBe(false);
  });

  it("users cannot borrow their own or removed tools", () => {
    expect(policy.canRequestTool(bob, aliceTool)).toBe(true);
    expect(policy.canRequestTool(alice, aliceTool)).toBe(false);
    expect(policy.canRequestTool(bob, removedTool)).toBe(false);
  });

  it("only the tool owner decides; only the borrower cancels", () => {
    expect(policy.canDecideRequest(alice, request)).toBe(true);
    expect(policy.canDecideRequest(bob, request)).toBe(false);
    expect(policy.canDecideRequest(admin, request)).toBe(false);
    expect(policy.canCancelRequest(bob, request)).toBe(true);
    expect(policy.canCancelRequest(alice, request)).toBe(false);
  });

  it("parties and admins can view a request; others cannot", () => {
    expect(policy.canViewRequest(alice, request)).toBe(true);
    expect(policy.canViewRequest(bob, request)).toBe(true);
    expect(policy.canViewRequest(admin, request)).toBe(true);
    expect(policy.canViewRequest({ _id: id("carol"), role: "user" }, request)).toBe(false);
  });

  it("admin-only capabilities", () => {
    expect(policy.canViewAllLoans(admin)).toBe(true);
    expect(policy.canViewAllLoans(alice)).toBe(false);
    expect(policy.canSetTrustedLender(admin)).toBe(true);
    expect(policy.canSetTrustedLender(alice)).toBe(false);
  });
});
