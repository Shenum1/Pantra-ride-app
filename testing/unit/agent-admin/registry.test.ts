import { describe, expect, it } from "vitest";
import { AGENT_TOOLS, getToolDefinitions } from "@/backend/agent-admin/registry";

const definitions = getToolDefinitions();

describe("agent tool registry", () => {
  it("exposes every registered tool exactly once", () => {
    const names = definitions.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(AGENT_TOOLS.length);
  });

  it.each(definitions.map((d) => [d.name, d] as const))("%s has a specific description", (_name, def) => {
    expect(def.description.length).toBeGreaterThan(60);
  });

  it.each(definitions.map((d) => [d.name, d] as const))("%s describes and types every property", (_name, def) => {
    const schema = def.input_schema as { type: string; properties?: Record<string, any>; additionalProperties?: boolean };
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
      expect(propSchema.description, `${def.name}.${prop} has no description`).toBeTruthy();
      expect(propSchema.type ?? propSchema.enum ?? propSchema.anyOf, `${def.name}.${prop} has no type`).toBeTruthy();
    }
  });

  it("requires a rationale on every write tool and never on read tools", () => {
    for (const def of definitions) {
      const required = ((def.input_schema as any).required ?? []) as string[];
      expect(required.includes("rationale")).toBe(def.requires_approval);
    }
  });

  it("never lets the agent attest that no provider transfer was sent", () => {
    const def = definitions.find((d) => d.name === "complete_payout_manually")!;
    expect((def.input_schema as any).properties).not.toHaveProperty("confirmedNoProviderTransfer");
  });

  it("never asks the agent for the row id of single-row pricing configs", () => {
    for (const name of ["update_commission_rate", "update_priority_fee", "update_surge_config", "update_waiting_charge", "update_cancellation_fee"]) {
      const def = definitions.find((d) => d.name === name)!;
      expect((def.input_schema as any).properties).not.toHaveProperty("id");
    }
  });
});
