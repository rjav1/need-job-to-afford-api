import { AIResponseRequest, UserProfile, Settings } from './types';
import { storage } from './storage';
import { generateTemplateResponse } from './common-questions';

// Generate AI response for open-ended questions
export async function generateAIResponse(request: AIResponseRequest): Promise<string> {
  const settings = await storage.getSettings();
  const apiKey = await storage.getApiKey();

  // Try template-based response first (no AI needed)
  const templateResponse = generateTemplateResponse(
    request.question,
    request.userProfile,
    request.companyName,
    request.jobTitle
  );

  // TEST MODE: Format for Discord and return placeholder
  if ((settings as any).testMode) {
    const discordMessage = formatForDiscord(request);
    // Return a special response that the UI will handle
    throw new TestModeError(discordMessage, templateResponse);
  }

  // If no API key or "noAI" mode, use template or return placeholder
  if (!apiKey || (settings as any).noAiMode) {
    if (templateResponse) {
      return templateResponse;
    }
    throw new Error('No API key configured and no template available for this question. Please add your API key in settings or answer manually.');
  }

  // If we have a template and preferTemplates is enabled, use it
  if (templateResponse && settings.preferTemplates) {
    return templateResponse;
  }
  
  const prompt = buildPrompt(request);

  try {
    if (settings.aiProvider === 'anthropic') {
      return await callAnthropic(apiKey, prompt);
    } else {
      return await callOpenAI(apiKey, prompt);
    }
  } catch (error) {
    // Fallback to template if AI fails
    if (templateResponse) {
      console.log('[AI Job Applier] AI failed, using template fallback');
      return templateResponse;
    }
    throw error;
  }
}

// Custom error for test mode
export class TestModeError extends Error {
  discordMessage: string;
  templateFallback: string | null;
  
  constructor(discordMessage: string, templateFallback: string | null) {
    super('Test mode - check Discord');
    this.discordMessage = discordMessage;
    this.templateFallback = templateFallback;
  }
}

// Format request for Discord
function formatForDiscord(request: AIResponseRequest): string {
  const skills = request.userProfile.skills.slice(0, 5).join(', ');
  const project = request.userProfile.projects[0];
  
  return `**🤖 AI Job Applier Request**

**Question:** ${request.question}

**Company:** ${request.companyName || 'Unknown'}
**Role:** ${request.jobTitle || 'Unknown'}

**Applicant Context:**
- Major: ${request.userProfile.major || 'N/A'}
- University: ${request.userProfile.university || 'N/A'}
- Skills: ${skills || 'N/A'}
${project ? `- Project: ${project.name} - ${project.description.slice(0, 100)}...` : ''}

@ronald please generate a response for this application question!`;
}

function buildPrompt(request: AIResponseRequest): string {
  const { question, companyName, jobTitle, userProfile, maxLength } = request;
  
  const projectsText = userProfile.projects
    .map(p => `- ${p.name}: ${p.description} (Technologies: ${p.technologies.join(', ')})`)
    .join('\n');

  return `You are helping someone write a job application response. Be professional, enthusiastic, and specific.

APPLICANT BACKGROUND:
- Name: ${userProfile.firstName} ${userProfile.lastName}
- Education: ${userProfile.degree} in ${userProfile.major} from ${userProfile.university}
- Skills: ${userProfile.skills.join(', ')}
- Projects:
${projectsText}

JOB DETAILS:
- Company: ${companyName}
- Position: ${jobTitle}

QUESTION TO ANSWER:
"${question}"

INSTRUCTIONS:
- Write a compelling, personalized response
- Reference specific skills or projects that are relevant
- Show genuine interest in ${companyName}
- Keep it concise but impactful
${maxLength ? `- Maximum ${maxLength} characters` : '- Keep it to 3-4 sentences'}

Write the response directly, no preamble:`;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Anthropic API error');
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

// Common question patterns and their types
export function detectQuestionType(question: string): string {
  const q = question.toLowerCase();
  
  if (q.includes('why') && (q.includes('company') || q.includes('work here') || q.includes('join'))) {
    return 'why_company';
  }
  if (q.includes('tell') && q.includes('yourself')) {
    return 'about_yourself';
  }
  if (q.includes('project') || q.includes('challenge') || q.includes('difficult')) {
    return 'project_experience';
  }
  if (q.includes('strength') || q.includes('weakness')) {
    return 'strengths_weaknesses';
  }
  if (q.includes('why') && (q.includes('role') || q.includes('position') || q.includes('job'))) {
    return 'why_role';
  }
  if (q.includes('where') && (q.includes('5 years') || q.includes('future') || q.includes('career'))) {
    return 'career_goals';
  }
  
  return 'general';
}
