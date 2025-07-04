
document.addEventListener('DOMContentLoaded', () => {
    const generateStackBtn = document.getElementById('generateStackButton');
    const stackSection = document.getElementById('stackSection');
    const stackCards = document.getElementById('stackCards');
    const submitBtn = document.getElementById('submitButton');
    const form = document.getElementById('generateForm');
    const loader = document.getElementById('loader');
    const errorDiv = document.getElementById('error');
    const resultsSection = document.getElementById('results');
    const projectReposDiv = document.getElementById('projectRepos');
    const projectVideosDiv = document.getElementById('projectVideos');
    const featureDetailsDiv = document.getElementById('featureDetails');

    let selectedStack = '';
    let detectedStack = '';
    let suggestions = [];
    let projectTypeSelected = '';

    // Helper: Show/hide loader
    function showLoader(show, text="Loading...") {
        loader.innerHTML = show ? `<div class="spinner"></div><div class="loader-text">${text}</div>` : "";
        loader.classList.toggle('hidden', !show);
    }
    // Helper: Show error
    function showError(msg) {
        errorDiv.textContent = msg || '';
        if (msg) errorDiv.classList.remove('hidden');
        else errorDiv.classList.add('hidden');
    }

    // Change stack suggestion when projectType is changed
    document.querySelectorAll('input[name="projectType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            projectTypeSelected = radio.value;
            stackSection.style.display = 'none';
            stackCards.innerHTML = '';
            submitBtn.disabled = true;
            selectedStack = '';
        });
    });

    // Tech Stack Suggestion
    generateStackBtn.addEventListener('click', async () => {
        const idea = document.getElementById('idea').value.trim();
        const projectType = form.projectType.value;
        projectTypeSelected = projectType;

        showError('');
        stackSection.style.display = 'none';
        stackCards.innerHTML = '';
        submitBtn.disabled = true;
        selectedStack = '';

        if (!idea) {
            showError('Please enter a project idea.');
            return;
        }
        if (!projectType) {
            showError('Select project type.');
            return;
        }

        showLoader(true, "Finding best stacks...");
        try {
            const res = await fetch('/detect-techstack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, projectType }),
            });
            const data = await res.json();
            showLoader(false);

            if (data.error) {
                showError(data.error);
                return;
            }
            suggestions = (data.suggestions || []).filter(stack => {
                if (projectType === "Frontend") return /react|angular|vue|svelte|next|frontend|html|css|js/i.test(stack);
                if (projectType === "Backend") return /node|django|flask|spring|laravel|backend|express|api|python|java|php|ruby/i.test(stack);
                return true;
            });
            // Fallback if all filtered out
            if (!suggestions.length) suggestions = data.suggestions || [];
            detectedStack = data.detectedStack || '';
            // Render suggestions
            stackCards.innerHTML = '';
            suggestions.forEach((stack, idx) => {
                const card = document.createElement('div');
                card.className = 'stack-card';
                card.textContent = stack;
                card.addEventListener('click', () => {
                    document.querySelectorAll('.stack-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedStack = stack;
                    submitBtn.disabled = false;
                });
                stackCards.appendChild(card);
            });
            stackSection.style.display = 'block';
            showError('');
        } catch (err) {
            showLoader(false);
            showError('Failed to get tech stack. Try again.');
        }
    });

    // Project Generation
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');
        resultsSection.classList.add('hidden');
        projectReposDiv.innerHTML = '';
        projectVideosDiv.innerHTML = '';
        featureDetailsDiv.innerHTML = '';
        showLoader(true, "Generating project...");

        const idea = document.getElementById('idea').value.trim();
        const projectType = form.projectType.value;
        const techStack = selectedStack || detectedStack || '';

        if (!idea || !projectType || !techStack) {
            showLoader(false);
            showError('Please provide all inputs and select a tech stack.');
            return;
        }

        try {
            const res = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, techStack, projectType }),
            });
            const data = await res.json();
            showLoader(false);

            if (data.error) {
                showError(data.error);
                return;
            }

            // Render GitHub repos
            projectReposDiv.innerHTML = `<h3>GitHub Repositories</h3>`;
            if (data.wholeProjectRepos && data.wholeProjectRepos.length) {
                const repoList = document.createElement('div');
                repoList.className = 'repo-list';
                data.wholeProjectRepos.forEach(repo => {
                    repoList.innerHTML += `
                        <div class="repo-card">
                            <div class="repo-title"><a href="${repo.url}" target="_blank">${repo.full_name}</a></div>
                            <div>⭐ ${repo.stars} | Lang: ${repo.language || 'N/A'}</div>
                        </div>
                    `;
                });
                projectReposDiv.appendChild(repoList);
            } else {
                projectReposDiv.innerHTML += `<div>No relevant repos found.</div>`;
            }

            // Render YouTube videos
            projectVideosDiv.innerHTML = `<h3>YouTube Videos</h3>`;
            if (data.wholeProjectVideos && data.wholeProjectVideos.length) {
                const videoList = document.createElement('div');
                videoList.className = 'video-list';
                data.wholeProjectVideos.forEach(video => {
                    videoList.innerHTML += `
                        <div class="video-card">
                            <img class="video-thumb" src="${video.thumbnail}" alt="video">
                            <div class="video-title"><a href="${video.url}" target="_blank">${video.title}</a></div>
                            <div class="channel-info">${video.channel}</div>
                        </div>
                    `;
                });
                projectVideosDiv.appendChild(videoList);
            } else {
                projectVideosDiv.innerHTML += `<div>No videos found.</div>`;
            }

            // Render Features
            featureDetailsDiv.innerHTML = `<h3>Features</h3>`;
            if (data.features && data.features.length) {
                const accordion = document.createElement('div');
                accordion.className = 'feature-accordion';
                data.features.forEach((feature, idx) => {
                    const item = document.createElement('div');
                    item.className = 'feature-item';
                    item.innerHTML = `
                        <div class="feature-header">${feature}
                            <span style="font-size:1.2em;">&#8675;</span>
                        </div>
                        <div class="feature-content">
                            <div>
                                <strong>GitHub Examples:</strong>
                                <div class="repo-list">${
                                    (data.featureRepos[feature]||[]).map(repo => `
                                        <div class="repo-card">
                                            <div class="repo-title"><a href="${repo.url}" target="_blank">${repo.full_name}</a></div>
                                            <div>⭐ ${repo.stars} | Lang: ${repo.language || 'N/A'}</div>
                                        </div>
                                    `).join('') || 'None'
                                }</div>
                            </div>
                            <div style="margin:1rem 0 0.7rem 0;">
                                <strong>YouTube Guides:</strong>
                                <div class="video-list">${
                                    (data.featureVideos[feature]||[]).map(video => `
                                        <div class="video-card">
                                            <img class="video-thumb" src="${video.thumbnail}" alt="video">
                                            <div class="video-title"><a href="${video.url}" target="_blank">${video.title}</a></div>
                                            <div class="channel-info">${video.channel}</div>
                                        </div>
                                    `).join('') || 'None'
                                }</div>
                            </div>
                            <div style="margin-top:1rem;">
                                <strong>Sample Code:</strong>
                                <button class="copy-btn" data-feature="${feature}">Copy</button>
                                <pre class="code-block"><code class="language-javascript">${escapeHtml(data.featureCodes[feature]||'')}</code></pre>
                            </div>
                        </div>
                    `;
                    accordion.appendChild(item);
                });
                featureDetailsDiv.appendChild(accordion);
                // Accordion toggle
                document.querySelectorAll('.feature-header').forEach((hdr, i) => {
                    hdr.addEventListener('click', () => {
                        hdr.parentElement.classList.toggle('open');
                    });
                });
                // Copy code
                document.querySelectorAll('.copy-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const feature = btn.getAttribute('data-feature');
                        const code = btn.parentElement.querySelector('code').textContent;
                        navigator.clipboard.writeText(code);
                        btn.textContent = "Copied!";
                        setTimeout(() => btn.textContent = "Copy", 1200);
                    });
                });
                // Syntax highlight
                document.querySelectorAll('pre code').forEach(block => {
                    hljs.highlightElement(block);
                });
            } else {
                featureDetailsDiv.innerHTML += `<div>No features found.</div>`;
            }

            resultsSection.classList.remove('hidden');
        } catch (err) {
            showLoader(false);
            showError('Failed to generate project. Try again.');
        }
    });

    // Helper: HTML escape
    function escapeHtml(str) {
        return (str||'').replace(/[&<>"']/g, function(m) {
            return {
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
            }[m];
        });
    }
});