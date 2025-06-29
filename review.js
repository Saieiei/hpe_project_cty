// Required dependencies
const fetch = require('node-fetch'); // Used by Octokit for HTTP requests
const axios = require('axios'); // Used for making Gemini API requests
const { Octokit } = require('@octokit/rest'); // GitHub REST API wrapper

// Extract repository owner and name from GitHub Actions environment variable
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

// Extract PR number from GitHub reference (e.g., refs/pull/123/merge → 123)
const pullRequestNumber = process.env.GITHUB_REF.split('/')[2];

// Initialize Octokit client with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: { fetch },
});

// Gemini API configuration
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Fetch PR metadata: author, title, comments, and file diffs
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
    process.exit(1); // Exit if metadata fetch fails
  }
}

// Format PR comments into a readable Markdown block
function formatPRComments(comments) {
  if (!comments.length) return 'No public PR comments.';
  return comments.map(c => `**${c.user.login}**: ${c.body}`).join('\n\n');
}

// Fetch past diffs from recently merged PRs that touched the same filename
async function fetchPreviousDiffs(filename) {
  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: 'closed',
    per_page: 10,
  });

  // Filter only merged PRs, excluding the current one
  const recentMerged = pulls.filter(pr => pr.merged_at && pr.number !== Number(pullRequestNumber));

  const matchingSummaries = [];

  for (const pr of recentMerged) {
    const { data: changedFiles } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    // Check if the current file exists in the previous PR
    const match = changedFiles.find(file => file.filename === filename);
    if (match && match.patch) {
      matchingSummaries.push({
        number: pr.number,
        user: pr.user.login,
        patch: match.patch,
      });
    }

    // Limit to top 3 matching historical patches
    if (matchingSummaries.length >= 3) break;
  }

  return matchingSummaries;
}

// Build prompt and send to Gemini API for review generation
async function getGeminiReview(fileSummaries, author, title, numFilesChanged, commentBlock) {
  const prompt = `You are a senior software engineer helping review a GitHub Pull Request.

Write a structured, paragraph-style review using GitHub-flavored markdown with the following format:

## PR Summary

**Title**: ${title}  
**Author**: ${author}  
**Total Files Changed**: ${numFilesChanged}

For each file, structure the review in the following order:

### **File: \`<filename>\`**

- Code Summary: Describe the key code changes in that file.
- Comment Summary: If any PR-level comments are related to this file, summarize them and include the commenter names.
- Previous PR Summary: Summarize past PR changes on this file, if available. Mention PR number and contributor.
- Recommendations: Suggest improvements or flag concerns if needed.

Use paragraph format for each section and write professionally.

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

    // Return generated review content
    return (
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No review content generated.'
    );
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    process.exit(1); // Exit if Gemini call fails
  }
}

// Post the review as a comment on the PR
async function postReviewComment(review) {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullRequestNumber,
      body: `### **LLVM KNOWLEDGE MINER - Review**\n\n${review}`,
    });
    console.log('Review posted successfully.');
  } catch (error) {
    console.error('Error posting review comment:', error.message);
    process.exit(1);
  }
}

// Main execution block
(async () => {
  const { author, title, comments, files } = await getPullRequestData();

  // Filter out non-reviewable files (e.g., JSON, Markdown)
  const excludeExtensions = ['.json', '.md'];
  const filteredFiles = files.filter(file =>
    !excludeExtensions.some(ext => file.filename.endsWith(ext))
  );

  // Skip review if no valid files remain
  if (filteredFiles.length === 0) {
    console.log('No reviewable code after filtering.');
    return;
  }

  let fileSummaries = '';

  // Loop over each file and include current patch + history
  for (const file of filteredFiles) {
    const prevDiffs = await fetchPreviousDiffs(file.filename);
    const historicalSummary = prevDiffs.length
      ? prevDiffs.map(p => `From PR #${p.number} by @${p.user}:\n\`\`\`diff\n${p.patch}\n\`\`\``).join('\n\n')
      : 'No similar historical changes found.';

    fileSummaries += `### File: \`${file.filename}\`\n\n\`\`\`diff\n${file.patch || ''}\n\`\`\`\n\n**Previous PR Summary**:\n${historicalSummary}\n\n`;
  }

  const numFilesChanged = filteredFiles.length;
  const formattedComments = formatPRComments(comments);

  // Generate structured review
  const review = await getGeminiReview(
    fileSummaries,
    author,
    title,
    numFilesChanged,
    formattedComments
  );

  // Post the generated review on the PR
  await postReviewComment(review);
})();
