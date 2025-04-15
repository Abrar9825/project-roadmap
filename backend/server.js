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

// Root route
app.get('/', (req, res) => {
    res.render('index');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

if (!process.env.GOOGLE_API_KEY || !process.env.GITHUB_TOKEN || !process.env.YOUTUBE_API_KEY) {
    console.error("❌ Missing API keys in .env");
    process.exit(1);
}

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Clean and optimize search query
const cleanFeatureQuery = (feature, techStack = '') => {
    const cleanedFeature = feature
        .replace(/[:()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 5)
        .join(' ');

    return `${cleanedFeature} ${techStack}`;
};

// GitHub API Search
const fetchGitHubRepos = async (feature, techStack) => {
    try {
        const query = cleanFeatureQuery(feature, techStack);
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

        return response.data.items.map(repo => ({
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

// YouTube API Search
const fetchYouTubeVideos = async (query, techStack) => {
    try {
        const fullQuery = cleanFeatureQuery(query, techStack);
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

        return response.data.items.map(video => ({
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
            Keep it simple and relevant to the tech stack. Focus on creating a small code snippet that shows the essence of the feature.

            Example:
            Feature: User Authentication
            Tech Stack: MERN
            Expected Output: A simple Express.js route for login and token generation.

            Feature: "${feature}"
            Tech Stack: "${techStack}"
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
    const { idea, techStack = 'MERN Stack' } = req.body;

    if (!idea || idea.trim() === '') {
        return res.status(400).json({ error: 'Project idea is required' });
    }

    try {
        // First, try fetching the whole project data
        const repos = await fetchGitHubRepos(idea, techStack);
        const videos = await fetchYouTubeVideos(idea, techStack);

        // Generate features data
        const prompt = `
            Project Idea: "${idea}"
            Tech Stack: "${techStack}"
            Please break down this project idea into key features. Provide a list of 3–6 words per feature (short titles only).
            Avoid detailed descriptions or technical implementation.
            Examples:
            * User Authentication
            * Dashboard Analytics
            * File Upload with Preview
            * Admin Panel Access
        `;

        const result = await model.generateContent(prompt);
        const featuresText = result?.response?.text();

        if (!featuresText) {
            return res.status(500).json({ error: 'Failed to generate features from Gemini API' });
        }

        const features = featuresText
            .split('\n')
            .filter(line => line.trim().startsWith('*'))
            .map(line => line.replace(/^\*\s*/, '').trim());

        if (features.length === 0) {
            return res.status(200).json({
                message: 'No features could be generated for the provided idea.',
                features: ['Example Feature: User Login', 'Example Feature: Admin Panel'],
                featureRepos: {},
                featureVideos: {},
                featureCodes: {}
            });
        }

        // Prepare data for features
        const featureRepos = {};
        const featureVideos = {};
        const featureCodes = {};

        // Fetch GitHub repos, YouTube videos, and generate code for each feature
        for (const feature of features) {
            const reposForFeature = await fetchGitHubRepos(feature, techStack);
            featureRepos[feature] = reposForFeature.length > 0 ? reposForFeature : [{ message: 'No repositories found for this feature.' }];

            const videosForFeature = await fetchYouTubeVideos(feature, techStack);
            featureVideos[feature] = videosForFeature.length > 0 ? videosForFeature : [{ message: 'No videos found for this feature.' }];

            const codeForFeature = await generateCodeForFeature(feature, techStack);
            featureCodes[feature] = codeForFeature;
        }

        // Return both whole project data (if any) and feature data
        return res.json({
            wholeProjectRepos: repos.length > 0 ? repos : [{ message: 'No project data found.' }],
            wholeProjectVideos: videos.length > 0 ? videos : [{ message: 'No project videos found.' }],
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
