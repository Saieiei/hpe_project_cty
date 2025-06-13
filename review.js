const fetch = require('node-fetch');
const axios = require('axios');

// GitHub environment variables
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const pullRequestNumber = process.env.GITHUB_REF.split('/')[2];

// Load Octokit
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: { fetch }
});

// Gemini setup
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Get the diff and PR metadata
async function getPullRequestDiff() {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    const diffUrl = pr.diff_url;
    const { data: diff } = await axios.get(diffUrl);

    return {
      diff,
      author: pr.user.login,
      title: pr.title,
    };
  } catch (error) {
    console.error('Error fetching PR diff:', error.message);
    process.exit(1);
  }
}

// Call Gemini for a code review
async function getGeminiReview(diff, author, title) {
  try {
    const prompt = `You are a professional software engineer reviewing a GitHub pull request.
Analyze the following code changes and provide a review with constructive feedback. Your response should include:
1. **PR Title**: ${title}
2. **Author Name**: ${author}
3. **Strengths**: What was done well in the code
4. **Suggestions for Improvement**: Specific areas where the code can be improved (e.g., readability, performance, structure, security, duplication)
5. **Potential Issues or Bugs**: If any
6. **Final Recommendation**: Approve / Needs changes / Comment only

Here is the diff:\n\n${diff}`;

    const response = await axios.post(
      `${geminiEndpoint}?key=${geminiApiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No feedback generated.';
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    process.exit(1);
  }
}

// Post review comment to PR
async function postReviewComment(review) {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullRequestNumber,
      body: `**Gemini Review**\n\n${review}`,
    });
    console.log('Review posted.');
  } catch (error) {
    console.error('Error posting comment:', error.message);
    process.exit(1);
  }
}

// Main runner
(async () => {
  const { diff, author, title } = await getPullRequestDiff();

  // Filter out non-reviewable files
  const excludePatterns = ['**/*.json', '**/*.md'];
  const diffLines = diff.split('\n');
  const filteredDiff = diffLines
    .filter(line => {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      if (match) {
        const filePath = match[1];
        return !excludePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
          return regex.test(filePath);
        });
      }
      return true;
    })
    .join('\n');

  if (!filteredDiff.trim()) {
    console.log('No reviewable code after filtering.');
    return;
  }

  const review = await getGeminiReview(filteredDiff, author, title);
  await postReviewComment(review);
})();
