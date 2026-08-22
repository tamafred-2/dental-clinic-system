export type AiSafetyRisk =
  'CLINICAL_ADVICE' | 'URGENT_MEDICAL' | 'PATIENT_RECORD' | 'PROMPT_INJECTION';

export type AiSafetyAssessment = {
  risk: AiSafetyRisk;
  reason: string;
};

const rules: Array<{ risk: AiSafetyRisk; reason: string; patterns: RegExp[] }> =
  [
    {
      risk: 'PROMPT_INJECTION',
      reason: 'Prompt-injection attempt.',
      patterns: [
        /ignore\s+(?:all\s+)?previous\s+instructions/i,
        /reveal\s+(?:your\s+)?(?:system|developer)\s+prompt/i,
        /show\s+(?:me\s+)?(?:your\s+)?hidden\s+instructions/i,
        /act\s+as\s+(?:a\s+)?(?:dentist|doctor)/i,
      ],
    },
    {
      risk: 'URGENT_MEDICAL',
      reason: 'Potentially urgent or emergency medical concern.',
      patterns: [
        /(?:severe|unbearable|excruciating)\s+(?:tooth|dental|mouth|jaw)?\s* pain/i,
        /(?:heavy|uncontrolled)\s+bleeding/i,
        /(?:trouble|difficulty)\s+breathing/i,
        /swelling\s+(?:of\s+the\s+)?(?:face|throat|neck)/i,
        /(?:knocked|broken|lost)\s+(?:out\s+)?tooth/i,
        /emergency|urgent\s+help/i,
      ],
    },
    {
      risk: 'PATIENT_RECORD',
      reason: 'Patient-record or sensitive personal information request.',
      patterns: [
        /(?:show|give|send|tell)\s+me\s+(?:my|the\s+patient's?)\s+(?:records?|medical history|x[- ]?rays?)/i,
        /access\s+(?:my|the\s+patient's?)\s+(?:record|chart|file)/i,
        /(?:patient|medical)\s+record/i,
      ],
    },
    {
      risk: 'CLINICAL_ADVICE',
      reason: 'Clinical diagnosis, treatment, or medication request.',
      patterns: [
        /(?:do\s+i\s+have|can\s+you\s+diagnose|is\s+this)\s+(?:an?\s+)?(?:infection|cavity|abscess|gum disease)/i,
        /should\s+i\s+(?:take|use)\s+(?:antibiotics?|medicine|painkillers?)/i,
        /what\s+(?:medicine|medication|treatment)\s+should\s+i\s+(?:take|get)/i,
        /do\s+i\s+need\s+(?:an?\s+)?(?:extraction|root canal|filling)/i,
        /what\s+treatment\s+should\s+i\s+get/i,
        /interpret\s+(?:my\s+)?(?:x[- ]?ray|symptoms?)/i,
      ],
    },
  ];

export function assessAiSafety(message: string): AiSafetyAssessment | null {
  const normalized = message.trim();
  if (!normalized) return null;
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return { risk: rule.risk, reason: rule.reason };
    }
  }
  return null;
}
