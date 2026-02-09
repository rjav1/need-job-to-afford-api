// Discord-based AI for testing
// Routes AI requests through Discord where Ronald (OpenClaw) responds

const DISCORD_WEBHOOK_URL = ''; // Will be set by user in settings
const DISCORD_CHANNEL_ID = '1466617247878479964'; // #public channel for testing

export interface DiscordAIRequest {
  question: string;
  companyName: string;
  jobTitle: string;
  resumeSummary: string;
  skills: string[];
  requestId: string;
}

// For testing: just return a placeholder that tells user to check Discord
export async function requestViaDiscord(request: DiscordAIRequest): Promise<string> {
  // In a real implementation, this would:
  // 1. Post to Discord webhook with the question
  // 2. Poll for Ronald's response
  // 3. Return the response
  
  // For now, return instructions
  return `[Discord AI Mode] Question sent to Ronald for: "${request.question.slice(0, 50)}..."
  
Check Discord #public channel for the AI-generated response, then paste it here.

Company: ${request.companyName}
Role: ${request.jobTitle}`;
}

// Generate a request ID for tracking
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
