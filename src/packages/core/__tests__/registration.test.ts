import { describe, expect, test } from "bun:test";
import {
  ActionRequiredError,
  ConfigurationError,
} from "../errors.ts";
import {
  createCustomerRegistry,
  registerCustomerModel,
  resolveClientReferenceId,
  resolveOwnerOrThrow,
} from "../registration.ts";

describe("registerCustomerModel", () => {
  test("uses first registration as default by default", () => {
    const registry = createCustomerRegistry();

    const userRegistration = registerCustomerModel(registry, {
      modelName: "User",
      resolveOwner: (record: { account: { id: string } }) => record.account,
    });

    registerCustomerModel(registry, {
      modelName: "Team",
      resolveOwner: (record: { ownerId: string }) => ({ id: record.ownerId }),
    });

    expect(userRegistration.isDefault).toBe(true);
    expect(registry.getDefault()?.modelName).toBe("User");
    expect(registry.list().length).toBe(2);
  });

  test("fails when multiple defaults are registered", () => {
    const registry = createCustomerRegistry();

    registerCustomerModel(registry, {
      modelName: "User",
      resolveOwner: (record: { id: string }) => record,
      isDefault: true,
    });

    expect(() =>
      registerCustomerModel(registry, {
        modelName: "Team",
        resolveOwner: (record: { id: string }) => record,
        isDefault: true,
      }),
    ).toThrow(ConfigurationError);
  });
});

describe("owner resolution and client reference safety", () => {
  test("throws when owner resolution returns null", () => {
    expect(() =>
      resolveOwnerOrThrow(
        {
          modelName: "User",
          resolveOwner: () => null,
        },
        { id: "missing" },
      ),
    ).toThrow(ActionRequiredError);
  });

  test("normalizes client reference ids", () => {
    const reference = resolveClientReferenceId(
      {
        getClientReferenceId: (record: { id: number }) => record.id,
      },
      { id: 42 },
    );

    expect(reference).toBe("42");
  });

  test("rejects unsafe client reference ids", () => {
    expect(() =>
      resolveClientReferenceId(
        {
          getClientReferenceId: () => ({ not: "serializable" }),
        },
        {},
      ),
    ).toThrow(ConfigurationError);
  });
});
