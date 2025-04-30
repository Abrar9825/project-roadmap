document.getElementById('detectStack').addEventListener('click', async () => {
    const idea = document.getElementById('idea').value;
    const stackType = document.querySelector('input[name="stackType"]:checked')?.value || 'fullstack';
    // 💡 Get selected stackType

    const detectedStackSection = document.getElementById('detectedStackSection');
    const detectedStack = document.getElementById('detectedStack');
    const suggestedStacks = document.getElementById('suggestedStacks');
    const techStackSelect = document.getElementById('techStack');

    if (!idea.trim()) {
        alert('Please enter a project idea.');
        return;
    }

    try {
        // 🔥 Send idea + selected stackType to backend
        const response = await fetch('/detect-techstack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idea, stackType }),
        });

        const data = await response.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        detectedStackSection.classList.remove('hidden');
        detectedStack.innerText = data.detectedStack || 'None';

        suggestedStacks.innerHTML = '';
        techStackSelect.innerHTML = '';

        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach((stack) => {
                const li = document.createElement('li');
                li.innerText = stack;
                suggestedStacks.appendChild(li);

                const option = document.createElement('option');
                option.value = stack;
                option.innerText = stack;
                techStackSelect.appendChild(option);
            });
        } else {
            const li = document.createElement('li');
            li.innerText = 'No suggestions available.';
            suggestedStacks.appendChild(li);

            const defaultOption = document.createElement('option');
            defaultOption.value = 'MERN Stack';
            defaultOption.innerText = 'MERN Stack';
            techStackSelect.appendChild(defaultOption);
        }
    } catch (error) {
        console.error('Error detecting tech stack:', error);
        alert('An error occurred while detecting the tech stack.');
    }
});

document.getElementById('generateForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const idea = document.getElementById('idea').value;
    const techStack = document.getElementById('techStack').value;

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
            body: JSON.stringify({ idea, techStack }),
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
                featureCard.innerHTML += `
                    <p><a href="${repo.url}" target="_blank">${repo.name}</a> - ★ ${repo.stars}</p>
                `;
            });

            const videosForFeature = data.featureVideos[feature];
            featureCard.innerHTML += '<p>YouTube Videos:</p>';
            videosForFeature.forEach(video => {
                featureCard.innerHTML += `
                    <p><a href="${video.url}" target="_blank">${video.title}</a></p>
                `;
            });

            const codeForFeature = data.featureCodes[feature];
            featureCard.innerHTML += `
                <h4>Code Snippet:</h4>
                <pre>${codeForFeature}</pre>
            `;

            featureDetailsDiv.appendChild(featureCard);
        });
    } catch (error) {
        alert('Error generating project data.');
        console.error(error);
    }
});
