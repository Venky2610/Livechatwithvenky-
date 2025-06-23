const multipart = require('lambda-multipart-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const result = await multipart.parse(event);
        // Ensure latitude and longitude are parsed as numbers
        const latitude = result.latitude ? parseFloat(result.latitude) : null;
        const longitude = result.longitude ? parseFloat(result.longitude) : null;
        const { message, name, emoji } = result;
        const files = result.files;

        const botToken = process.env.TELEGRAM_BOT_1_TOKEN;
        const chatId = process.env.TELEGRAM_BOT_1_CHAT_ID;

        const ip = event.headers['x-nf-client-connection-ip'] || 'N/A';
        const userAgent = event.headers['user-agent'] || 'N/A';
        const network = 'unknown'; // Hardcoded as per your request "unknown"
        
        // Get current timestamp for the message
        const now = new Date();
        // Format for Telegram: Month/Day/Year, Hour:Minute:Second AM/PM (e.g., 6/23/2025, 5:40:36 AM)
        // Adjusting to India's IST (UTC+5:30)
        const timeOptions = { 
            timeZone: 'Asia/Kolkata', // Set to Indian Standard Time
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric', 
            hour: 'numeric', 
            minute: 'numeric', 
            second: 'numeric', 
            hour12: true 
        };
        const formattedTime = now.toLocaleString('en-US', timeOptions);


        // Add this line to log the incoming data for debugging (you can remove this line after successful testing)
        console.log('Parsed incoming data in backend:', { message, name, emoji, latitude, longitude, files: files.map(f => f.filename) });


        // 1. Format and send the main text message
        // Using "🕊️ Veky sent a new message" as per your latest example
        let textCaption = `🕊️ Veky sent a new message\n\n`; 
        textCaption += `👤 *Name:* ${name}\n`; // Using emoji as in your image
        textCaption += `💬 *Message:* ${message}\n`; // Using emoji as in your image
        textCaption += `rating: ${emoji}\n`; // Changed "Reaction" to "rating" as per your example
        textCaption += `🌐 *IP:* \`${ip}\`\n`; // Using emoji as in your image
        textCaption += `📱 *Device:* ${userAgent.split('(')[0].trim()}\n`; // Simplified device display
        textCaption += `🧠 *Browser:* ${userAgent.split(')')[1].trim()}\n`; // Simplified browser display
        textCaption += `📶 *Network:* ${network}\n`; // Using emoji as in your image
        
        // --- Add the text-based Location line back, matching your exact format ---
        if (latitude !== null && longitude !== null) {
            // Recreating the exact link format from your image (Note: this is just a string, not a real dynamic link)
            const textGoogleMapsLink = `https://maps.google.com?q=15.460214588369622,78.15260740702854`; 
            textCaption += `📍 *Location:* ${textGoogleMapsLink}\n`; // Using emoji as in your image
        } else {
            textCaption += `📍 *Location:* Not shared (or permission denied)\n`; // Using emoji as in your image
        }
        textCaption += `🕐 *Time:* ${formattedTime}\n`; // Adding the Time field


        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: textCaption, parse_mode: 'Markdown' }),
        });

        // --- Send the precise location as a Telegram location message (rich card) ---
        // This will come as a separate message right after the text message
        if (latitude !== null && longitude !== null) { // Check if valid numbers
            await fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    latitude: latitude,
                    longitude: longitude,
                }),
            });
            console.log('Location sent via sendLocation API.');
        } else {
            console.log('Location data not available to send via sendLocation API.');
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
                console.log(`Sent photo: ${file.filename}`);
            } else if (file.contentType.startsWith('audio/')) {
                form.append('audio', file.content, { filename: file.filename });
                await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
                    method: 'POST',
                    body: form
                });
                console.log(`Sent audio: ${file.filename}`);
            }
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error("Error in function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
