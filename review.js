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

// Fetch PR metadata, file-level diffs, and comments
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

    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    return {
      author: pr.user.login,
      title: pr.title,
      comments,
      files,
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

// Prepare Gemini prompt using per-file structured patch data
async function getGeminiReview(fileSummaries, author, title, numFilesChanged, commentBlock) {
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

${fileSummaries}

## Public PR Comments

${commentBlock}`;

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
  const { author, title, comments, files } = await getPullRequestData();

  const excludeExtensions = ['.json', '.md'];
  const filteredFiles = files.filter(file =>
    !excludeExtensions.some(ext => file.filename.endsWith(ext))
  );

  if (filteredFiles.length === 0) {
    console.log('No reviewable code after filtering.');
    return;
  }

  const fileSummaries = filteredFiles
    .map(file => {
      return `### File: \`${file.filename}\`

\`\`\`diff
${file.patch || ''}
\`\`\``;
    })
    .join('\n\n');

  const numFilesChanged = filteredFiles.length;
  const formattedComments = formatPRComments(comments);

  const review = await getGeminiReview(
    fileSummaries,
    author,
    title,
    numFilesChanged,
    formattedComments
  );

  await postReviewComment(review);
})();
