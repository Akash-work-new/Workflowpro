import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
let aiModel: any = null;

if (apiKey) {
  try {
    const ai = new GoogleGenerativeAI(apiKey);
    aiModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Gemini AI Service initialized successfully');
  } catch (error) {
    console.error('Error initializing Gemini Client, falling back to mock engine:', error);
  }
} else {
  console.log('No GEMINI_API_KEY found, running AI Task Assistant on heuristic fallback engine');
}

// 1. Generate Subtasks
export const generateSubtasks = async (title: string, description: string = ''): Promise<string[]> => {
  if (aiModel) {
    try {
      const prompt = `Based on this task title: "${title}" and description: "${description}", generate a checklist of 3 to 6 logical subtasks. Return ONLY a JSON string array of strings, for example: ["Subtask 1", "Subtask 2"]. Do not add markdown formatting or explanations.`;
      const result = await aiModel.generateContent(prompt);
      const text = result.response.text().trim();
      // Remove any surrounding code blocks (e.g. ```json ... ```)
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Gemini generateSubtasks error, falling back:', error);
    }
  }

  // Fallback heuristic generator
  const titleLower = title.toLowerCase();
  if (titleLower.includes('setup') || titleLower.includes('configure') || titleLower.includes('install')) {
    return [
      'Research requirements and compatibility',
      'Initialize configuration files and variables',
      'Deploy service instance locally',
      'Write basic tests and verify integration',
      'Document configuration steps',
    ];
  }
  if (titleLower.includes('ui') || titleLower.includes('frontend') || titleLower.includes('board') || titleLower.includes('page')) {
    return [
      'Review design mockups and layout specs',
      'Create component structures and styling classes',
      'Bind interactive actions and event triggers',
      'Integrate backend API hook services',
      'Validate cross-device responsiveness',
    ];
  }
  if (titleLower.includes('database') || titleLower.includes('api') || titleLower.includes('backend') || titleLower.includes('schema')) {
    return [
      'Draft table schemas and indexing keys',
      'Write database migrations and seed records',
      'Implement Express route handlers and middleware validation',
      'Run unit/integration tests for endpoint queries',
      'Optimise queries and database connection pools',
    ];
  }

  return [
    'Analyze requirements and map dependencies',
    'Execute core implementation blocks',
    'Write verification checks and test validation',
    'Conduct peer review code audit',
    'Deploy to testing environment',
  ];
};

// 2. Estimate Completion Time
export const estimateCompletionTime = async (
  title: string,
  description: string = '',
  priority: string = 'MEDIUM'
): Promise<{ estimatedHours: number; confidence: number }> => {
  if (aiModel) {
    try {
      const prompt = `Estimate the hours required to complete this task: Title: "${title}", Description: "${description}", Priority: "${priority}". Return ONLY a JSON object in this format: {"estimatedHours": 12.5, "confidence": 0.85}.`;
      const result = await aiModel.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error('Gemini estimateCompletionTime error, falling back:', e);
    }
  }

  // Fallback heuristic
  let hours = 8.0;
  let confidence = 0.7;

  const descLength = description.length;
  if (descLength > 200) hours += 6;
  if (descLength > 500) hours += 10;

  if (priority === 'CRITICAL') { hours += 12; confidence = 0.95; }
  else if (priority === 'HIGH') { hours += 8; confidence = 0.85; }
  else if (priority === 'LOW') { hours = Math.max(2.0, hours - 4); confidence = 0.6; }

  if (title.toLowerCase().includes('refactor') || title.toLowerCase().includes('migration')) {
    hours += 16;
  }

  return { estimatedHours: parseFloat(hours.toFixed(1)), confidence };
};

// 3. Predict Delays
export const predictDelays = async (
  taskDetails: { title: string; priority: string; dueDate?: Date | null },
  assigneeWorkloadHours: number
): Promise<{ delayProbability: number; riskLevel: string; reason: string }> => {
  if (aiModel) {
    try {
      const prompt = `Analyze task details: Title: "${taskDetails.title}", Priority: "${taskDetails.priority}", DueDate: "${taskDetails.dueDate || 'none'}". The assignee currently has ${assigneeWorkloadHours} hours of active tasks in their queue. Estimate risk of delay. Return ONLY a JSON object in this format: {"delayProbability": 0.65, "riskLevel": "HIGH", "reason": "Reason details here"}.`;
      const result = await aiModel.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error('Gemini predictDelays error, falling back:', e);
    }
  }

  // Fallback heuristic
  let delayProbability = 0.15;
  let riskLevel = 'LOW';
  let reason = 'Assignee workload is well within threshold limits and timelines are stable.';

  if (assigneeWorkloadHours > 40) {
    delayProbability = 0.85;
    riskLevel = 'CRITICAL';
    reason = `Assignee is heavily over-allocated with ${assigneeWorkloadHours} hours of tasks. High chance of bottlenecking.`;
  } else if (assigneeWorkloadHours > 25) {
    delayProbability = 0.55;
    riskLevel = 'MEDIUM';
    reason = `Assignee workload is elevated (${assigneeWorkloadHours} hours). Mild delay risk if complex scope emerges.`;
  }

  if (taskDetails.dueDate) {
    const daysRemaining = (new Date(taskDetails.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysRemaining < 0) {
      delayProbability = 1.0;
      riskLevel = 'HIGH';
      reason = 'Task dueDate has already passed and work is pending completion.';
    } else if (daysRemaining < 2 && assigneeWorkloadHours > 15) {
      delayProbability = 0.75;
      riskLevel = 'HIGH';
      reason = `Only ${daysRemaining.toFixed(1)} days left before due date, and assignee has multiple active tasks in queue.`;
    }
  }

  return { delayProbability, riskLevel, reason };
};

// 4. Suggest Assignee
export const suggestAssignee = async (
  taskDetails: { title: string; description: string; priority: string },
  candidates: { id: string; name: string; designation: string; activeWorkloadHours: number }[]
): Promise<{ suggestedUserId: string; reason: string }> => {
  if (candidates.length === 0) {
    throw new Error('No candidates available for assignment suggestion');
  }

  if (aiModel) {
    try {
      const prompt = `Based on task title: "${taskDetails.title}", description: "${taskDetails.description}", Priority: "${taskDetails.priority}". We have these candidate users with active workload hours: ${JSON.stringify(candidates)}. Determine the best candidate. Return ONLY a JSON object: {"suggestedUserId": "candidate_id", "reason": "Explanation of choice"}.`;
      const result = await aiModel.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error('Gemini suggestAssignee error, falling back:', e);
    }
  }

  // Fallback heuristic: choose candidate with lowest workload, matching designation keywords if possible
  const taskTitle = taskDetails.title.toLowerCase();
  let bestCandidate = candidates[0];
  let highestScore = -1;

  for (const c of candidates) {
    let score = 100 - c.activeWorkloadHours; // Base score on workload availability
    const des = c.designation.toLowerCase();

    // Check skills alignment
    if (taskTitle.includes('frontend') || taskTitle.includes('ui') || taskTitle.includes('page') || taskTitle.includes('css')) {
      if (des.includes('frontend') || des.includes('designer') || des.includes('react')) score += 50;
    }
    if (taskTitle.includes('backend') || taskTitle.includes('database') || taskTitle.includes('api') || taskTitle.includes('query')) {
      if (des.includes('backend') || des.includes('node') || des.includes('database') || des.includes('db')) score += 50;
    }

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = c;
    }
  }

  return {
    suggestedUserId: bestCandidate.id,
    reason: `${bestCandidate.name} has been selected due to aligned skills (${bestCandidate.designation}) and optimal bandwidth with only ${bestCandidate.activeWorkloadHours} hours currently allocated.`,
  };
};

// 5. Generate Project Summary
export const generateProjectSummary = async (
  projectDetails: { name: string; description: string; status: string },
  tasksDetails: { title: string; status: string; priority: string }[]
): Promise<string> => {
  const completed = tasksDetails.filter((t) => t.status === 'COMPLETED').length;
  const blocked = tasksDetails.filter((t) => t.status === 'BLOCKED').length;
  const total = tasksDetails.length;

  if (aiModel) {
    try {
      const prompt = `Write an executive summary for project: "${projectDetails.name}" (${projectDetails.description}), status: "${projectDetails.status}". Summary of tasks: Total: ${total}, Completed: ${completed}, Blocked: ${blocked}. Keep it professional, structured, under 150 words.`;
      const result = await ioModelGenerate(prompt);
      return result;
    } catch (e) {
      console.error('Gemini projectSummary error, falling back:', e);
    }
  }

  return `### Project Summary: ${projectDetails.name}
The project **${projectDetails.name}** is currently in **${projectDetails.status}** status. 

Out of **${total}** total planned items, **${completed}** tasks have been successfully resolved, representing a **${total > 0 ? Math.round((completed / total) * 100) : 0}%** completion rate. Currently, there are **${blocked}** blocked items requiring immediate management attention. Overall, progress remains aligned with timelines, and team coordination is focused on unblocking high-priority objectives.`;
};

// 6. Generate Weekly Report
export const generateWeeklyReport = async (
  userName: string,
  timeLogs: { durationMinutes: number; description: string; taskTitle: string }[]
): Promise<string> => {
  const totalHours = (timeLogs.reduce((acc, log) => acc + log.durationMinutes, 0) / 60).toFixed(1);

  if (aiModel) {
    try {
      const prompt = `Write a professional weekly work summary report for employee "${userName}". Time logged: ${totalHours} hours. Logged tasks: ${JSON.stringify(timeLogs)}. Keep it structured under 150 words.`;
      const result = await ioModelGenerate(prompt);
      return result;
    } catch (e) {
      console.error('Gemini weeklyReport error, falling back:', e);
    }
  }

  const taskSummaries = timeLogs.map((log) => `- **${log.taskTitle}**: ${log.description} (${(log.durationMinutes / 60).toFixed(1)} hrs)`).slice(0, 5).join('\n');

  return `### Weekly Performance Digest: ${userName}
During this period, **${userName}** logged a total of **${totalHours}** work hours across active sprints. 

**Key Task Highlights:**
${taskSummaries || '- No active tasks logged during this cycle.'}

**Summary Evaluation:**
The logged hours demonstrate consistent productivity, with primary contributions centered on task execution and frontend layouts. Bandwidth management is optimal, and no significant delays were flagged.`;
};

// 7. Generate Performance Review
export const generatePerformanceReview = async (
  stats: { name: string; completed: number; overdue: number; productivity: number; efficiency: number; onTimePercent: number },
  managerFeedback: string = 'Consistent delivery and strong core contributions.'
): Promise<{ rating: number; feedback: string }> => {
  if (aiModel) {
    try {
      const prompt = `Generate a performance scorecard review for employee "${stats.name}". Stats: Tasks Completed: ${stats.completed}, Overdue: ${stats.overdue}, Productivity Rating: ${stats.productivity}, Efficiency Score: ${stats.efficiency}, On-Time Completion Rate: ${stats.onTimePercent}%. Manager notes: "${managerFeedback}". Determine a final rating from 1 to 5 (float) and write a constructive summary under 120 words. Return ONLY a JSON object: {"rating": 4.2, "feedback": "Constructive text here"}.`;
      const result = await aiModel.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error('Gemini performanceReview error, falling back:', e);
    }
  }

  // Fallback heuristic review rating calculation
  let rating = 3.0; // Base rating

  if (stats.onTimePercent > 90) rating += 0.8;
  else if (stats.onTimePercent > 75) rating += 0.4;
  else if (stats.onTimePercent < 50) rating -= 0.5;

  if (stats.efficiency > 90) rating += 0.7;
  else if (stats.efficiency < 50) rating -= 0.5;

  if (stats.overdue > 2) rating -= 0.4;

  rating = Math.max(1.0, Math.min(5.0, parseFloat(rating.toFixed(1))));

  const feedback = `Employee ${stats.name} has completed ${stats.completed} tasks this period with an on-time delivery rate of ${stats.onTimePercent}%. Their productivity and efficiency scorecards are strong, reflecting good task planning and execution. Manager Notes: "${managerFeedback}". Recommendation: Maintain high standard of task detailing and sprint collaboration.`;

  return { rating, feedback };
};

// Local helper to call generic content generation for text briefs
async function ioModelGenerate(prompt: string): Promise<string> {
  const result = await aiModel.generateContent(prompt);
  return result.response.text().trim();
}
