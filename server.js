const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Check for required API keys
if (!process.env.GOOGLE_API_KEY || !process.env.GITHUB_TOKEN) {
    console.error("❌ Missing API keys in .env");
    process.exit(1);
}

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Helper function to clean and optimize feature queries
const cleanFeatureQuery = (feature) => {
    return feature
        .replace(/[:()]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .trim()
        .split(' ') // Split into words
        .slice(0, 5) // Limit to 5 core keywords
        .join(' '); // Join back into a query
};

// GitHub API Helper Function
const fetchGitHubRepos = async (feature) => {
    try {
        const query = cleanFeatureQuery(feature);
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
                per_page: 5, // Limit to top 5 repos
            },
        });

        return response.data.items.map(repo => ({
            name: repo.name,
            full_name: repo.full_name,
            // description: repo.description,
            stars: repo.stargazers_count,
            url: repo.html_url,
            language: repo.language,
        }));
    } catch (error) {
        console.error('❌ GitHub API Error:', error.message || error);
        return [];
    }
};

// POST Endpoint
app.post('/generate', async (req, res) => {
    const { idea, mode } = req.body;

    if (!idea || idea.trim() === '') {
        return res.status(400).json({ error: 'Project idea is required' });
    }

    try {
        if (mode === 'features') {
            // Updated prompt for concise feature generation
            const prompt = `
                Project Idea: "${idea}"
                Please break down this project into core features, providing short feature titles (preferably 3–6 words per feature). Avoid including long descriptions or implementation details.

                Example Output:
                * User Authentication
                * Resume Template Selection
                * AI Content Generation
                * Skill Extraction
                * Export Options

                Provide the output in a clean and concise bullet-point format.
            `;
            const result = await model.generateContent(prompt);
            const featuresText = result?.response?.text();

            console.log('Gemini API Features Response:', featuresText);

            if (!featuresText) {
                return res.status(500).json({ error: 'Failed to generate features from Gemini API' });
            }

            // Updated Parsing Logic
            const features = featuresText
                .split('\n')
                .filter(line => line.trim().startsWith('*')) // Match lines starting with '*'
                .map(line => line.replace(/^\*\s*/, '').trim()); // Remove '*' and extra spaces

            console.log('Extracted Features:', features);

            if (features.length === 0) {
                return res.status(200).json({
                    message: 'No features could be generated for the provided idea.',
                    features: [],
                    featureRepos: {}
                });
            }

            // Fetch GitHub repos for each feature
            const featureRepos = {};
            for (const feature of features) {
                console.log(`Fetching repos for feature: ${feature}`);
                const repos = await fetchGitHubRepos(feature);
                featureRepos[feature] = repos.length > 0 ? repos : [{ message: 'No repositories found for this feature.' }];
            }

            return res.json({ features, featureRepos });
        } else if (mode === 'whole') {
            // Behavior 1: Search for whole project repositories
            const wholeProjectRepos = await fetchGitHubRepos(idea);
            return res.json({ wholeProjectRepos });
        } else {
            return res.status(400).json({ error: 'Invalid mode. Use "whole" or "features".' });
        }
    } catch (error) {
        console.error('❌ Error:', error.message || error);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});