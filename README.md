## 📖 About The Project

  **LLVM Knowledge Miner** is a GitHub-integrated automation system that enhances pull request (PR) reviews using **Gemini 1.5 Flash**, enabling intelligent, file-wise analysis of code diffs, PR comments, and historical PR activity.

This project is designed for maintainers and reviewers of large codebases like LLVM to streamline review cycles with structured summaries, improvement suggestions, and consistent markdown-based reports – all powered by LLMs and GitHub Actions.

---

### ✨ Features

- 🧠 Context-aware **code summarization** using Gemini 1.5 Flash
- 💬 Real-time **comment summarization** and contributor recognition 
- 📜 Retrieval of **historical file-level changes** across prior PRs
- ⚙️ Zero-maintenance CI/CD integration with GitHub Actions
- 📝 Modular architecture with Node.js, Octokit, and Axios 
- 📂 File-level breakdown with recommendations


## 🛠 Built With

- [Node.js](https://nodejs.org/)
- [Octokit (GitHub REST API)](https://github.com/octokit/rest.js/)
- [Axios](https://axios-http.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Gemini 1.5 Flash API](https://ai.google.dev/gemini-api/docs/api-key?authuser=1#set-api-env-var)

---



## 🚀 Getting Started

### 📌 Prerequisites
  - A GitHub account
  - Node.js installed
  - Gemini API key from Google AI Studio

---

### 🔧 Installation

1. **Fork this repository**

2. **Clone the repo**
   ```bash
   git clone https://github.com/<your-username>/llvm-knowledge-miner.git
   cd llvm-knowledge-miner

3. **Install dependencies**
     ```bash
    npm install
4. **Set secrets in GitHub repository:**

    Navigate to your repo → Settings → Secrets and variables → Actions → New repository secret

Add:

  | Secret Name      | Description                               |
  | ---------------- | ----------------------------------------- |
  | `GITHUB_TOKEN`   | Auto-injected by GitHub for Actions usage |
  | `GEMINI_API_KEY` | Your Gemini 1.5 Flash API key             |

5. **Ensure project structure**
```   
llvm-knowledge-miner/
├── .github/
│   └── workflows/
│       └── main.yml           # GitHub PR trigger
├── review.js                  # Review engine
├── package.json               # Dependencies
└── README.md                  # This file
```

---

## ⚙️ **Usage**

- Whenever a pull request is opened or updated, the following pipeline runs automatically:

  📌 GitHub PR Trigger  →  ⚙️ GitHub Actions Workflow  →  🧠 review.js (Node.js + Octokit + Axios) →  📥 PR Metadata Collection  →  🕘 Historical PR Diff Retrieval  →  📝 Structured Prompt Generation  →  🔮 Gemini 1.5 Flash Inference  →  🗒️ Markdown Review Generation & Posting

- To test manually:
  ```bash
    node review.js
   ```
---

## 🧩 **Folder Structure**
```
📁 llvm-knowledge-miner
├── 📁 .github
│   └── 📁 workflows
│       └── main.yml          # GitHub workflow file
├── review.js                 # Review orchestration logic
├── package.json              # NPM dependencies
└── README.md                 # Project documentation
```


