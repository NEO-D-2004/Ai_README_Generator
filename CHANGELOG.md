# Changelog

All notable changes to the **AI README Markdown Generator** extension will be documented in this file.

## [1.0.5] - 2026-06-11

### Added
- **README Referencing**: The workspace scanner now detects and reads pre-existing `README.md` files (up to 1MB) and feeds them to the NVIDIA LLM during generation, allowing it to preserve custom configurations and guide information.
- **Overwrite Safety Dialog**: Implemented a native VS Code warning confirmation modal when attempting to save and overwrite an existing `README.md` file, preventing accidental data loss.


### Fixed
- **Onboarding Tour UI Alignment**: Fixed onboarding tooltip card horizontal spill-over by calculating and clamping positioning coordinates between a 10px padding from the left and right window borders.
- **Tooltip Animation Collisions**: Changed the tooltip entry animation from `slideUp` (which overrode inline position transforms) to a custom `tourFadeIn` transition that animates only opacity, allowing custom dynamic alignment translations to work correctly.

---

## [1.0.0] - 2026-06-11

### Added
- **Core Workspace Scanning**: Scans workspace folders to extract framework, language, dependencies, devDependencies, environment configs (`.env.example`), active scripts, license, and folder tree structure.
- **NVIDIA NIM Integration**: Connects with high-speed completions API using open-source models like `meta/llama-3.3-70b-instruct` and `nvidia/llama-3.1-nemotron-70b-instruct`.
- **Interactive Sidebar Webview**: VS Code styled React Webview UI featuring live Markdown preview, raw markdown editing, and collapsible checklist items.
- **Section Editor**: Supports highlighting or selecting an isolated section (e.g. Installation) and supplying localized prompt instructions to regenerate just that section.
- **Explorer Dashboard**: Adds a dashboard layout with recursive directory Tree View (collapsible icons) and a file statistics Data Table for JSON/XML files.
- **Secure Key Storage**: Uses VS Code's native `SecretStorage` to save the NVIDIA API key securely.
- **Generation History & Model Switcher**: Saves successfully generated READMEs in VS Code `globalState` cache with parameters, allowing one-click restore. Includes a top-level model selector dropdown.
- **Guided Onboarding Tour**: Walkthrough system that triggers on first startup to guide users through key settings, model switching, analysis, and custom instruction fields.
