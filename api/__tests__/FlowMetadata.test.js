const {
  buildObjectiveTagsForFlow,
  getCallScriptFlowTypes,
  getEffectiveObjectiveTags,
  normalizeCallScriptFlowType,
} = require("../functions/FlowMetadata");

describe("FlowMetadata", () => {
  test("normalizes the new domain flow aliases to canonical flow types", () => {
    expect(normalizeCallScriptFlowType("tax-support-service")).toBe("tax_support");
    expect(normalizeCallScriptFlowType("fraud_review_support")).toBe("fraud_review");
    expect(normalizeCallScriptFlowType("identity-verification-plus-flow")).toBe(
      "identity_verification_plus",
    );
  });

  test("derives new domain flows from objective tags and default profile fallback", () => {
    expect(
      getCallScriptFlowTypes({
        objective_tags: ["collections_servicing_support"],
      }),
    ).toEqual(["collections_servicing"]);

    expect(
      getCallScriptFlowTypes({
        default_profile: "identity-verification-plus",
      }),
    ).toEqual(["identity_verification_plus"]);
  });

  test("keeps canonical domain objective tags stable when building effective tags", () => {
    expect(
      buildObjectiveTagsForFlow("bank-servicing", ["customer_requested_callback"]),
    ).toEqual(["customer_requested_callback", "bank_servicing_support"]);

    expect(
      getEffectiveObjectiveTags({
        flow_type: "bank-servicing",
        objective_tags: ["customer_requested_callback", "bank_servicing_support"],
      }),
    ).toEqual(["customer_requested_callback", "bank_servicing_support"]);
  });
});
