const fetch = require('node-fetch');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');

// Extract repo and PR number
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const pullRequestNumber = process.env.GITHUB_REF.split('/')[2];

// Set up Octokit and Gemini API
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: { fetch },
});
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Fetch PR metadata, diff, and comments
async function getPullRequestData() {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: pullRequestNumber,
    });

    const diffUrl = pr.diff_url;
    const { data: diff } = await axios.get(diffUrl);

    return {
      diff,
      author: pr.user.login,
      title: pr.title,
      comments,
    };
  } catch (error) {
    console.error('Error fetching PR data:', error.message);
    process.exit(1);
  }
}

// Format public PR comments into markdown
function formatPRComments(comments) {
  if (!comments.length) return 'No public PR comments.';
  return comments.map(c => `**${c.user.login}**: ${c.body}`).join('\n\n');
}

// Prepare Gemini prompt for paragraph-based review
async function getGeminiReview(diff, author, title, numFilesChanged, commentBlock) {
  const prompt = `You are a senior software engineer helping review a GitHub Pull Request.

Write a structured, paragraph-style review using GitHub-flavored markdown with the following format:

## PR Summary

**Title**: ${title}  
**Author**: ${author}  
**Total Files Changed**: ${numFilesChanged}

For each file:

### File: \`<filename>\`

- Code Summary: Describe the key code changes in that file.
- Comment Summary: If any PR-level comments are related to this file, summarize them and include the commenter names.
- Recommendations: Suggest improvements or flag concerns if needed.

Use clear headings, give as points instead of para, avoid tables, and keep the writing technical and concise.

## Public PR Comments

${commentBlock}
`;

  try {
    const response = await axios.post(
      `${geminiEndpoint}?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return (
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No review content generated.'
    );
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    process.exit(1);
  }
}

// Post review to the PR
async function postReviewComment(review) {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullRequestNumber,
      body: `## Gemini AI Review Report\n\n${review}`,
    });
    console.log('Review posted successfully.');
  } catch (error) {
    console.error('Error posting review comment:', error.message);
    process.exit(1);
  }
}

// Main function
(async () => {
  const { diff, author, title, comments } = await getPullRequestData();

  // Filter out non-code files
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

  // Count number of changed files
  const changedFiles = new Set();
  filteredDiff.split('\n').forEach(line => {
    const match = line.match(/^diff --git a\/(.+?) b\/.+$/);
    if (match) changedFiles.add(match[1]);
  });

  const numFilesChanged = changedFiles.size;
  const formattedComments = formatPRComments(comments);

  const review = await getGeminiReview(
    filteredDiff,
    author,
    title,
    numFilesChanged,
    formattedComments
  );

  await postReviewComment(review);
})();
