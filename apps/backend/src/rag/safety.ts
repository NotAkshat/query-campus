/**
 * Questions that ask for something harmful get a short, clear refusal. It is decided before any search
 * or AI call, so it is instant, costs no quota, and does not depend on what the model decides to do.
 */
const SCOPE = 'I can only answer questions about IET DAVV, such as admissions, fees, faculty and timetables.';

const HARMFUL = [
  // making weapons or explosives
  /\b(make|making|build|building|create|creating|assemble|construct|manufacture|prepare|synthesi[sz]e)\b[^.?!]{0,40}\b(bomb|explosive|explosives|grenade|ied|detonator|landmine|gun|firearm|weapon|weapons|poison|nerve agent|napalm|meth|methamphetamine)\b/i,
  /\b(bomb|explosive|explosives|grenade|detonator|poison)\b[^.?!]{0,30}\b(recipe|instructions|tutorial|steps|ingredients|at home|diy)\b/i,
  // hurting people
  /\bhow\s+(to|can i|do i)\s+(kill|murder|hurt|harm|stab|shoot|attack|poison)\b/i,
  /\b(plan|planning)\b[^.?!]{0,30}\b(attack|shooting|bombing|murder)\b/i,
];

const SELF_HARM = [/\b(kill myself|end my life|commit suicide|suicide method|want to die|hurt myself|self[- ]harm)\b/i];

export function unsafeReply(question: string): string | null {
  if (SELF_HARM.some((re) => re.test(question))) {
    return `I'm really sorry you are feeling this way. I can't help with this here, but please talk to someone you trust, such as a family member, a friend or a teacher, or contact a local helpline. You do not have to deal with it alone. ${SCOPE}`;
  }
  if (HARMFUL.some((re) => re.test(question))) {
    return `I can't help with that. ${SCOPE}`;
  }
  return null;
}
