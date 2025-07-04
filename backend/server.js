const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Set views directory and view engine
app.set('views', path.join(__dirname, '../frontend'));
app.set('view engine', 'ejs');

// Initialize Gemini AI Model
if (!process.env.GOOGLE_API_KEY || !process.env.GITHUB_TOKEN || !process.env.YOUTUBE_API_KEY) {
    console.error("❌ Missing API keys in .env");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Root route
app.get('/', (req, res) => {
    res.render('index');
});

// Clean the feature string, keep only first 5 words for concise search
const cleanFeatureQuery = (feature) => {
    return feature
        .replace(/[:()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 5)
        .join(' ');
};

// Use Gemini to extract main language/technology from a stack string
async function extractMainLanguageFromStack(techStack, projectType) {
    try {
        const prompt = `
Given the following tech stack string for a ${projectType || "project"}:
"${techStack}"
Return ONLY the main programming language or framework most commonly used for open-source repositories for this stack (like: react, node, python, vue, java, etc). Just the keyword, lowercase, no extra words, no punctuation.
If multiple, return the most appropriate for searching repos.
`;
        const result = await model.generateContent(prompt);
        let mainLang = (result?.response?.text() || '').trim().toLowerCase();
        // Remove any extra words, just keep one word
        mainLang = mainLang.split(/[^a-zA-Z0-9\-\_]+/)[0];
        return mainLang || 'javascript';
    } catch (err) {
        console.error("❌ Gemini main language extract error:", err.message || err);
        return 'javascript';
    }
}

// Use Gemini to suggest stacks based on the project type
function getStackTypeInstructions(projectType) {
    if (!projectType) return 'Suggest fullstack combinations suitable for a modern web project.';

    const type = projectType.toLowerCase();

    if (type === 'frontend') {
        return 'Suggest only frontend tech stack combinations (e.g., React, Angular, Vue, Svelte, Next.js, etc). Do not include backend or database.';
    }

    if (type === 'backend') {
        return 'Suggest only backend tech stack combinations (e.g., Node.js, Express, Django, Flask, Spring Boot, Laravel, etc). Do not include frontend frameworks.';
    }

    if (type === 'app') {
        return 'Suggest mobile app development stacks (e.g., React Native, Flutter, Swift for iOS, Kotlin for Android, or cross-platform frameworks). Focus on mobile development.';
    }

    return 'Suggest fullstack combinations suitable for a modern web project.';
}


// Detect Tech Stack and Suggest Alternatives
app.post('/detect-techstack', async (req, res) => {
    const { idea, projectType } = req.body;
    if (!idea || idea.trim() === '') {
        return res.status(400).json({ error: 'Project idea is required' });
    }

    try {
        const prompt = `
Analyze this project idea: "${idea}"
${getStackTypeInstructions(projectType)}
1. Identify if any tech stack is already mentioned.
2. Suggest the best 3 suitable ${projectType || 'fullstack'} tech stack combinations for the project idea.
3. Return response in this exact format:
{
  "detectedStack": "Tech Stack Name",
  "suggestions": [
    "Tech Stack Combination 1",
    "Tech Stack Combination 2",
    "Tech Stack Combination 3"
  ]
}
No commentary or explanation.
`;

        const result = await model.generateContent(prompt);
        const responseText = result?.response?.text();
        const matched = responseText && responseText.match(/\{[\s\S]*\}/);
        if (!matched) {
            return res.status(500).json({ error: 'Invalid response from Gemini AI' });
        }
        const techStackData = JSON.parse(matched[0]);
        return res.json(techStackData);

    } catch (error) {
        console.error('❌ Tech Stack Detection Error:', error.message || error);
        return res.status(500).json({ error: 'Error detecting tech stack' });
    }
});

// GitHub API Search - now uses Gemini to extract main language/framework!
const fetchGitHubRepos = async (feature, techStack, projectType) => {
    try {
        // Use Gemini to extract main language/framework
        const mainLang = await extractMainLanguageFromStack(techStack, projectType);
        // Query is: feature + mainLang, both cleaned up
        const query = `${cleanFeatureQuery(feature)} ${mainLang}`.toLowerCase();
        console.log(`GitHub Query: "${query}"`);

        const response = await axios.get(`https://api.github.com/search/repositories`, {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
            },
            params: {
                q: query,
                sort: 'stars',
                order: 'desc',
                per_page: 5,
            },
        });

        return (response.data.items || []).map(repo => ({
            name: repo.name,
            full_name: repo.full_name,
            stars: repo.stargazers_count,
            url: repo.html_url,
            language: repo.language,
        }));
    } catch (error) {
        console.error('❌ GitHub API Error:', error.message || error);
        return [];
    }
};

// YouTube API Search (no change)
const fetchYouTubeVideos = async (query, techStack) => {
    try {
        const fullQuery = `${cleanFeatureQuery(query)} ${techStack}`;
        console.log(`YouTube Query: "${fullQuery}"`);

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                key: process.env.YOUTUBE_API_KEY,
                q: fullQuery,
                part: 'snippet',
                type: 'video',
                maxResults: 5,
            },
        });

        return (response.data.items || []).map(video => ({
            title: video.snippet.title,
            description: video.snippet.description,
            url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            channel: video.snippet.channelTitle,
            thumbnail: video.snippet.thumbnails.high.url,
        }));
    } catch (error) {
        console.error('❌ YouTube API Error:', error.message || error);
        return [];
    }
};

// Generate Code Snippet for Feature
const generateCodeForFeature = async (feature, techStack) => {
    try {
        const prompt = `
Project Feature: "${feature}"
Tech Stack: "${techStack}"
Please generate a basic code snippet (1–2 functions) that demonstrates the implementation of this feature. 
Keep it simple and relevant to the tech stack. Output only code, no explanations.
`;
        const result = await model.generateContent(prompt);
        const code = result?.response?.text();
        return code ? code : 'No code generated for this feature.';
    } catch (error) {
        console.error('❌ Code Generation Error:', error.message || error);
        return 'Error generating code for this feature.';
    }
};

// Generate Project Data
app.post('/generate', async (req, res) => {
    const { idea, techStack, projectType } = req.body;
    if (!idea || idea.trim() === '') {
        return res.status(400).json({ error: 'Project idea is required' });
    }

    try {
        // Use main language for repo search
        const repos = await fetchGitHubRepos(idea, techStack, projectType);
        const videos = await fetchYouTubeVideos(idea, techStack);

        const prompt = `
Project Idea: "${idea}"
Tech Stack: "${techStack}"
Project Type: "${projectType || 'Fullstack'}"
Break down this project idea into key features. Provide a list of 3–6 words per feature (short titles only).
Return only a bullet list, no commentary.
`;

        const result = await model.generateContent(prompt);
        const featuresText = result?.response?.text();

        if (!featuresText) {
            return res.status(500).json({ error: 'Failed to generate features from Gemini AI' });
        }

        // Accept both * and - as bullet points
        const features = featuresText
            .split('\n')
            .filter(line => /^\s*[\*\-]/.test(line.trim()))
            .map(line => line.replace(/^[\*\-\s]+/, '').trim())
            .filter(Boolean);

        const featureRepos = {};
        const featureVideos = {};
        const featureCodes = {};

        // For each feature: get repos, videos, code
        for (const feature of features) {
            featureRepos[feature] = await fetchGitHubRepos(feature, techStack, projectType);
            featureVideos[feature] = await fetchYouTubeVideos(feature, techStack);
            featureCodes[feature] = await generateCodeForFeature(feature, techStack);
        }

        return res.json({
            wholeProjectRepos: repos,
            wholeProjectVideos: videos,
            features,
            featureRepos,
            featureVideos,
            featureCodes
        });

    } catch (error) {
        console.error('❌ Error:', error.message || error);
        return res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
