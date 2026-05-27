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
  ChevronRight
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
}

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
        customPrompt: promptModifiers
      }
    });
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
          
          {/* PANEL 1: NVIDIA API SETTINGS */}
          <section className="panel-card">
            <button className="panel-header" onClick={() => togglePanel('api')}>
              <div className="panel-title-group">
                <Cpu size={16} />
                <span>NVIDIA LLM Config</span>
              </div>
              {collapsedPanels.api ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            {!collapsedPanels.api && (
              <div className="panel-body">
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
                    <button className="btn-secondary btn-sm" onClick={handleSaveApiKey}>Save</button>
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
              </div>
            )}
          </section>

          {/* PANEL 2: WORKSPACE SCANNER INFO */}
          <section className="panel-card">
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
          <section className="panel-card">
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
          <section className="panel-card">
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
          <button className="btn-primary btn-full btn-lg" onClick={handleGenerate}>
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
