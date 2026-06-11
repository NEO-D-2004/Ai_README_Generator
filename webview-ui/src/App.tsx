import { useState, useEffect } from 'react';
import MarkdownIt from 'markdown-it';
import {
  Play,
  Save,
  FileText,
  RefreshCw,
  Sliders,
  CheckSquare,
  Square,
  Code,
  Eye,
  BookOpen,
  Terminal,
  List,
  Cpu,
  Key,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
  Edit2,
  Folder,
  FolderOpen,
  ChevronRight,
  Settings,
  History,
  X,
  Trash2
} from 'lucide-react';

const vscode = (window as any).acquireVsCodeApi
  ? (window as any).acquireVsCodeApi()
  : {
      postMessage: (msg: any) => console.log('Mock postMessage:', msg),
      setState: (state: any) => console.log('Mock setState:', state),
      getState: () => null
    };

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

const DEFAULT_SECTIONS = [
  'Title & Description',
  'Tech Stack',
  'Features',
  'Folder Structure',
  'Installation',
  'Usage',
  'Configuration',
  'Scripts',
  'API',
  'Contributing',
  'License',
  'FAQ'
];

interface ProjectMetadata {
  projectName: string;
  primaryLanguage: string;
  framework: string;
  packageManager: string;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  folderStructure: string;
  hasReadme: boolean;
  readmeLength?: number;
  license: string;
  hasDocker: boolean;
  hasEnvExample: boolean;
  hasCicd: boolean;
  gitRemoteUrl?: string;
  existingReadmeContent?: string;
}

interface TourStep {
  targetId: string | null;
  title: string;
  description: string;
  placement: 'bottom' | 'top' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: null,
    title: "Welcome to AI README Generator! 👋",
    description: "This guide will walk you through setting up the extension so you can generate professional README files in seconds using NVIDIA open-source LLMs.",
    placement: 'center'
  },
  {
    targetId: "tour-settings-btn",
    title: "1. Setup NVIDIA API Key 🔐",
    description: "Click the Settings (gear) icon to open the configuration. You will need to enter your NVIDIA API key. If you don't have one, register for free at build.nvidia.com.",
    placement: 'bottom'
  },
  {
    targetId: "tour-model-select",
    title: "2. Choose AI Model 🤖",
    description: "Use this quick selector to choose an AI model (e.g. Llama 3.3 70B or Nemotron). Changes synchronize automatically with settings.",
    placement: 'bottom'
  },
  {
    targetId: "tour-workspace-analysis",
    title: "3. Workspace Analysis 📁",
    description: "Displays project information like detected framework, language, packages, and folders. We feed this context into the LLM during generation.",
    placement: 'bottom'
  },
  {
    targetId: "tour-sections",
    title: "4. Select README Sections 📑",
    description: "Choose which sections to include in the generated README. Check or uncheck headings like Installation, Tech Stack, or License to fit your needs.",
    placement: 'bottom'
  },
  {
    targetId: "tour-instructions",
    title: "5. Custom Instructions 💡",
    description: "Add custom prompt guidelines! For example, write in a specific voice, explain environment secrets, or customize deployment guides.",
    placement: 'top'
  },
  {
    targetId: "tour-generate-btn",
    title: "6. Generate README! ⚡",
    description: "Click this button to generate the markdown documentation. A live preview will render immediately below, allowing you to edit and save it.",
    placement: 'top'
  },
  {
    targetId: "tour-history-btn",
    title: "7. Generation History 🕒",
    description: "View previous generations here. Clicking a history item restores all sections, prompts, metadata, and generated text so you can start right where you left off.",
    placement: 'bottom'
  }
];

export default function App() {
  // Config & API State
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('meta/llama-3.3-70b-instruct');
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [includeBadges, setIncludeBadges] = useState(true);
  const [includeDiagrams, setIncludeDiagrams] = useState(true);

  // Modal and drawer visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);

  // Onboarding Tour state
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);

  // Analysis State
  const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
  
  // Generation & README State
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [customPrompt, setCustomPrompt] = useState('Write concise enterprise-grade documentation.');
  const [readmeContent, setReadmeContent] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Phase 2 Explorer state
  const [explorerData, setExplorerData] = useState<{ tree: any[]; table: any[] } | null>(null);
  const [explorerFormat, setExplorerFormat] = useState<'json' | 'xml'>('json');
  const [explorerError, setExplorerError] = useState('');

  // UI Tabs / Accordion Toggles
  const [activeTab, setActiveTab] = useState<'preview' | 'raw' | 'sectionEdit' | 'projectExplorer'>('preview');
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({
    api: false,
    analyzer: false,
    sections: false,
    prompts: true
  });

  // Section Editing State
  const [editSectionName, setEditSectionName] = useState('Installation');
  const [sectionPrompt, setSectionPrompt] = useState('');

  const loadExplorerData = (format: 'json' | 'xml') => {
    setExplorerError('');
    setExplorerData(null);
    vscode.postMessage({ type: 'loadExplorerData', format });
  };

  // Fetch initial API key and start scanning
  useEffect(() => {
    vscode.postMessage({ type: 'getApiKey' });
    vscode.postMessage({ type: 'scanWorkspace' });
    vscode.postMessage({ type: 'getHistory' });
    vscode.postMessage({ type: 'getTourState' });
    loadExplorerData('json');
  }, []);

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'apiKeyResult':
          setApiKey(msg.key);
          break;
        case 'tourStateResult':
          if (!msg.hasCompletedTour) {
            setShowTour(true);
            setTourStep(0);
          } else {
            setShowTour(false);
          }
          break;
        case 'historyResult':
          setGenerationHistory(msg.history);
          break;
        case 'scanResult':
          setMetadata(msg.data);
          setStatusMsg('');
          break;
        case 'readmeGenerated':
          setReadmeContent(msg.content);
          setStatusMsg('');
          setErrorMsg('');
          setActiveTab('preview');
          break;
        case 'sectionRegenerated':
          setStatusMsg('');
          setErrorMsg('');
          const updatedReadme = replaceSection(readmeContent, msg.sectionName, msg.content);
          setReadmeContent(updatedReadme);
          vscode.postMessage({ type: 'showInfo', message: `Section "${msg.sectionName}" regenerated!` });
          break;
        case 'explorerDataResult':
          setExplorerData(msg.payload);
          setExplorerFormat(msg.format);
          setExplorerError('');
          break;
        case 'explorerDataError':
          setExplorerError(msg.message);
          setExplorerData(null);
          break;
        case 'status':
          setStatusMsg(msg.message);
          setErrorMsg('');
          break;
        case 'error':
          setErrorMsg(msg.message);
          setStatusMsg('');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [readmeContent]);

  const updateTourTargetRect = () => {
    const step = TOUR_STEPS[tourStep];
    if (step && step.targetId) {
      const el = document.getElementById(step.targetId);
      if (el) {
        setTourTargetRect(el.getBoundingClientRect());
        el.classList.add('tour-highlighted-element');
        return;
      }
    }
    setTourTargetRect(null);
  };

  useEffect(() => {
    document.querySelectorAll('.tour-highlighted-element').forEach(el => {
      el.classList.remove('tour-highlighted-element');
    });

    if (showTour) {
      updateTourTargetRect();
    }
  }, [tourStep, showTour]);

  useEffect(() => {
    if (showTour) {
      window.addEventListener('resize', updateTourTargetRect);
      window.addEventListener('scroll', updateTourTargetRect, true);
    }
    return () => {
      window.removeEventListener('resize', updateTourTargetRect);
      window.removeEventListener('scroll', updateTourTargetRect, true);
    };
  }, [showTour, tourStep]);

  const handleTourNext = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      handleTourFinish();
    }
  };

  const handleTourBack = () => {
    if (tourStep > 0) {
      setTourStep(tourStep - 1);
    }
  };

  const handleTourFinish = () => {
    setShowTour(false);
    document.querySelectorAll('.tour-highlighted-element').forEach(el => {
      el.classList.remove('tour-highlighted-element');
    });
    vscode.postMessage({ type: 'completeTour' });
  };

  const handleTourRestart = () => {
    setIsSettingsOpen(false);
    setIsHistoryOpen(false);
    vscode.postMessage({ type: 'resetTour' });
  };

  const getTooltipStyle = () => {
    if (!tourTargetRect) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1200
      };
    }

    const step = TOUR_STEPS[tourStep];
    const spacing = 12;
    const tooltipWidth = step.targetId === null ? 290 : 260;
    let top = 0;
    let left = 0;
    let transform = '';

    if (step.placement === 'bottom' || step.placement === 'top') {
      top = step.placement === 'bottom' ? tourTargetRect.bottom + spacing : tourTargetRect.top - spacing;
      let desiredLeft = tourTargetRect.left + (tourTargetRect.width / 2) - (tooltipWidth / 2);
      
      if (desiredLeft < 10) {
        desiredLeft = 10;
      }
      if (desiredLeft + tooltipWidth > window.innerWidth - 10) {
        desiredLeft = window.innerWidth - tooltipWidth - 10;
      }
      
      left = desiredLeft;
      transform = step.placement === 'top' ? 'translateY(-100%)' : '';
    } else if (step.placement === 'left') {
      top = tourTargetRect.top + (tourTargetRect.height / 2);
      left = tourTargetRect.left - spacing;
      transform = 'translate(-100%, -50%)';
      
      if (left - tooltipWidth < 10) {
        top = tourTargetRect.top - spacing;
        left = Math.max(10, Math.min(tourTargetRect.left + (tourTargetRect.width / 2) - (tooltipWidth / 2), window.innerWidth - tooltipWidth - 10));
        transform = 'translateY(-100%)';
      }
    } else if (step.placement === 'right') {
      top = tourTargetRect.top + (tourTargetRect.height / 2);
      left = tourTargetRect.right + spacing;
      transform = 'translateY(-50%)';
      
      if (left + tooltipWidth > window.innerWidth - 10) {
        top = tourTargetRect.bottom + spacing;
        left = Math.max(10, Math.min(tourTargetRect.left + (tourTargetRect.width / 2) - (tooltipWidth / 2), window.innerWidth - tooltipWidth - 10));
        transform = '';
      }
    }

    if (top < 10) { top = 10; }
    if (left < 10) { left = 10; }

    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      transform,
      zIndex: 1200
    };
  };

  const togglePanel = (panel: string) => {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const handleSaveApiKey = () => {
    vscode.postMessage({ type: 'saveApiKey', key: apiKey });
  };

  const handleClearApiKey = () => {
    vscode.postMessage({ type: 'clearApiKey' });
    setApiKey('');
  };

  const handleScan = () => {
    vscode.postMessage({ type: 'scanWorkspace' });
  };

  const handleToggleSection = (section: string) => {
    setSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleGenerate = () => {
    if (!metadata) {
      setErrorMsg('No project metadata. Please scan workspace first.');
      return;
    }
    
    // Build actual options
    let promptModifiers = customPrompt;
    if (includeBadges) {promptModifiers += '\n- Include beautiful Markdown badges.';}
    if (includeDiagrams) {promptModifiers += '\n- Include a Mermaid directory/flow diagram if appropriate.';}

    vscode.postMessage({
      type: 'generateReadme',
      options: {
        apiKey,
        model: model === 'custom' ? customModel : model,
        temperature,
        maxTokens,
        metadata,
        sections,
        customPrompt: promptModifiers,
        originalCustomPrompt: customPrompt,
        includeBadges,
        includeDiagrams
      }
    });
  };

  const handleLoadHistoryItem = (item: any) => {
    if (item.model !== 'meta/llama-3.3-70b-instruct' &&
        item.model !== 'meta/llama-3.1-70b-instruct' &&
        item.model !== 'meta/llama-3.1-8b-instruct' &&
        item.model !== 'nvidia/llama-3.1-nemotron-70b-instruct') {
      setModel('custom');
      setCustomModel(item.model);
    } else {
      setModel(item.model);
    }
    setTemperature(item.temperature);
    setMaxTokens(item.maxTokens);
    setSections(item.sections || DEFAULT_SECTIONS);
    setCustomPrompt(item.customPrompt || '');
    setIncludeBadges(!!item.includeBadges);
    setIncludeDiagrams(!!item.includeDiagrams);
    setReadmeContent(item.readmeContent);
    if (item.metadata) {
      setMetadata(item.metadata);
    }
    setActiveTab('preview');
    setIsHistoryOpen(false);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'deleteHistoryItem', id });
  };

  const handleClearHistory = () => {
    vscode.postMessage({ type: 'clearHistory' });
  };

  const handleRegenerateSection = () => {
    if (!readmeContent) {
      setErrorMsg('Please generate a full README first before regenerating sections.');
      return;
    }
    if (!metadata) {
      setErrorMsg('No project metadata available.');
      return;
    }

    vscode.postMessage({
      type: 'regenerateSection',
      options: {
        apiKey,
        model: model === 'custom' ? customModel : model,
        temperature,
        maxTokens,
        metadata,
        sectionName: editSectionName,
        existingReadme: readmeContent,
        customPrompt: sectionPrompt
      }
    });
  };

  const handleSaveReadme = () => {
    if (!readmeContent) {return;}
    vscode.postMessage({ type: 'saveReadme', content: readmeContent });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(readmeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Section Replacing logic
  const replaceSection = (fullMarkdown: string, sectionName: string, newSectionContent: string): string => {
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerRegex = new RegExp(`^(##+\\s+${escapeRegExp(sectionName)})(\\s|$)`, 'mi');
    const match = fullMarkdown.match(headerRegex);
    if (!match) {
      // Append if not found
      return fullMarkdown + '\n\n' + newSectionContent;
    }

    const startIndex = match.index!;
    const headerPrefix = match[1].trim().split(' ')[0];
    const level = headerPrefix.length;

    const remainingText = fullMarkdown.slice(startIndex + match[0].length);
    const nextHeaderRegex = new RegExp(`^#{1,${level}}\\s+`, 'm');
    const nextHeaderMatch = remainingText.match(nextHeaderRegex);

    if (nextHeaderMatch) {
      const endIndex = startIndex + match[0].length + nextHeaderMatch.index!;
      return fullMarkdown.slice(0, startIndex) + newSectionContent + '\n\n' + fullMarkdown.slice(endIndex).trim();
    } else {
      return fullMarkdown.slice(0, startIndex) + newSectionContent;
    }
  };

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="app-header">
        <div className="header-top-row">
          <div className="header-left-group">
            <select
              className="quick-model-select"
              id="tour-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              title="Quick Switch Model"
            >
              <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B</option>
              <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B</option>
              <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B</option>
              <option value="nvidia/llama-3.1-nemotron-70b-instruct">Nemotron 70B</option>
              {model === 'custom' && <option value="custom">Custom NIM</option>}
            </select>
          </div>
          <div className="header-right-group">
            <button
              className={`header-icon-btn ${isHistoryOpen ? 'active' : ''}`}
              id="tour-history-btn"
              onClick={() => {
                setIsHistoryOpen(!isHistoryOpen);
                setIsSettingsOpen(false);
              }}
              title="Generation History"
            >
              <History size={15} />
            </button>
            <button
              className={`header-icon-btn ${isSettingsOpen ? 'active' : ''}`}
              id="tour-settings-btn"
              onClick={() => {
                setIsSettingsOpen(!isSettingsOpen);
                setIsHistoryOpen(false);
              }}
              title="LLM Settings"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
        <div className="header-info">
          <h1>AI README Generator</h1>
          {metadata ? (
            <div className="project-badge">
              <span className="project-name">{metadata.projectName}</span>
              <span className="project-framework">{metadata.framework} ({metadata.primaryLanguage})</span>
            </div>
          ) : (
            <div className="loading-badge">No workspace scanned</div>
          )}
        </div>
      </header>

      {/* STATUS AND ERRORS */}
      {statusMsg && (
        <div className="status-banner animate-pulse">
          <RefreshCw className="spinner" size={16} />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <main className="app-content">
        {/* PANEL COLLAPSIBLES */}
        <div className="panels-container">

          {/* PANEL 2: WORKSPACE SCANNER INFO */}
          <section className="panel-card" id="tour-workspace-analysis">
            <button className="panel-header" onClick={() => togglePanel('analyzer')}>
              <div className="panel-title-group">
                <Terminal size={16} />
                <span>Workspace Analysis</span>
              </div>
              {collapsedPanels.analyzer ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            {!collapsedPanels.analyzer && (
              <div className="panel-body">
                {metadata ? (
                  <div className="analysis-summary">
                    <div className="summary-item">
                      <span className="summary-label">Language:</span>
                      <span className="summary-val">{metadata.primaryLanguage}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Framework:</span>
                      <span className="summary-val">{metadata.framework}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Pkg Manager:</span>
                      <span className="summary-val">{metadata.packageManager}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">License:</span>
                      <span className="summary-val">{metadata.license}</span>
                    </div>
                    
                    <div className="summary-chips">
                      {metadata.hasDocker && <span className="badge-chip">Docker</span>}
                      {metadata.hasEnvExample && <span className="badge-chip">.env.example</span>}
                      {metadata.hasCicd && <span className="badge-chip">CI/CD</span>}
                      {metadata.hasReadme && (
                        <span className="badge-chip secondary">
                          Existing README ({Math.round(metadata.readmeLength! / 1024)} KB)
                        </span>
                      )}
                    </div>

                    <button className="btn-secondary btn-full btn-sm" onClick={handleScan}>
                      <RefreshCw size={12} />
                      <span>Rescan Workspace</span>
                    </button>
                  </div>
                ) : (
                  <div className="placeholder-text">
                    <p>No workspace scanned yet.</p>
                    <button className="btn-primary btn-full btn-sm" onClick={handleScan}>Scan Now</button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* PANEL 3: SECTION SELECTION */}
          <section className="panel-card" id="tour-sections">
            <button className="panel-header" onClick={() => togglePanel('sections')}>
              <div className="panel-title-group">
                <List size={16} />
                <span>README Sections</span>
              </div>
              {collapsedPanels.sections ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            {!collapsedPanels.sections && (
              <div className="panel-body">
                <div className="sections-grid">
                  {DEFAULT_SECTIONS.map((sec) => {
                    const isChecked = sections.includes(sec);
                    return (
                      <button
                        key={sec}
                        className={`section-toggle-btn ${isChecked ? 'active' : ''}`}
                        onClick={() => handleToggleSection(sec)}
                      >
                        {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                        <span>{sec}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* PANEL 4: CUSTOM PROMPTS */}
          <section className="panel-card" id="tour-instructions">
            <button className="panel-header" onClick={() => togglePanel('prompts')}>
              <div className="panel-title-group">
                <Sliders size={16} />
                <span>Custom Instructions</span>
              </div>
              {collapsedPanels.prompts ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            {!collapsedPanels.prompts && (
              <div className="panel-body">
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Write in a clear, friendly voice. Include examples for Docker Compose."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* MASTER GENERATION BUTTON */}
          <button className="btn-primary btn-full btn-lg" id="tour-generate-btn" onClick={handleGenerate}>
            <Play size={16} />
            <span>Generate README.md</span>
          </button>
        </div>

        {/* OUTPUT & PREVIEW SECTION */}
        <section className="preview-container">
          <div className="tab-header">
            <button
              className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              <BookOpen size={14} />
              <span>Preview</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
              onClick={() => setActiveTab('raw')}
            >
              <Code size={14} />
              <span>Raw</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'sectionEdit' ? 'active' : ''}`}
              onClick={() => setActiveTab('sectionEdit')}
            >
              <Edit2 size={14} />
              <span>Section Editor</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'projectExplorer' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('projectExplorer');
                loadExplorerData(explorerFormat);
              }}
            >
              <Folder size={14} />
              <span>Explorer Dashboard</span>
            </button>
            
            {readmeContent && activeTab !== 'projectExplorer' && (
              <div className="tab-actions">
                <button className="btn-ghost btn-sm" onClick={handleCopy}>
                  {isCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button className="btn-secondary btn-sm" onClick={handleSaveReadme}>
                  <Save size={14} />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>

          <div className="tab-body">
            {activeTab === 'projectExplorer' ? (
              <div className="explorer-dashboard-layout">
                <div className="explorer-header-bar">
                  <div className="explorer-header-left">
                    <span className="form-label" style={{ marginRight: '6px' }}>Format:</span>
                    <select
                      className="form-select"
                      style={{ width: '150px', padding: '2px 6px', margin: 0, height: '24px' }}
                      value={explorerFormat}
                      onChange={(e) => {
                        const fmt = e.target.value as 'json' | 'xml';
                        setExplorerFormat(fmt);
                        loadExplorerData(fmt);
                      }}
                    >
                      <option value="json">sample-data.json</option>
                      <option value="xml">sample-data.xml</option>
                    </select>
                    <span className={`explorer-badge ${explorerFormat === 'json' ? 'explorer-badge-json' : 'explorer-badge-xml'}`} style={{ marginLeft: '8px' }}>
                      {explorerFormat.toUpperCase()} Format
                    </span>
                  </div>
                  <div className="explorer-header-right">
                    <button className="btn-secondary btn-sm" style={{ height: '24px', padding: '2px 8px' }} onClick={() => loadExplorerData(explorerFormat)}>
                      <RefreshCw size={12} />
                      <span style={{ marginLeft: '4px' }}>Refresh</span>
                    </button>
                  </div>
                </div>

                {explorerError && (
                  <div className="error-banner" style={{ marginBottom: '12px' }}>
                    <AlertCircle size={16} />
                    <span>{explorerError}</span>
                  </div>
                )}

                {explorerData ? (
                  <div className="explorer-split-panel">
                    <div className="explorer-panel">
                      <div className="explorer-panel-title">
                        <FolderOpen size={14} />
                        <span>Project Tree Structure</span>
                      </div>
                      <div className="tree-container">
                        <ul className="tree-list">
                          {explorerData.tree.map((node, i) => (
                            <TreeNodeComponent key={i} node={node} />
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="explorer-panel">
                      <div className="explorer-panel-title">
                        <List size={14} />
                        <span>Data Table View</span>
                      </div>
                      <div className="explorer-table-container">
                        <table className="explorer-table">
                          <thead>
                            <tr>
                              <th>File</th>
                              <th>Type</th>
                              <th>Size</th>
                            </tr>
                          </thead>
                          <tbody>
                            {explorerData.table.map((row, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 500 }}>{row.file}</td>
                                <td>
                                  <span className="badge-chip secondary" style={{ fontSize: '10px' }}>
                                    {row.type}
                                  </span>
                                </td>
                                <td style={{ opacity: 0.85 }}>{row.size}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <RefreshCw className="spinner" size={32} />
                    <p>Loading explorer data...</p>
                  </div>
                )}
              </div>
            ) : readmeContent ? (
              <>
                {activeTab === 'preview' && (
                  <div
                    className="markdown-rendered"
                    dangerouslySetInnerHTML={{ __html: md.render(readmeContent) }}
                  />
                )}
                {activeTab === 'raw' && (
                  <textarea
                    className="raw-editor"
                    value={readmeContent}
                    onChange={(e) => setReadmeContent(e.target.value)}
                  />
                )}
                {activeTab === 'sectionEdit' && (
                  <div className="section-edit-form">
                    <div className="form-group">
                      <label className="form-label">Select README Section to Regenerate</label>
                      <select
                        className="form-select"
                        value={editSectionName}
                        onChange={(e) => setEditSectionName(e.target.value)}
                      >
                        {sections.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Instructions for this section</label>
                      <textarea
                        className="form-textarea"
                        rows={4}
                        placeholder="e.g. Include detailed instructions for setting up database migrations."
                        value={sectionPrompt}
                        onChange={(e) => setSectionPrompt(e.target.value)}
                      />
                    </div>
                    <button className="btn-secondary btn-full" onClick={handleRegenerateSection}>
                      <RefreshCw size={14} />
                      <span>Regenerate "{editSectionName}" Section</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="preview-placeholder">
                <FileText size={48} className="placeholder-icon" />
                <p>Generate a README.md to preview it here.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <Cpu size={16} />
                <span>NVIDIA LLM Config</span>
              </div>
              <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  <Key size={12} />
                  <span>NVIDIA API Key</span>
                </label>
                <div className="input-with-button">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Paste nvapi-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    className="icon-button"
                    title={showKey ? 'Hide key' : 'Show key'}
                    onClick={() => setShowKey(!showKey)}
                  >
                    <Eye size={14} />
                  </button>
                </div>
                <div className="button-row">
                  <button className="btn-secondary btn-sm" onClick={() => { handleSaveApiKey(); setIsSettingsOpen(false); }}>Save</button>
                  <button className="btn-ghost btn-sm" onClick={handleClearApiKey}>Clear</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">AI Model</label>
                <select
                  className="form-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B (Recommended)</option>
                  <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                  <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B (Fast)</option>
                  <option value="nvidia/llama-3.1-nemotron-70b-instruct">Llama 3.1 Nemotron 70B</option>
                  <option value="custom">Custom NVIDIA NIM Model...</option>
                </select>
              </div>

              {model === 'custom' && (
                <div className="form-group">
                  <label className="form-label">Custom Model Identifier</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. meta/llama3-8b-instruct"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                  />
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Temperature: {temperature}</label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    className="form-range"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Tokens</label>
                  <input
                    type="number"
                    className="form-input"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeBadges}
                    onChange={(e) => setIncludeBadges(e.target.checked)}
                  />
                  <span>Include badges</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeDiagrams}
                    onChange={(e) => setIncludeDiagrams(e.target.checked)}
                  />
                  <span>Include diagrams</span>
                </label>
              </div>
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.15))', paddingTop: '12px' }}>
                <button className="btn-ghost btn-sm btn-full" onClick={handleTourRestart}>
                  <span>Restart Welcome Tour</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY DRAWER */}
      {isHistoryOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryOpen(false)}>
          <div className="modal-content history-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <History size={16} />
                <span>Generation History</span>
              </div>
              <button className="close-btn" onClick={() => setIsHistoryOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body history-body">
              {generationHistory.length > 0 ? (
                <div className="history-list-container">
                  <div className="history-actions-row">
                    <button className="btn-ghost btn-sm btn-full" onClick={handleClearHistory}>Clear All History</button>
                  </div>
                  <div className="history-items-list">
                    {generationHistory.map((item) => (
                      <div
                        key={item.id}
                        className="history-item-card"
                        onClick={() => handleLoadHistoryItem(item)}
                        title="Click to restore this generation"
                      >
                        <div className="history-item-header">
                          <span className="history-item-project">{item.projectName}</span>
                          <button
                            className="history-delete-btn"
                            title="Delete entry"
                            onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="history-item-meta">
                          <span>{item.model.split('/').pop()}</span>
                          <span>•</span>
                          <span>Temp: {item.temperature}</span>
                        </div>
                        <div className="history-item-time">{item.timestamp}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-history">
                  <History size={32} className="placeholder-icon" />
                  <p>No history entries found.</p>
                  <p style={{ fontSize: '11px', opacity: 0.7 }}>Successful generations will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ONBOARDING WELCOME TOUR OVERLAY */}
      {showTour && (
        <>
          <div className="tour-overlay" onClick={handleTourFinish} />
          <div className={`tour-tooltip-card placement-${TOUR_STEPS[tourStep].placement}`} style={getTooltipStyle()}>
            <div className="tour-tooltip-header">
              <span className="tour-step-badge">Step {tourStep + 1} of {TOUR_STEPS.length}</span>
              <button className="tour-skip-btn" onClick={handleTourFinish}>Skip</button>
            </div>
            <div className="tour-tooltip-body">
              <h3>{TOUR_STEPS[tourStep].title}</h3>
              <p>{TOUR_STEPS[tourStep].description}</p>
              
              {tourStep === 1 && (
                <div style={{ marginTop: '8px' }}>
                  <a
                    href="https://build.nvidia.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="tour-link"
                    style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                  >
                    Get free API Key at build.nvidia.com
                  </a>
                </div>
              )}
            </div>
            <div className="tour-tooltip-footer">
              <button
                className="btn-ghost btn-sm"
                onClick={handleTourBack}
                disabled={tourStep === 0}
                style={{ opacity: tourStep === 0 ? 0.4 : 1 }}
              >
                Back
              </button>
              <button className="btn-primary btn-sm" onClick={handleTourNext}>
                {tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
}

function TreeNodeComponent({ node }: { node: TreeNode }) {
  const [isOpen, setIsOpen] = useState(true);

  const handleToggle = () => {
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    }
  };

  const isFolder = node.type === 'folder';

  return (
    <li className="tree-node">
      <div className="tree-node-content" onClick={handleToggle}>
        {isFolder ? (
          <>
            <span className="tree-node-icon" style={{ opacity: 0.7, color: 'var(--accent-purple)' }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="tree-node-icon" style={{ color: 'var(--accent-purple)' }}>
              {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
            </span>
          </>
        ) : (
          <>
            <span className="tree-node-icon" style={{ width: '14px' }}></span>
            <span className="tree-node-icon" style={{ color: 'var(--vscode-descriptionForeground, #8e8e8e)' }}>
              <FileText size={14} />
            </span>
          </>
        )}
        <span>{node.name}</span>
      </div>
      {isFolder && isOpen && node.children && (
        <ul className="tree-folder-children">
          {node.children.map((child, idx) => (
            <TreeNodeComponent key={idx} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
