# LLVM KNOWLEDGE MINER

<div align="center">

[![Node.js Version](https://img.shields.io/badge/Node.js-18.x-brightgreen?logo=node.js)](https://nodejs.org/)
[![Gemini API](https://img.shields.io/badge/LLM-Gemini%201.5%20Flash-orange?logo=google)](https://ai.google.dev/)
[![PR Reviewer Bot](https://img.shields.io/badge/Bot-PR%20Review%20Bot-success)](https://github.com/Nandees13/hpe_project)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/Nandees13/hpe_project/main.yml?label=CI&logo=githubactions)](https://github.com/Nandees13/hpe_project/actions)

</div>

## 📚 Table of Contents

- [📖 About The Project](#-about-the-project)
- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🛠 Built With](#-built-with)
- [📚 Example Output](#-example-output)
- [🚀 Getting Started](#-getting-started)
  - [📌 Prerequisites](#-prerequisites)
  - [🔧 Installation](#-installation)
- [⚙️ Usage](#️-usage)
- [🧩 Folder Structure](#-folder-structure)
- [🔎 Some Heads Up of the Project](#-some-heads-up-of-the-project)

## 📖 About The Project

  **LLVM Knowledge Miner** is a GitHub-integrated automation system that enhances pull request (PR) reviews using **Gemini 1.5 Flash**, enabling intelligent, file-wise analysis of code diffs, PR comments, and historical PR activity.

This project is designed for maintainers and reviewers of large codebases like LLVM to streamline review cycles with structured summaries, improvement suggestions, and consistent markdown-based reports – all powered by LLMs and GitHub Actions.

## ✨ Features

- 🧠 Context-aware **code summarization** using Gemini 1.5 Flash
- 💬 Real-time **comment summarization** and contributor recognition 
- 📜 Retrieval of **historical file-level changes** across prior PRs
- ⚙️ Zero-maintenance CI/CD integration with GitHub Actions
- 📝 Modular architecture with Node.js, Octokit, and Axios 
- 📂 File-level breakdown with recommendations

## 🛠️ Tech Stack

  | Technology     | Role                         |
  |----------------|------------------------------|
  | **Node.js**    | Script runtime               |
  | **Octokit**    | GitHub REST API integration  |
  | **Axios**      | HTTP client for Gemini API   |
  | **GitHub Actions** | CI/CD for triggering workflow |
  | **Gemini 1.5 Flash** | LLM inference for review generation |

## 🛠 Built With

- [Node.js](https://nodejs.org/)
- [Octokit (GitHub REST API)](https://github.com/octokit/rest.js/)
- [Axios](https://axios-http.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Gemini 1.5 Flash API](https://ai.google.dev/gemini-api/docs/api-key?authuser=1#set-api-env-var)

---

### 📚 Example Output

![Sample Output of the Reviewer Bot](https://github.com/user-attachments/assets/c57ac9c6-998e-4e47-bd1f-e742cf4cedb0)

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
  | `GEMINI_API_KEY` |     Your Gemini 1.5 Flash API key         |

---

## ⚙️ **Usage**

- Whenever a pull request is opened or updated, the following pipeline runs automatically:

<div align="center">

### Workflow Overview

**GitHub PR Trigger**  
  ↓  
**GitHub Actions Workflow**  
  ↓  
**review.js** (Node.js + Octokit + Axios)  
  ↓  
**Pull Request Metadata Collection**  
  ↓  
**Historical PR Diff Retrieval**  
  ↓  
**Structured Prompt Generation**  
  ↓  
**Gemini 1.5 Flash Inference**  
  ↓  
**Markdown Review Generation & Posting**

</div>


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

### 🔎 Some Heads Up of the Project

<div align="center"> 

 [![Open Issues](https://img.shields.io/github/issues/Nandees13/hpe_project?color=blueviolet)](https://github.com/Nandees13/hpe_project/issues)
[![Closed PRs](https://img.shields.io/github/issues-pr-closed/Nandees13/hpe_project?color=success)](https://github.com/Nandees13/hpe_project/pulls?q=is%3Apr+is%3Aclosed)
[![Last Commit](https://img.shields.io/github/last-commit/Nandees13/hpe_project?color=yellow)](https://github.com/Nandees13/hpe_project/commits)
[![Top Language](https://img.shields.io/github/languages/top/Nandees13/hpe_project?color=critical)](https://github.com/Nandees13/hpe_project)
[![Stars](https://img.shields.io/github/stars/Nandees13/hpe_project?style=social)](https://github.com/Nandees13/hpe_project/stargazers)
[![Forks](https://img.shields.io/github/forks/Nandees13/hpe_project?style=social)](https://github.com/Nandees13/hpe_project/network/members) </div>

<div align="center"> ![Top Languages](https://github-readme-stats.vercel.app/api/top-langs/?username=Nandees13&repo=hpe_project&layout=compact) </div>
