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

        // Project Repositories
        projectReposDiv.innerHTML = '<h3>GitHub Repositories</h3>';
        data.wholeProjectRepos.forEach(repo => {
            const repoDiv = document.createElement('div');
            repoDiv.innerHTML = `<a href="${repo.url}" target="_blank">${repo.name}</a> - ★ ${repo.stars}`;
            projectReposDiv.appendChild(repoDiv);
        });

        // Project Videos
        projectVideosDiv.innerHTML = '<h3>YouTube Videos</h3>';
        data.wholeProjectVideos.forEach(video => {
            const videoDiv = document.createElement('div');
            videoDiv.innerHTML = `<a href="${video.url}" target="_blank">${video.title}</a> - ${video.channel}`;
            projectVideosDiv.appendChild(videoDiv);
        });

        // Feature Details
        featureDetailsDiv.innerHTML = '<h3>Features</h3>';
        data.features.forEach(feature => {
            const featureDiv = document.createElement('div');
            featureDiv.innerHTML = `<h4>${feature}</h4>`;

            const reposForFeature = data.featureRepos[feature];
            const videosForFeature = data.featureVideos[feature];
            const codeForFeature = data.featureCodes[feature];

            featureDiv.innerHTML += '<h5>Repositories</h5>';
            reposForFeature.forEach(repo => {
                featureDiv.innerHTML += `<div><a href="${repo.url}" target="_blank">${repo.name}</a> - ★ ${repo.stars}</div>`;
            });

            featureDiv.innerHTML += '<h5>Videos</h5>';
            videosForFeature.forEach(video => {
                featureDiv.innerHTML += `<div><a href="${video.url}" target="_blank">${video.title}</a> - ${video.channel}</div>`;
            });

            featureDiv.innerHTML += '<h5>Code Snippet</h5>';
            featureDiv.innerHTML += `<pre>${codeForFeature}</pre>`;

            featureDetailsDiv.appendChild(featureDiv);
        });
    } catch (error) {
        alert('Error generating project data.');
        console.error(error);
    }
});