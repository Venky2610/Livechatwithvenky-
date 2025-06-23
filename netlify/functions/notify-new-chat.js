// ... (content of notify-new-chat.js as provided in the last full bundle)
const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        const { sessionId, userName, firstMessage } = data;

        // Get your secret bot 2 token and chat ID from Netlify's environment variables
        const botToken = process.env.TELEGRAM_BOT_2_TOKEN; 
        const chatId = process.env.TELEGRAM_BOT_2_CHAT_ID; 

        if (!botToken || !chatId) {
            console.error('Missing TELEGRAM_BOT_2_TOKEN or TELEGRAM_BOT_2_CHAT_ID environment variables.');
            return { statusCode: 500, body: 'Server configuration error.' };
        }

        // Get IP and other info from the request headers (passive data collection)
        const ip = event.headers['x-nf-client-connection-ip'] || 'N/A';
        const userAgent = event.headers['user-agent'] || 'N/A';
        const network = 'Unknown'; 

        // Construct the notification message
        let notificationText = `🔥 *New Live Chat Request!* 🔥\n\n`;
        notificationText += `*User:* ${userName}\n`;
        notificationText += `*Session ID:* \`${sessionId}\`\n`;
        notificationText += `*First Message:* "${firstMessage}"\n\n`;
        notificationText += `--- *Technical Data* ---\n`;
        notificationText += `*IP Address:* \`${ip}\`\n`;
        notificationText += `*Device/Browser:* \`${userAgent}\`\n`;
        notificationText += `*Network:* \`${network}\`\n\n`;
        notificationText += `Click here to reply: [Admin Panel Link Placeholder]`; 

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const telegramResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: notificationText,
                parse_mode: 'Markdown'
            }),
        });

        if (!telegramResponse.ok) {
            const errorBody = await telegramResponse.text();
            console.error(`Failed to send Telegram notification: ${telegramResponse.status} - ${errorBody}`);
            throw new Error('Failed to send Telegram notification.');
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error("Error in notify-new-chat function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
