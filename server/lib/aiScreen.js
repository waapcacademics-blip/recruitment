// AI reading aid for HR reviewing the essay/case study — deliberately NOT a
// score, grade, or recommendation. It only describes what's factually present
// (does it address the prompt's requirements, how substantial is it, any
// generic/off-topic red flags) so a human reviewer can read faster. It never
// gates progression or feeds into any pass/fail — only the human shortlist
// decision does that. See DEPLOY.md / README for the legal context on why
// this stays advisory-only.

const MODEL = 'claude-haiku-4-5-20251001';

function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM_PROMPT = `You are helping a school's HR team read a job candidate's written response faster. You are NOT making a hiring decision, NOT scoring the response, and NOT allowed to recommend advancing or rejecting the candidate. Describe only what is factually observable in the text: whether it addresses the prompt's stated requirements, its apparent depth of effort, and any notable red flags (generic/templated language that could apply to any employer, being off-topic, being far under the expected length, or seeming incomplete relative to what was asked).

Respond with ONLY a JSON object matching this exact shape, no other text:
{
  "addressesAllRequirements": true or false,
  "missingElements": ["short phrase describing each unaddressed requirement, empty array if none"],
  "depthAssessment": one of "substantial" | "moderate" | "thin" | "generic_or_off_topic",
  "notableStrengths": ["short factual observations, empty array if none stand out"],
  "notableConcerns": ["short factual observations, empty array if none"],
  "summary": "one or two plain-language sentences for a busy reviewer, describing what's there — not whether it's good enough"
}`;

async function screenLongform({ label, promptText, minWords, responseText }) {
  if (!aiConfigured()) return null;

  const userMessage = `Prompt given to the candidate (${label}, minimum ${minWords} words):\n"""\n${promptText}\n"""\n\nCandidate's submitted response:\n"""\n${responseText}\n"""`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = (data.content || []).map((b) => b.text || '').join('').trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('Could not parse AI response as JSON: ' + raw.slice(0, 300));
  }
}

module.exports = { aiConfigured, screenLongform };
