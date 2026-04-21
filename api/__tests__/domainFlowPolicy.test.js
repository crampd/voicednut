const {
  getDomainFlowPolicyDecision,
  applyDomainFlowPolicyDecision,
} = require("../functions/domainFlowPolicy");

describe("domainFlowPolicy", () => {
  test("allows calls with no normalized domain", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "",
        source: "unit_test",
        callSid: "CA_no_domain",
        domainFlowsConfig: {},
      }),
    ).toMatchObject({
      allowed: true,
      shadowMode: false,
      reason: "no_domain",
      bucket: null,
      payload: null,
    });
  });

  test("blocks on kill switch before applying allowlist compatibility", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "tax_support",
        source: "unit_test",
        callSid: "CA_kill_switch",
        domainFlowsConfig: {
          enabled: true,
          killSwitch: true,
          rolloutPercent: 100,
          allowlist: ["profile:tax_support"],
        },
      }),
    ).toMatchObject({
      allowed: false,
      shadowMode: false,
      reason: "kill_switch",
      payload: {
        status: "blocked",
        domain: "tax_support",
        policyReason: "kill_switch",
        shadowMode: false,
      },
    });
  });

  test("allows an explicit profile allowlist entry even when the global flag is disabled", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "tax-support",
        source: "unit_test",
        callSid: "CA_allowlisted",
        domainFlowsConfig: {
          enabled: false,
          rolloutPercent: 0,
          allowlist: ["profile:tax_support"],
        },
      }),
    ).toMatchObject({
      allowed: true,
      shadowMode: false,
      reason: "allowlist",
      allowlisted: true,
      domain: "tax_support",
    });
  });

  test("blocks disabled profiles when shadow mode is not enabled", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "fraud_review",
        source: "unit_test",
        callSid: "CA_disabled",
        domainFlowsConfig: {
          enabled: false,
          shadowMode: false,
          rolloutPercent: 100,
        },
      }),
    ).toMatchObject({
      allowed: false,
      shadowMode: false,
      reason: "disabled",
      payload: {
        status: "blocked",
        domain: "fraud_review",
        policyReason: "disabled",
        shadowMode: false,
      },
    });
  });

  test("allows shadow mode execution even when rollout would otherwise be off", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "collections_servicing",
        source: "unit_test",
        callSid: "CA_shadow_mode",
        domainFlowsConfig: {
          enabled: false,
          shadowMode: true,
          rolloutPercent: 0,
        },
      }),
    ).toMatchObject({
      allowed: true,
      shadowMode: true,
      reason: "shadow_mode",
      domain: "collections_servicing",
    });
  });

  test("blocks enabled profiles with zero rollout percent outside shadow mode", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "bank_servicing",
        source: "unit_test",
        callSid: "CA_rollout_zero",
        domainFlowsConfig: {
          enabled: true,
          shadowMode: false,
          rolloutPercent: 0,
        },
      }),
    ).toMatchObject({
      allowed: false,
      shadowMode: false,
      reason: "rollout_zero",
      payload: {
        status: "blocked",
        domain: "bank_servicing",
        policyReason: "rollout_zero",
        shadowMode: false,
      },
    });
  });

  test("applies per-profile overrides ahead of the global rollout defaults", () => {
    expect(
      getDomainFlowPolicyDecision({
        domain: "fraud-review",
        source: "unit_test",
        callSid: "CA_profile_override",
        domainFlowsConfig: {
          enabled: true,
          shadowMode: false,
          rolloutPercent: 100,
          enabledByProfile: {
            fraud_review: false,
          },
        },
      }),
    ).toMatchObject({
      allowed: false,
      shadowMode: false,
      reason: "disabled",
      domain: "fraud_review",
    });
  });
});

describe("applyDomainFlowPolicyDecision", () => {
  const createDependencies = () => ({
    db: {
      updateCallState: jest.fn(() => Promise.resolve()),
      setCallDisposition: jest.fn(() => Promise.resolve()),
      logServiceHealth: jest.fn(() => Promise.resolve()),
    },
    webhookService: {
      addLiveEvent: jest.fn(),
    },
  });

  test("records blocked side effects and returns the blocked payload", async () => {
    const dependencies = createDependencies();
    const decision = getDomainFlowPolicyDecision({
      domain: "tax_support",
      source: "unit_test",
      callSid: "CA_blocked_effects",
      domainFlowsConfig: {
        enabled: false,
        shadowMode: false,
        rolloutPercent: 100,
      },
    });

    await expect(
      applyDomainFlowPolicyDecision({
        decision,
        callSid: "CA_blocked_effects",
        ...dependencies,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      shadowMode: false,
      reason: "disabled",
      payload: {
        status: "blocked",
        domain: "tax_support",
        policyReason: "disabled",
        shadowMode: false,
      },
    });

    expect(dependencies.db.updateCallState).toHaveBeenCalledWith(
      "CA_blocked_effects",
      "domain_flow_policy_blocked",
      expect.objectContaining({
        domain: "tax_support",
        source: "unit_test",
        reason: "disabled",
      }),
    );
    expect(dependencies.db.setCallDisposition).toHaveBeenCalledWith(
      "CA_blocked_effects",
      "policy_blocked",
      expect.objectContaining({
        domain: "tax_support",
        source: "unit_test",
        reason: "disabled",
      }),
    );
    expect(dependencies.db.logServiceHealth).toHaveBeenCalledWith(
      "domain_flows",
      "blocked",
      expect.objectContaining({
        domain: "tax_support",
        source: "unit_test",
        reason: "disabled",
      }),
    );
    expect(dependencies.webhookService.addLiveEvent).toHaveBeenCalledWith(
      "CA_blocked_effects",
      "🛑 Tax Support flow blocked by rollout policy",
      { force: true },
    );
  });

  test("records shadow mode side effects without creating a blocked disposition", async () => {
    const dependencies = createDependencies();
    const decision = getDomainFlowPolicyDecision({
      domain: "collections_servicing",
      source: "unit_test",
      callSid: "CA_shadow_effects",
      domainFlowsConfig: {
        enabled: false,
        shadowMode: true,
        rolloutPercent: 0,
      },
    });

    await expect(
      applyDomainFlowPolicyDecision({
        decision,
        callSid: "CA_shadow_effects",
        ...dependencies,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      shadowMode: true,
      reason: "shadow_mode",
    });

    expect(dependencies.db.updateCallState).toHaveBeenCalledWith(
      "CA_shadow_effects",
      "domain_flow_shadow_mode",
      expect.objectContaining({
        domain: "collections_servicing",
        source: "unit_test",
        reason: "shadow_mode",
      }),
    );
    expect(dependencies.db.setCallDisposition).not.toHaveBeenCalled();
    expect(dependencies.db.logServiceHealth).toHaveBeenCalledWith(
      "domain_flows",
      "shadow_mode",
      expect.objectContaining({
        domain: "collections_servicing",
        source: "unit_test",
        reason: "shadow_mode",
      }),
    );
    expect(dependencies.webhookService.addLiveEvent).toHaveBeenCalledWith(
      "CA_shadow_effects",
      "👁 Collections Servicing flow running in shadow mode",
      { force: false },
    );
  });

  test("returns immediately for no-domain decisions without side effects", async () => {
    const dependencies = createDependencies();
    const decision = getDomainFlowPolicyDecision({
      domain: "",
      source: "unit_test",
      callSid: "CA_no_domain_effects",
      domainFlowsConfig: {},
    });

    await expect(
      applyDomainFlowPolicyDecision({
        decision,
        callSid: "CA_no_domain_effects",
        ...dependencies,
      }),
    ).resolves.toEqual({
      allowed: true,
      shadowMode: false,
      reason: "no_domain",
      bucket: null,
    });

    expect(dependencies.db.updateCallState).not.toHaveBeenCalled();
    expect(dependencies.db.setCallDisposition).not.toHaveBeenCalled();
    expect(dependencies.db.logServiceHealth).not.toHaveBeenCalled();
    expect(dependencies.webhookService.addLiveEvent).not.toHaveBeenCalled();
  });
});
