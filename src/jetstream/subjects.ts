export const SUBJECT_PREFIX = 'org';

export interface SubjectParts {
  orgId: string;
  service: string;
  entity: string;
  action: string;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

// Builds org.<orgId>.<service>.<entity>.<action> — the tenant leads so per-tenant permissions and replay stay possible
export function subjectFor({ orgId, service, entity, action }: SubjectParts): string {
  // A dot would add a token and a wildcard would widen the subject — either way the message publishes
  // fine and then matches no consumer, which is far harder to find than a rejected publish
  for (const [name, token] of Object.entries({ orgId, service, entity, action })) {
    if (!TOKEN_PATTERN.test(token)) {
      throw new Error(`Invalid ${name} "${token}" — subject tokens allow letters, digits, dashes and underscores`);
    }
  }
  return [SUBJECT_PREFIX, orgId, service, entity, action].join('.');
}

// Reads the org a subject belongs to, or null when it is not one of ours
export function orgIdFromSubject(subject: string): string | null {
  const [prefix, orgId] = subject.split('.');
  return prefix === SUBJECT_PREFIX && orgId ? orgId : null;
}

// Builds a consumer's filter subject, wildcarding every token it did not name
export function filterSubject(parts: Partial<SubjectParts>): string {
  return [SUBJECT_PREFIX, parts.orgId ?? '*', parts.service ?? '*', parts.entity ?? '*', parts.action ?? '*'].join('.');
}
