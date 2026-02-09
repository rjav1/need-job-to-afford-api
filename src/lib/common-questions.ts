import { UserProfile } from './types';

// Pre-built templates for common application questions
// These can work WITHOUT AI if user has filled in their profile

export interface QuestionTemplate {
  patterns: RegExp[];
  generate: (profile: UserProfile, companyName?: string, jobTitle?: string) => string;
}

export const COMMON_QUESTIONS: QuestionTemplate[] = [
  // Why this company?
  {
    patterns: [
      /why.*(this company|work here|join us|interested in.*company)/i,
      /what attracts you to/i,
      /why do you want to work/i,
    ],
    generate: (profile, company, job) => {
      const skills = profile.skills.slice(0, 3).join(', ');
      return `I'm excited about the opportunity at ${company || 'your company'} because it aligns perfectly with my background in ${profile.major || 'technology'}. With experience in ${skills || 'software development'}, I'm eager to contribute to innovative projects and grow alongside a talented team. The ${job || 'role'} particularly interests me as it would allow me to apply my skills while learning from industry leaders.`;
    }
  },
  
  // Tell us about yourself
  {
    patterns: [
      /tell us about yourself/i,
      /describe yourself/i,
      /introduce yourself/i,
      /who are you/i,
    ],
    generate: (profile) => {
      const skills = profile.skills.slice(0, 4).join(', ');
      const project = profile.projects[0];
      let response = `I'm a ${profile.major || 'Computer Science'} student at ${profile.university || 'university'}, expected to graduate ${profile.graduationDate || 'soon'}. I have strong experience in ${skills || 'programming and software development'}.`;
      if (project) {
        response += ` Recently, I worked on ${project.name}, where I ${project.description.slice(0, 100)}...`;
      }
      return response;
    }
  },
  
  // Describe a project
  {
    patterns: [
      /describe.*(project|work|experience)/i,
      /tell us about a project/i,
      /challenging project/i,
      /proud of/i,
      /accomplishment/i,
    ],
    generate: (profile) => {
      const project = profile.projects[0];
      if (project) {
        const tech = project.technologies.join(', ');
        return `One project I'm particularly proud of is ${project.name}. ${project.description} I used ${tech || 'various technologies'} to build this solution. ${project.highlights[0] || 'This project taught me valuable lessons about software development and problem-solving.'}`;
      }
      return `During my studies at ${profile.university || 'university'}, I've worked on several projects applying ${profile.skills.slice(0, 3).join(', ') || 'my technical skills'}. I enjoy tackling complex problems and building solutions that make a real impact.`;
    }
  },
  
  // Why this role/position?
  {
    patterns: [
      /why.*(this role|this position|interested in.*role)/i,
      /what interests you about this/i,
    ],
    generate: (profile, company, job) => {
      const skills = profile.skills.slice(0, 3).join(', ');
      return `The ${job || 'position'} excites me because it combines my passion for ${profile.major || 'technology'} with practical application. My experience with ${skills || 'relevant technologies'} has prepared me well for this role. I'm eager to contribute my skills while continuing to learn and grow in a professional environment.`;
    }
  },
  
  // Strengths
  {
    patterns: [
      /strength/i,
      /what are you good at/i,
      /best qualities/i,
    ],
    generate: (profile) => {
      const skills = profile.skills.slice(0, 2).join(' and ');
      return `My key strengths include strong problem-solving abilities, proficiency in ${skills || 'technical skills'}, and excellent collaboration skills. I'm a quick learner who adapts well to new technologies and enjoys working in team environments to deliver quality results.`;
    }
  },
  
  // Weaknesses
  {
    patterns: [
      /weakness/i,
      /area.*(improve|development)/i,
      /challenge.*overcome/i,
    ],
    generate: () => {
      return `I sometimes focus too much on details, wanting to perfect every aspect of my work. I've learned to balance this by setting clear milestones and priorities, ensuring I deliver quality work while meeting deadlines. This attention to detail has actually become valuable in catching bugs and improving code quality.`;
    }
  },
  
  // Career goals / Where do you see yourself
  {
    patterns: [
      /where.*see yourself/i,
      /career goal/i,
      /5 years/i,
      /future/i,
      /long.?term/i,
    ],
    generate: (profile, company) => {
      return `In the next few years, I aim to grow into a senior technical role where I can both contribute to impactful projects and mentor others. I'm excited about ${company ? `opportunities at ${company}` : 'this opportunity'} because it aligns with my goal of working on meaningful ${profile.major?.toLowerCase().includes('data') ? 'data-driven' : 'software'} solutions while continuously developing my skills.`;
    }
  },
  
  // Availability / Start date
  {
    patterns: [
      /when can you start/i,
      /availability/i,
      /start date/i,
      /earliest.*start/i,
    ],
    generate: (profile) => {
      if (profile.graduationDate) {
        return `I am available to start after my graduation in ${profile.graduationDate}. I'm flexible and excited to begin as soon as possible.`;
      }
      return `I am available to start immediately and am flexible with the start date based on your team's needs.`;
    }
  },
  
  // Relocation
  {
    patterns: [
      /willing to relocate/i,
      /relocation/i,
      /work location/i,
    ],
    generate: () => {
      return `Yes, I am open to relocation for the right opportunity. I'm excited about new experiences and adapting to new environments.`;
    }
  },
];

// Find matching template for a question
export function findMatchingTemplate(question: string): QuestionTemplate | null {
  for (const template of COMMON_QUESTIONS) {
    for (const pattern of template.patterns) {
      if (pattern.test(question)) {
        return template;
      }
    }
  }
  return null;
}

// Generate response using template (no AI needed)
export function generateTemplateResponse(
  question: string,
  profile: UserProfile,
  companyName?: string,
  jobTitle?: string
): string | null {
  const template = findMatchingTemplate(question);
  if (template) {
    return template.generate(profile, companyName, jobTitle);
  }
  return null;
}
