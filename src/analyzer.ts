import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectMetadata {
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

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  'coverage',
  'bower_components',
  'venv',
  '.venv',
  'env',
  'target',
  'bin',
  'obj',
  '.idea',
  '.vscode'
]);

export async function analyzeWorkspace(workspaceRoot: string): Promise<ProjectMetadata> {
  const metadata: ProjectMetadata = {
    projectName: path.basename(workspaceRoot),
    primaryLanguage: 'Unknown',
    framework: 'Vanilla',
    packageManager: 'Unknown',
    scripts: {},
    dependencies: [],
    devDependencies: [],
    folderStructure: '',
    hasReadme: false,
    license: 'None',
    hasDocker: false,
    hasEnvExample: false,
    hasCicd: false
  };

  try {
    const rootFiles = await fs.readdir(workspaceRoot);

    // 1. Basic check for files
    metadata.hasReadme = rootFiles.some(f => f.toLowerCase() === 'readme.md');
    if (metadata.hasReadme) {
      const readmeFilename = rootFiles.find(f => f.toLowerCase() === 'readme.md')!;
      const readmePath = path.join(workspaceRoot, readmeFilename);
      try {
        const stat = await fs.stat(readmePath);
        metadata.readmeLength = stat.size;
        if (stat.size < 1000 * 1024) {
          metadata.existingReadmeContent = await fs.readFile(readmePath, 'utf-8');
        }
      } catch (e) {
        // ignore
      }
    }

    metadata.hasDocker = rootFiles.some(f => f.toLowerCase() === 'dockerfile' || f.toLowerCase() === 'docker-compose.yml');
    metadata.hasEnvExample = rootFiles.some(f => f === '.env.example' || f === '.env.sample');
    
    // Check for CI/CD configs
    metadata.hasCicd = rootFiles.some(f => f === '.gitlab-ci.yml' || f === 'azure-pipelines.yml') ||
                       (rootFiles.includes('.github') && await exists(path.join(workspaceRoot, '.github', 'workflows')));

    // Git analysis (extract remote origin URL if possible)
    if (rootFiles.includes('.git')) {
      const gitConfigPath = path.join(workspaceRoot, '.git', 'config');
      if (await exists(gitConfigPath)) {
        try {
          const content = await fs.readFile(gitConfigPath, 'utf-8');
          const match = content.match(/\[remote\s+"origin"\][^]*?url\s*=\s*(.+)/);
          if (match && match[1]) {
            metadata.gitRemoteUrl = match[1].trim();
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // License Detection
    const licenseFile = rootFiles.find(f => {
      const lf = f.toLowerCase();
      return lf === 'license' || lf === 'license.txt' || lf === 'license.md';
    });
    if (licenseFile) {
      try {
        const licensePath = path.join(workspaceRoot, licenseFile);
        const text = await fs.readFile(licensePath, 'utf-8');
        // Extract license type (usually the first line has the license name)
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          if (lines[0].toLowerCase().includes('mit')) {
            metadata.license = 'MIT';
          } else if (lines[0].toLowerCase().includes('apache')) {
            metadata.license = 'Apache 2.0';
          } else if (lines[0].toLowerCase().includes('gnu') || lines[0].toLowerCase().includes('gpl')) {
            metadata.license = 'GPL';
          } else if (lines[0].toLowerCase().includes('bsd')) {
            metadata.license = 'BSD';
          } else {
            metadata.license = lines[0].length < 30 ? lines[0] : 'Custom';
          }
        }
      } catch (e) {
        metadata.license = 'Present (Unparsed)';
      }
    }

    // 2. Language and Framework Parsing
    if (rootFiles.includes('package.json')) {
      metadata.primaryLanguage = 'JavaScript';
      metadata.packageManager = 'npm';
      
      if (rootFiles.includes('yarn.lock')) {
        metadata.packageManager = 'yarn';
      } else if (rootFiles.includes('pnpm-lock.yaml')) {
        metadata.packageManager = 'pnpm';
      } else if (rootFiles.includes('package-lock.json')) {
        metadata.packageManager = 'npm';
      }

      try {
        const pkgContent = await fs.readFile(path.join(workspaceRoot, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);

        if (pkg.name) {
          metadata.projectName = pkg.name;
        }

        // Scripts
        if (pkg.scripts) {
          metadata.scripts = pkg.scripts;
        }

        // Dependencies
        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        metadata.dependencies = deps;
        metadata.devDependencies = devDeps;

        // Check for TypeScript usage
        if (devDeps.includes('typescript') || deps.includes('typescript') || rootFiles.includes('tsconfig.json')) {
          metadata.primaryLanguage = 'TypeScript';
        }

        // Framework Detection (JS/TS)
        if (deps.includes('next')) {
          metadata.framework = 'Next.js';
        } else if (deps.includes('react')) {
          metadata.framework = 'React';
        } else if (deps.includes('vue') || deps.includes('nuxt')) {
          metadata.framework = deps.includes('nuxt') ? 'Nuxt.js' : 'Vue';
        } else if (deps.includes('express')) {
          metadata.framework = 'Express.js';
        } else if (deps.includes('@nestjs/core')) {
          metadata.framework = 'NestJS';
        } else if (deps.includes('svelte') || deps.includes('@sveltejs/kit')) {
          metadata.framework = 'Svelte';
        }
      } catch (e) {
        // ignore JSON errors
      }
    } else if (rootFiles.includes('requirements.txt') || rootFiles.includes('Pipfile') || rootFiles.includes('pyproject.toml') || rootFiles.includes('setup.py')) {
      metadata.primaryLanguage = 'Python';
      metadata.packageManager = rootFiles.includes('Pipfile') ? 'Pipenv' : (rootFiles.includes('pyproject.toml') ? 'Poetry' : 'pip');

      // Scan requirements.txt if present
      if (rootFiles.includes('requirements.txt')) {
        try {
          const reqs = await fs.readFile(path.join(workspaceRoot, 'requirements.txt'), 'utf-8');
          const lines = reqs.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
          metadata.dependencies = lines.map(l => l.split(/[=<>~]/)[0].trim());
        } catch (e) {}
      }

      // Framework Detection (Python)
      const allDeps = metadata.dependencies.map(d => d.toLowerCase());
      if (allDeps.includes('django')) {
        metadata.framework = 'Django';
      } else if (allDeps.includes('flask')) {
        metadata.framework = 'Flask';
      } else if (allDeps.includes('fastapi') || allDeps.includes('uvicorn')) {
        metadata.framework = 'FastAPI';
      }
    } else if (rootFiles.includes('Cargo.toml')) {
      metadata.primaryLanguage = 'Rust';
      metadata.packageManager = 'cargo';
      try {
        const cargoText = await fs.readFile(path.join(workspaceRoot, 'Cargo.toml'), 'utf-8');
        const nameMatch = cargoText.match(/name\s*=\s*"([^"]+)"/);
        if (nameMatch) {
          metadata.projectName = nameMatch[1];
        }
        metadata.framework = 'Rust Cargo Project';
      } catch (e) {}
    } else if (rootFiles.includes('go.mod')) {
      metadata.primaryLanguage = 'Go';
      metadata.packageManager = 'go';
      try {
        const goModText = await fs.readFile(path.join(workspaceRoot, 'go.mod'), 'utf-8');
        const moduleMatch = goModText.match(/module\s+(.+)/);
        if (moduleMatch) {
          metadata.projectName = path.basename(moduleMatch[1].trim());
        }
        metadata.framework = 'Go Module';
      } catch (e) {}
    } else if (rootFiles.includes('pom.xml') || rootFiles.some(f => f.endsWith('.gradle'))) {
      metadata.primaryLanguage = 'Java';
      metadata.packageManager = rootFiles.includes('pom.xml') ? 'maven' : 'gradle';
      metadata.framework = 'Java project';
    } else if (rootFiles.some(f => f.endsWith('.csproj'))) {
      metadata.primaryLanguage = 'C#';
      metadata.packageManager = 'dotnet';
      metadata.framework = '.NET project';
    } else if (rootFiles.includes('composer.json')) {
      metadata.primaryLanguage = 'PHP';
      metadata.packageManager = 'composer';
      metadata.framework = 'PHP project';
    }

    // 3. Generate folder structure tree
    metadata.folderStructure = await getFolderTreeString(workspaceRoot, workspaceRoot);

  } catch (error) {
    console.error('Error during workspace analysis:', error);
  }

  return metadata;
}

async function exists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch (e) {
    return false;
  }
}

async function getFolderTreeString(rootDir: string, currentDir: string, depth = 0, prefix = ''): Promise<string> {
  if (depth > 2) {
    return ''; // Limit depth to 3 levels (0, 1, 2)
  }

  try {
    const files = await fs.readdir(currentDir, { withFileTypes: true });
    
    // Sort directories first, then files alphabetically
    const sortedFiles = files
      .filter(f => !IGNORE_DIRS.has(f.name))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) {return -1;}
        if (!a.isDirectory() && b.isDirectory()) {return 1;}
        return a.name.localeCompare(b.name);
      });

    let tree = '';
    const total = sortedFiles.length;
    
    for (let i = 0; i < total; i++) {
      const item = sortedFiles[i];
      const isLast = i === total - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      tree += `${prefix}${connector}${item.name}${item.isDirectory() ? '/' : ''}\n`;

      if (item.isDirectory()) {
        const subTree = await getFolderTreeString(
          rootDir,
          path.join(currentDir, item.name),
          depth + 1,
          prefix + childPrefix
        );
        tree += subTree;
      }
    }
    return tree;
  } catch (e) {
    return '';
  }
}
