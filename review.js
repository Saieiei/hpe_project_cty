const fetch = require('node-fetch');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');

// Extract GitHub environment variables
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const pullRequestNumber = process.env.GITHUB_REF.split('/')[2];

// Authenticate with GitHub
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  request: { fetch }
});

// Gemini configuration
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Fetch PR diff and metadata
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
    console.error('❌ Error fetching PR diff:', error.message);
    process.exit(1);
  }
}

// Query Gemini for a review summary
async function getGeminiReview(diff, author, title, numFilesChanged) {
  try {
    const prompt = `You are a professional software engineer and reviewer assisting in summarizing a GitHub Pull Request.

Analyze the following code diff and generate a structured review report using GitHub-flavored markdown in this format:

---

## 📝 PR Summary

**Title**: ${title}  
**Author**: ${author}  
**Total Files Changed**: ${numFilesChanged}

---

## 🔍 File-wise Breakdown

For each file, provide:

### 📄 File: \`<filename>\`

- **Code Summary**: What changes were made.
- **Comment Summary** _(if present)_: What was said in comments by any contributors along with their name and their relevance.
- **Recommendations**: Suggestions for improvements, optimizations, or flagging issues.

---

Use clear sections per file and be concise yet technical.

### 🔧 Here's the code diff:
\`\`\`diff
${diff}
\`\`\`
`;

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

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ No feedback generated.';
  } catch (error) {
    console.error('❌ Error calling Gemini API:', error.message);
    process.exit(1);
  }
}

// Post the review as a comment on the PR
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
    console.error('❌ Error posting comment:', error.message);
    process.exit(1);
  }
}

// Main function
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

  const review = await getGeminiReview(filteredDiff, author, title, numFilesChanged);
  await postReviewComment(review);
})();
