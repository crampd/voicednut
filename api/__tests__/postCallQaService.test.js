const {
  evaluatePostCallQuality,
  normalizePostCallQaConfig,
  resolveCallProfile,
} = require("../services/postCallQaService");

const SCORABLE_TRANSCRIPT = [
  { speaker: "user", message: "I need help with a tax notice. What happens next?" },
  { speaker: "ai", message: "I understand. I can review the notice details and confirm the next step." },
  { speaker: "user", message: "Can you send me the checklist?" },
  { speaker: "ai", message: "Yes, please confirm the best delivery method and I will note a follow up." },
  { speaker: "user", message: "Email is fine." },
  { speaker: "ai", message: "Thank you. The case is scheduled for review. Have a good day." },
];

describe("postCallQaService", () => {
  test("resolves the new domain profiles from direct and nested aliases", () => {
    expect(resolveCallProfile({ flow_type: "tax-support-service" })).toBe("tax_support");

    expect(
      resolveCallProfile({
        business_context: JSON.stringify({ profile: "fraud-review-support" }),
      }),
    ).toBe("fraud_review");

    expect(
      resolveCallProfile({
        ai_analysis: JSON.stringify({
          adaptation: {
            businessContext: {
              conversation_profile: "identity-verification-plus",
            },
          },
        }),
      }),
    ).toBe("identity_verification_plus");
  });

  test("normalizes threshold aliases for the new domain profiles", () => {
    const config = normalizePostCallQaConfig({
      profileThresholds: {
        "tax-support-service": 81,
        fraud_review_support: 90,
        "identity-verification-plus": 88,
      },
    });

    expect(config.profileThresholds.tax_support).toBe(81);
    expect(config.profileThresholds.fraud_review).toBe(90);
    expect(config.profileThresholds.identity_verification_plus).toBe(88);
  });

  test("uses the new domain profile threshold during quality evaluation", () => {
    const report = evaluatePostCallQuality({
      callSid: "CA_test_tax_resolution",
      call: {
        business_context: JSON.stringify({
          profile: "tax-resolution-service",
        }),
      },
      transcripts: SCORABLE_TRANSCRIPT,
      config: {
        enabled: true,
        shadowMode: true,
        minTurns: 4,
      },
    });

    expect(report.status).toBe("scored");
    expect(report.profile).toBe("tax_resolution");
    expect(report.metrics.threshold_score).toBe(78);
    expect(typeof report.score).toBe("number");
  });
});
