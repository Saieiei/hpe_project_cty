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

// Get the diff from the PR
async function getPullRequestDiff() {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    const diffUrl = pr.diff_url;
    const { data: diff } = await axios.get(diffUrl);
    return diff;
  } catch (error) {
    console.error('Error fetching PR diff:', error.message);
    process.exit(1);
  }
}

// Call Gemini for a code review
async function getGeminiReview(diff) {
  try {
    const prompt = `Summarize the following GitHub pull request in a professional tone. Provide:
1. **PR Title**
2. **Author Name**
3. **Key Comments** (e.g., what triggered the change, any duplication/conflict mentioned)
4. **Diff Summary** (list files and lines changed)
5. **Final Summary** (concise explanation of what was fixed or introduced)\n\n${diff}`;
    const response = await axios.post(
      `${geminiEndpoint}?key=${geminiApiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
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
  const diff = await getPullRequestDiff();

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

  const review = await getGeminiReview(filteredDiff);
  await postReviewComment(review);
})();
