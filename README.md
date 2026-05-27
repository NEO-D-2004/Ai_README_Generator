# AI README Generator

[![VS Code Extension](https://img.shields.io/badge/VS_Code-Extension-blue.svg?logo=visual-studio-code)](https://code.visualstudio.com/)
[![NVIDIA AI](https://img.shields.io/badge/Powered%20By-NVIDIA%20AI-green.svg)](https://build.nvidia.com/)
[![React](https://img.shields.io/badge/UI-React%20%2B%20Webview-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg?logo=vite)](https://vitejs.dev/)

An enterprise-grade VS Code extension that automatically scans your codebase, analyzes its structure, and uses state-of-the-art NVIDIA-hosted open-source LLMs (like Llama 3.3 and Nemotron) to generate beautiful, comprehensive, and professional `README.md` files.

Featuring an interactive, VS Code-themed sidebar Webview UI, the extension provides workspace diagnostics, section-by-section customization, and a targeted **Section Editor** that lets you regenerate single parts of your documentation on-the-fly.

---

## Key Features

- **🔍 Smart Workspace Analysis**: Parses languages, package managers, dependency trees, environment configuration files (`.env.example`), Docker configs, CI/CD scripts, and git remotes.
- **⚡ NVIDIA NIM Integration**: Leverages NVIDIA's high-speed API platform for low-latency Markdown generation using advanced open-source models like `meta/llama-3.3-70b-instruct`.
- **🎨 Native VS Code Theme Integration**: Styled using CSS variables (`--vscode-*`), adapting perfectly to dark, light, or high-contrast themes.
- **🛠️ Section Checklist & Custom Prompts**: Toggle specific sections (Installation, Usage, Folder Structure, API, FAQ, etc.) and supply custom markdown rules or styling guidelines.
- **📝 Live Markdown Preview**: Render and read your generated README live using `markdown-it`, or switch to **Raw** text edit mode.
- **🔄 Targeted Section Regeneration**: Highlight or select individual sections, supply direct prompts (e.g. "Add database migration steps"), and let the LLM rebuild just that section without touching the rest of your README.
- **📁 Project Explorer Dashboard**: A split-pane dashboard that dynamically renders collapsible recursive Tree Views (left) and Data Tables (right) from JSON or XML files.
- **🔐 Secure Key Storage**: Uses VS Code's native `SecretStorage` to save your NVIDIA API key securely.

---

## Tech Stack

- **Extension Framework**: VS Code Extension API
- **Language**: TypeScript
- **Frontend UI**: React
- **Build Tools**: Vite (for React Webview) & Esbuild (for Extension Host)
- **AI Requests**: Axios (pointing to NVIDIA's completions endpoint)
- **Markdown Rendering**: `markdown-it`
- **File System Parsing**: Node `fs/promises` & `path` APIs
- **XML Parsing**: `xml2js` (translates XML tree nodes and rows to JSON)
- **Icons**: `lucide-react`

---

## Project Structure

```
Ai_README_Generator/
├── .vscode/
│   ├── launch.json            # Run Extension configuration profile
│   └── tasks.json             # Compiles extension & webview in sync
├── data/
│   ├── sample-data.json       # Baseline JSON explorer data
│   └── sample-data.xml        # Baseline XML explorer data
├── media/
│   └── icon.svg               # Extension sidebar logo
├── out/                       # Compiled assets (bundled via esbuild and Vite)
│   ├── extension.js           # Extension host bundle
│   └── webview/               # Compiled React app
│       ├── index.html
│       └── assets/
│           ├── index.js
│           └── index.css
├── src/                       # Extension backend
│   ├── analyzer.ts            # Workspace scanning and metadata extraction
│   ├── extension.ts           # Activates commands and registers Webview
│   ├── generator.ts           # Queries NVIDIA NIM completions API
│   └── webviewPanel.ts        # Orchestrates IPC bridge, JSON/XML parses & SecretStorage
├── webview-ui/                # React Webview client code
│   ├── src/
│   │   ├── App.tsx            # Main UI state, panels, and tabs
│   │   ├── index.css          # Glassmorphic, responsive stylesheets
│   │   └── main.tsx           # Mounting script
│   ├── index.html
│   ├── tsconfig.json
│   └── vite.config.ts         # Maps outDir to parent output folder
├── package.json               # Extension manifest
├── tsconfig.json              # Extension backend compiler options
└── esbuild.js                 # Bundler for extension backend
```

---

## Configuration Settings

You can customize the extension via VS Code settings (`ctrl+,` or `cmd+,`):

| Setting | Type | Default Value | Description |
|---|---|---|---|
| `aiReadmeGenerator.defaultModel` | `string` | `meta/llama-3.3-70b-instruct` | The default NVIDIA NIM model identifier. |
| `aiReadmeGenerator.temperature` | `number` | `0.5` | Sampling temperature. Higher values mean more creative outputs. |
| `aiReadmeGenerator.maxTokens` | `integer` | `4096` | Maximum token length for generated outputs. |

---

## Installation & Setup

### Prerequisites
- [Node.js (v18.0.0+)](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/)
- An NVIDIA API Key. Register and obtain one for free at the [NVIDIA API Catalog](https://build.nvidia.com/).

### Installation
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/your-username/Ai_README_Generator.git
   cd Ai_README_Generator
   ```
2. Install dependencies for both the extension and the webview UI:
   ```bash
   npm install
   ```

---

## Development & Testing

1. **Build the extension**:
   Compile the extension host and build the React app assets in one command:
   ```bash
   npm run build-all
   ```
2. **Debug in VS Code**:
   - Open this directory in VS Code.
   - Press `F5` (or go to **Run & Debug** and click **Run Extension**).
   - A new **Extension Development Host** window will open with the extension loaded.
3. **Run the Extension**:
   - In the debug window, click the **AI README** icon in the sidebar Activity Bar.
   - Enter your NVIDIA API key, click **Save**, and start generating!

---

## Usage Guide

1. **Scan Workspace**: When you open the extension panel in a project, it automatically performs a framework, language, and folder tree scan. Click **Rescan Workspace** at any time to refresh the metrics.
2. **Configure Settings**:
   - Choose a model (e.g., Llama 3.3 70B, Llama 3.1 8B, or Nemotron).
   - Adjust generation temperature and token constraints.
   - Toggle options for badges and diagrams.
3. **Select Sections**: Check or uncheck sections in the **README Sections** checklist to include only the items you want.
4. **Generate README**: Click **Generate README.md**. The live progress loader will show generation status.
5. **Review & Edit**:
   - **Preview**: View the parsed markdown rendered in real-time.
   - **Raw**: Edit the raw markdown text block directly.
   - **Section Editor**: Select an isolated section (e.g., *Installation*), write a instruction (e.g. *"add yarn global install instruction"*), and click **Regenerate Section**. The editor will query the AI and replace only that section in your draft.
6. **Save**: Click the **Save** button in the tab bar. This writes the completed `README.md` to your workspace root and automatically opens it in your editor.
7. **Explorer Dashboard**: Click the *Explorer Dashboard* tab in the webview. Toggle between the dropdown formats (`sample-data.json` / `sample-data.xml`) to see the recursive Tree View (collapsible directories, folder/file icons) and the corresponding file statistics Data Table. Click **Refresh** to reload the files if they are modified.

---

## License

This project is licensed under the [MIT License](LICENSE).
