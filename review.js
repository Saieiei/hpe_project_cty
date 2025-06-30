const fetch = require('node-fetch');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const pullRequestNumber = process.env.GITHUB_REF.split('/')[2];

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: { fetch },
});

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Fetch PR metadata: title, author, comments, and file diffs
async function getPullRequestData() {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    // Fetch general issue-level comments
    const { data: issueComments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: pullRequestNumber,
    });

    // Fetch inline file-level review comments
    const { data: reviewComments } = await octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    const allComments = [...issueComments, ...reviewComments];

    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    return {
      author: pr.user.login,
      title: pr.title,
      comments: allComments,
      files,
    };
  } catch (error) {
    console.error('Error fetching PR data:', error.message);
    process.exit(1);
  }
}

// Format PR comments for summary
function formatPRComments(comments) {
  if (!comments.length) return 'No public PR comments.';
  return comments.map(c => `**${c.user.login}**: ${c.body}`).join('\n\n');
}

// Fetch similar past changes from recent merged PRs for a file
async function fetchPreviousDiffs(filename) {
  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo,
    state: 'closed',
    per_page: 10,
  });

  const recentMerged = pulls.filter(pr => pr.merged_at && pr.number !== Number(pullRequestNumber));
  const matchingSummaries = [];

  for (const pr of recentMerged) {
    const { data: changedFiles } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });

    const match = changedFiles.find(file => file.filename === filename);
    if (match && match.patch) {
      matchingSummaries.push({
        number: pr.number,
        user: pr.user.login,
        patch: match.patch,
      });
    }

    if (matchingSummaries.length >= 3) break;
  }

  return matchingSummaries;
}

// Construct prompt and query Gemini API
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

    return (
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No review content generated.'
    );
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    process.exit(1);
  }
}

// Post the Gemini-generated review to the PR
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

// Main execution
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

  let fileSummaries = '';

  for (const file of filteredFiles) {
    const prevDiffs = await fetchPreviousDiffs(file.filename);
    const historicalSummary = prevDiffs.length
      ? prevDiffs.map(p => `From PR #${p.number} by @${p.user}:\n\`\`\`diff\n${p.patch}\n\`\`\``).join('\n\n')
      : 'No similar historical changes found.';

    fileSummaries += `### File: \`${file.filename}\`\n\n\`\`\`diff\n${file.patch || ''}\n\`\`\`\n\n**Previous PR Summary**:\n${historicalSummary}\n\n`;
  }

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
