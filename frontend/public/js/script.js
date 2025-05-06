// Event listener for generating tech stack
document.getElementById('generateStackButton').addEventListener('click', async () => {
    const ideaInput = document.getElementById('idea').value;
    const projectType = document.querySelector('input[name="projectType"]:checked')?.value;

    if (!ideaInput.trim()) {
        alert('Please enter a project idea.');
        return;
    }

    if (!projectType) {
        alert('Please select a project type.');
        return;
    }

    try {
        // Disable the button while fetching
        const generateStackButton = document.getElementById('generateStackButton');
        generateStackButton.disabled = true;
        generateStackButton.textContent = 'Generating...';

        const response = await fetch('/detect-techstack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idea: ideaInput, projectType }),
        });

        const data = await response.json();

        if (data.error) {
            alert(data.error);
            generateStackButton.disabled = false;
            generateStackButton.textContent = 'Generate Tech Stack';
            return;
        }

        // Populate stack options dynamically
        setStackOptions(data.suggestions);

        // Enable the submit button after stacks are generated
        document.getElementById('submitButton').disabled = false;

        // Update button text back
        generateStackButton.disabled = false;
        generateStackButton.textContent = 'Generate Tech Stack';
    } catch (error) {
        alert('Error generating tech stack suggestions.');
        console.error(error);

        // Reset the button state
        const generateStackButton = document.getElementById('generateStackButton');
        generateStackButton.disabled = false;
        generateStackButton.textContent = 'Generate Tech Stack';
    }
});

// Populate stack options dynamically
function setStackOptions(stackOptions) {
    const stackSection = document.getElementById('stackSection');
    const stackCardsDiv = document.getElementById('stackCards');

    stackCardsDiv.innerHTML = ''; // Clear previous options

    if (stackOptions && stackOptions.length > 0) {
        stackOptions.forEach((stack, index) => {
            const stackOptionHTML = `
                <label class="card">
                    <input type="radio" name="stack" value="${stack}" ${index === 0 ? "checked" : ""}/> ${stack}
                </label>
            `;
            stackCardsDiv.innerHTML += stackOptionHTML;
        });

        stackSection.style.display = 'block';
    } else {
        stackSection.style.display = 'none';
        alert('No tech stack suggestions available.');
    }
}

// Event listener for form submission
document.getElementById('generateForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const idea = document.getElementById('idea').value;
    const projectType = document.querySelector('input[name="projectType"]:checked').value;
    const techStack = getSelectedStack();

    if (!techStack) {
        alert('Please select a tech stack.');
        return;
    }

    const resultsDiv = document.getElementById('results');
    const projectReposDiv = document.getElementById('projectRepos');
    const projectVideosDiv = document.getElementById('projectVideos');
    const featureDetailsDiv = document.getElementById('featureDetails');

    resultsDiv.classList.add('hidden');
    projectReposDiv.innerHTML = '';
    projectVideosDiv.innerHTML = '';
    featureDetailsDiv.innerHTML = '';

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idea, projectType, techStack }),
        });

        const data = await response.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        resultsDiv.classList.remove('hidden');

        // GitHub Repositories
        projectReposDiv.innerHTML = '<h3>GitHub Repositories</h3>';
        data.wholeProjectRepos.forEach(repo => {
            const repoCard = document.createElement('div');
            repoCard.className = 'card';
            repoCard.innerHTML = `
                <h3>${repo.name}</h3>
                <p>Stars: ★ ${repo.stars}</p>
                <p>Language: ${repo.language}</p>
                <a href="${repo.url}" target="_blank">View Repository</a>
            `;
            projectReposDiv.appendChild(repoCard);
        });

        // YouTube Videos
        projectVideosDiv.innerHTML = '<h3>YouTube Videos</h3>';
        data.wholeProjectVideos.forEach(video => {
            const videoCard = document.createElement('div');
            videoCard.className = 'card';
            videoCard.innerHTML = `
                <h3>${video.title}</h3>
                <p>${video.description}</p>
                <p>Channel: ${video.channel}</p>
                <a href="${video.url}" target="_blank">Watch Video</a>
            `;
            projectVideosDiv.appendChild(videoCard);
        });

        // Feature Details
        featureDetailsDiv.innerHTML = '<h3>Features</h3>';
        data.features.forEach(feature => {
            const featureCard = document.createElement('div');
            featureCard.className = 'card';
            featureCard.innerHTML = `
                <h3>${feature}</h3>
                <p>GitHub Repositories:</p>
            `;

            const reposForFeature = data.featureRepos[feature];
            reposForFeature.forEach(repo => {
                if (repo.url) {
                    featureCard.innerHTML += `
                        <p><a href="${repo.url}" target="_blank">${repo.name}</a> - ★ ${repo.stars}</p>
                    `;
                } else {
                    featureCard.innerHTML += `<p>${repo.message}</p>`;
                }
            });

            const videosForFeature = data.featureVideos[feature];
            featureCard.innerHTML += '<p>YouTube Videos:</p>';
            videosForFeature.forEach(video => {
                if (video.url) {
                    featureCard.innerHTML += `
                        <p><a href="${video.url}" target="_blank">${video.title}</a></p>
                    `;
                } else {
                    featureCard.innerHTML += `<p>${video.message}</p>`;
                }
            });

            const codeForFeature = data.featureCodes[feature];
            featureCard.innerHTML += `
                <h4>Code Snippet:</h4>
                <pre><code class="language-javascript">${escapeHTML(codeForFeature)}</code></pre>
            `;

            featureDetailsDiv.appendChild(featureCard);
        });

        // Re-apply syntax highlighting for dynamically added code snippets
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    } catch (error) {
        alert('Error generating project data.');
        console.error(error);
    }
});

// Get selected tech stack
function getSelectedStack() {
    const selectedStack = document.querySelector('input[name="stack"]:checked');
    return selectedStack ? selectedStack.value : null;
}

// Escape HTML for safe rendering
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}