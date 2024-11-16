document.addEventListener("DOMContentLoaded", function () {
    const fetchCommentsButton = document.getElementById('fetchComments');
    const labelsContainer = document.getElementById('labels');
    let staticTotalComments = 0;

    // Set initial labels
    labelsContainer.innerHTML = `
        <p><strong>Total Comments:</strong> ${staticTotalComments}</p>
        <p><strong>Fetched Comments:</strong> 0</p>
        <p><strong>Positive Comments:</strong> 0</p>
        <p><strong>Negative Comments:</strong> 0</p>
        <p><strong>Neutral Comments:</strong> 0</p>
    `;

    fetchCommentsButton.addEventListener('click', function () {
        const videoId = document.getElementById('videoId').value;
        const apiKey = document.getElementById('apiKey').value;

        if (!videoId || !apiKey) {
            alert('Please enter both the YouTube Video ID and API Key');
            return;
        }

        // Fetch the total comment count once if it hasn't been set
        if (staticTotalComments === 0) {
            getTotalCommentCount(videoId, apiKey)
                .then(totalComments => {
                    staticTotalComments = totalComments;
                    updateLabels(); // Set initial static value
                    fetchAllComments(videoId, apiKey);
                })
                .catch(error => console.error('Error fetching video details:', error));
        } else {
            fetchAllComments(videoId, apiKey);
        }
    });

    function getTotalCommentCount(videoId, apiKey) {
        const apiURL = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;
        return fetch(apiURL)
            .then(response => response.json())
            .then(data => {
                if (data.items.length > 0) {
                    return data.items[0].statistics.commentCount;
                } else {
                    throw new Error('Video not found or invalid API key.');
                }
            });
    }

    function fetchAllComments(videoId, apiKey, pageToken = "", allComments = []) {
        let apiURL = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${apiKey}&maxResults=100`;
        if (pageToken) apiURL += `&pageToken=${pageToken}`;

        fetch(apiURL)
            .then(response => response.json())
            .then(data => {
                const comments = data.items.map(item => item.snippet.topLevelComment.snippet.textDisplay);
                allComments.push(...comments);

                if (data.nextPageToken) {
                    fetchAllComments(videoId, apiKey, data.nextPageToken, allComments);
                } else {
                    analyzeComments(allComments);
                }
            })
            .catch(error => {
                console.error('Error fetching comments from YouTube API:', error);
                alert('Failed to fetch comments. Please check the Video ID and API Key.');
            });
    }

    function analyzeComments(comments) {
        fetch('http://127.0.0.1:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comments: comments })
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);

            // Update fetched and sentiment-specific labels, keeping Total Comments static
            updateLabels(data.sentiments, comments.length);
            clearChartContainer('sentimentChart');
            clearChartContainer('queryChart');
            clearChartContainer('lengthChart');

            plotSentimentDistribution(data.sentiments);
            plotQueryDistribution(data.query_flags);
            plotLengthDistribution(data.comment_lengths);
        })
        .catch(error => console.error('Error analyzing comments:', error));
    }

    function updateLabels(sentiments = [], fetchedComments = 0) {
        const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0 };
        sentiments.forEach(sentiment => sentimentCounts[sentiment]++);

        // Display the static total comments and update fetched and specific sentiment counts
        labelsContainer.innerHTML = `
            <p><strong>Total Comments:</strong> ${staticTotalComments}</p>
            <p><strong>Fetched Comments:</strong> ${fetchedComments}</p>
            <p><strong>Positive Comments:</strong> ${sentimentCounts.Positive}</p>
            <p><strong>Negative Comments:</strong> ${sentimentCounts.Negative}</p>
            <p><strong>Neutral Comments:</strong> ${sentimentCounts.Neutral}</p>
        `;
    }

    function clearChartContainer(chartId) {
        const chartContainer = document.getElementById(chartId);
        if (chartContainer) {
            chartContainer.remove();
        }
        const newCanvas = document.createElement('canvas');
        newCanvas.id = chartId;
        document.getElementById('charts').appendChild(newCanvas);
    }

    function plotSentimentDistribution(sentiments) {
        const ctx = document.getElementById('sentimentChart');
        const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0 };
        sentiments.forEach(sentiment => sentimentCounts[sentiment]++);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(sentimentCounts),
                datasets: [{
                    label: 'Sentiment Distribution',
                    data: Object.values(sentimentCounts),
                    backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function plotQueryDistribution(queryFlags) {
        const ctx = document.getElementById('queryChart');
        const queryCount = queryFlags.filter(flag => flag === true).length;
        const nonQueryCount = queryFlags.length - queryCount;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Query', 'Non-Query'],
                datasets: [{
                    label: 'Query vs Non-Query Comments',
                    data: [queryCount, nonQueryCount],
                    backgroundColor: ['#3498DB', '#F39C12'],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function plotLengthDistribution(commentLengths) {
        const ctx = document.getElementById('lengthChart');
        const binSize = 5;
        const bins = [];
        const binLabels = [];
        const maxLength = Math.max(...commentLengths);
        const minLength = Math.min(...commentLengths);

        for (let i = minLength; i <= maxLength; i += binSize) {
            bins.push(commentLengths.filter(length => length >= i && length < i + binSize).length);
            binLabels.push(`${i}-${i + binSize - 1}`);
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Comment Length Distribution',
                    data: bins,
                    backgroundColor: '#9b59b6',
                    borderColor: '#5e3370',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
});
