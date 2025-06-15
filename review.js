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

// Get review comments with user info
async function getPullRequestComments() {
  try {
    const comments = await octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullRequestNumber,
      per_page: 100,
    });

    if (!comments.data.length) return '';

    return comments.data.map(comment => {
      return `**${comment.user.login}** on \`${comment.path}\`:\n> ${comment.body}`;
    }).join('\n\n');
  } catch (error) {
    console.error('Error fetching PR comments:', error.message);
    return '';
  }
}

// Call Gemini for a code review
async function getGeminiReview(diff, author, title, comments, numFilesChanged) {
  const commentsSection = comments
    ? `## 💬 Review Comments from Developers\n\n${comments}\n\n---\n`
    : '';

  const prompt = `
You are an expert software engineer tasked with reviewing a pull request using the following details.

---

## 📝 PR Summary

**Title**: ${title}  
**Author**: ${author}  
**Files Changed**: ${numFilesChanged}

---

${commentsSection}## 🔍 Code Changes (Diff)

\`\`\`diff
${diff}
\`\`\`

---

### ✅ Instructions:
1. Summarize the PR based on the diff ${comments ? 'and the developer comments' : ''}.
2. Give structured feedback for each file.
3. Use GitHub Markdown for formatting.
4. Make it easy for reviewers to quickly understand impact and suggestions.
`;

  try {
    const response = await axios.post(
      `${geminiEndpoint}?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ No feedback generated.';
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
      body: `### 🤖 Gemini AI Review Report\n\n${review}`,
    });
    console.log('✅ Review posted successfully.');
  } catch (error) {
    console.error('Error posting comment:', error.message);
    process.exit(1);
  }
}

// Main runner
(async () => {
  const { diff, author, title } = await getPullRequestDiff();
  const comments = await getPullRequestComments();

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
    console.log('⚠️ No reviewable code after filtering.');
    return;
  }

  // Count changed files
  const changedFiles = new Set();
  filteredDiff.split('\n').forEach(line => {
    const match = line.match(/^diff --git a\/(.+?) b\/.+$/);
    if (match) changedFiles.add(match[1]);
  });
  const numFilesChanged = changedFiles.size;

  const review = await getGeminiReview(filteredDiff, author, title, comments, numFilesChanged);
  await postReviewComment(review);
})();
