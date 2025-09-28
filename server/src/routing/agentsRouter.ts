import type { AgentKey } from '../utils/prompts';

export type RouteInput = {
  message: string;
};

const RX = {
  coding: /\b(code|typescript|python|bug|stacktrace|compile|sdk|api|lambda|cloudwatch|iam|docker|k8s|sql|regex|performance|refactor|unit test)\b/i,
  security: /\b(sec|security|xss|csrf|oauth|jwt|encryption|kms|secrets|vuln|cve|threat|pentest|attack)\b/i,
  travel: /\b(travel|hotel|flight|itinerary|visa|trip|tour|city|restaurant|attraction)\b/i,
};

export class AgentRouter {
  static route(input: RouteInput): AgentKey {
    const text = `${input.message}`.toLowerCase();

    if (RX.security.test(text)) return 'security';
    if (RX.coding.test(text))   return 'coding';
    if (RX.travel.test(text))   return 'travel';

    return 'general';
  }
}
