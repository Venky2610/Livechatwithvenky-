// This is a Node.js file, it runs on a server, not in the browser.
const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Get the data from the frontend
        const data = JSON.parse(event.body);
        const message = data.message || '';
        const name = data.name || 'Anonymous';
        const emoji = data.emoji || 'No reaction';

        // Get your secret bot token and chat ID from Netlify's environment variables
        const botToken = process.env.TELEGRAM_BOT_1_TOKEN;
        const chatId = process.env.TELEGRAM_BOT_1_CHAT_ID;
        
        // Get IP and other info from the request headers
        const ip = event.headers['x-nf-client-connection-ip'] || 'N/A';
        const userAgent = event.headers['user-agent'] || 'N/A';

        // Format the message to be sent to Telegram
        let text = `🔵 *New Anonymous Message* 🔵\n\n`;
        text += `*From:* ${name}\n`;
        text += `*Reaction:* ${emoji}\n\n`;
        text += `*Message:*\n${message}\n\n`;
        text += `--- *Technical Data* ---\n`;
        text += `*IP Address:* \`${ip}\`\n`;
        text += `*Device/Browser:* \`${userAgent}\``;

        // The URL for the Telegram Bot API
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        // Send the data to Telegram
        const telegramResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown'
            }),
        });

        if (!telegramResponse.ok) {
            throw new Error('Failed to send message to Telegram.');
        }

        // Return a success message to the frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};
