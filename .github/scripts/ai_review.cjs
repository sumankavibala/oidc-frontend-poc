const fs = require('fs');

async function main() {
    const apiKey = process.env.FREE_AI_API_KEY;
    if (!apiKey) {
        console.error('Error: FREE_AI_API_KEY secret is missing!');
        process.exit(1);
    }

    let diffContent = 'No diff found.';
    try {
        if (fs.existsSync('pr_diff.txt')) {
            diffContent = fs.readFileSync('pr_diff.txt', 'utf8').slice(0, 12000);
        }
    } catch (err) {
        console.error('Error reading pr_diff.txt:', err);
    }

    const systemPrompt = 
        'You are an expert software engineer specializing in performance, efficiency, and resource optimization. ' +
        'Analyze the following Git diff. Ignore style or syntax unless it hurts performance. ' +
        'Focus entirely on finding algorithmic complexity bugs (Big O issues), heavy database/API loops, memory leaks, ' +
        'or missing caching opportunities. Provide a highly concise markdown summary with concrete suggestions.';

    const models = ['llama-3.1-8b-instant', 'llama3-8b-8192', 'llama-3.3-70b-versatile'];
    let response = null;

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    for (const model of models) {
        const payload = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Review this diff:\n\n${diffContent}` }
            ],
            temperature: 0.2
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`Calling Groq ${model} (Attempt ${attempt})...`);
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    response = await res.json();
                    break;
                } else if (res.status === 429) {
                    console.log(`429 Rate limited on Groq ${model}, retrying in ${attempt * 5}s...`);
                    await new Promise(r => setTimeout(r, attempt * 5000));
                } else {
                    const errText = await res.text();
                    console.log(`Error ${res.status} from Groq ${model}: ${errText}`);
                    break;
                }
            } catch (err) {
                console.error(`Request exception on ${model}:`, err.message);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (response && response.choices && response.choices[0]) {
            break;
        }
    }

    if (!response || !response.choices || !response.choices[0]) {
        console.error('API Error: Unable to fetch response from Groq API');
        const reportContent = 
            '⚠️ **AI Reviewer encountered an API error with Groq:**\n\n' +
            '*Note: Free tier rate limits may be temporarily exceeded. Please wait 1-2 minutes for rate limits to reset.*';
        fs.writeFileSync('review.md', reportContent, 'utf8');
        process.exit(0);
    }

    try {
        const reviewText = response.choices[0].message.content;
        fs.writeFileSync('review.md', '### ⚡ AI Code Efficiency Report\n\n' + reviewText, 'utf8');
    } catch (err) {
        console.error('Failed to parse API response:', err);
        fs.writeFileSync('review.md', '⚠️ **Failed to parse Groq AI Review response.**', 'utf8');
    }
}

main().catch(err => {
    console.error('Unhandled error in script:', err);
    process.exit(1);
});
