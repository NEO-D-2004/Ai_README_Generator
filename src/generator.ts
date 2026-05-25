import axios from 'axios';
import { ProjectMetadata } from './analyzer';

interface GenerateOptions {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  metadata: ProjectMetadata;
  sections: string[];
  customPrompt: string;
}

interface RegenerateSectionOptions {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  metadata: ProjectMetadata;
  sectionName: string;
  existingReadme: string;
  customPrompt: string;
}

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function generateReadme(options: GenerateOptions): Promise<string> {
  const { apiKey, model, temperature, maxTokens, metadata, sections, customPrompt } = options;

  const systemPrompt = `You are a principal technical writer and developer advocate.
Your goal is to write a clean, high-quality, comprehensive, and professional README.md file for the project details provided.
Adhere to these strict rules:
1. Use GitHub-flavored Markdown.
2. Ensure you represent directories, scripts, and commands correctly.
3. Be concise and enterprise-grade. Avoid conversational fillers or meta-introductions (like "Here is your README..."). Start directly with the README title.
4. Do NOT hallucinate dependencies or features that are not in the metadata.
5. If certain files (like .env.example or Dockerfile) are detected, write detailed configuration and setup steps for them.`;

  const userPrompt = `Analyze the project metadata below and generate a professional README.md.

PROJECT METADATA:
- Name: ${metadata.projectName}
- Primary Language: ${metadata.primaryLanguage}
- Framework: ${metadata.framework}
- Package Manager: ${metadata.packageManager}
- Active Scripts: ${JSON.stringify(metadata.scripts, null, 2)}
- Dependencies: ${metadata.dependencies.join(', ') || 'None'}
- Dev Dependencies: ${metadata.devDependencies.join(', ') || 'None'}
- Environment Configs: ${metadata.hasEnvExample ? 'Has .env.example file' : 'None detected'}
- Docker Support: ${metadata.hasDocker ? 'Dockerfile/Docker Compose detected' : 'None detected'}
- CI/CD Configurations: ${metadata.hasCicd ? 'CI/CD workflow files detected' : 'None detected'}
- Git URL: ${metadata.gitRemoteUrl || 'None'}
- License: ${metadata.license}

FOLDER STRUCTURE:
\`\`\`
${metadata.folderStructure}
\`\`\`

SECTIONS TO GENERATE:
Generate a README containing ONLY these sections in a logical order:
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

ADDITIONAL INSTRUCTIONS / USER INSTRUCTIONS:
${customPrompt || 'None. Make it modern, clean, and comprehensive.'}

Generate the final README.md content below:`;

  try {
    const response = await axios.post(
      NVIDIA_API_URL,
      {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response structure from NVIDIA API.');
    }
  } catch (error: any) {
    console.error('NVIDIA API request failed:', error?.response?.data || error.message);
    const apiError = error?.response?.data?.message || error?.response?.data?.error?.message || error.message;
    throw new Error(`NVIDIA API Error: ${apiError}`);
  }
}

export async function generateReadmeSection(options: RegenerateSectionOptions): Promise<string> {
  const { apiKey, model, temperature, maxTokens, metadata, sectionName, existingReadme, customPrompt } = options;

  const systemPrompt = `You are a principal technical writer.
You are asked to rewrite or generate ONLY the section "${sectionName}" of an existing README.md.
Adhere to these rules:
1. Output ONLY the rewritten section starting with its header (e.g. \`## ${sectionName}\`).
2. Do not output the whole README.md. Do not write any explanations, side notes, or conversational text.
3. Align the tone, styling, and details with the existing README.md context provided.
4. Keep commands, structure, and configurations technically accurate based on the project metadata.`;

  const userPrompt = `Here is the project metadata and the existing README.md. Rewrite or regenerate ONLY the section: "${sectionName}".

PROJECT METADATA:
- Name: ${metadata.projectName}
- Primary Language: ${metadata.primaryLanguage}
- Framework: ${metadata.framework}
- Dependencies: ${metadata.dependencies.join(', ')}
- Folder Structure:
\`\`\`
${metadata.folderStructure}
\`\`\`

EXISTING README.md:
\`\`\`markdown
${existingReadme}
\`\`\`

USER'S INSTRUCTIONS FOR THIS SECTION:
${customPrompt || `Regenerate the ${sectionName} section to make it clear and professional.`}

Output the updated section below (including its header \`## ${sectionName}\`):`;

  try {
    const response = await axios.post(
      NVIDIA_API_URL,
      {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response structure from NVIDIA API.');
    }
  } catch (error: any) {
    console.error('NVIDIA API section request failed:', error?.response?.data || error.message);
    const apiError = error?.response?.data?.message || error?.response?.data?.error?.message || error.message;
    throw new Error(`NVIDIA API Error: ${apiError}`);
  }
}
