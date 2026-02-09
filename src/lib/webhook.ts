// Webhook notification for successful job applications
import { DEFAULT_WEBHOOK_URL } from './types';

export interface WebhookPayload {
  jobTitle: string;
  company: string;
  url: string;
  fieldsFilledCount: number;
  totalFields: number;
  timestamp: string;
  status: 'success' | 'partial' | 'error';
  errorMessage?: string;
}

/**
 * Extract job info from the current page
 */
export function extractJobInfo(): { jobTitle: string; company: string } {
  const info = { jobTitle: '', company: '' };
  
  // LinkedIn
  if (window.location.hostname.includes('linkedin.com')) {
    info.company = document.querySelector('.jobs-unified-top-card__company-name')?.textContent?.trim() || 
                   document.querySelector('.topcard__org-name-link')?.textContent?.trim() || '';
    info.jobTitle = document.querySelector('.jobs-unified-top-card__job-title')?.textContent?.trim() ||
                 document.querySelector('.topcard__title')?.textContent?.trim() || '';
  }
  
  // Greenhouse
  if (window.location.hostname.includes('greenhouse.io')) {
    info.company = document.querySelector('.company-name')?.textContent?.trim() ||
                   document.querySelector('[class*="company"]')?.textContent?.trim() || '';
    info.jobTitle = document.querySelector('.app-title')?.textContent?.trim() ||
                 document.querySelector('h1')?.textContent?.trim() || '';
  }
  
  // Lever
  if (window.location.hostname.includes('lever.co')) {
    const headline = document.querySelector('.posting-headline h2')?.textContent?.trim() || '';
    info.company = headline;
    info.jobTitle = headline;
  }
  
  // Workday
  if (window.location.hostname.includes('workday.com') || window.location.hostname.includes('myworkdayjobs.com')) {
    info.jobTitle = document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
                 document.querySelector('h1')?.textContent?.trim() || '';
  }
  
  // Fallback - try to get from page title
  if (!info.jobTitle && document.title) {
    info.jobTitle = document.title.split(' - ')[0].split(' | ')[0].trim();
  }
  
  return info;
}

/**
 * Send a Discord webhook notification for a job application fill
 */
export async function sendWebhookNotification(
  payload: WebhookPayload,
  webhookUrl?: string
): Promise<boolean> {
  const url = webhookUrl || DEFAULT_WEBHOOK_URL;
  
  try {
    // Build Discord embed
    const statusEmoji = payload.status === 'success' ? '✅' : payload.status === 'partial' ? '⚠️' : '❌';
    const statusColor = payload.status === 'success' ? 0x10b981 : payload.status === 'partial' ? 0xf59e0b : 0xef4444;
    
    const embed = {
      title: `${statusEmoji} Job Application Auto-Filled`,
      color: statusColor,
      fields: [
        {
          name: '💼 Job Title',
          value: payload.jobTitle || 'Unknown',
          inline: true,
        },
        {
          name: '🏢 Company',
          value: payload.company || 'Unknown',
          inline: true,
        },
        {
          name: '📝 Fields Filled',
          value: `${payload.fieldsFilledCount} / ${payload.totalFields}`,
          inline: true,
        },
        {
          name: '🔗 Application URL',
          value: payload.url.length > 100 
            ? `[Open Application](${payload.url})` 
            : payload.url || 'N/A',
          inline: false,
        },
      ],
      timestamp: payload.timestamp,
      footer: {
        text: 'AI Job Applier Extension',
      },
    };

    // Add error message if any
    if (payload.errorMessage) {
      embed.fields.push({
        name: '⚠️ Issues',
        value: payload.errorMessage.slice(0, 200),
        inline: false,
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error('[AI Job Applier] Webhook failed:', response.status, await response.text());
      return false;
    }

    console.log('[AI Job Applier] Webhook notification sent successfully');
    return true;
  } catch (error) {
    console.error('[AI Job Applier] Webhook error:', error);
    return false;
  }
}
